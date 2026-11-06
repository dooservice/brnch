#!/usr/bin/env bash
# Publishes a branch of this repository through a real gitd with brnch's gitd adapter. Only the
# gitd process receives the token; the test process, which plays the agent, has none. Afterwards
# it checks on the remote that the branch exists and deletes it.
#   GH_TOKEN    the short-lived token of the workflow run
#   REPOSITORY  owner/name of the remote
set -euo pipefail

repository="${REPOSITORY:?REPOSITORY is required}"
publisher_token="${GH_TOKEN:?GH_TOKEN is required}"
branch="agents/ci-publish-${GITHUB_RUN_ID:?GITHUB_RUN_ID is required}"
unset GH_TOKEN GITHUB_TOKEN

root="$(mktemp -d)"
mkdir -p "$root/workspaces"
curl -fsSL -o "$root/gitd" "https://github.com/dooservice/gitd/releases/download/0.15.1/gitd-linux-amd64"
chmod +x "$root/gitd"

cat > "$root/gitd.toml" <<TOML
socket = "$root/gitd.sock"
state = "$root/state"
roots = ["$root/workspaces"]

[[credentials]]
prefix = "https://github.com/$repository"
token_env = "GITD_PUBLISH_TOKEN"
token_user = "x-access-token"
TOML

GITD_PUBLISH_TOKEN="$publisher_token" "$root/gitd" serve --config "$root/gitd.toml" > "$root/gitd.log" 2>&1 &
gitd_process=$!

cleanup() {
  kill "$gitd_process" 2> /dev/null || true
  GH_TOKEN="$publisher_token" gh api -X DELETE "repos/$repository/git/refs/heads/$branch" > /dev/null 2>&1 || true
  echo "--- gitd.log ---"
  cat "$root/gitd.log"
}
trap cleanup EXIT

for _ in $(seq 100); do
  [ -S "$root/gitd.sock" ] && break
  sleep 0.1
done

export GITD_SOCKET="$root/gitd.sock"
export GITD_TEST_ROOT="$root/workspaces"
export GITD_TEST_REPOSITORY="https://github.com/$repository"
export GITD_TEST_PUBLISH_BRANCH="$branch"
cargo test -p brnch-gitd --test publish_with_gitd_tests -- --ignored --nocapture

remote_line="$(git ls-remote --heads "https://github.com/$repository" "$branch")"
echo "remote: $remote_line"
echo "$remote_line" | grep -q "refs/heads/$branch"
{
  echo "### Publicación real a GitHub a través de gitd"
  echo
  echo "- rama publicada: \`$branch\`"
  echo "- commit en el remoto: \`${remote_line%%$'\t'*}\`"
  echo "- el proceso que hizo de agente no tenía ninguna variable de token"
} >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
