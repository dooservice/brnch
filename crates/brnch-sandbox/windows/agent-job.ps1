# Runs inside the agent's own account: it starts the program with the arguments and environment
# the job file names. Output goes where the starter pointed it, so nothing is relayed here.
param([Parameter(Mandatory)][string]$JobFile)
$ErrorActionPreference = 'Stop'
# A PowerShell 7 parent leaves its module path behind, and Windows PowerShell cannot load its own modules from it.
$env:PSModulePath = [Environment]::GetEnvironmentVariable('PSModulePath', 'Machine')
$job = Get-Content -LiteralPath $JobFile -Raw | ConvertFrom-Json

function ConvertTo-CommandLineArgument([string]$text) {
    if ($text -ne '' -and $text -notmatch '[\s"]') { return $text }
    $escaped = [regex]::Replace($text, '(\\*)"', '$1$1\"')
    $escaped = [regex]::Replace($escaped, '(\\+)$', '$1$1')
    return '"' + $escaped + '"'
}

$info = New-Object Diagnostics.ProcessStartInfo
$info.FileName = $job.program
$info.Arguments = (@($job.arguments) | ForEach-Object { ConvertTo-CommandLineArgument ([string]$_) }) -join ' '
$info.WorkingDirectory = $job.directory
$info.UseShellExecute = $false
$info.CreateNoWindow = $true
$job.environment.PSObject.Properties | ForEach-Object { $info.EnvironmentVariables[$_.Name] = [string]$_.Value }
$process = [Diagnostics.Process]::Start($info)
$process.WaitForExit()
exit $process.ExitCode
