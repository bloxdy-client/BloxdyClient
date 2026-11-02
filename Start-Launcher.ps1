$ErrorActionPreference = 'Stop'
$launcherElectron = Join-Path $PSScriptRoot 'node_modules/electron/dist/electron.exe'
if (-not (Test-Path -LiteralPath $launcherElectron)) { throw 'Electron fehlt. Bitte zuerst npm install im Projekt ausführen.' }
$launcherLogs = Join-Path $PSScriptRoot 'outputs/launcher'
New-Item -ItemType Directory -Path $launcherLogs -Force | Out-Null
Start-Process -FilePath $launcherElectron -ArgumentList ('"' + $PSScriptRoot + '"') -WorkingDirectory $PSScriptRoot -WindowStyle Normal -RedirectStandardOutput (Join-Path $launcherLogs 'launcher.log') -RedirectStandardError (Join-Path $launcherLogs 'launcher-error.log')
