#!/bin/bash
# Migration: 005-add-monorepo-support
# From version: 3.x.x
# To version: 4.0.0
# Description: Adds mode field and product_flows path to local-config.yaml.
#              Creates docs/flows/ directory if in product repo context.

TARGET_VERSION="4.0.0"

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
    log_info "Migracion 005: Agregando soporte monorepo y flows..."

    # 1. Update local-config.yaml with mode and product_flows
    update_local_config

    # 2. Create docs/flows/ if this is a product repo
    create_flows_folder

    log_success "Migracion 005 completada"
}

update_local_config() {
    local config_file=".claude/local-config.yaml"

    if [ ! -f "$config_file" ]; then
        log_info "No se encontro $config_file, nada que actualizar"
        return 0
    fi

    # Add mode: multirepo if not present (backward compatible default)
    if ! grep -q "^mode:" "$config_file"; then
        # Insert mode at the top of the file (after comments)
        sed -i '/^[^#]/{i\mode: multirepo\n
;:a;n;ba}' "$config_file" 2>/dev/null

        # If sed approach failed, try simpler approach
        if ! grep -q "^mode:" "$config_file"; then
            local tmp_file=$(mktemp)
            echo "mode: multirepo" > "$tmp_file"
            echo "" >> "$tmp_file"
            cat "$config_file" >> "$tmp_file"
            mv "$tmp_file" "$config_file"
        fi

        log_success "Agregado mode: multirepo a $config_file"
    else
        log_info "mode ya existe en $config_file"
    fi

    # Add product_flows path if not present
    if ! grep -q "product_flows:" "$config_file"; then
        # Detect the product path from existing config
        local product_path=""
        if grep -q "product_docs:" "$config_file"; then
            product_path=$(grep "product_docs:" "$config_file" | sed 's/.*product_docs: *//' | sed 's/ *$//')
        fi

        if [ -n "$product_path" ]; then
            # Derive flows path from product_docs path
            local flows_path="${product_path%/docs}/docs/flows"
            # If product_docs is just "docs", flows_path should be "docs/flows"
            if [ "$product_path" = "docs" ]; then
                flows_path="docs/flows"
            fi

            # Insert after product_architectures line
            if grep -q "product_architectures:" "$config_file"; then
                sed -i "/product_architectures:/a\\  product_flows: $flows_path" "$config_file"
                log_success "Agregado product_flows: $flows_path a $config_file"
            else
                # Fallback: insert before story_plans
                if grep -q "story_plans:" "$config_file"; then
                    sed -i "/story_plans:/i\\  product_flows: $flows_path" "$config_file"
                    log_success "Agregado product_flows: $flows_path a $config_file"
                fi
            fi
        else
            log_warning "No se pudo detectar product_docs path, product_flows no agregado"
            log_warning "Ejecuta /service:setup-repo para reconfiguar"
        fi
    else
        log_info "product_flows ya existe en $config_file"
    fi
}

create_flows_folder() {
    # Create docs/flows/ if docs/prd/ exists (indicates this is a product repo or monorepo)
    if [ -d "docs/prd" ]; then
        if [ ! -d "docs/flows" ]; then
            mkdir -p "docs/flows"
            log_success "Creado directorio docs/flows/"
        else
            log_info "docs/flows/ ya existe"
        fi
    else
        log_info "No es un product repo, no se crea docs/flows/"
    fi
}

# Ejecutar migracion
main
