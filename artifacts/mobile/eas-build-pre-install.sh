#!/usr/bin/env bash
set -euo pipefail

# On EAS Build workers the entire monorepo is uploaded.
# EAS may only run pnpm install inside the project dir (artifacts/mobile/).
# This hook navigates to the workspace root and installs all workspace
# packages so that pnpm symlinks (e.g. @workspace/api-client-react) are
# properly resolved before Gradle runs.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

echo "[pre-install] Workspace root: $WORKSPACE_ROOT"
cd "$WORKSPACE_ROOT"

echo "[pre-install] Running pnpm install at workspace root..."
pnpm install --frozen-lockfile

echo "[pre-install] Done."
