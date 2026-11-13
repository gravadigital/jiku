#!/bin/bash
# Hook: SessionStart
# Purpose: After context compaction, remind Claude to re-read the command being executed
#
# This hook checks if the session started due to compaction and, if so,
# outputs instructions for Claude to re-read the current command.

# Debug mode - set to 1 to enable logging
DEBUG=1
LOG_DIR="${HOME}/.claude/state"
LOG_FILE="${LOG_DIR}/hooks.log"

log_debug() {
    if [ "$DEBUG" = "1" ]; then
        mkdir -p "$LOG_DIR"
        echo "[$(date -Iseconds)] [SessionStart] $1" >> "$LOG_FILE"
    fi
}

log_debug "=== Hook started ==="

# Read JSON input from stdin
INPUT=$(cat)
log_debug "Input received: $INPUT"

# Extract fields from input
SOURCE=$(echo "$INPUT" | jq -r '.source // empty')
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')

log_debug "source: $SOURCE"
log_debug "session_id: $SESSION_ID"

# Only act on compaction-triggered session starts
if [ "$SOURCE" != "compact" ]; then
    log_debug "Source is not 'compact' (is: '$SOURCE'), exiting"
    exit 0
fi

log_debug "Source is 'compact', looking for saved command..."

# Look for the saved command state
STATE_DIR="${HOME}/.claude/state"
STATE_FILE="${STATE_DIR}/current-command-${SESSION_ID}.json"

log_debug "Looking for state file: $STATE_FILE"

if [ ! -f "$STATE_FILE" ]; then
    log_debug "State file not found, exiting"
    exit 0
fi

log_debug "State file found, reading..."

# Read the saved command
COMMAND_NAME=$(jq -r '.command // empty' "$STATE_FILE" 2>/dev/null || true)

log_debug "COMMAND_NAME from state: $COMMAND_NAME"

if [ -z "$COMMAND_NAME" ]; then
    log_debug "No command name in state file, exiting"
    exit 0
fi

# Clean up the state file
rm -f "$STATE_FILE"
log_debug "State file cleaned up"

# Output message for Claude
# This message will be shown to Claude after compaction
OUTPUT=$(cat << EOF
IMPORTANTE: El contexto fue compactado durante la ejecución del comando "/${COMMAND_NAME}".

ACCIÓN REQUERIDA:
1. Releé el archivo del skill: .claude/skills/${COMMAND_NAME}/SKILL.md
2. Identificá en qué paso estabas según el estado de la conversación
3. Continuá desde ese paso sin repetir lo ya hecho

NO comiences desde el principio. Continuá donde quedaste.
EOF
)

log_debug "Outputting instructions for command: $COMMAND_NAME"
log_debug "=== Hook finished ==="

echo "$OUTPUT"

exit 0
