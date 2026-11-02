$ErrorActionPreference = 'Stop'
$nativeExecutable = Join-Path $PSScriptRoot 'build/Release/BloxdNative.exe'
if (-not (Test-Path -LiteralPath $nativeExecutable)) { & (Join-Path $PSScriptRoot 'Build.ps1') }
$nativeOutput = Join-Path $PSScriptRoot 'outputs'
New-Item -ItemType Directory -Path $nativeOutput -Force | Out-Null
# Hide the diagnostic console; GLFW creates the visible interactive window.
Start-Process -FilePath $nativeExecutable -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $nativeOutput 'interactive.log') -RedirectStandardError (Join-Path $nativeOutput 'interactive-error.log')
