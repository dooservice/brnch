# Runs the same probes under whatever identity starts it and writes "label|result|detail" lines.
param(
    [string]$RealProfile,
    [string]$RealAppData,
    [string]$Workspace,
    [string]$Pool,
    [string]$OutputFile
)

$script:lines = @()

function Add-Result([string]$label, [string]$result, [string]$detail) {
    $script:lines += "$label|$result|$detail"
}

function Test-ReadAccess([string]$label, [string]$path) {
    try {
        $null = Get-Content -LiteralPath $path -ErrorAction Stop
        Add-Result $label 'accesible' ''
    } catch {
        $message = $_.Exception.Message
        if ($message.Length -gt 60) { $message = $message.Substring(0, 60) }
        Add-Result $label 'bloqueado' $message
    }
}

function Test-Command([string]$label, [scriptblock]$command) {
    try {
        $null = & $command 2>&1
        if ($LASTEXITCODE -eq 0) { Add-Result $label 'funciona' '' } else { Add-Result $label 'falla' "código $LASTEXITCODE" }
    } catch {
        Add-Result $label 'falla' $_.Exception.Message
    }
}

Test-ReadAccess 'leer %USERPROFILE%\.ssh\id_test' (Join-Path $RealProfile '.ssh\id_test')
Test-ReadAccess 'leer gh hosts.yml en AppData' (Join-Path $RealAppData 'GitHub CLI\hosts.yml')

$credentialList = (cmdkey /list 2>&1 | Out-String)
if ($credentialList -match 'brnch-canary') {
    Add-Result 'Credential Manager (cmdkey /list)' 'accesible' ''
} else {
    Add-Result 'Credential Manager (cmdkey /list)' 'bloqueado' 'no aparece el canario'
}

try {
    Set-Content -LiteralPath (Join-Path $Workspace 'written-by-probe.txt') -Value 'ok' -ErrorAction Stop
    Add-Result 'escribir en el workspace' 'funciona' ''
} catch {
    Add-Result 'escribir en el workspace' 'falla' $_.Exception.Message
}
Test-ReadAccess 'leer el pool' (Join-Path $Pool 'object.txt')
Test-Command 'git --version' { git --version }
Test-Command 'node -v' { node -v }
Test-Command 'git ls-remote por HTTPS' { git ls-remote https://github.com/dooservice/gitd HEAD }

Set-Content -LiteralPath $OutputFile -Value $script:lines
