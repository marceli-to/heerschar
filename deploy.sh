#!/bin/zsh
# Deploys the committed state of this repository to heerschar.kimiyu.ch (Hostpoint) over SSH.
# Run from your Mac: ./deploy.sh  (add --dry-run to only show what would change)
#
# The game is a static site: tested and built locally from a clean copy of HEAD, then dist/
# is synced to the web root. .well-known/ on the server is never deleted.
set -euo pipefail
cd "$(dirname "$0")"

HOST=pumutuxu@pumutuxu.myhostpoint.ch
DEST=/home/pumutuxu/www/heerschar.kimiyu.ch

DRY_RUN=()
[[ ${1:-} == --dry-run ]] && DRY_RUN=(--dry-run --itemize-changes)

if [[ -n $(git status --porcelain) ]]; then
  echo "You have uncommitted changes. Commit them first; only committed code is deployed."
  exit 1
fi

export NVM_DIR="$HOME/.nvm"
[[ -s $NVM_DIR/nvm.sh ]] && source "$NVM_DIR/nvm.sh" && nvm use --silent

STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT
# mktemp creates the folder as 700; rsync would copy that onto the web root and lock out the web server.
chmod 755 "$STAGE"

echo "Testing and building $(git rev-parse --short HEAD)…"
git archive HEAD | tar -x -C "$STAGE"
ln -s "$PWD/node_modules" "$STAGE/node_modules"
(cd "$STAGE" && npm test --silent && npm run build --silent)

# Folders 755, files 644 (macOS ships openrsync, which has no --chmod)
chmod -R u=rwX,go=rX "$STAGE/dist"

echo "Uploading…"
# One connection (one password prompt): the remote side creates the web root before rsync starts
rsync -rlptz --delete "${DRY_RUN[@]}" \
  --rsync-path "mkdir -p '$DEST' && rsync" \
  --filter 'protect /.well-known/' \
  "$STAGE/dist/" "$HOST:$DEST/"

if (( ${#DRY_RUN} )); then
  echo "Dry run only, nothing was changed."
else
  echo "Deployed $(git rev-parse --short HEAD) to https://heerschar.kimiyu.ch"
fi
