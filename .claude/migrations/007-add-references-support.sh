#!/bin/bash
# Migration: 007-add-references-support
# From version: 5.1.x
# To version: 5.2.0
# Description: Adds docs/references/ folder with empty index.md for external reference documentation.
#              Adds product_references path to local-config.yaml.

TARGET_VERSION="5.2.0"

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

log_info() { echo -e "${BLUE}  i${NC} $1" >&2; }
log_success() { echo -e "${GREEN}  OK${NC} $1" >&2; }
log_warning() { echo -e "${YELLOW}  !${NC} $1" >&2; }
log_error() { echo -e "${RED}  X${NC} $1" >&2; }

main() {
    log_info "Migracion 007: Agregando soporte de referencias externas..."

    # 1. Create docs/references/ with empty index if product repo
    create_references_folder

    # 2. Update local-config.yaml with product_references path
    update_local_config

    log_success "Migracion 007 completada"
}

create_references_folder() {
    # Create docs/references/ if docs/prd/ exists (indicates product repo or monorepo)
    if [ -d "docs/prd" ]; then
        if [ ! -d "docs/references" ]; then
            mkdir -p "docs/references"
            log_success "Creado directorio docs/references/"
        else
            log_info "docs/references/ ya existe"
        fi

        # Create empty index.md if it doesn't exist
        if [ ! -f "docs/references/index.md" ]; then
            echo "# Referencias" > "docs/references/index.md"
            log_success "Creado docs/references/index.md"
        else
            log_info "docs/references/index.md ya existe"
        fi
    else
        log_info "No es un product repo, no se crea docs/references/"
    fi
}

update_local_config() {
    local config_file=".claude/local-config.yaml"

    if [ ! -f "$config_file" ]; then
        log_info "No se encontro $config_file, nada que actualizar"
        return 0
    fi

    # Add product_references path if not present
    if ! grep -q "product_references:" "$config_file"; then
        # Detect the product path from existing config
        local product_path=""
        if grep -q "product_docs:" "$config_file"; then
            product_path=$(grep "product_docs:" "$config_file" | sed 's/.*product_docs: *//' | sed 's/ *$//')
        fi

        if [ -n "$product_path" ]; then
            # Derive references path from product_docs path
            local references_path="${product_path%/docs}/docs/references"
            if [ "$product_path" = "docs" ]; then
                references_path="docs/references"
            fi

            # Insert after product_flows line (added in migration 005)
            if grep -q "product_flows:" "$config_file"; then
                sed -i "/product_flows:/a\\  product_references: $references_path" "$config_file"
                log_success "Agregado product_references: $references_path a $config_file"
            else
                # Fallback: insert before story_plans
                if grep -q "story_plans:" "$config_file"; then
                    sed -i "/story_plans:/i\\  product_references: $references_path" "$config_file"
                    log_success "Agregado product_references: $references_path a $config_file"
                fi
            fi
        else
            log_warning "No se pudo detectar product_docs path, product_references no agregado"
            log_warning "Ejecuta /service-setup-repo para reconfigurar"
        fi
    else
        log_info "product_references ya existe en $config_file"
    fi
}

# Ejecutar migracion
main
