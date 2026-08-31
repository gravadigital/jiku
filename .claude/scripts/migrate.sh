#!/bin/bash
# Grava Workflow - Migration Script
# Ejecuta migraciones automáticas al actualizar versiones

set -e

VERSION_FILE=".claude/.grava-version"
WORKFLOW_VERSION_FILE=".claude/VERSION"
MIGRATIONS_DIR=".claude/migrations"

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Funciones de utilidad
log_info() { echo -e "${BLUE}ℹ${NC} $1" >&2; }
log_success() { echo -e "${GREEN}✅${NC} $1" >&2; }
log_warning() { echo -e "${YELLOW}⚠️${NC} $1" >&2; }
log_error() { echo -e "${RED}❌${NC} $1" >&2; }
log_migrate() { echo -e "${CYAN}🔄${NC} $1" >&2; }

# Comparar versiones semánticas
# Retorna: 0 si iguales, 1 si v1 > v2, 2 si v1 < v2
compare_versions() {
    local v1=$1
    local v2=$2

    if [ "$v1" = "$v2" ]; then
        echo "0"
        return
    fi

    local IFS='.'
    read -ra V1_PARTS <<< "$v1"
    read -ra V2_PARTS <<< "$v2"

    for i in 0 1 2; do
        local n1=${V1_PARTS[$i]:-0}
        local n2=${V2_PARTS[$i]:-0}
        if [ "$n1" -gt "$n2" ]; then
            echo "1"
            return
        elif [ "$n1" -lt "$n2" ]; then
            echo "2"
            return
        fi
    done
    echo "0"
}

# Detectar versión del proyecto automáticamente
detect_project_version() {
    # Si tiene story-plans, es >= 1.6.0
    if [ -d "docs/story-plans" ]; then
        echo "1.6.0"
        return
    fi

    # Si tiene tasks con estructura vieja, es 1.5.0
    if [ -d "docs/tasks" ]; then
        echo "1.5.0"
        return
    fi

    # Proyecto nuevo, usar versión actual del workflow
    if [ -f "$WORKFLOW_VERSION_FILE" ]; then
        cat "$WORKFLOW_VERSION_FILE" | tr -d '[:space:]'
    else
        echo "1.0.0"
    fi
}

# Obtener o crear .grava-version
get_or_create_project_version() {
    if [ -f "$VERSION_FILE" ]; then
        cat "$VERSION_FILE" | tr -d '[:space:]'
    else
        local detected_version=$(detect_project_version)
        log_info "Detectada estructura de proyecto: v$detected_version"
        echo "$detected_version" > "$VERSION_FILE"
        log_success "Creado $VERSION_FILE con versión $detected_version"
        echo "$detected_version"
    fi
}

# Obtener versión target (del workflow)
get_target_version() {
    if [ -f "$WORKFLOW_VERSION_FILE" ]; then
        cat "$WORKFLOW_VERSION_FILE" | tr -d '[:space:]'
    else
        log_error "No se encontró $WORKFLOW_VERSION_FILE"
        exit 1
    fi
}

# Ejecutar migración
run_migration() {
    local migration_file=$1
    local migration_name=$(basename "$migration_file" .sh)

    log_migrate "Ejecutando migración: $migration_name"

    # Ejecutar en un proceso hijo, NO con source.
    # Cada migración define su propia TARGET_VERSION y sus propios log_*; con
    # source esas definiciones pisaban las del orquestador y truncaban el rango
    # de migraciones (solo corría la primera de la cadena).
    # bash (y no un subshell) además evita que las migraciones hereden `set -e`,
    # que no fueron escritas para tolerar.
    if bash "$migration_file"; then
        log_success "Migración $migration_name completada"
        return 0
    else
        log_error "Migración $migration_name falló"
        return 1
    fi
}

