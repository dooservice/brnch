#!/usr/bin/env bash
# Probes four Seatbelt profiles on macOS and reports, for each, which credential locations stay
# readable and which common tools keep working:
#   files-only          hides credential files only (what Codex and Anthropic's sandbox do)
#   no-security-service also denies the Security service that guards the Keychain
#   strict              also hides the Keychain folders and the ssh-agent sockets
#   allowlist           denies everything, then allows only what the agent needs
# Prints a table and never fails, so every probe is reported.
set -u

summary_file="${GITHUB_STEP_SUMMARY:-/dev/null}"
profiles_directory="$(cd "$(dirname "$0")/macos" && pwd)"
real_home="$HOME"
work_directory="$(cd "$(mktemp -d)" && pwd -P)"
pool_directory="$(cd "$(mktemp -d)" && pwd -P)"
echo "pool object" > "$pool_directory/object"
generic_secret="SECRET-KEYCHAIN-VALUE"
internet_secret="SECRET-INTERNET-VALUE"

mkdir -p "$real_home/.ssh" "$real_home/.config/gh"
echo "canary-ssh-key" > "$real_home/.ssh/id_test"
echo "canary-gh-token" > "$real_home/.config/gh/hosts.yml"
echo "canary-git-credential" > "$real_home/.git-credentials"

security create-keychain -p probe-password probe.keychain
security unlock-keychain -p probe-password probe.keychain
security set-keychain-settings probe.keychain
security list-keychains -d user -s probe.keychain
security default-keychain -d user -s probe.keychain
security add-generic-password -a brnch -s brnch-canary -w "$generic_secret" -A probe.keychain
security add-internet-password -a probe -s github.com -r htps -w "$internet_secret" -A probe.keychain

