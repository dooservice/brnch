#!/usr/bin/env bash
# Probes three Seatbelt profiles on macOS: one that only hides credential files (what Codex and
# Anthropic's sandbox do), one that also denies the Security service, and a strict one. For each
# it reports whether the Keychain canary can be read and which common tools keep working.
# Prints a table and never fails, so every probe is reported.
set -u

summary_file="${GITHUB_STEP_SUMMARY:-/dev/null}"
real_home="$HOME"
work_directory="$(mktemp -d)"
secret_value="SECRET-KEYCHAIN-VALUE"

mkdir -p "$real_home/.ssh" "$real_home/.config/gh"
echo "canary-ssh-key" > "$real_home/.ssh/id_test"
echo "canary-gh-token" > "$real_home/.config/gh/hosts.yml"
echo "canary-git-credential" > "$real_home/.git-credentials"

security create-keychain -p probe-password probe.keychain
security unlock-keychain -p probe-password probe.keychain
security set-keychain-settings probe.keychain
security list-keychains -d user -s probe.keychain
security default-keychain -d user -s probe.keychain
security add-generic-password -a brnch -s brnch-canary -w "$secret_value" -A probe.keychain
eval "$(ssh-agent -s)" > /dev/null

cat > "$work_directory/main.go" <<'GO'
package main

import (
	"fmt"
	"net/http"
	"os"
)

func main() {
	response, failure := http.Get("https://api.github.com")
	if failure != nil {
		fmt.Println(failure)
		os.Exit(1)
	}
	response.Body.Close()
}
GO
if command -v go > /dev/null; then
  (cd "$work_directory" && go mod init probe && go build -o fetcher .) > "$work_directory/go-build.log" 2>&1 || cat "$work_directory/go-build.log"
else
  echo "go no está instalado en este runner"
fi

files_only_rules="(version 1)
(allow default)
(deny file-read* (subpath \"$real_home/.ssh\") (subpath \"$real_home/.config/gh\") (literal \"$real_home/.git-credentials\"))"
security_service_rules='(deny mach-lookup (global-name "com.apple.SecurityServer") (global-name "com.apple.securityd.xpc") (global-name "com.apple.secd"))'
agent_socket_real="$(python3 -c 'import os; print(os.path.realpath(os.environ["SSH_AUTH_SOCK"]))')"
strict_extra_rules="(deny file-read* (subpath \"$real_home/Library/Keychains\") (subpath \"/Library/Keychains\"))
(deny network-outbound (remote unix-socket (path-literal \"$agent_socket_real\")))
(deny network-outbound (remote unix-socket (regex #\"^/private/tmp/com\\.apple\\.launchd\\.[^/]+/Listeners\$\")))"

printf '%s\n' "$files_only_rules" > "$work_directory/files-only.sb"
printf '%s\n%s\n' "$files_only_rules" "$security_service_rules" > "$work_directory/no-security-service.sb"
printf '%s\n%s\n%s\n' "$files_only_rules" "$security_service_rules" "$strict_extra_rules" > "$work_directory/strict.sb"

rows=""
record() { rows+="| $1 | $2 | $3 | $4 |"$'\n'; }

in_profile() {
  local profile_name="$1"; shift
  sandbox-exec -f "$work_directory/$profile_name.sb" "$@"
}

probe_blocked() {
  local profile_name="$1" description="$2"; shift 2
  if in_profile "$profile_name" "$@" > /dev/null 2>&1; then
    record "$profile_name" "$description" "bloqueo esperado" "**ACCESIBLE**"
  else
    record "$profile_name" "$description" "bloqueo esperado" "bloqueado"
  fi
}

probe_working() {
  local profile_name="$1" description="$2"; shift 2
  if in_profile "$profile_name" "$@" > /dev/null 2>&1; then
    record "$profile_name" "$description" "control" "funciona"
  else
    record "$profile_name" "$description" "control" "falla"
  fi
}

keychain_output="$(security find-generic-password -s brnch-canary -w 2>&1)"
if [ "$keychain_output" = "$secret_value" ]; then
  record "sin sandbox" "Keychain: security find-generic-password" "línea base" "accesible (la brecha existe)"
else
  record "sin sandbox" "Keychain: security find-generic-password" "línea base" "**no se pudo leer ni sin sandbox**: $keychain_output"
fi

for profile_name in files-only no-security-service strict; do
  probe_blocked "$profile_name" "leer ~/.ssh/id_test" cat "$real_home/.ssh/id_test"
  probe_blocked "$profile_name" "leer ~/.config/gh/hosts.yml" cat "$real_home/.config/gh/hosts.yml"

  sandboxed_output="$(in_profile "$profile_name" security find-generic-password -s brnch-canary -w 2>&1)"
  if [ "$sandboxed_output" = "$secret_value" ]; then
    record "$profile_name" "Keychain: security find-generic-password" "bloqueo esperado" "**ACCESIBLE**"
  else
    record "$profile_name" "Keychain: security find-generic-password" "bloqueo esperado" "bloqueado"
  fi

  in_profile "$profile_name" ssh-add -l > /dev/null 2>&1
  agent_exit_code=$?
  if [ "$agent_exit_code" -eq 2 ]; then
    record "$profile_name" "hablar con el agente SSH" "bloqueo esperado" "bloqueado"
  else
    record "$profile_name" "hablar con el agente SSH" "bloqueo esperado" "**ACCESIBLE** (código $agent_exit_code)"
  fi

  probe_working "$profile_name" "escribir en el workspace" sh -c "echo ok > '$work_directory/file-$profile_name'"
  probe_working "$profile_name" "git --version" git --version
  probe_working "$profile_name" "HTTPS con curl del sistema" /usr/bin/curl -sS -o /dev/null --max-time 20 https://api.github.com
  probe_working "$profile_name" "HTTPS con Python" python3 -c "import urllib.request as u; u.urlopen('https://api.github.com', timeout=20)"
  if command -v node > /dev/null; then
    probe_working "$profile_name" "HTTPS con Node" node -e "fetch('https://api.github.com').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
  fi
  if [ -x "$work_directory/fetcher" ]; then
    probe_working "$profile_name" "HTTPS con un binario de Go (como gh)" "$work_directory/fetcher"
  fi
  probe_working "$profile_name" "git ls-remote por HTTPS" git ls-remote https://github.com/dooservice/gitd HEAD
done

report="### macOS · Seatbelt ($(sw_vers -productVersion), $(uname -m))

| Perfil | Sonda | Esperado | Resultado |
|---|---|---|---|
$rows"
echo "$report"
echo "$report" >> "$summary_file"
