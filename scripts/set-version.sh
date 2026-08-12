#!/usr/bin/env bash
#
# Sets the version of the whole monorepo in one shot.
#
# Every service and shared package carries the same number — see the versioning
# policy in CHANGELOG.md. That number lives in more than one place, so bumping it
# by hand means editing eight package.json files, the lockfile and the four
# *_VERSION defaults in deploy/.env.dist without missing one. This script is the
# single entry point.
#
# Usage:
#   scripts/set-version.sh 1.2.3
#   scripts/set-version.sh --check      # verify everything already agrees
#
# The release workflow runs --check against the git tag, so a tag that disagrees
# with the tree fails the build instead of publishing mislabelled images.
#
# Only the versioned template, deploy/.env.dist, is checked. An actual deploy/.env
# is free to point the same variables at the mutable `dev` tag — that file is not
# versioned and this script never reads it.

set -euo pipefail

cd "$(dirname "$0")/.."

WORKSPACES=(
  package.json
  api/package.json
  core/package.json
  web/package.json
  opus-web/package.json
  packages/models/package.json
  packages/nats-protocol/package.json
  packages/zitadel-auth/package.json
)

ENV_DIST=deploy/.env.dist
ENV_VARS=(API_VERSION CORE_VERSION WEB_VERSION OPUS_WEB_VERSION)

die() { echo "error: $*" >&2; exit 1; }

read_version() {
  node -p "require('./$1').version"
}

# --check: report disagreement instead of writing. Prints every version it found
# so a CI failure shows the mismatch rather than just an exit code.
if [[ "${1:-}" == "--check" ]]; then
  expected=$(read_version package.json)
  status=0

  for ws in "${WORKSPACES[@]}"; do
    got=$(read_version "$ws")
    if [[ "$got" != "$expected" ]]; then
      echo "MISMATCH $ws: $got (root says $expected)"
      status=1
    fi
  done

  for var in "${ENV_VARS[@]}"; do
    got=$(grep -E "^${var}=" "$ENV_DIST" | cut -d= -f2-)
    if [[ "$got" != "$expected" ]]; then
      echo "MISMATCH $ENV_DIST $var: $got (root says $expected)"
      status=1
    fi
  done

  if [[ $status -eq 0 ]]; then
    echo "ok: everything reports $expected"
  fi
  exit $status
fi

VERSION="${1:-}"
[[ -n "$VERSION" ]] || die "usage: $0 <version> | --check"

# Reject anything that is not plain semver. A leading 'v' is the common slip:
# the git tag carries it, the package.json must not.
if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$ ]]; then
  die "'$VERSION' is not semver (expected 1.2.3 or 1.2.3-rc.1, with no leading 'v')"
fi

echo "Setting the monorepo to $VERSION"

for ws in "${WORKSPACES[@]}"; do
  node -e "
    const fs = require('fs');
    const p = '$ws';
    const d = JSON.parse(fs.readFileSync(p, 'utf8'));
    d.version = '$VERSION';
    fs.writeFileSync(p, JSON.stringify(d, null, 2) + '\n');
  "
  echo "  $ws"
done

# The *_VERSION defaults pick which published image tag a compose pulls. They
# track the release so a fresh clone of a tagged tree points at matching images.
for var in "${ENV_VARS[@]}"; do
  grep -qE "^${var}=" "$ENV_DIST" || die "$ENV_DIST has no $var to update"
  sed -i -E "s|^${var}=.*|${var}=${VERSION}|" "$ENV_DIST"
  echo "  $ENV_DIST $var"
done

# Keeps the lockfile's workspace entries in step. --package-lock-only avoids
# touching node_modules.
npm install --package-lock-only >/dev/null 2>&1
echo "  package-lock.json"

echo
echo "Done. Review with 'git diff', then:"
echo "  - move the CHANGELOG's [Unreleased] entries under [$VERSION]"
echo "  - commit, merge to main, and tag v$VERSION"