eval "$(ssh-agent -s)" > /dev/null
launchd_style_directory="/private/tmp/com.apple.launchd.brnchprobe"
launchd_style_socket="$launchd_style_directory/Listeners"
mkdir -p "$launchd_style_directory"
ssh-agent -a "$launchd_style_socket" > /dev/null
agent_socket_real="$(python3 -c 'import os; print(os.path.realpath(os.environ["SSH_AUTH_SOCK"]))')"

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
keychain_and_socket_rules="(deny file-read* (subpath \"$real_home/Library/Keychains\") (subpath \"/Library/Keychains\"))
(deny network-outbound (remote unix-socket (path-literal \"$agent_socket_real\")))
(deny network-outbound (remote unix-socket (regex #\"^/private/tmp/com\\.apple\\.launchd\\.[^/]+/Listeners\$\")))"

printf '%s\n' "$files_only_rules" > "$work_directory/files-only.sb"
printf '%s\n%s\n' "$files_only_rules" "$security_service_rules" > "$work_directory/no-security-service.sb"
printf '%s\n%s\n%s\n' "$files_only_rules" "$security_service_rules" "$keychain_and_socket_rules" > "$work_directory/strict.sb"

{
  cat "$profiles_directory/seatbelt_base_policy.sbpl"
  cat "$profiles_directory/seatbelt_read_only_platform_defaults.sbpl"
  grep -v 'com.apple.SecurityServer' "$profiles_directory/seatbelt_network_policy.sbpl"
  cat <<RULES
(allow file-read-metadata)
(allow file-read*
  (subpath "/usr") (subpath "/bin") (subpath "/sbin") (subpath "/System")
  (subpath "/Library/Developer") (subpath "/opt/homebrew") (subpath "/private/etc")
  (subpath "/dev") (subpath "$work_directory") (subpath "$pool_directory"))
(allow file-map-executable
  (subpath "/usr") (subpath "/System") (subpath "/Library/Developer")
  (subpath "/opt/homebrew") (subpath "$work_directory"))
(allow file-write* (subpath "$work_directory") (subpath "/private/tmp") (subpath "/private/var/folders"))
(allow network*)
$keychain_and_socket_rules
RULES
} > "$work_directory/allowlist.sb"

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
    record "$profile_name" "$description" "control" "**falla**"
  fi
}

probe_secret_hidden() {
  local profile_name="$1" description="$2" secret="$3"; shift 3
  local output
  output="$(in_profile "$profile_name" "$@" 2>&1)"
  if [[ "$output" == *"$secret"* ]]; then
    record "$profile_name" "$description" "bloqueo esperado" "**ACCESIBLE**"
  else
    record "$profile_name" "$description" "bloqueo esperado" "bloqueado"
  fi
}

probe_agent_socket_hidden() {
  local profile_name="$1" description="$2" socket="$3"
  in_profile "$profile_name" env SSH_AUTH_SOCK="$socket" ssh-add -l > /dev/null 2>&1
  local exit_code=$?
  if [ "$exit_code" -eq 2 ]; then
    record "$profile_name" "$description" "bloqueo esperado" "bloqueado"
  else
    record "$profile_name" "$description" "bloqueo esperado" "**ACCESIBLE** (código $exit_code)"
  fi
}

baseline_output="$(security find-generic-password -s brnch-canary -w 2>&1)"
if [ "$baseline_output" = "$generic_secret" ]; then
  record "sin sandbox" "Keychain: contraseña genérica" "línea base" "accesible (la brecha existe)"
else
  record "sin sandbox" "Keychain: contraseña genérica" "línea base" "**no se pudo leer ni sin sandbox**: $baseline_output"
fi
baseline_helper="$(printf 'protocol=https\nhost=github.com\n\n' | /usr/bin/git credential-osxkeychain get 2>&1)"
if [[ "$baseline_helper" == *"$internet_secret"* ]]; then
  record "sin sandbox" "Keychain: git credential-osxkeychain" "línea base" "accesible (la brecha existe)"
else
  record "sin sandbox" "Keychain: git credential-osxkeychain" "línea base" "**no se pudo leer ni sin sandbox**"
fi

for profile_name in files-only no-security-service strict allowlist; do
  probe_blocked "$profile_name" "leer ~/.ssh/id_test" cat "$real_home/.ssh/id_test"
  probe_blocked "$profile_name" "leer ~/.config/gh/hosts.yml" cat "$real_home/.config/gh/hosts.yml"
  probe_blocked "$profile_name" "leer ~/.git-credentials" cat "$real_home/.git-credentials"
  probe_secret_hidden "$profile_name" "Keychain: contraseña genérica" "$generic_secret" security find-generic-password -s brnch-canary -w
  probe_secret_hidden "$profile_name" "Keychain: contraseña de internet" "$internet_secret" security find-internet-password -s github.com -w
  probe_secret_hidden "$profile_name" "Keychain: git credential-osxkeychain" "$internet_secret" sh -c "printf 'protocol=https\nhost=github.com\n\n' | /usr/bin/git credential-osxkeychain get"
  probe_agent_socket_hidden "$profile_name" "agente SSH (socket propio)" "$SSH_AUTH_SOCK"
  probe_agent_socket_hidden "$profile_name" "agente SSH (ruta estilo launchd)" "$launchd_style_socket"

  probe_working "$profile_name" "escribir en el workspace" sh -c "echo ok > '$work_directory/file-$profile_name'"
  probe_working "$profile_name" "leer el pool" cat "$pool_directory/object"
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
probe_blocked allowlist "listar el directorio personal" ls "$real_home"

report="### macOS · Seatbelt ($(sw_vers -productVersion), $(uname -m))

| Perfil | Sonda | Esperado | Resultado |
|---|---|---|---|
$rows"
echo "$report"
echo "$report" >> "$summary_file"

if [[ "$rows" == *"allowlist | "*"**falla**"* ]]; then
  echo "--- denegaciones del sandbox (últimos 3 minutos) ---"
  log show --last 3m --predicate 'sender == "Sandbox"' --style compact 2>/dev/null | grep -i deny | tail -40 || true
fi
