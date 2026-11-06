# Prepares the local account agents run under. It has three phases so that only the one that must
# be elevated asks for administrator permission, once:
#   Prepare  as the person: makes a random password, keeps it protected for this person only
#            (DPAPI) and makes the folder where jobs are handed to the agent.
#   Create   as administrator: makes the account with that password and gives it its folder.
#   Status   prints "ready" when both are done.
param(
    [Parameter(Mandatory)][ValidateSet('Prepare', 'Create', 'Status')][string]$Phase,
    [Parameter(Mandatory)][string]$Account,
    [Parameter(Mandatory)][string]$DataDirectory
)
$ErrorActionPreference = 'Stop'
# A PowerShell 7 parent leaves its module path behind, and Windows PowerShell cannot load its own modules from it.
$env:PSModulePath = [Environment]::GetEnvironmentVariable('PSModulePath', 'Machine')
$credentialFile = Join-Path $DataDirectory 'agent-account.credential'
$jobsDirectory = Join-Path $DataDirectory 'agent-jobs'
$readyMarker = Join-Path $DataDirectory 'agent-account.ready'

function New-RandomPassword {
    $alphabet = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    $bytes = New-Object byte[] 24
    [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $letters = $bytes | ForEach-Object { $alphabet[$_ % $alphabet.Length] }
    return (($letters -join '') + 'aA1!')
}

if ($Phase -eq 'Prepare') {
    New-Item -ItemType Directory -Force $DataDirectory, $jobsDirectory | Out-Null
    if (-not (Test-Path -LiteralPath $credentialFile)) {
        $secure = ConvertTo-SecureString (New-RandomPassword) -AsPlainText -Force
        $secure | ConvertFrom-SecureString | Set-Content -LiteralPath $credentialFile
    }
    Write-Output 'prepared'
}

if ($Phase -eq 'Create') {
    $secure = Get-Content -LiteralPath $credentialFile | ConvertTo-SecureString
    $password = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
    & net.exe user $Account 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        & net.exe user $Account $password | Out-Null
    } else {
        & net.exe user $Account $password /add /y /passwordchg:no /expires:never | Out-Null
    }
    if ($LASTEXITCODE -ne 0) { throw "the account $Account could not be created" }
    & icacls.exe $jobsDirectory /inheritance:r /grant "${env:USERNAME}:(OI)(CI)F" "${Account}:(OI)(CI)M" | Out-Null
    Set-Content -LiteralPath $readyMarker -Value $Account
    Write-Output 'created'
}

if ($Phase -eq 'Status') {
    if ((Test-Path -LiteralPath $credentialFile) -and (Test-Path -LiteralPath $readyMarker)) { Write-Output 'ready' } else { Write-Output 'missing' }
}
