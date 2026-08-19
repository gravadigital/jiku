#!/bin/bash
# Migration: 001-consolidate-tasks
# From version: 1.5.0
# To version: 1.6.0
# Description: Consolidates task files from docs/tasks/{story_id}/ to docs/story-plans/{story}.md

TARGET_VERSION="1.6.0"

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}  ℹ${NC} $1"; }
log_success() { echo -e "${GREEN}  ✅${NC} $1"; }
log_warning() { echo -e "${YELLOW}  ⚠️${NC} $1"; }

# Función para extraer story filename del path
get_story_filename() {
    local story_id=$1
    # Buscar el archivo de story correspondiente
    local story_file=$(find docs -path "*/stories/${story_id}.*.md" -o -path "*/stories/${story_id}-*.md" 2>/dev/null | head -1)

    if [ -n "$story_file" ]; then
        basename "$story_file" .md
    else
        # Fallback: usar el story_id directamente
        echo "$story_id"
    fi
}

# Función para consolidar tasks de una story
consolidate_story_tasks() {
    local story_dir=$1
    local story_id=$(basename "$story_dir")
    local story_filename=$(get_story_filename "$story_id")

    log_info "Consolidando tasks de story: $story_id"

    # Crear directorio de story-plans si no existe
    mkdir -p docs/story-plans

    # Archivo de salida
    local output_file="docs/story-plans/${story_filename}.md"

    # Verificar si ya existe (prevenir sobrescritura)
    if [ -f "$output_file" ]; then
        log_warning "El archivo $output_file ya existe, omitiendo..."
        return 0
    fi

    # Leer index.md
    local index_file="${story_dir}/index.md"
    if [ ! -f "$index_file" ]; then
        log_warning "No se encontró index.md en $story_dir, omitiendo..."
        return 0
    fi

    # Crear archivo consolidado
    {
        # Header del story plan
        echo "# Story Plan: $story_id"
        echo ""

        # Extraer Story Reference del index
        sed -n '/## Referencia a Story/,/^---$/p' "$index_file" | head -n -1
        echo ""
        echo "---"
        echo ""

        # Extraer Acceptance Criteria Coverage
        sed -n '/## Criterios de Aceptación/,/^---$/p' "$index_file" | head -n -1
        echo ""
        echo "---"
        echo ""

        # Tasks section
        echo "## Tasks"
        echo ""

        # Iterar sobre archivos de tasks (formato: N.nombre-task.md)
        for task_file in "${story_dir}"/*.md; do
            [ "$task_file" = "$index_file" ] && continue
            [ -f "$task_file" ] || continue

            local task_basename=$(basename "$task_file")
            local task_num=$(echo "$task_basename" | cut -d'.' -f1)

            # Extraer contenido del task (sin el título principal)
            echo "### Task $task_num"
            echo ""
            tail -n +2 "$task_file"  # Omitir primera línea (título)
            echo ""
            echo "---"
            echo ""
        done

        # Extraer Dependency Graph del index
        sed -n '/## Grafo de Dependencias/,/^---$/p' "$index_file" | head -n -1
        echo ""
        echo "---"
        echo ""

        # Extraer Suggested Execution Order del index
        sed -n '/## Orden de Ejecución/,/^---$/p' "$index_file" | head -n -1

        # Si no hay sección de orden, crearla básica
        if ! grep -q "## Orden de Ejecución" "$index_file"; then
            echo "## Suggested Execution Order"
            echo ""
            echo "Follow the dependency graph above."
        fi

        echo ""
        echo "---"
        echo ""

        # Progress section
        echo "## Progress"
        echo ""

        # Contar tasks
        local total_tasks=$(find "${story_dir}" -name "*.md" ! -name "index.md" | wc -l)

        echo "- **Total:** $total_tasks tasks"
        echo "- **Pending:** $total_tasks"
        echo "- **In Progress:** 0"
        echo "- **Completed:** 0"

    } > "$output_file"

    log_success "Creado: $output_file"
}

# Main migration logic
main() {
    # Verificar si hay estructura vieja para migrar
    if [ ! -d "docs/tasks" ]; then
        log_info "No se encontró directorio docs/tasks/, no hay nada que migrar"
        return 0
    fi

    log_info "Iniciando consolidación de tasks..."

    # Contar stories
    local story_count=$(find docs/tasks -mindepth 1 -maxdepth 1 -type d | wc -l)

    if [ "$story_count" -eq 0 ]; then
        log_info "No hay stories en docs/tasks/, no hay nada que migrar"
        return 0
    fi

    log_info "Encontradas $story_count stories para migrar"

    # Iterar sobre cada story
    for story_dir in docs/tasks/*/; do
        [ -d "$story_dir" ] || continue
        consolidate_story_tasks "$story_dir"
    done

    # Eliminar directorio viejo
    log_info "Eliminando docs/tasks/ (estructura antigua)..."
    rm -rf docs/tasks

    log_success "Migración completada exitosamente"
    log_success "✨ Estructura actualizada a docs/story-plans/"
}

# Ejecutar migración
main
