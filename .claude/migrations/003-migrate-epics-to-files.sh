#!/bin/bash
# Migration: 003-migrate-epics-to-files
# From version: 1.10.0
# To version: 1.11.0
# Description: Migrates epics from docs/prd/epic-list.md to individual files in docs/epics/

TARGET_VERSION="1.11.0"

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

log_info() { echo -e "${BLUE}  ℹ${NC} $1"; }
log_success() { echo -e "${GREEN}  ✅${NC} $1"; }
log_warning() { echo -e "${YELLOW}  ⚠️${NC} $1"; }
log_error() { echo -e "${RED}  ❌${NC} $1"; }

# Función para convertir título a slug (para nombre de archivo)
slugify() {
    echo "$1" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//' | sed 's/-$//'
}

# Main migration logic
main() {
    local epic_list_file="docs/prd/epic-list.md"
    local epics_folder="docs/epics"

    # Verificar si existe el archivo epic-list.md
    if [ ! -f "$epic_list_file" ]; then
        log_info "No se encontró $epic_list_file, no hay nada que migrar"
        return 0
    fi

    # Verificar si ya existen archivos en docs/epics/
    if [ -d "$epics_folder" ] && [ "$(ls -A $epics_folder 2>/dev/null)" ]; then
        log_warning "Ya existen archivos en $epics_folder"
        log_warning "Verificando si la migración ya fue aplicada..."

        # Contar epics en el archivo original vs archivos existentes
        local epic_count_file=$(grep -c "^## Epic" "$epic_list_file" 2>/dev/null || echo "0")
        local epic_count_folder=$(ls -1 "$epics_folder"/*.md 2>/dev/null | wc -l)

        if [ "$epic_count_folder" -ge "$epic_count_file" ]; then
            log_info "Los archivos de epics ya existen ($epic_count_folder archivos). Omitiendo migración."
            return 0
        fi
    fi

    log_info "Migrando epics desde $epic_list_file a archivos individuales..."

    # Crear directorio de epics si no existe
    mkdir -p "$epics_folder"

    # Variables para parsear el archivo
    local current_epic_num=""
    local current_epic_title=""
    local current_epic_content=""
    local in_epic=false
    local epics_migrated=0

    # Leer el archivo línea por línea
    while IFS= read -r line || [ -n "$line" ]; do
        # Detectar inicio de nueva epic (## Epic N: Título)
        if [[ "$line" =~ ^##[[:space:]]+Epic[[:space:]]+([0-9]+):[[:space:]]*(.+)$ ]]; then
            # Si ya teníamos una epic en proceso, guardarla
            if [ "$in_epic" = true ] && [ -n "$current_epic_num" ]; then
                save_epic "$current_epic_num" "$current_epic_title" "$current_epic_content"
                ((epics_migrated++))
            fi

            # Iniciar nueva epic
            current_epic_num="${BASH_REMATCH[1]}"
            current_epic_title="${BASH_REMATCH[2]}"
            current_epic_content=""
            in_epic=true
            log_info "Procesando Epic $current_epic_num: $current_epic_title"
        elif [ "$in_epic" = true ]; then
            # Acumular contenido de la epic actual
            current_epic_content+="$line"$'\n'
        fi
    done < "$epic_list_file"

    # Guardar la última epic
    if [ "$in_epic" = true ] && [ -n "$current_epic_num" ]; then
        save_epic "$current_epic_num" "$current_epic_title" "$current_epic_content"
        ((epics_migrated++))
    fi

    if [ "$epics_migrated" -eq 0 ]; then
        log_warning "No se encontraron epics en formato esperado en $epic_list_file"
        log_info "Formato esperado: '## Epic N: Título de la Epic'"
        return 0
    fi

    log_success "Se migraron $epics_migrated epics a $epics_folder/"

    # Eliminar referencias a epics del índice del PRD
    remove_epic_references_from_prd_index

    # Preguntar si eliminar el archivo original
    log_info "El archivo original $epic_list_file se mantiene como respaldo"
    log_info "Puedes eliminarlo manualmente después de verificar la migración"

    log_success "Migración completada exitosamente"
}

# Función para guardar una epic individual
save_epic() {
    local epic_num="$1"
    local epic_title="$2"
    local epic_content="$3"

    local title_slug=$(slugify "$epic_title")
    local filename="docs/epics/${epic_num}.${title_slug}.md"

    # Extraer secciones del contenido original
    local description=""
    local acceptance_criteria=""
    local out_of_scope=""
    local technical_notes=""
    local current_section=""

    while IFS= read -r line; do
        # Detectar secciones por encabezados ### o patrones conocidos
        if [[ "$line" =~ ^###[[:space:]]+Descripci[oó]n ]] || [[ "$line" =~ ^###[[:space:]]+Description ]]; then
            current_section="description"
        elif [[ "$line" =~ ^###[[:space:]]+Criterios ]] || [[ "$line" =~ ^###[[:space:]]+Acceptance ]]; then
            current_section="acceptance"
        elif [[ "$line" =~ ^###[[:space:]]+Fuera ]] || [[ "$line" =~ ^###[[:space:]]+Out[[:space:]]of ]]; then
            current_section="outofscope"
        elif [[ "$line" =~ ^###[[:space:]]+Notas ]] || [[ "$line" =~ ^###[[:space:]]+Technical ]]; then
            current_section="technical"
        elif [[ "$line" =~ ^### ]]; then
            # Otra sección desconocida, añadir a notas técnicas
            current_section="technical"
            technical_notes+="$line"$'\n'
        else
            # Agregar línea a la sección actual
            case "$current_section" in
                "description") description+="$line"$'\n' ;;
                "acceptance") acceptance_criteria+="$line"$'\n' ;;
                "outofscope") out_of_scope+="$line"$'\n' ;;
                "technical") technical_notes+="$line"$'\n' ;;
                *)
                    # Si no hay sección definida, asumir descripción
                    if [ -n "$line" ]; then
                        description+="$line"$'\n'
                    fi
                    ;;
            esac
        fi
    done <<< "$epic_content"

    # Limpiar espacios en blanco extra
    description=$(echo "$description" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
    acceptance_criteria=$(echo "$acceptance_criteria" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
    out_of_scope=$(echo "$out_of_scope" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
    technical_notes=$(echo "$technical_notes" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')

    # Valores por defecto si están vacíos
    [ -z "$description" ] && description="(Migrado desde epic-list.md - completar descripción)"
    [ -z "$acceptance_criteria" ] && acceptance_criteria="(Migrado desde epic-list.md - completar criterios de aceptación)"
    [ -z "$out_of_scope" ] && out_of_scope="(Migrado desde epic-list.md - definir qué está fuera de alcance)"

    # Crear archivo con el nuevo formato
    cat > "$filename" << EOF
# Epic ${epic_num}: ${epic_title}

## Status

Draft

## Descripción

${description}

## Criterios de Aceptación

${acceptance_criteria}

## Fuera de Alcance

${out_of_scope}

## Notas Técnicas

${technical_notes:-"(Sin notas técnicas)"}
EOF

    log_success "  Creado: $filename"
}

# Función para eliminar referencias a epics del índice del PRD
remove_epic_references_from_prd_index() {
    local prd_index="docs/prd/index.md"

    if [ ! -f "$prd_index" ]; then
        log_info "No se encontró $prd_index, omitiendo limpieza de índice"
        return 0
    fi

    # Verificar si tiene referencias a epic-list.md
    if ! grep -q "epic-list" "$prd_index"; then
        log_info "El índice del PRD no tiene referencias a epic-list.md"
        return 0
    fi

    log_info "Eliminando referencias a epics del índice del PRD..."

    # Crear archivo temporal sin las líneas que referencian epic-list
    local temp_file="${prd_index}.tmp"
    grep -v "epic-list" "$prd_index" > "$temp_file"

    # Reemplazar archivo original
    mv "$temp_file" "$prd_index"

    log_success "Eliminadas referencias a epic-list.md del índice del PRD"
}

# Ejecutar migración
main
