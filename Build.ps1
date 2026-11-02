param([string]$BuildDirectory = (Join-Path $PSScriptRoot 'build'))
$ErrorActionPreference = 'Stop'
$nativeVsLocator = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio/Installer/vswhere.exe'
if (-not (Test-Path -LiteralPath $nativeVsLocator)) { throw 'Visual Studio Installer wurde nicht gefunden.' }
$nativeVsPath = & $nativeVsLocator -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
if (-not $nativeVsPath) { throw 'Desktopentwicklung mit C++ fehlt.' }
$nativeCMakePath = Join-Path $nativeVsPath 'Common7/IDE/CommonExtensions/Microsoft/CMake/CMake/bin/cmake.exe'
if (-not (Test-Path -LiteralPath $nativeCMakePath)) { throw 'C++-CMake-Tools fuer Windows fehlen.' }
& $nativeCMakePath -S $PSScriptRoot -B $BuildDirectory -A x64
if ($LASTEXITCODE -ne 0) { throw 'CMake-Konfiguration fehlgeschlagen.' }
& $nativeCMakePath --build $BuildDirectory --config Release --parallel 4
if ($LASTEXITCODE -ne 0) { throw 'Native Kompilierung fehlgeschlagen.' }
