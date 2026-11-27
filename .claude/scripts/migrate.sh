#!/bin/bash
# jiku flow - Migration Script
# Runs the migrations between the project's version and the installed one

set -e

VERSION_FILE=".claude/.jflow-version"
WORKFLOW_VERSION_FILE=".claude/VERSION"
MIGRATIONS_DIR=".claude/migrations"

# Output colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Utilities
log_info() { echo -e "${BLUE}ℹ${NC} $1" >&2; }
log_success() { echo -e "${GREEN}✅${NC} $1" >&2; }
log_warning() { echo -e "${YELLOW}⚠️${NC} $1" >&2; }
log_error() { echo -e "${RED}❌${NC} $1" >&2; }
log_migrate() { echo -e "${CYAN}🔄${NC} $1" >&2; }

# Compare semantic versions
# Returns: 0 if equal, 1 if v1 > v2, 2 if v1 < v2
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

# The project's version: without .jflow-version it is a new install, at the installed version.
# (The migration chain starts at 1.0.0.)
detect_project_version() {
    if [ -f "$WORKFLOW_VERSION_FILE" ]; then
        cat "$WORKFLOW_VERSION_FILE" | tr -d '[:space:]'
    else
        echo "1.0.0"
    fi
}

# Read or create .jflow-version
get_or_create_project_version() {
    if [ -f "$VERSION_FILE" ]; then
        cat "$VERSION_FILE" | tr -d '[:space:]'
    else
        local detected_version=$(detect_project_version)
        log_info "No .jflow-version: taking the installed version, v$detected_version"
        echo "$detected_version" > "$VERSION_FILE"
        log_success "Created $VERSION_FILE with $detected_version"
        echo "$detected_version"
    fi
}

# Target version (the installed jiku flow)
get_target_version() {
    if [ -f "$WORKFLOW_VERSION_FILE" ]; then
        cat "$WORKFLOW_VERSION_FILE" | tr -d '[:space:]'
    else
        log_error "$WORKFLOW_VERSION_FILE not found"
        exit 1
    fi
}

# Run a migration
run_migration() {
    local migration_file=$1
    local migration_name=$(basename "$migration_file" .sh)

    log_migrate "Running migration: $migration_name"

    # In a child process, NEVER with source.
    # Each migration defines its own TARGET_VERSION and log_*; with source they
    # overwrote the orchestrator's and truncated the range (only the first
    # migration of the chain ran). bash (not a subshell) also keeps migrations
    # from inheriting `set -e`, which they were not written to tolerate.
    if bash "$migration_file"; then
        log_success "Migration $migration_name done"
        return 0
    else
        log_error "Migration $migration_name failed"
        return 1
    fi
}

