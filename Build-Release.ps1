param([switch]$KeepVersion)
$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
try {
    # A new release gets a new version. Carry each component after 9.
    # KeepVersion is only for rebuilding the same release.
    if (-not $KeepVersion) {
        $currentVersion = (Get-Content -LiteralPath (Join-Path $PSScriptRoot 'package.json') -Raw | ConvertFrom-Json).version
        if ($currentVersion -notmatch '^(\d+)\.(\d+)\.(\d+)$') { throw "Unsupported release version: $currentVersion" }
        $majorVersion = [int]$Matches[1]
        $minorVersion = [int]$Matches[2]
        $patchVersion = [int]$Matches[3]
        if ($patchVersion -ge 9) {
            $patchVersion = 0
            $minorVersion++
            if ($minorVersion -ge 10) {
                $minorVersion = 0
                $majorVersion++
            }
        } else {
            $patchVersion++
        }
        $nextVersion = "$majorVersion.$minorVersion.$patchVersion"
        & npm.cmd version $nextVersion --no-git-tag-version --ignore-scripts
        if ($LASTEXITCODE -ne 0) { throw 'Release version update failed.' }
    }
    $releaseVersion = (Get-Content -LiteralPath (Join-Path $PSScriptRoot 'package.json') -Raw | ConvertFrom-Json).version
    & (Join-Path $PSScriptRoot 'Build-Launcher.ps1')
    & npm.cmd run build:viewer
    if ($LASTEXITCODE -ne 0) { throw '3D-Viewer-Build fehlgeschlagen.' }
    & npm.cmd run dist:windows -- "--config.directories.output=dist-bloxdy-v$releaseVersion"
    if ($LASTEXITCODE -ne 0) { throw 'Windows-Paketierung fehlgeschlagen.' }
    & node (Join-Path $PSScriptRoot 'launcher/release-update.cjs') "dist-bloxdy-v$releaseVersion"
    if ($LASTEXITCODE -ne 0) { throw 'Update-Metadaten konnten nicht erstellt werden.' }
} finally { Pop-Location }
# Builds and packages only; never launches the installer, launcher or game.
