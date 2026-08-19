#!/bin/bash
# Hook: PreCompact
# Purpose: Capture the current command being executed before context compaction
#
# This hook reads the transcript to find the last skill/command executed
# and saves it for the session-resume hook to use.

# Debug mode - set to 1 to enable logging
DEBUG=1
LOG_DIR="${HOME}/.claude/state"
LOG_FILE="${LOG_DIR}/hooks.log"

log_debug() {
    if [ "$DEBUG" = "1" ]; then
        mkdir -p "$LOG_DIR"
        echo "[$(date -Iseconds)] [PreCompact] $1" >> "$LOG_FILE"
    fi
}

log_debug "=== Hook started ==="

# Read JSON input from stdin
INPUT=$(cat)
log_debug "Input received: $INPUT"

# Extract transcript_path from input
TRANSCRIPT_PATH=$(echo "$INPUT" | jq -r '.transcript_path // empty')
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')

log_debug "transcript_path: $TRANSCRIPT_PATH"
log_debug "session_id: $SESSION_ID"

if [ -z "$TRANSCRIPT_PATH" ]; then
    log_debug "No transcript_path in input, exiting"
    exit 0
fi

if [ ! -f "$TRANSCRIPT_PATH" ]; then
    log_debug "Transcript file does not exist: $TRANSCRIPT_PATH"
    exit 0
fi

log_debug "Transcript file exists, searching for skill..."

# Find the last Skill tool call in the transcript
# The transcript is a JSONL file where each line is a JSON object
# We look for tool_use with name "Skill"
LAST_SKILL=$(tac "$TRANSCRIPT_PATH" 2>/dev/null | grep -m1 '"name":"Skill"' | head -1 || true)

log_debug "LAST_SKILL grep result: $LAST_SKILL"

if [ -z "$LAST_SKILL" ]; then
    log_debug "No Skill tool found, trying command-name tags..."

    # No skill found, try looking for command-name tags in assistant messages
    LAST_COMMAND=$(tac "$TRANSCRIPT_PATH" 2>/dev/null | grep -oP '<command-name>/[^<]+</command-name>' | head -1 || true)

    log_debug "LAST_COMMAND tag result: $LAST_COMMAND"

    if [ -n "$LAST_COMMAND" ]; then
        # Extract command name from tag
        COMMAND_NAME=$(echo "$LAST_COMMAND" | sed 's/<command-name>\(.*\)<\/command-name>/\1/')
        log_debug "Extracted from tag: $COMMAND_NAME"
    else
        log_debug "No command found in transcript, exiting"
        exit 0
    fi
else
    # Extract skill name from the tool input
    COMMAND_NAME=$(echo "$LAST_SKILL" | jq -r '.input.skill // empty' 2>/dev/null || true)
    log_debug "Extracted skill (method 1): $COMMAND_NAME"

    if [ -z "$COMMAND_NAME" ]; then
        # Try alternative parsing
        COMMAND_NAME=$(echo "$LAST_SKILL" | grep -oP '"skill"\s*:\s*"[^"]+"' | sed 's/.*"\([^"]*\)"$/\1/' || true)
        log_debug "Extracted skill (method 2): $COMMAND_NAME"
    fi
fi

if [ -z "$COMMAND_NAME" ]; then
    log_debug "Could not extract command name, exiting"
    exit 0
fi

log_debug "Final COMMAND_NAME: $COMMAND_NAME"

# Save the current command to a state file
STATE_DIR="${HOME}/.claude/state"
mkdir -p "$STATE_DIR"

STATE_FILE="${STATE_DIR}/current-command-${SESSION_ID}.json"

log_debug "Saving to: $STATE_FILE"

# Save command info
cat > "$STATE_FILE" << EOF
{
    "command": "${COMMAND_NAME}",
    "timestamp": "$(date -Iseconds)",
    "session_id": "${SESSION_ID}"
}
EOF

log_debug "State file saved successfully"
log_debug "=== Hook finished ==="

exit 0