# Main execution
main() {
    log_info "Starting migrations..."

    # Versions
    PROJECT_VERSION=$(get_or_create_project_version)
    # The orchestrator's own name: no migration can overwrite it.
    WORKFLOW_TARGET=$(get_target_version)

    log_info "Project version: v$PROJECT_VERSION"
    log_info "Target version: v$WORKFLOW_TARGET"

    # Compare
    COMPARISON=$(compare_versions "$PROJECT_VERSION" "$WORKFLOW_TARGET")

    if [ "$COMPARISON" = "0" ]; then
        log_success "The project is already at the installed version"
        exit 0
    elif [ "$COMPARISON" = "1" ]; then
        log_warning "The project version ($PROJECT_VERSION) is newer than the installed jiku flow ($WORKFLOW_TARGET)"
        log_warning "No migrations will run"
        exit 0
    fi

    # Find and run the migrations needed
    MIGRATIONS_EXECUTED=0
    MIGRATIONS_FAILED=0

    if [ ! -d "$MIGRATIONS_DIR" ]; then
        log_info "No migrations available"
        # Move the version directly
        echo "$WORKFLOW_TARGET" > "$VERSION_FILE"
        log_success "Version set to v$WORKFLOW_TARGET"
        exit 0
    fi

    # Every migration, in order
    for migration_file in "$MIGRATIONS_DIR"/[0-9][0-9][0-9]-*.sh; do
        [ -f "$migration_file" ] || continue

        # TARGET_VERSION of the script
        MIGRATION_TARGET=$(grep "^TARGET_VERSION=" "$migration_file" | cut -d'"' -f2 | cut -d"'" -f2)

        if [ -z "$MIGRATION_TARGET" ]; then
            log_warning "Migration $(basename "$migration_file") has no TARGET_VERSION, skipping..."
            continue
        fi

        # It runs when PROJECT_VERSION < MIGRATION_TARGET <= WORKFLOW_TARGET
        COMP_PROJECT=$(compare_versions "$PROJECT_VERSION" "$MIGRATION_TARGET")
        COMP_TARGET=$(compare_versions "$MIGRATION_TARGET" "$WORKFLOW_TARGET")

        if [ "$COMP_PROJECT" = "2" ] && { [ "$COMP_TARGET" = "2" ] || [ "$COMP_TARGET" = "0" ]; }; then
            if run_migration "$migration_file"; then
                MIGRATIONS_EXECUTED=$((MIGRATIONS_EXECUTED + 1))
            else
                MIGRATIONS_FAILED=$((MIGRATIONS_FAILED + 1))
                log_error "A migration failed, stopping"
                exit 1
            fi
        fi
    done

    # Agent migrations pending (.md), BEFORE moving .jflow-version, so the range
    # is the one this run actually covered.
    detect_agent_migrations "$PROJECT_VERSION" "$WORKFLOW_TARGET"

    # Move .jflow-version to the target
    echo "$WORKFLOW_TARGET" > "$VERSION_FILE"

    # Safeguard: if the final version did not reach the target, say so instead of
    # leaving a .jflow-version that lies about the real state.
    FINAL_VERSION=$(cat "$VERSION_FILE" | tr -d '[:space:]')
    if [ "$(compare_versions "$FINAL_VERSION" "$WORKFLOW_TARGET")" != "0" ]; then
        log_warning "The final version ($FINAL_VERSION) did not reach the target ($WORKFLOW_TARGET): check the skipped migrations"
    fi

    # Summary
    echo ""
    if [ $MIGRATIONS_EXECUTED -gt 0 ]; then
        log_success "✨ Migrations done: $MIGRATIONS_EXECUTED"
        log_success "📦 Version: v$PROJECT_VERSION → v$WORKFLOW_TARGET"
    else
        log_info "No pending migrations"
        log_success "📦 Version set to v$WORKFLOW_TARGET"
    fi
}

# The agent migrations (.md) that apply
detect_agent_migrations() {
    local from_version=$1
    local to_version=$2
    local pending_file=".claude/agent-migrations-pending.md"
    local pending=()

    if [ ! -d "$MIGRATIONS_DIR" ]; then
        return 0
    fi

    # Only files named like a migration (NNN-*.md). A loose *.md in the folder (the
    # README, which shows the frontmatter format in a code block) matched the
    # target_version grep and was listed as if it were a migration.
    for migration_file in "$MIGRATIONS_DIR"/[0-9][0-9][0-9]-*.md; do
        [ -f "$migration_file" ] || continue

        # target_version of the frontmatter
        MIGRATION_TARGET=$(grep "^target_version:" "$migration_file" | sed 's/target_version: *"//' | sed 's/".*//' | tr -d '[:space:]')

        if [ -z "$MIGRATION_TARGET" ]; then
            continue
        fi

        # It applies when from_version < MIGRATION_TARGET <= to_version
        COMP_FROM=$(compare_versions "$from_version" "$MIGRATION_TARGET")
        COMP_TO=$(compare_versions "$MIGRATION_TARGET" "$to_version")

        if [ "$COMP_FROM" = "2" ] && { [ "$COMP_TO" = "2" ] || [ "$COMP_TO" = "0" ]; }; then
            pending+=("$migration_file")
        elif [ -f "$pending_file" ] && grep -q "file: $migration_file$" "$pending_file"; then
            # Pending from an earlier run and not done by the agent yet (the file
            # is still there): carried over. Without this a later run rewrote the
            # file with a newer range and silently dropped migrations never applied.
            pending+=("$migration_file")
        fi
    done

    # Write the pending list if there are any
    if [ ${#pending[@]} -gt 0 ]; then
        # Dedupe and sort by migration name
        IFS=$'\n' read -r -d '' -a pending < <(printf '%s\n' "${pending[@]}" | sort -u && printf '\0')
        {
            echo "# Agent Migrations Pending"
            echo ""
            echo "These migrations need the agent:"
            echo ""
            for f in "${pending[@]}"; do
                name=$(basename "$f" .md)
                desc=$(grep "^description:" "$f" | sed 's/description: *"//' | sed 's/".*//')
                echo "- **$name**: $desc"
                echo "  file: $f"
            done
        } > "$pending_file"
        log_warning "Agent migrations pending: ${#pending[@]} (see $pending_file)"
    else
        # No pending ones: remove the file
        rm -f "$pending_file"
    fi
}

# Run
main
