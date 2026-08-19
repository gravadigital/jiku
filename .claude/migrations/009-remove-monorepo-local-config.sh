#!/bin/bash
# Migration: 009-remove-monorepo-local-config
# From version: 6.0.0
# To version: 6.1.0
# Description: In monorepo, .claude/local-config.yaml is no longer used (it only added ambiguity:
#              constant paths + a single service.name/type that cannot represent a multi-service repo).
#              Service skills now auto-detect monorepo from docs/prd/ at the repo root and resolve paths
#              from the Files-index defaults and each service's manifest.yaml. This migration deletes the
#              stale config file when the repo is a monorepo. Multirepo configs are left untouched.

TARGET_VERSION="6.1.0"

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
    local config_file=".claude/local-config.yaml"

    # Nothing to do if there is no config file (idempotent: already removed, or never existed).
    if [ ! -f "$config_file" ]; then
        log_info "No hay $config_file, nada que eliminar (monorepo ya se autodetecta)"
        return 0
    fi

    # Determine whether this repo is a monorepo. Two independent signals:
    #   (a) the config explicitly declares mode: monorepo
    #   (b) the product docs live in THIS repo (docs/prd/ at the root) — i.e. product + service together
    local is_monorepo=0
    local reason=""

    if grep -qE "^[[:space:]]*mode:[[:space:]]*monorepo" "$config_file"; then
        is_monorepo=1
        reason="mode: monorepo declarado en el config"
    elif [ -d "docs/prd" ]; then
        # docs/prd at the repo root means the product layer lives here → monorepo.
        # (In multirepo the product docs are in a SEPARATE repo, referenced via product_repo path.)
        is_monorepo=1
        reason="se encontró docs/prd/ en la raíz (producto y servicio en el mismo repo)"
    fi

    if [ "$is_monorepo" -ne 1 ]; then
        log_info "Repo multirepo (sin mode: monorepo ni docs/prd/ local) — se conserva $config_file"
        return 0
    fi

    # It's a monorepo: the config is now redundant/ambiguous. Remove it.
    log_warning "Monorepo detectado ($reason)."
    log_info "En monorepo $config_file ya no se usa — los skills de servicio autodetectan el contexto."

    if rm -f "$config_file"; then
        log_success "Eliminado $config_file (monorepo no requiere configuración)"
        log_info "Los skills resuelven paths desde los defaults del Files index y los manifest.yaml por servicio"
    else
        log_error "No se pudo eliminar $config_file — eliminalo manualmente"
        return 1
    fi
}

# Ejecutar migracion
main
