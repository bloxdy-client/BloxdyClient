$ErrorActionPreference = 'Stop'
$launcherVsWhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio/Installer/vswhere.exe'
$launcherVs = & $launcherVsWhere -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
if (-not $launcherVs) { throw 'C++-Buildtools fehlen auf diesem Entwicklungsrechner.' }
$launcherCmake = Join-Path $launcherVs 'Common7/IDE/CommonExtensions/Microsoft/CMake/CMake/bin/cmake.exe'
$launcherBuild = Join-Path $PSScriptRoot 'build-launcher'
& $launcherCmake -S $PSScriptRoot -B $launcherBuild -A x64
if ($LASTEXITCODE -ne 0) { throw 'CMake-Konfiguration fehlgeschlagen.' }
& $launcherCmake --build $launcherBuild --config Release --target MemoryBudgetRunner MemoryBudgetTests --parallel 4
if ($LASTEXITCODE -ne 0) { throw 'Launcher-Helfer konnten nicht gebaut werden.' }
