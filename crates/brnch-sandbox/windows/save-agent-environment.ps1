# Keeps the variables agents receive (such as an API key) protected for this person only (DPAPI).
# The values arrive in an environment variable, never on the command line, so they do not show in
# a list of running processes.
param([Parameter(Mandatory)][string]$DataDirectory, [switch]$Clear)
$ErrorActionPreference = 'Stop'
# A PowerShell 7 parent leaves its module path behind, and Windows PowerShell cannot load its own modules from it.
$env:PSModulePath = [Environment]::GetEnvironmentVariable('PSModulePath', 'Machine')
$file = Join-Path $DataDirectory 'agent-environment.credential'
if ($Clear) {
    Remove-Item -LiteralPath $file -Force -ErrorAction SilentlyContinue
    Write-Output 'cleared'
    exit 0
}
New-Item -ItemType Directory -Force $DataDirectory | Out-Null
ConvertTo-SecureString $env:BRNCH_AGENT_ENVIRONMENT -AsPlainText -Force | ConvertFrom-SecureString | Set-Content -LiteralPath $file
Write-Output 'saved'
