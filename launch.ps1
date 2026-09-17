[CmdletBinding()]
param([switch]$Pilot)
$ErrorActionPreference = 'Stop'
$gateway = Join-Path $HOME '.agents/skills/credentials-access/scripts/api-keys.ps1'
if (-not (Test-Path -LiteralPath $gateway)) { throw 'The scoped credentials-access gateway is not installed.' }
$grantText = & powershell.exe -NoProfile -File $gateway -Reason 'Verify scoped grant for user-authorized Dodeca Jev experiment' share list --output json
if ($LASTEXITCODE -ne 0) { throw 'Scoped Proton grant lookup failed.' }
$grant = $grantText | ConvertFrom-Json
if (@($grant.shares).Count -ne 1 -or $grant.shares[0].name -ne 'api_keys' -or $grant.shares[0].share_role -ne 'Viewer') { throw 'Unexpected Proton scope; credential retrieval stopped.' }
$keyText = & powershell.exe -NoProfile -File $gateway -Reason 'Use exactly typesafeai-tinkering-key for the authorized bounded Dodeca Jev experiment' item view --vault-name api_keys --item-title typesafeai-tinkering-key --field 'API Key'
if ($LASTEXITCODE -ne 0 -or -not $keyText) { throw 'The selected TypeSafe credential could not be read.' }
try {
    $env:TYPESAFE_API_KEY = ($keyText -join "`n").Trim()
    $keyText = $null
    Push-Location $PSScriptRoot
    try {
        if ($Pilot) { & node pilot.mjs } else { & node server.mjs }
        $runExit = $LASTEXITCODE
    } finally { Pop-Location }
} finally {
    [Environment]::SetEnvironmentVariable('TYPESAFE_API_KEY', $null, 'Process')
    $keyText = $null
}
exit $runExit
