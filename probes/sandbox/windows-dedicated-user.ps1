# Probes whether running an agent under a separate local Windows account hides the real user's
# git credentials (files, Credential Manager, OpenSSH agent) while the workspace stays usable.
# Each scenario runs the same probes as the current user (baseline) and as the dedicated account;
# the first scenario also grants the account one per-user tool folder and times the permission work
# on a large tree. Scenarios: an NTFS folder and, when DEV_DRIVE is set, a ReFS Dev Drive.
# Prints tables and never fails, so every probe is reported. Meant for a disposable CI runner.
$ErrorActionPreference = 'Continue'

$summaryFile = $env:GITHUB_STEP_SUMMARY
$agentAccount = 'brnchagent'
$agentPassword = 'Pr0be!' + [guid]::NewGuid().ToString('N').Substring(0, 8)
$probeScript = Join-Path $PSScriptRoot 'windows-probe-actions.ps1'
$userToolDirectory = Join-Path $env:USERPROFILE 'tools'
$userToolPath = Join-Path $userToolDirectory 'whoami-copy.exe'
$treeFileCount = 20000
$report = ''

function Read-ProbeResults([string]$path) {
    $table = [ordered]@{}
    if (Test-Path $path) {
        foreach ($line in Get-Content $path) {
            $parts = $line -split '\|', 3
            $table[$parts[0]] = $parts[1] + $(if ($parts[2]) { " ($($parts[2]))" } else { '' })
        }
    }
    return $table
}

function Invoke-ProbeRun([string]$scriptPath, [string]$workspacePath, [string]$poolPath, [string]$outputFile, $credential) {
    $arguments = @('-NoProfile', '-File', $scriptPath, '-RealProfile', $env:USERPROFILE, '-RealAppData', $env:APPDATA,
        '-Workspace', $workspacePath, '-Pool', $poolPath, '-UserToolPath', $userToolPath, '-OutputFile', $outputFile)
    if (-not $credential) {
        $null = & powershell.exe @arguments
        return ''
    }
    try {
        Start-Process powershell.exe -Credential $credential -LoadUserProfile -WorkingDirectory $workspacePath -Wait `
            -RedirectStandardError (Join-Path $workspacePath 'agent-errors.txt') -ArgumentList $arguments
        return ''
    } catch {
        return $_.Exception.Message
    }
}

function New-FileTree([string]$directory, [int]$fileCount) {
    New-Item -ItemType Directory -Force $directory | Out-Null
    for ($index = 0; $index -lt $fileCount; $index++) {
        [IO.File]::WriteAllText("$directory\file$index.txt", 'x')
    }
}

function Format-ResultTable([System.Collections.IDictionary[]]$columns, [string[]]$headers) {
    $labels = $columns[0].Keys
    $text = '| Sonda | ' + ($headers -join ' | ') + " |`n|---|" + ('---|' * $headers.Count) + "`n"
    foreach ($label in $labels) {
        $cells = foreach ($column in $columns) { if ($column.Contains($label)) { $column[$label] } else { 'sin resultado' } }
        $text += "| $label | " + ($cells -join ' | ') + " |`n"
    }
    return $text
}

