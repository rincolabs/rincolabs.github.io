#!/usr/bin/env bash
# Build the site and publish dist/ to the `prod` branch for GitHub Pages.
#
# Uses a dedicated git worktree so your main working tree / current branch is
# never touched. Nothing is committed or pushed without explicit confirmation.
#
# Usage:
#   bash scripts/deploy.sh            # build + prepare + ask before commit/push
#   bash scripts/deploy.sh --dry-run  # build + prepare worktree, then stop (no commit)

set -euo pipefail

BRANCH="prod"
REMOTE="origin"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKTREE="$ROOT/.prod-worktree"
DIST="$ROOT/dist"

DRY_RUN=0
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=1

cd "$ROOT"

confirm() {
  # $1 = prompt. Returns 0 if user answers yes.
  local reply
  read -r -p "$1 [y/N] " reply
  [[ "$reply" =~ ^([yY]|[yY][eE][sS])$ ]]
}

cleanup() {
  git worktree remove --force "$WORKTREE" 2>/dev/null || true
  rm -rf "$WORKTREE"
}
trap cleanup EXIT

echo "==> Building site"
npm run build

echo "==> Preparing '$BRANCH' worktree"
# Remove any stale worktree from a previous run.
git worktree remove --force "$WORKTREE" 2>/dev/null || true
rm -rf "$WORKTREE"

if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
  # Local branch exists: check it out in the worktree.
  git worktree add "$WORKTREE" "$BRANCH"
elif git ls-remote --exit-code --heads "$REMOTE" "$BRANCH" >/dev/null 2>&1; then
  # Remote branch exists: track it.
  git fetch "$REMOTE" "$BRANCH"
  git worktree add "$WORKTREE" -b "$BRANCH" "$REMOTE/$BRANCH"
else
  # First deploy: create an orphan branch with no history.
  git worktree add --detach "$WORKTREE"
  git -C "$WORKTREE" checkout --orphan "$BRANCH"
fi

echo "==> Syncing dist/ into worktree"
# Replace all tracked content with the fresh build (keep .git).
find "$WORKTREE" -mindepth 1 -maxdepth 1 ! -name '.git' -exec rm -rf {} +
cp -a "$DIST"/. "$WORKTREE"/

cd "$WORKTREE"
git add -A

echo
echo "==> Changes staged for '$BRANCH':"
git status --short
echo
echo "Files that would be published:"
git ls-files | sed 's/^/  /'
echo

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "Dry run: stopping before commit. Worktree kept at: $WORKTREE"
  trap - EXIT   # keep the worktree for inspection
  exit 0
fi

if git diff --cached --quiet; then
  echo "No changes to publish. Done."
  exit 0
fi

if ! confirm "Commit these changes to '$BRANCH'?"; then
  echo "Aborted. Nothing committed."
  exit 0
fi

read -r -p "Commit message [deploy]: " MSG
MSG="${MSG:-deploy}"
git commit -m "$MSG"

if confirm "Push '$BRANCH' to $REMOTE?"; then
  git push "$REMOTE" "$BRANCH"
  echo "==> Pushed. If this is the first deploy, set GitHub Pages to serve the '$BRANCH' branch."
else
  echo "Committed locally on '$BRANCH' but not pushed."
fi
