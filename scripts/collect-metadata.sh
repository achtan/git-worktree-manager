#!/bin/bash
set -euo pipefail

# Collect metadata for research/plan documents
# Outputs JSON to stdout

date_iso=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
date_short=$(date +"%Y-%m-%d")
user="${USER:-unknown}"
git_commit=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
branch=$(git branch --show-current 2>/dev/null || echo "unknown")

# Get repository from gh CLI or git remote
repo=""
if command -v gh &>/dev/null; then
  repo=$(gh repo view --json nameWithOwner -q '.nameWithOwner' 2>/dev/null || echo "")
fi
if [[ -z "$repo" ]]; then
  repo=$(git remote get-url origin 2>/dev/null | sed 's/.*github.com[:/]\(.*\)\.git/\1/' || echo "unknown")
fi

cat <<EOF
{
  "date_iso": "$date_iso",
  "date_short": "$date_short",
  "user": "$user",
  "git_commit": "$git_commit",
  "branch": "$branch",
  "repository": "$repo"
}
EOF
