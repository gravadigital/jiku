#!/bin/bash
# jiku flow - update script. The mechanical half of /jflow-framework-update: download a version, compare,
# show its CHANGELOG, detect local changes, back up, update, migrate, verify. Installing and updating the
# files is done by the jflow.py of the downloaded copy (`jflow.py install`), so an update always follows
# the new version's rules and touches only what belongs to jiku flow (see .claude/scripts/jflowlib/install.py).

set -e

REPO_URL="${JFLOW_REPO_URL:-https://github.com/gravadigital/jiku-flow.git}"
TMP_BASE="${TMPDIR:-/tmp}"
TMP_DIR="$TMP_BASE/jflow-update"
BACKUP_DIR="$TMP_BASE/jflow-backups"
VERSION_FILE=".claude/VERSION"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}ℹ${NC} $1"; }
log_success() { echo -e "${GREEN}✅${NC} $1"; }
log_warning() { echo -e "${YELLOW}⚠️${NC} $1"; }
log_error() { echo -e "${RED}❌${NC} $1"; }

get_local_version() {
    if [ -f "$VERSION_FILE" ]; then tr -d '[:space:]' < "$VERSION_FILE"; else echo "0.0.0"; fi
}

get_remote_version() {
    if [ -f "$TMP_DIR/$VERSION_FILE" ]; then tr -d '[:space:]' < "$TMP_DIR/$VERSION_FILE"; else echo "unknown"; fi
}

# 0 if equal, 1 if v1 > v2, 2 if v1 < v2
compare_versions() {
    local v1=$1 v2=$2
    if [ "$v1" = "$v2" ]; then echo "0"; return; fi
    local IFS='.'
    read -ra A <<< "$v1"
    read -ra B <<< "$v2"
    for i in 0 1 2; do
        local n1=${A[$i]:-0} n2=${B[$i]:-0}
        if [ "$n1" -gt "$n2" ]; then echo "1"; return; fi
        if [ "$n1" -lt "$n2" ]; then echo "2"; return; fi
    done
    echo "0"
}

# The latest release (highest vX.Y.Z tag), or the version asked for (vX.Y.Z or a branch)
clone_remote() {
    local ref=$1
    log_info "Downloading jiku flow${ref:+ $ref}..."
    rm -rf "$TMP_DIR"
    if [ -z "$ref" ]; then
        ref=$(git ls-remote --tags --refs "$REPO_URL" 'v*' 2>/dev/null | sed 's#.*refs/tags/##' \
              | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | sort -V | tail -1)
    fi
    if ! git -c advice.detachedHead=false clone --quiet --depth 1 ${ref:+--branch "$ref"} "$REPO_URL" "$TMP_DIR" 2>/dev/null; then
        log_error "Could not download $REPO_URL${ref:+ ($ref)}"
        exit 1
    fi
    log_success "Downloaded ${ref:-the default branch}"
}

require_download() {
    if [ ! -f "$TMP_DIR/.claude/scripts/jflow.py" ]; then
        log_error "Nothing downloaded: run fetch-remote first"
        exit 1
    fi
}

create_backup() {
    local version=$1
    local path="$BACKUP_DIR/backup-$(date +%Y%m%d-%H%M%S)-v${version}"
    mkdir -p "$BACKUP_DIR"
    if [ -d ".claude" ]; then
        cp -r .claude "$path"
        log_success "Backup: $path"
        echo "BACKUP:$path"
    else
        log_warning "There is no .claude/ to back up"
    fi
}

verify_update() {
    local expected=$1 errors=0
    local actual
    actual=$(get_local_version)
    if [ "$actual" != "$expected" ]; then
        log_error "Version mismatch: expected $expected, found $actual"
        errors=$((errors + 1))
    fi
    for f in .claude/scripts/jflow.py .claude/.jflow-manifest; do
        if [ ! -f "$f" ]; then
            log_warning "Missing: $f"
            errors=$((errors + 1))
        fi
    done
    for hook in .claude/hooks/jflow-*.sh; do
        [ -f "$hook" ] && [ ! -x "$hook" ] && chmod +x "$hook"
    done
    if python3 -c "import json; json.load(open('.claude/settings.json'))" 2>/dev/null; then
        log_success "settings.json is valid"
    else
        log_error "settings.json is not valid JSON"
        errors=$((errors + 1))
    fi
    if [ $errors -eq 0 ]; then log_success "Verified"; return 0; fi
    log_warning "Verified with $errors problem(s)"
    return 1
}

# Wrapped in a function, so bash has read the whole script before running it: `update` replaces this
# very file.
main() {
    case "${1:-help}" in
        "check-version")
            echo "LOCAL_VERSION:$(get_local_version)"
            ;;
        "fetch-remote")
            clone_remote "$2"
            echo "REMOTE_VERSION:$(get_remote_version)"
            ;;
        "compare")
            local_v=$(get_local_version); remote_v=$(get_remote_version)
            echo "LOCAL_VERSION:$local_v"
            echo "REMOTE_VERSION:$remote_v"
            echo "COMPARISON:$(compare_versions "$local_v" "$remote_v")"  # 0 equal, 1 local newer, 2 remote newer
            ;;
        "changelog")
            require_download
            cat "$TMP_DIR/.claude/CHANGELOG.md"
            ;;
        "detect-changes")
            require_download
            python3 "$TMP_DIR/.claude/scripts/jflow.py" --root . install --dry
            ;;
        "backup")
            create_backup "${2:-$(get_local_version)}"
            ;;
        "update")
            require_download
            shift
            if [ "$1" = "--keep" ]; then shift; fi
            python3 "$TMP_DIR/.claude/scripts/jflow.py" --root . install --keep "$@"
            log_success "Updated to $(get_remote_version)"
            ;;
        "migrate")
            bash .claude/scripts/migrate.sh
            ;;
        "verify")
            verify_update "${2:-$(get_remote_version)}"
            ;;
        "cleanup")
            rm -rf "$TMP_DIR"
            log_success "Download removed (backups stay in $BACKUP_DIR until the system cleans its temp folder)"
            ;;
        "help"|*)
            cat <<EOF
jiku flow update script

Usage: $0 <command> [args]

  check-version            installed version
  fetch-remote [ref]       download the latest release (or ref: vX.Y.Z or a branch)
  compare                  compare the installed and the downloaded versions
  changelog                the downloaded CHANGELOG
  detect-changes           what an update would change: NEW, UPDATE, MODIFIED (changed by you),
                           CLASH, REMOVE, KEEP_REMOVED
  backup [version]         copy .claude/ to $BACKUP_DIR
  update [--keep f1 f2…]   update; the files listed keep your version (the new one as .new), the
                           other MODIFIED ones are replaced (yours as .bkp)
  migrate                  run the pending migrations
  verify [version]         check the result
  cleanup                  remove the download (backups are kept)
EOF
            ;;
    esac
}

main "$@"
exit $?
