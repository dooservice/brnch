#!/usr/bin/env bash
# Probes whether a bubblewrap sandbox hides git credentials from a process while its
# workspace stays usable. Prints a table and never fails, so every probe is reported.
set -u

summary_file="${GITHUB_STEP_SUMMARY:-/dev/null}"
real_home="$HOME"
workspace_directory="$(mktemp -d)"
pool_directory="$(mktemp -d)"
echo "pool object" > "$pool_directory/object"

mkdir -p "$real_home/.ssh" "$real_home/.config/gh"
echo "canary-ssh-key" > "$real_home/.ssh/id_test"
echo "canary-gh-token" > "$real_home/.config/gh/hosts.yml"
echo "canary-git-credential" > "$real_home/.git-credentials"
eval "$(ssh-agent -s)" > /dev/null

sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0 > /dev/null 2>&1 || true
sudo apt-get install -y bubblewrap > /dev/null 2>&1

resolver_binds=()
if [ -d /run/systemd/resolve ]; then
  resolver_binds=(--ro-bind /run/systemd/resolve /run/systemd/resolve)
fi

run_sandboxed() {
  bwrap --ro-bind /usr /usr --ro-bind /etc /etc "${resolver_binds[@]}" \
    --symlink usr/bin /bin --symlink usr/lib /lib --symlink usr/lib64 /lib64 \
    --proc /proc --dev /dev --tmpfs /tmp \
    --bind "$workspace_directory" "$workspace_directory" \
    --ro-bind "$pool_directory" "$pool_directory" \
    --chdir "$workspace_directory" --unshare-pid --die-with-parent \
    --setenv HOME /nonexistent "$@"
}

rows=""
record() { rows+="| $1 | $2 | $3 |"$'\n'; }

expect_blocked() {
  local description="$1"; shift
  if run_sandboxed "$@" > /dev/null 2>&1; then
    record "$description" "bloqueo esperado" "**ACCESIBLE**"
  else
    record "$description" "bloqueo esperado" "bloqueado"
  fi
}

expect_working() {
  local description="$1"; shift
  if run_sandboxed "$@" > /dev/null 2>&1; then
    record "$description" "control: debe funcionar" "funciona"
  else
    record "$description" "control: debe funcionar" "**FALLA**"
  fi
}

if cat "$real_home/.ssh/id_test" > /dev/null 2>&1; then
  record "leer ~/.ssh/id_test sin sandbox" "línea base" "accesible (la brecha existe)"
fi

expect_blocked "leer ~/.ssh/id_test" cat "$real_home/.ssh/id_test"
expect_blocked "leer ~/.config/gh/hosts.yml" cat "$real_home/.config/gh/hosts.yml"
expect_blocked "leer ~/.git-credentials" cat "$real_home/.git-credentials"

run_sandboxed env SSH_AUTH_SOCK="$SSH_AUTH_SOCK" ssh-add -l > /dev/null 2>&1
agent_exit_code=$?
if [ "$agent_exit_code" -eq 2 ]; then
  record "hablar con el agente SSH" "bloqueo esperado" "bloqueado"
else
  record "hablar con el agente SSH" "bloqueo esperado" "**ACCESIBLE** (código $agent_exit_code)"
fi

expect_working "escribir en el workspace" sh -c "echo ok > '$workspace_directory/file'"
expect_working "leer el pool" cat "$pool_directory/object"
expect_working "git --version" git --version
expect_working "HTTPS a la API de GitHub" curl -sS -o /dev/null --max-time 20 https://api.github.com

report="### Linux · bubblewrap

| Sonda | Esperado | Resultado |
|---|---|---|
$rows"
echo "$report"
echo "$report" >> "$summary_file"
