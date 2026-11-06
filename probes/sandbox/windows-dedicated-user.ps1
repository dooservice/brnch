# Probes whether running an agent under a separate local Windows account hides the real user's
# git credentials (files and Credential Manager) while the workspace stays usable. The same probes
# run first as the current user (baseline) and then as the dedicated account.
# Prints a table and never fails, so every probe is reported. Meant for a disposable CI runner.
$ErrorActionPreference = 'Continue'

$summaryFile = $env:GITHUB_STEP_SUMMARY
$agentAccount = 'brnchagent'
$agentPassword = 'Pr0be!' + [guid]::NewGuid().ToString('N').Substring(0, 8)
$probeRoot = 'C:\brnch-probe'
$workspace = Join-Path $probeRoot 'workspace'
$pool = Join-Path $probeRoot 'pool'
$probeScript = Join-Path $PSScriptRoot 'windows-probe-actions.ps1'
$installedProbeScript = Join-Path $probeRoot 'windows-probe-actions.ps1'

New-Item -ItemType Directory -Force $workspace, $pool | Out-Null
'pool object' | Set-Content (Join-Path $pool 'object.txt')
Copy-Item $probeScript $installedProbeScript

New-Item -ItemType Directory -Force "$env:USERPROFILE\.ssh" | Out-Null
'canary-ssh-key' | Set-Content "$env:USERPROFILE\.ssh\id_test"
New-Item -ItemType Directory -Force "$env:APPDATA\GitHub CLI" | Out-Null
'canary-gh-token' | Set-Content "$env:APPDATA\GitHub CLI\hosts.yml"
cmdkey /generic:brnch-canary /user:probe /pass:SECRET-CREDENTIAL-VALUE | Out-Null

net user $agentAccount $agentPassword /add /y
icacls $probeRoot /grant "${agentAccount}:(RX)" | Out-Null
icacls $installedProbeScript /grant "${agentAccount}:(R)" | Out-Null
icacls $workspace /grant "${agentAccount}:(OI)(CI)M" | Out-Null
icacls $pool /grant "${agentAccount}:(OI)(CI)RX" | Out-Null

$baselineFile = Join-Path $probeRoot 'baseline.txt'
$agentFile = Join-Path $workspace 'agent-result.txt'
$agentErrors = Join-Path $workspace 'agent-errors.txt'

& powershell.exe -NoProfile -File $installedProbeScript -RealProfile $env:USERPROFILE -RealAppData $env:APPDATA -Workspace $workspace -Pool $pool -OutputFile $baselineFile

$securePassword = ConvertTo-SecureString $agentPassword -AsPlainText -Force
$credential = New-Object System.Management.Automation.PSCredential($agentAccount, $securePassword)
$launchFailure = ''
try {
    Start-Process powershell.exe -Credential $credential -LoadUserProfile -WorkingDirectory $workspace -Wait `
        -RedirectStandardError $agentErrors `
        -ArgumentList @('-NoProfile', '-File', $installedProbeScript, '-RealProfile', $env:USERPROFILE, '-RealAppData', $env:APPDATA, '-Workspace', $workspace, '-Pool', $pool, '-OutputFile', $agentFile)
} catch {
    $launchFailure = $_.Exception.Message
}

function Read-ProbeResults([string]$path) {
    $table = @{}
    if (Test-Path $path) {
        foreach ($line in Get-Content $path) {
            $parts = $line -split '\|', 3
            $table[$parts[0]] = $parts[1] + $(if ($parts[2]) { " ($($parts[2]))" } else { '' })
        }
    }
    return $table
}

$baseline = Read-ProbeResults $baselineFile
$agent = Read-ProbeResults $agentFile

$rows = ''
foreach ($label in $baseline.Keys) {
    $agentResult = if ($agent.ContainsKey($label)) { $agent[$label] } else { 'sin resultado' }
    $rows += "| $label | $($baseline[$label]) | $agentResult |`n"
}

$report = "### Windows · cuenta local aparte`n`n| Sonda | Usuario actual (línea base) | Cuenta del agente |`n|---|---|---|`n$rows"
if ($launchFailure) { $report += "`n**No se pudo lanzar bajo la cuenta aparte:** $launchFailure`n" }
if (Test-Path $agentErrors) {
    $errorText = (Get-Content $agentErrors -Raw)
    if ($errorText) { $report += "`nSalida de error del agente:`n``````n$errorText`n```````n" }
}
Write-Host $report
if ($summaryFile) { Add-Content -Path $summaryFile -Value $report }

net user $agentAccount /delete | Out-Null
cmdkey /delete:brnch-canary | Out-Null