function Invoke-Scenario([string]$scenarioName, [string]$probeRoot, [bool]$withExtras, $credential) {
    $workspace = Join-Path $probeRoot 'workspace'
    $pool = Join-Path $probeRoot 'pool'
    $installedScript = Join-Path $probeRoot 'windows-probe-actions.ps1'
    New-Item -ItemType Directory -Force $workspace, $pool | Out-Null
    'pool object' | Set-Content (Join-Path $pool 'object.txt')
    Copy-Item $probeScript $installedScript

    icacls $probeRoot /grant "${agentAccount}:(RX)" | Out-Null
    icacls $installedScript /grant "${agentAccount}:(R)" | Out-Null
    icacls $workspace /grant "${agentAccount}:(OI)(CI)M" | Out-Null
    icacls $pool /grant "${agentAccount}:(OI)(CI)RX" | Out-Null

    $baselineFile = Join-Path $probeRoot 'baseline.txt'
    $agentFile = Join-Path $workspace 'agent-result.txt'
    $grantedFile = Join-Path $workspace 'agent-granted-result.txt'

    $null = Invoke-ProbeRun $installedScript $workspace $pool $baselineFile $null
    $launchFailure = Invoke-ProbeRun $installedScript $workspace $pool $agentFile $credential

    $columns = @((Read-ProbeResults $baselineFile), (Read-ProbeResults $agentFile))
    $headers = @('Usuario actual (línea base)', 'Cuenta del agente')

    $timings = ''
    if ($withExtras) {
        icacls $userToolDirectory /grant "${agentAccount}:(OI)(CI)RX" | Out-Null
        $null = Invoke-ProbeRun $installedScript $workspace $pool $grantedFile $credential
        $columns += , (Read-ProbeResults $grantedFile)
        $headers += 'Cuenta del agente tras conceder la carpeta de herramientas'

        $plainTree = Join-Path $probeRoot 'tree-plain'
        $grantedLater = Join-Path $probeRoot 'tree-granted-later'
        $inherited = Join-Path $probeRoot 'tree-inherited'
        New-Item -ItemType Directory -Force $inherited | Out-Null
        icacls $inherited /grant "${agentAccount}:(OI)(CI)M" | Out-Null
        $plainSeconds = [math]::Round((Measure-Command { New-FileTree $plainTree $treeFileCount }).TotalSeconds, 1)
        $null = New-FileTree $grantedLater $treeFileCount
        $grantSeconds = [math]::Round((Measure-Command { icacls $grantedLater /grant "${agentAccount}:(OI)(CI)RX" /T /C /Q | Out-Null }).TotalSeconds, 1)
        $inheritedSeconds = [math]::Round((Measure-Command { New-FileTree (Join-Path $inherited 'files') $treeFileCount }).TotalSeconds, 1)
        $timings = "`nTiempos con $treeFileCount archivos en ${scenarioName}:`n`n- crear el árbol sin permisos para la cuenta: $plainSeconds s`n- conceder permisos a un árbol ya creado: $grantSeconds s`n- crear el árbol dentro de una carpeta con permiso heredado: $inheritedSeconds s`n"
    }

    $text = "### Windows · cuenta local aparte · $scenarioName`n`n" + (Format-ResultTable $columns $headers) + $timings
    if ($launchFailure) { $text += "`n**No se pudo lanzar bajo la cuenta aparte:** $launchFailure`n" }
    $errorsPath = Join-Path $workspace 'agent-errors.txt'
    if (Test-Path $errorsPath) {
        $errorText = Get-Content $errorsPath -Raw
        if ($errorText) { $text += "`nSalida de error del agente:`n``````n$errorText`n```````n" }
    }
    return $text
}

New-Item -ItemType Directory -Force "$env:USERPROFILE\.ssh" | Out-Null
'canary-ssh-key' | Set-Content "$env:USERPROFILE\.ssh\id_test"
New-Item -ItemType Directory -Force "$env:APPDATA\GitHub CLI" | Out-Null
'canary-gh-token' | Set-Content "$env:APPDATA\GitHub CLI\hosts.yml"
cmdkey /generic:brnch-canary /user:probe /pass:SECRET-CREDENTIAL-VALUE | Out-Null
New-Item -ItemType Directory -Force $userToolDirectory | Out-Null
Copy-Item "$env:SystemRoot\System32\whoami.exe" $userToolPath

Set-Service ssh-agent -StartupType Manual -ErrorAction SilentlyContinue
Start-Service ssh-agent -ErrorAction SilentlyContinue

net user $agentAccount $agentPassword /add /y
$securePassword = ConvertTo-SecureString $agentPassword -AsPlainText -Force
$credential = New-Object System.Management.Automation.PSCredential($agentAccount, $securePassword)

$report += Invoke-Scenario 'carpeta NTFS' 'C:\brnch-probe' $true $credential
if ($env:DEV_DRIVE) {
    $report += "`n" + (Invoke-Scenario "Dev Drive ReFS ($env:DEV_DRIVE)" (Join-Path $env:DEV_DRIVE 'brnch-probe') $false $credential)
} else {
    $report += "`nNo hay Dev Drive en este runner.`n"
}

Write-Host $report
if ($summaryFile) { Add-Content -Path $summaryFile -Value $report }

net user $agentAccount /delete | Out-Null
cmdkey /delete:brnch-canary | Out-Null
Stop-Service ssh-agent -ErrorAction SilentlyContinue
