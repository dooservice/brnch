# Probes whether running an agent under a separate local Windows account hides the real user's
# git credentials (files, Credential Manager, OpenSSH agent) while the workspace stays usable.
# Each scenario runs the same probes as the current user (baseline) and as the dedicated account;
# the first scenario also grants the account one per-user tool folder and times the permission work
# on a large tree.
#
# CI (default):  scenarios are $Root and, when DEV_DRIVE is set, a ReFS Dev Drive. Never fails.
# Workstation:   -Workstation on a real PC. Needs an elevated PowerShell. It uses test file names
#                of its own, refuses to overwrite anything, also checks the tools found on your
#                PATH, and removes every account, file and folder it created, even on failure.
param(
    [switch]$Workstation,
    [string]$Root = 'C:\brnch-probe',
    [string]$SecondRoot = ''
)
$ErrorActionPreference = 'Continue'

$summaryFile = $env:GITHUB_STEP_SUMMARY
$agentAccount = 'brnchagent'
$agentPassword = 'Pr0be!' + [guid]::NewGuid().ToString('N').Substring(0, 8)
$probeScript = Join-Path $PSScriptRoot 'windows-probe-actions.ps1'
$sshCanaryName = if ($Workstation) { 'brnch-canary-id' } else { 'id_test' }
$ghCanaryName = if ($Workstation) { 'brnch-canary-hosts.yml' } else { 'hosts.yml' }
$sshDirectory = Join-Path $env:USERPROFILE '.ssh'
$ghDirectory = Join-Path $env:APPDATA 'GitHub CLI'
$sshCanaryPath = Join-Path $sshDirectory $sshCanaryName
$ghCanaryPath = Join-Path $ghDirectory $ghCanaryName
$userToolDirectory = Join-Path $env:USERPROFILE $(if ($Workstation) { 'brnch-check-tools' } else { 'tools' })
$userToolPath = Join-Path $userToolDirectory 'whoami-copy.exe'
$treeFileCount = 20000
$createdDirectories = @()
$toolList = ''
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
    $values = [ordered]@{
        '-RealProfile' = $env:USERPROFILE; '-RealAppData' = $env:APPDATA; '-Workspace' = $workspacePath
        '-Pool' = $poolPath; '-UserToolPath' = $userToolPath; '-SshCanaryName' = $sshCanaryName
        '-GhCanaryName' = $ghCanaryName; '-ToolList' = $toolList; '-OutputFile' = $outputFile
    }
    if (-not $credential) {
        $arguments = @('-NoProfile', '-File', $scriptPath)
        foreach ($name in $values.Keys) { $arguments += $name; $arguments += $values[$name] }
        $null = & powershell.exe @arguments
        return ''
    }
    $quotedArguments = @('-NoProfile', '-File', "`"$scriptPath`"")
    foreach ($name in $values.Keys) { $quotedArguments += $name; $quotedArguments += "`"$($values[$name])`"" }
    try {
        Start-Process powershell.exe -Credential $credential -LoadUserProfile -WorkingDirectory $workspacePath -Wait `
            -RedirectStandardError (Join-Path $workspacePath 'agent-errors.txt') -ArgumentList $quotedArguments
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

function New-DirectoryTracked([string]$path) {
    if (-not (Test-Path -LiteralPath $path)) {
        New-Item -ItemType Directory -Force $path | Out-Null
        $script:createdDirectories += $path
    }
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

function Remove-Everything {
    net user $agentAccount /delete 2>&1 | Out-Null
    cmdkey /delete:brnch-canary 2>&1 | Out-Null
    Remove-Item -LiteralPath $sshCanaryPath, $ghCanaryPath -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $userToolDirectory -Recurse -Force -ErrorAction SilentlyContinue
    foreach ($directory in $createdDirectories) {
        if ((Test-Path -LiteralPath $directory) -and -not (Get-ChildItem -LiteralPath $directory -Force)) {
            Remove-Item -LiteralPath $directory -Force -ErrorAction SilentlyContinue
        }
    }
    foreach ($path in @($Root, $SecondRoot)) {
        if ($path -and (Test-Path -LiteralPath $path)) { Remove-Item -LiteralPath $path -Recurse -Force -ErrorAction SilentlyContinue }
    }
    if ($Workstation -and $sshServiceWasStopped) { Stop-Service ssh-agent -ErrorAction SilentlyContinue }
}

if ($Workstation) {
    $principal = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        Write-Host 'Abre PowerShell con clic derecho > "Ejecutar como administrador" y vuelve a lanzar este script.'
        exit 1
    }
    foreach ($existing in @($sshCanaryPath, $ghCanaryPath, $Root, $userToolDirectory) + $(if ($SecondRoot) { @($SecondRoot) } else { @() })) {
        if (Test-Path -LiteralPath $existing) { Write-Host "Ya existe ${existing}: elige otra ruta o bórralo. No se toca nada."; exit 1 }
    }
    Write-Host @"
Este script va a crear, y borrar al terminar:
  - una cuenta local temporal llamada $agentAccount
  - archivos de prueba: $sshCanaryPath y $ghCanaryPath
  - una entrada de prueba en el Administrador de credenciales (brnch-canary)
  - las carpetas $Root$(if ($SecondRoot) { " y $SecondRoot" }) y $userToolDirectory
No lee ni modifica tus llaves ni tus credenciales reales.
"@
    if ((Read-Host 'Escribe SI para continuar') -ne 'SI') { Write-Host 'Cancelado.'; exit 0 }
    $toolNames = @('git', 'node', 'python', 'npm', 'cargo', 'claude', 'code')
    $entries = foreach ($toolName in $toolNames) {
        $command = Get-Command $toolName -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($command) { "$toolName=$($command.Source)" }
    }
    $toolList = $entries -join ';'
}

$sshServiceWasStopped = $false
try {
    New-DirectoryTracked $sshDirectory
    'canary-ssh-key' | Set-Content $sshCanaryPath
    New-DirectoryTracked $ghDirectory
    'canary-gh-token' | Set-Content $ghCanaryPath
    cmdkey /generic:brnch-canary /user:probe /pass:SECRET-CREDENTIAL-VALUE | Out-Null
    New-Item -ItemType Directory -Force $userToolDirectory | Out-Null
    Copy-Item "$env:SystemRoot\System32\whoami.exe" $userToolPath

    $sshService = Get-Service ssh-agent -ErrorAction SilentlyContinue
    if ($sshService -and $sshService.Status -ne 'Running') {
        Set-Service ssh-agent -StartupType Manual -ErrorAction SilentlyContinue
        Start-Service ssh-agent -ErrorAction SilentlyContinue
        $sshServiceWasStopped = $true
    }

    net user $agentAccount $agentPassword /add /y
    $securePassword = ConvertTo-SecureString $agentPassword -AsPlainText -Force
    $credential = New-Object System.Management.Automation.PSCredential($agentAccount, $securePassword)

    $report += "Sistema: $([Environment]::OSVersion.VersionString)`n`n"
    $report += Invoke-Scenario "carpeta $Root" $Root $true $credential
    if ($SecondRoot) {
        $report += "`n" + (Invoke-Scenario "carpeta $SecondRoot" $SecondRoot $false $credential)
    } elseif ($env:DEV_DRIVE) {
        $report += "`n" + (Invoke-Scenario "Dev Drive ReFS ($env:DEV_DRIVE)" (Join-Path $env:DEV_DRIVE 'brnch-probe') $false $credential)
    } else {
        $report += "`nNo se probó una segunda ubicación (Dev Drive).`n"
    }

    Write-Host $report
    if ($summaryFile) { Add-Content -Path $summaryFile -Value $report }
    if ($Workstation) {
        $reportPath = Join-Path ([Environment]::GetFolderPath('Desktop')) 'brnch-windows-check.md'
        Set-Content -LiteralPath $reportPath -Value $report -Encoding UTF8
        Write-Host "`nInforme guardado en $reportPath. Pégame su contenido: no incluye contraseñas ni contenido de tus archivos."
    }
} finally {
    Remove-Everything
}
