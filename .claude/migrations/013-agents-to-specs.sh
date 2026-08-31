#!/bin/bash
# Migration: 013-agents-to-specs
# From version: 7.0.0
# To version: 8.0.0
# Description: The "agent" concept is split in two. Persona files that only restated trained
#              defaults are deleted (backend-developer, frontend-developer, db-architector).
#              The specification content they carried moves to .claude/specs/ (technical-standards,
#              functional-analysis, ux-methodology, orchestration). Only one real subagent survives,
#              addressed by subagent_type with its own pinned model: ux-researcher, for parametric
#              fan-out. QA review becomes the forked skill /service-qa-review, which cannot write
#              (Write/Edit removed).
#              This migration removes the stale agent files from the service repo. The new specs/ and
#              agent definitions arrive with the normal file sync, so this only cleans up leftovers.

TARGET_VERSION="8.0.0"

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
    local agents_dir=".claude/agents"
    local specs_dir=".claude/specs"

    if [ ! -d "$agents_dir" ]; then
        log_info "No hay $agents_dir, nada que migrar"
        return 0
    fi

    # The specs must have arrived with the file sync before we delete anything.
    # If they are missing, the sync did not run: abort rather than leave the repo
    # without either the agents or the specs.
    if [ ! -d "$specs_dir" ]; then
        log_error "Falta $specs_dir — el sync de archivos no se aplicó todavía."
        log_error "Ejecutá /update-tools de nuevo; no borro los agentes sin las specs presentes."
        return 1
    fi

    local removed=0
    local obsolete="analyst.md backend-developer.md db-architector.md frontend-developer.md orchestrator.md technical-leader.md qa-reviewer.md"

    for f in $obsolete; do
        if [ -f "$agents_dir/$f" ]; then
            rm -f "$agents_dir/$f"
            if [ "$f" = "qa-reviewer.md" ]; then
                log_success "Eliminado $agents_dir/$f (ahora es el skill forkeado /service-qa-review)"
            else
                log_success "Eliminado $agents_dir/$f (su contenido vive ahora en $specs_dir/)"
            fi
            removed=$((removed + 1))
        fi
    done

    if [ "$removed" -eq 0 ]; then
        log_info "Los agentes obsoletos ya no estaban (migración idempotente)"
    fi

    # Warn about local skills still pointing at the deleted files.
    if [ -d ".claude/skills" ]; then
        local stale
        stale=$(grep -rl "agents/\(analyst\|technical-leader\|backend-developer\|frontend-developer\|db-architector\|orchestrator\|qa-reviewer\)\.md\|subagent_type: \"qa-reviewer\"" \
                 .claude/skills 2>/dev/null || true)
        if [ -n "$stale" ]; then
            log_warning "Estos skills locales todavía referencian agentes eliminados:"
            echo "$stale" | while read -r s; do log_warning "  - $s"; done
            log_warning "Actualizalos para leer .claude/specs/ (ver .claude/utils/index.md)"
        fi
    fi

    log_success "Migración a specs completada"
    return 0
}

main "$@"
