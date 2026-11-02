$ErrorActionPreference = 'Stop'
$nativeBridgeExecutable = Join-Path $PSScriptRoot 'build-release/Release/BloxdNative.exe'
if (-not (Test-Path -LiteralPath $nativeBridgeExecutable)) { & (Join-Path $PSScriptRoot 'Build.ps1') -BuildDirectory (Join-Path $PSScriptRoot 'build-release') }
$nativeBridgeElectron = Join-Path $PSScriptRoot 'node_modules/electron/dist/electron.exe'
if (-not (Test-Path -LiteralPath $nativeBridgeElectron)) {
    & npm.cmd install --prefix $PSScriptRoot --no-fund --no-audit
    if ($LASTEXITCODE -ne 0) { throw 'Electron konnte nicht eingerichtet werden.' }
    & node.exe (Join-Path $PSScriptRoot 'node_modules/electron/install.js')
    if ($LASTEXITCODE -ne 0) { throw 'Die Electron-Laufzeit konnte nicht heruntergeladen werden.' }
}
$nativeBridgeLogs = Join-Path $PSScriptRoot 'outputs/bridge'
New-Item -ItemType Directory -Path $nativeBridgeLogs -Force | Out-Null
Start-Process -FilePath $nativeBridgeElectron -ArgumentList ('"' + $PSScriptRoot + '" --bridge-client') -WorkingDirectory $PSScriptRoot -WindowStyle Normal -RedirectStandardOutput (Join-Path $nativeBridgeLogs 'desktop.log') -RedirectStandardError (Join-Path $nativeBridgeLogs 'desktop-error-process.log')
