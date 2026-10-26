#!/usr/bin/env bash
# Usage: tools/run.sh <data.json> <outDir> <moneyflowRepoDir>
# Installs the Rubik font locally, links the preinstalled global Playwright, renders one PNG per bank.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
WORK="${RENDER_WORK:-/tmp/anchor-render}"
mkdir -p "$WORK"
cp "$HERE/render.mjs" "$WORK/render.mjs"
cd "$WORK"
[ -f package.json ] || npm init -y >/dev/null
[ -d node_modules/@fontsource/rubik ] || npm i @fontsource/rubik@5.1.0 >/dev/null 2>&1
G="$(npm root -g)"
mkdir -p node_modules
ln -sfn "$G/playwright" node_modules/playwright
ln -sfn "$G/playwright-core" node_modules/playwright-core
node render.mjs "$(realpath "$1")" "$(realpath -m "$2")" "$3" node_modules/@fontsource/rubik/files
