#!/bin/bash
# Migration: 010-consolidate-screen-template
# From version: 6.1.0
# To version: 6.2.0
# Description: The two screen templates were consolidated into one. The dead low-fi template was
#              deleted and screen-mid-tmpl.yaml was renamed to screen-tmpl.yaml (fidelity is a field
#              of the document, not a filename).
#
#              Why this migration is needed: `update-tools.sh update-full` wipes .claude entirely, so
#              the old name leaves no trace there. But detect_local_modifications() classifies ANY
#              local file the new version no longer ships as LOCAL_ONLY — it cannot tell "the user
#              created this" from "the previous version shipped this and the new one removed it". So
#              after this rename EVERY repo coming from 6.1.0 reports screen-mid-tmpl.yaml as
#              LOCAL_ONLY even if untouched, and if the user then picks the preserve path,
#              update_preserve() restores it verbatim next to the new screen-tmpl.yaml. Verified by
#              reproduction on a pristine repo. This migration removes the stale file, keeping a .bkp
#              when its content differs (it may hold real local edits, or just the 6.1.0 content).

TARGET_VERSION="6.2.0"

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
    local stale=".claude/templates/screen-mid-tmpl.yaml"
    local canonical=".claude/templates/screen-tmpl.yaml"

    # Idempotent: nothing to do if the old name is already gone.
    if [ ! -f "$stale" ]; then
        log_info "No hay $stale — template de pantalla ya consolidado"
        return 0
    fi

    # Safety guard: never leave the repo without a screen template. If the canonical file is
    # missing, the update did not land correctly — abort instead of deleting the only copy.
    if [ ! -f "$canonical" ]; then
        log_error "Existe $stale pero falta $canonical"
        log_error "No elimino el único template de pantalla disponible. Revisá la actualización."
        return 1
    fi

    # When the content differs we cannot tell local edits apart from the plain 6.1.0 content, so keep
    # a .bkp instead of deleting outright. Identical content is safe to remove silently.
    if diff -q "$stale" "$canonical" > /dev/null 2>&1; then
        rm -f "$stale"
        log_success "Eliminado $stale (idéntico al nuevo $canonical)"
    else
        mv "$stale" "${stale}.bkp"
        log_warning "Eliminado $stale — su contenido difería del nuevo $canonical"
        log_info "Guardado como ${stale}.bkp por si tenía cambios tuyos. Si era solo la versión vieja del template, borralo"
    fi

    log_info "El template de pantalla ahora es único: $canonical (la fidelidad es un campo del frontmatter)"
}

# Ejecutar migracion
main
