#!/usr/bin/env bash
# Take a released graph and the engine from ~/fssai-intake-lab. Run the lab's own checks first
# (node cli/lab.mjs check --graph ...; npm test), then this, then: node scripts/intake/check.mjs
# Usage: scripts/intake/sync-from-lab.sh [VERSION]   (default 2)
set -euo pipefail
LAB=${LAB:-$HOME/fssai-intake-lab}
V=${1:-2}
cd "$(dirname "$0")/../.."
cp "$LAB"/engine/{automaton,conditions,graph,index,text,verdict,verdict-kob}.js server/intake/engine/
sed -i '1i // Copied from ~/fssai-intake-lab/engine (see scripts/intake/sync-from-lab.sh); change it there, not here.' server/intake/engine/index.js
cp "$LAB/graph/graph.v$V.json" config/intake/
cp "$LAB/tests/cases.v$V.json" "$LAB/cli/walk.js" "$LAB/cli/cases.js" scripts/intake/
cp "$LAB/loop/records.mjs" server/intake/records-format.mjs
cp "$LAB/loop/clm-format.mjs" server/intake/clm-format.mjs
node scripts/intake/export-records.mjs "$LAB" "$V"
echo "synced engine + graph v$V from $LAB @ $(git -C "$LAB" rev-parse --short HEAD)"
git status --short server/intake config/intake scripts/intake