# Main execution
main() {
    log_info "Iniciando sistema de migraciones..."

    # Obtener versiones
    PROJECT_VERSION=$(get_or_create_project_version)
    # Nombre propio del orquestador: ninguna migración puede pisarlo.
    WORKFLOW_TARGET=$(get_target_version)

    log_info "Versión del proyecto: v$PROJECT_VERSION"
    log_info "Versión target: v$WORKFLOW_TARGET"

    # Comparar versiones
    COMPARISON=$(compare_versions "$PROJECT_VERSION" "$WORKFLOW_TARGET")

    if [ "$COMPARISON" = "0" ]; then
        log_success "El proyecto ya está en la versión más reciente"
        exit 0
    elif [ "$COMPARISON" = "1" ]; then
        log_warning "La versión del proyecto ($PROJECT_VERSION) es mayor que la del workflow ($WORKFLOW_TARGET)"
        log_warning "No se ejecutarán migraciones"
        exit 0
    fi

    # Buscar y ejecutar migraciones necesarias
    MIGRATIONS_EXECUTED=0
    MIGRATIONS_FAILED=0

    if [ ! -d "$MIGRATIONS_DIR" ]; then
        log_info "No hay migraciones disponibles"
        # Actualizar versión directamente
        echo "$WORKFLOW_TARGET" > "$VERSION_FILE"
        log_success "Versión actualizada a v$WORKFLOW_TARGET"
        exit 0
    fi

    # Iterar sobre todas las migraciones en orden
    for migration_file in "$MIGRATIONS_DIR"/[0-9][0-9][0-9]-*.sh; do
        [ -f "$migration_file" ] || continue

        # Extraer TARGET_VERSION del script
        MIGRATION_TARGET=$(grep "^TARGET_VERSION=" "$migration_file" | cut -d'"' -f2 | cut -d"'" -f2)

        if [ -z "$MIGRATION_TARGET" ]; then
            log_warning "Migración $(basename "$migration_file") no tiene TARGET_VERSION definida, omitiendo..."
            continue
        fi

        # Verificar si necesitamos ejecutar esta migración
        # La ejecutamos si: PROJECT_VERSION < MIGRATION_TARGET <= WORKFLOW_TARGET
        COMP_PROJECT=$(compare_versions "$PROJECT_VERSION" "$MIGRATION_TARGET")
        COMP_TARGET=$(compare_versions "$MIGRATION_TARGET" "$WORKFLOW_TARGET")

        if [ "$COMP_PROJECT" = "2" ] && { [ "$COMP_TARGET" = "2" ] || [ "$COMP_TARGET" = "0" ]; }; then
            if run_migration "$migration_file"; then
                MIGRATIONS_EXECUTED=$((MIGRATIONS_EXECUTED + 1))
            else
                MIGRATIONS_FAILED=$((MIGRATIONS_FAILED + 1))
                log_error "Migración falló, deteniendo proceso"
                exit 1
            fi
        fi
    done

    # Detectar migraciones de agente pendientes (.md).
    # Se hace ANTES de mover .grava-version para que el rango sea el real
    # recorrido en esta corrida.
    detect_agent_migrations "$PROJECT_VERSION" "$WORKFLOW_TARGET"

    # Actualizar .grava-version al target
    echo "$WORKFLOW_TARGET" > "$VERSION_FILE"

    # Salvaguarda: si la versión final no alcanzó el target, avisar en vez de
    # dejar un .grava-version que miente sobre el estado real.
    FINAL_VERSION=$(cat "$VERSION_FILE" | tr -d '[:space:]')
    if [ "$(compare_versions "$FINAL_VERSION" "$WORKFLOW_TARGET")" != "0" ]; then
        log_warning "La versión final ($FINAL_VERSION) no alcanzó el target ($WORKFLOW_TARGET) — revisar migraciones omitidas"
    fi

    # Resumen
    echo ""
    if [ $MIGRATIONS_EXECUTED -gt 0 ]; then
        log_success "✨ Migraciones completadas: $MIGRATIONS_EXECUTED"
        log_success "📦 Versión actualizada: v$PROJECT_VERSION → v$WORKFLOW_TARGET"
    else
        log_info "No había migraciones pendientes"
        log_success "📦 Versión actualizada a v$WORKFLOW_TARGET"
    fi
}

# Detectar migraciones de agente (.md) que corresponde ejecutar
detect_agent_migrations() {
    local from_version=$1
    local to_version=$2
    local pending_file=".claude/agent-migrations-pending.md"
    local pending=()

    if [ ! -d "$MIGRATIONS_DIR" ]; then
        return 0
    fi

    # Solo los archivos con el naming de migración (NNN-*.md). Un *.md suelto en
    # la carpeta —el README, por ejemplo, que documenta el formato del frontmatter
    # dentro de un bloque de código— matcheaba el grep de target_version y entraba
    # a la lista de pendientes como si fuera una migración.
    for migration_file in "$MIGRATIONS_DIR"/[0-9][0-9][0-9]-*.md; do
        [ -f "$migration_file" ] || continue

        # Extraer TARGET_VERSION del frontmatter
        MIGRATION_TARGET=$(grep "^target_version:" "$migration_file" | sed 's/target_version: *"//' | sed 's/".*//' | tr -d '[:space:]')

        if [ -z "$MIGRATION_TARGET" ]; then
            continue
        fi

        # Ejecutar si: from_version < MIGRATION_TARGET <= to_version
        COMP_FROM=$(compare_versions "$from_version" "$MIGRATION_TARGET")
        COMP_TO=$(compare_versions "$MIGRATION_TARGET" "$to_version")

        if [ "$COMP_FROM" = "2" ] && { [ "$COMP_TO" = "2" ] || [ "$COMP_TO" = "0" ]; }; then
            pending+=("$migration_file")
        elif [ -f "$pending_file" ] && grep -q "file: $migration_file$" "$pending_file"; then
            # Ya estaba pendiente de una corrida anterior y el agente todavía no
            # la ejecutó (el archivo sigue existiendo): se arrastra.
            # Sin esto, una corrida posterior reescribía el archivo con un rango
            # más nuevo y descartaba en silencio migraciones nunca aplicadas.
            pending+=("$migration_file")
        fi
    done

    # Generar archivo de pendientes si hay alguna
    if [ ${#pending[@]} -gt 0 ]; then
        # Deduplicar y ordenar por nombre de migración
        IFS=$'\n' read -r -d '' -a pending < <(printf '%s\n' "${pending[@]}" | sort -u && printf '\0')
        {
            echo "# Agent Migrations Pending"
            echo ""
            echo "Las siguientes migraciones requieren ser ejecutadas por el agente:"
            echo ""
            for f in "${pending[@]}"; do
                name=$(basename "$f" .md)
                desc=$(grep "^description:" "$f" | sed 's/description: *"//' | sed 's/".*//')
                echo "- **$name**: $desc"
                echo "  file: $f"
            done
        } > "$pending_file"
        log_warning "Migraciones de agente pendientes: ${#pending[@]} (ver $pending_file)"
    else
        # Limpiar archivo si no hay pendientes
        rm -f "$pending_file"
    fi
}

# Ejecutar main
main
