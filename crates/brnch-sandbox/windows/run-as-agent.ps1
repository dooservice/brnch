# Runs one agent as the dedicated account and hands its output to this process's own, line by line.
# It runs as the person, which is why the agent's account never needs the person's secrets: the
# password and any API key stay protected for the person, and are only given to the agent's job.
param(
    [Parameter(Mandatory)][string]$Account,
    [Parameter(Mandatory)][string]$DataDirectory,
    [Parameter(Mandatory)][string]$JobFile,
    [Parameter(Mandatory)][string]$InnerScript,
    [Parameter(Mandatory)][string]$WorkspaceDirectory
)
$ErrorActionPreference = 'Stop'
# A PowerShell 7 parent leaves its module path behind, and Windows PowerShell cannot load its own modules from it.
$env:PSModulePath = [Environment]::GetEnvironmentVariable('PSModulePath', 'Machine')
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$credentialFile = Join-Path $DataDirectory 'agent-account.credential'
$environmentFile = Join-Path $DataDirectory 'agent-environment.credential'
$secure = Get-Content -LiteralPath $credentialFile | ConvertTo-SecureString
$credential = New-Object System.Management.Automation.PSCredential($Account, $secure)

# The agent is given what it needs to work, nothing more: its workspace and the folder of its program.
$job = Get-Content -LiteralPath $JobFile -Raw | ConvertFrom-Json
$program = (Get-Command $job.program -ErrorAction Stop).Source
& icacls.exe $WorkspaceDirectory /grant "${Account}:(OI)(CI)M" /T /C /Q | Out-Null
& icacls.exe (Split-Path -Parent $program) /grant "${Account}:(OI)(CI)RX" /C /Q | Out-Null
$environment = @{}
if (Test-Path -LiteralPath $environmentFile) {
    $protected = Get-Content -LiteralPath $environmentFile | ConvertTo-SecureString
    $json = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($protected))
    ($json | ConvertFrom-Json).PSObject.Properties | ForEach-Object { $environment[$_.Name] = $_.Value }
}
@{ program = $program; arguments = $job.arguments; directory = $job.directory; environment = $environment } |
    ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $JobFile -Encoding UTF8

$standardOutput = "$JobFile.out"
$standardError = "$JobFile.err"
foreach ($path in @($standardOutput, $standardError)) { Set-Content -LiteralPath $path -Value '' -NoNewline }
$process = Start-Process powershell.exe -Credential $credential -LoadUserProfile -WorkingDirectory $WorkspaceDirectory -PassThru `
    -RedirectStandardOutput $standardOutput -RedirectStandardError $standardError `
    -ArgumentList @('-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', "`"$InnerScript`"", '-JobFile', "`"$JobFile`"")
# Without holding the handle now, ExitCode comes back empty once the process has ended.
$null = $process.Handle

function Read-Increment([string]$path, [ref]$offset, $writer) {
    $stream = [IO.File]::Open($path, 'Open', 'Read', 'ReadWrite')
    try {
        if ($stream.Length -le $offset.Value) { return }
        $stream.Seek($offset.Value, 'Begin') | Out-Null
        $bytes = New-Object byte[] ($stream.Length - $offset.Value)
        $read = $stream.Read($bytes, 0, $bytes.Length)
        $offset.Value += $read
        $writer.Write([Text.Encoding]::UTF8.GetString($bytes, 0, $read))
        $writer.Flush()
    } finally { $stream.Dispose() }
}

$outputOffset = [long]0
$errorOffset = [long]0
try {
    while (-not $process.HasExited) {
        Read-Increment $standardOutput ([ref]$outputOffset) ([Console]::Out)
        Read-Increment $standardError ([ref]$errorOffset) ([Console]::Error)
        Start-Sleep -Milliseconds 100
    }
    $process.WaitForExit()
    Read-Increment $standardOutput ([ref]$outputOffset) ([Console]::Out)
    Read-Increment $standardError ([ref]$errorOffset) ([Console]::Error)
} finally {
    if (-not $process.HasExited) { $process.Kill() }
    Remove-Item -LiteralPath $JobFile, $standardOutput, $standardError -Force -ErrorAction SilentlyContinue
}
exit $process.ExitCode
