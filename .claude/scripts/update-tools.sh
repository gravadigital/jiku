#!/bin/bash
# Grava Workflow - Update Tools Script
# Este script maneja la actualización de las herramientas de forma consistente

set -e

REPO_URL="git@git.grava.io:herramientas/grava-workflow.git"
TMP_DIR="/tmp/grava-workflow-update"
BACKUP_DIR="/tmp/grava-workflow-backups"
VERSION_FILE=".claude/VERSION"
CHANGELOG_FILE=".claude/CHANGELOG.md"

# Archivos protegidos dentro de .claude/ que NUNCA se deben sobrescribir ni eliminar
PROTECTED_FILES=("settings.local.json" "local-config.yaml" ".grava-version")

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Funciones de utilidad
log_info() { echo -e "${BLUE}ℹ${NC} $1"; }
log_success() { echo -e "${GREEN}✅${NC} $1"; }
log_warning() { echo -e "${YELLOW}⚠️${NC} $1"; }
log_error() { echo -e "${RED}❌${NC} $1"; }

# Obtener versión local
get_local_version() {
    if [ -f "$VERSION_FILE" ]; then
        cat "$VERSION_FILE" | tr -d '[:space:]'
    else
        echo "0.0.0"
    fi
}

# Obtener versión remota
get_remote_version() {
    if [ -f "$TMP_DIR/$VERSION_FILE" ]; then
        cat "$TMP_DIR/$VERSION_FILE" | tr -d '[:space:]'
    else
        echo "unknown"
    fi
}

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

# Clonar repositorio remoto
clone_remote() {
    log_info "Descargando última versión..."
    rm -rf "$TMP_DIR"
    if ! git clone --depth 1 "$REPO_URL" "$TMP_DIR" 2>/dev/null; then
        log_error "No se pudo clonar el repositorio"
        exit 1
    fi
    log_success "Repositorio clonado"
}

# Verificar si un archivo está protegido
is_protected() {
    local file=$1
    local basename=$(basename "$file")
    for protected in "${PROTECTED_FILES[@]}"; do
        if [ "$basename" = "$protected" ]; then
            return 0
        fi
    done
    return 1
}

# Detectar archivos modificados localmente
detect_local_modifications() {
    local modified_files=()
    local local_only_files=()
    local protected_files=()

    # Comparar archivos que existen en ambos
    if [ -d ".claude" ] && [ -d "$TMP_DIR/.claude" ]; then
        while IFS= read -r -d '' file; do
            local rel_path="${file#.claude/}"
            local remote_file="$TMP_DIR/.claude/$rel_path"

            # Ignorar archivos temporales
            if [[ "$rel_path" == *.bkp ]]; then
                continue
            fi

            # Detectar archivos protegidos
            if is_protected "$rel_path"; then
                protected_files+=("$rel_path")
                continue
            fi

            if [ -f "$remote_file" ]; then
                if ! diff -q "$file" "$remote_file" > /dev/null 2>&1; then
                    modified_files+=("$rel_path")
                fi
            else
                local_only_files+=("$rel_path")
            fi
        done < <(find .claude -type f -print0 2>/dev/null)
    fi

    # Output como JSON-like para fácil parsing
    echo "MODIFIED:"
    printf '%s\n' "${modified_files[@]}"
    echo "LOCAL_ONLY:"
    printf '%s\n' "${local_only_files[@]}"
    echo "PROTECTED:"
    printf '%s\n' "${protected_files[@]}"
}

# Crear backup
create_backup() {
    local version=$1
    local timestamp=$(date +%Y%m%d-%H%M%S)
    local backup_name="backup-${timestamp}-v${version}"
    local backup_path="${BACKUP_DIR}/${backup_name}"

    mkdir -p "$BACKUP_DIR"

    if [ -d ".claude" ]; then
        cp -r .claude "$backup_path"
        log_success "Backup creado: $backup_path"
        echo "$backup_path"
    else
        log_warning "No existe .claude/ para hacer backup"
        echo ""
    fi
}

