#!/bin/bash
# The NATS identity of the local stack (operator, accounts, auth callout, sentinels), generated
# once into the `nats-creds` volume with the same script a server uses (deploy/nats/bootstrap.sh).
# /nats is a copy of deploy/nats with the volume mounted on creds/.
set -euo pipefail
cd /nats
if [[ -f creds/nats-resolver.conf ]]; then
  echo "nats identity: already generated"
else
  ./bootstrap.sh
fi
# Local only: every container of the stack reads these files, whatever its user.
chmod 644 creds/* 2>/dev/null || true
