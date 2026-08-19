#!/bin/bash
# Migration: 002-add-story-plans-path
# From version: 1.8.0
# To version: 1.9.0
# Description: Adds story_plans path to local-config.yaml if it exists

TARGET_VERSION="1.9.0"

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}  ℹ${NC} $1"; }
log_success() { echo -e "${GREEN}  ✅${NC} $1"; }
log_warning() { echo -e "${YELLOW}  ⚠️${NC} $1"; }

# Main migration logic
main() {
    local config_file=".claude/local-config.yaml"

    # Verificar si existe el archivo local-config.yaml
    if [ ! -f "$config_file" ]; then
        log_info "No se encontró $config_file, no hay nada que migrar"
        return 0
    fi

    # Verificar si ya tiene la clave story_plans
    if grep -q "story_plans:" "$config_file"; then
        log_info "El archivo $config_file ya tiene la clave story_plans, omitiendo migración"
        return 0
    fi

    log_info "Agregando clave story_plans a $config_file..."

    # Crear directorio docs/story-plans si no existe
    if [ ! -d "docs/story-plans" ]; then
        log_info "Creando directorio docs/story-plans/"
        mkdir -p docs/story-plans
    fi

    # Buscar la sección paths: y agregar story_plans después de product_architectures
    # Usamos sed para insertar la línea después de product_architectures
    if grep -q "product_architectures:" "$config_file"; then
        # Crear archivo temporal
        local temp_file="${config_file}.tmp"

        # Insertar story_plans después de product_architectures
        awk '
            /product_architectures:/ {
                print
                # Leer la siguiente línea para preservar el formato
                getline
                print
                # Agregar story_plans con la misma indentación
                print "  story_plans: docs/story-plans"
                next
            }
            { print }
        ' "$config_file" > "$temp_file"

        # Reemplazar archivo original
        mv "$temp_file" "$config_file"

        log_success "Clave story_plans agregada exitosamente"
        log_info "Nueva configuración en $config_file:"
        log_info "  story_plans: docs/story-plans"
    else
        # Si no encontramos product_architectures, agregar al final de la sección paths
        log_warning "No se encontró product_architectures en $config_file"
        log_warning "Agregando story_plans al final de la sección paths"

        # Buscar la última línea de la sección paths e insertar antes del siguiente bloque
        awk '
            /^[^ ]/ && in_paths && !done {
                print "  story_plans: docs/story-plans"
                done = 1
            }
            /^paths:/ { in_paths = 1 }
            { print }
            END {
                if (in_paths && !done) {
                    print "  story_plans: docs/story-plans"
                }
            }
        ' "$config_file" > "${config_file}.tmp"

        mv "${config_file}.tmp" "$config_file"
        log_success "Clave story_plans agregada al final de la sección paths"
    fi

    log_success "Migración completada exitosamente"
    log_success "✨ Configuración actualizada con story_plans"
}

# Ejecutar migración
main
