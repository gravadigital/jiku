#!/bin/bash
# JetStream state of the local stack, created with the same scripts a server uses: the module
# registry (JIKU_MODULES), the per-identity KV space (JIKU_KV) and the domain events stream
# (JIKU_EVENTS). Each script is idempotent.
set -euo pipefail
cd /nats
export NATS_BOX_INLINE=1 NATS_INTERNAL_URL=nats://nats:4222
./create-modules-kv.sh
./create-kv-space.sh
./create-events-stream.sh
