#!/bin/bash
# Migration: 004-remove-epics
# From version: 2.x.x
# To version: 3.0.0
# Description: Removes epic concept. Renames epic-candidates.md to feature-groups.md.
#              Existing E-XXX.S-XX stories are left as-is (not renamed).

TARGET_VERSION="3.0.0"

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

log_info() { echo -e "${BLUE}  i${NC} $1"; }
log_success() { echo -e "${GREEN}  OK${NC} $1"; }
log_warning() { echo -e "${YELLOW}  !${NC} $1"; }
log_error() { echo -e "${RED}  X${NC} $1"; }

main() {
    log_info "Migracion 004: Eliminando concepto de Epics..."

    # 1. Rename epic-candidates.md to feature-groups.md
    rename_epic_candidates

    # 2. Remove docs/epics/ folder if empty
    remove_epics_folder

    # 3. Update local-config.yaml if it has epics references
    update_local_config

    log_success "Migracion 004 completada"
}

rename_epic_candidates() {
    local old_file="docs/prd/epic-candidates.md"
    local new_file="docs/prd/feature-groups.md"

    if [ ! -f "$old_file" ]; then
        log_info "No se encontro $old_file, nada que renombrar"
        return 0
    fi

    if [ -f "$new_file" ]; then
        log_warning "$new_file ya existe, no se sobreescribe"
        return 0
    fi

    # Rename file
    mv "$old_file" "$new_file"
    log_success "Renombrado: $old_file -> $new_file"

    # Replace "Epic Candidate" with "Feature Group" in the file content
    if command -v sed &> /dev/null; then
        sed -i 's/Epic Candidate/Feature Group/g' "$new_file"
        sed -i 's/epic candidate/feature group/g' "$new_file"
        sed -i 's/epic candidates/feature groups/g' "$new_file"
        sed -i 's/Epic Candidates/Feature Groups/g' "$new_file"
        sed -i 's/create-epic/create-stories/g' "$new_file"
        sed -i 's/planify-epic/create-stories/g' "$new_file"
        log_success "Actualizado contenido de $new_file"
    fi
}

remove_epics_folder() {
    local epics_folder="docs/epics"

    if [ ! -d "$epics_folder" ]; then
        log_info "No existe $epics_folder, nada que hacer"
        return 0
    fi

    # Check if folder has files
    local file_count=$(ls -1 "$epics_folder" 2>/dev/null | wc -l)
    if [ "$file_count" -gt 0 ]; then
        log_warning "$epics_folder tiene $file_count archivos, NO se elimina"
        log_warning "Los archivos de epics existentes se mantienen como referencia"
        return 0
    fi

    # Empty folder, safe to remove
    rmdir "$epics_folder"
    log_success "Eliminado directorio vacio: $epics_folder"
}

update_local_config() {
    local config_file=".claude/local-config.yaml"

    if [ ! -f "$config_file" ]; then
        log_info "No se encontro $config_file, nada que actualizar"
        return 0
    fi

    # Remove epics_folder references
    if grep -q "epics_folder" "$config_file"; then
        sed -i '/epics_folder/d' "$config_file"
        log_success "Eliminada referencia epics_folder de $config_file"
    fi
}

# Ejecutar migracion
main