# Realizar actualización completa (sobrescribe todo excepto archivos protegidos)
update_full() {
    log_info "Actualizando todos los archivos..."

    # Guardar archivos protegidos
    local protected_tmp="/tmp/grava-protected-temp"
    rm -rf "$protected_tmp"
    mkdir -p "$protected_tmp"

    for protected in "${PROTECTED_FILES[@]}"; do
        if [ -f ".claude/$protected" ]; then
            cp ".claude/$protected" "$protected_tmp/$protected"
            log_info "Protegiendo: $protected"
        fi
    done

    # Reemplazar .claude
    rm -rf .claude
    cp -r "$TMP_DIR/.claude" .claude

    # Restaurar archivos protegidos
    for protected in "${PROTECTED_FILES[@]}"; do
        if [ -f "$protected_tmp/$protected" ]; then
            cp "$protected_tmp/$protected" ".claude/$protected"
            log_success "Restaurado: $protected"
        fi
    done

    rm -rf "$protected_tmp"
    log_success "Actualización completa realizada"
}

# Realizar actualización preservando archivos modificados
# Los archivos modificados localmente se guardan como .bkp
# Los archivos nuevos quedan con el nombre original
# Los archivos protegidos SIEMPRE se preservan
update_preserve() {
    local -a files_to_preserve=("$@")

    log_info "Actualizando preservando archivos modificados..."

    # Crear directorio temporal para preservar archivos modificados
    local preserve_tmp="/tmp/grava-preserve-temp"
    rm -rf "$preserve_tmp"
    mkdir -p "$preserve_tmp"

    # Guardar archivos protegidos primero (siempre se preservan)
    local protected_tmp="/tmp/grava-protected-temp"
    rm -rf "$protected_tmp"
    mkdir -p "$protected_tmp"

    for protected in "${PROTECTED_FILES[@]}"; do
        if [ -f ".claude/$protected" ]; then
            cp ".claude/$protected" "$protected_tmp/$protected"
            log_info "Protegiendo: $protected"
        fi
    done

    # Copiar archivos modificados a preservar
    for file in "${files_to_preserve[@]}"; do
        if [ -n "$file" ] && [ -f ".claude/$file" ]; then
            mkdir -p "$preserve_tmp/$(dirname "$file")"
            cp ".claude/$file" "$preserve_tmp/$file"
        fi
    done

    # Reemplazar .claude con la nueva versión
    rm -rf .claude
    cp -r "$TMP_DIR/.claude" .claude

    # Restaurar archivos protegidos (siempre)
    for protected in "${PROTECTED_FILES[@]}"; do
        if [ -f "$protected_tmp/$protected" ]; then
            cp "$protected_tmp/$protected" ".claude/$protected"
            log_success "Restaurado: $protected"
        fi
    done
    rm -rf "$protected_tmp"

    # Guardar archivos modificados como .bkp donde hay conflictos
    local conflicts=()
    for file in "${files_to_preserve[@]}"; do
        if [ -n "$file" ] && [ -f "$preserve_tmp/$file" ]; then
            if [ -f ".claude/$file" ]; then
                # Archivo existe en nueva versión - verificar si hay diferencias
                if ! diff -q "$preserve_tmp/$file" ".claude/$file" > /dev/null 2>&1; then
                    # Hay diferencias - guardar versión modificada del usuario como .bkp
                    cp "$preserve_tmp/$file" ".claude/${file}.bkp"
                    conflicts+=("$file")
                fi
                # El archivo nuevo queda con el nombre original
            else
                # Archivo no existe en nueva versión - restaurar archivo local
                mkdir -p ".claude/$(dirname "$file")"
                cp "$preserve_tmp/$file" ".claude/$file"
            fi
        fi
    done

    rm -rf "$preserve_tmp"

    # Reportar conflictos
    if [ ${#conflicts[@]} -gt 0 ]; then
        echo "CONFLICTS:"
        printf '%s\n' "${conflicts[@]}"
    fi

    log_success "Actualización con preservación realizada"
}

# Verificar actualización
verify_update() {
    local expected_version=$1
    local errors=0

    log_info "Verificando actualización..."

    # Verificar versión
    local actual_version=$(get_local_version)
    if [ "$actual_version" != "$expected_version" ]; then
        log_error "Versión no coincide: esperada $expected_version, actual $actual_version"
        ((errors++))
    fi

    # Verificar archivos críticos
    local critical_files=(".claude/utils/index.md" ".claude/CHANGELOG.md")
    for file in "${critical_files[@]}"; do
        if [ ! -f "$file" ]; then
            log_warning "Archivo crítico faltante: $file"
            ((errors++))
        fi
    done

    # Verificar que los hooks sean ejecutables
    if [ -d ".claude/hooks" ]; then
        for hook in .claude/hooks/*.sh; do
            if [ -f "$hook" ] && [ ! -x "$hook" ]; then
                log_info "Haciendo ejecutable: $hook"
                chmod +x "$hook"
            fi
        done
        log_success "Hooks verificados"
    fi

    if [ $errors -eq 0 ]; then
        log_success "Verificación completada sin errores"
        return 0
    else
        log_warning "Verificación completada con $errors advertencias"
        return 1
    fi
}

# Limpiar archivos temporales
cleanup() {
    rm -rf "$TMP_DIR"
    rm -rf "/tmp/grava-preserve-temp"
    rm -rf "$BACKUP_DIR"
}

# Mostrar changelog entre versiones
show_changelog() {
    local from_version=$1
    local to_version=$2

    if [ -f "$TMP_DIR/$CHANGELOG_FILE" ]; then
        cat "$TMP_DIR/$CHANGELOG_FILE"
    else
        log_warning "No se encontró CHANGELOG"
    fi
}

# Ejecutar migraciones
run_migrations() {
    if [ -f ".claude/scripts/migrate.sh" ]; then
        log_info "Ejecutando migraciones..."
        bash .claude/scripts/migrate.sh
    else
        log_warning "Script de migración no encontrado, omitiendo migraciones"
    fi
}

# Comandos disponibles
case "${1:-help}" in
    "check-version")
        echo "LOCAL_VERSION:$(get_local_version)"
        ;;

    "fetch-remote")
        clone_remote
        echo "REMOTE_VERSION:$(get_remote_version)"
        ;;

    "compare")
        local_v=$(get_local_version)
        remote_v=$(get_remote_version)
        result=$(compare_versions "$local_v" "$remote_v")
        echo "LOCAL_VERSION:$local_v"
        echo "REMOTE_VERSION:$remote_v"
        echo "COMPARISON:$result"  # 0=igual, 1=local mayor, 2=remota mayor
        ;;

    "detect-changes")
        detect_local_modifications
        ;;

    "backup")
        version=${2:-$(get_local_version)}
        create_backup "$version"
        ;;

    "update-full")
        update_full
        ;;

    "update-preserve")
        shift
        update_preserve "$@"
        ;;

    "verify")
        expected_version=${2:-$(get_remote_version)}
        verify_update "$expected_version"
        ;;

    "migrate")
        run_migrations
        ;;

    "changelog")
        from_version=${2:-$(get_local_version)}
        to_version=${3:-$(get_remote_version)}
        show_changelog "$from_version" "$to_version"
        ;;

    "cleanup")
        cleanup
        log_success "Archivos temporales eliminados"
        ;;

    "help"|*)
        echo "Grava Workflow Update Script"
        echo ""
        echo "Uso: $0 <comando> [args]"
        echo ""
        echo "Comandos:"
        echo "  check-version          Mostrar versión local instalada"
        echo "  fetch-remote           Clonar repositorio remoto"
        echo "  compare                Comparar versiones local y remota"
        echo "  detect-changes         Detectar archivos modificados localmente"
        echo "  backup [version]       Crear backup de .claude/"
        echo "  update-full            Actualizar sobrescribiendo todo"
        echo "  update-preserve [files] Actualizar preservando archivos especificados"
        echo "  verify [version]       Verificar que la actualización fue exitosa"
        echo "  migrate                Ejecutar migraciones pendientes"
        echo "  changelog [from] [to]  Mostrar changelog entre versiones"
        echo "  cleanup                Eliminar archivos temporales"
        echo "  help                   Mostrar esta ayuda"
        ;;
esac
