# Bloxdy Client

<p align="center">
  <img src="launcher/assets/bloxdy-icon.png" alt="Bloxdy Client mascot" width="112">
</p>

**Your Bloxd.io setup, in one place.**

[Features](#features-and-current-limits) · [Getting started](#getting-started) ·
[Development](#build-and-verification) · [Contributing](CONTRIBUTING.md)

Bloxdy Client is a Windows launcher for Bloxd.io with profiles, optional mods,
shader controls, texture selection, and a character preview. This repository
contains the Bloxdy Client source, experimental native renderer, tests, and
technical history. The current source version is **1.9.9**.

**[Download the Windows installer](https://github.com/bloxdy-client/BloxdyClient/releases/latest/download/BloxdyClient-Installer-x64.exe)**

Install 1.9.9 once. The installed Windows launcher checks for updates while idle,
downloads new versions automatically, and installs a ready update when you close
the launcher. Update downloads pause while a game or account window is open.

## Features and current limits

- Profiles keep selected mods, textures, and client settings together.
- The launcher provides supported mod installation and settings per profile.
- Built-in shaders use Bloxd's original WebGPU shadow pipeline, with separate
  block and entity switches, shadow strength, and visibility distance.
- Sky, clouds, water, lava, fog, bloom, equipment lighting, and leaf motion
  remain part of the shader controls. Shaders and Litematica are experimental;
  visual correctness, compatibility, and real FPS still need in-game testing.
- Character preview uses the player's actual 3D model and textures after a
  player-initiated game join.
- The standard client includes Zoomer, Grassify, No Ads, Factory Buffer Reuse,
  Litematica, and shader controls. Profiles retain their individual settings.
- Crash reports remain local until you explicitly submit one from the launcher.

The separate experimental renderer sources are retained for future development;
the standard launcher does not offer Minecraft/Iris renderer selection. Graphics,
controls, and FPS need live testing by users; CPU and compiler checks cannot
establish visual correctness or performance in a game session.

## Repository map

| Path | Purpose |
| --- | --- |
| `launcher/` | Desktop interface, built-in mods, adapters, and tests |
| `bridge/` | Game-to-native transport and CPU tests |
| `src/` | Experimental native renderer and shader loader |
| `shaderpacks/` | Bloxdy shaderpack examples |
| `installer/` | Windows installer support |
| `website/` | Static website source and release notes |
| `docs/` | Technical references and historical records |

The [project context](PROJECT-CONTEXT.md) tracks versions, decisions,
verification, and unfinished work. Earlier technical notes are kept under
[`docs/history/`](docs/history/). Please read the [contribution guide](CONTRIBUTING.md)
before proposing a change.

## Getting started

Bloxdy Client's primary release targets **Windows x64**. A separate Linux preview
configuration is present; Windows automatic updates and memory-budget enforcement
do not apply to that preview. ChromeOS support is not provided.

Use the installer linked above or [GitHub Releases](https://github.com/bloxdy-client/BloxdyClient/releases).
Older installations need the 1.9.9 installer once to enable automatic updates.
Source ZIP downloads are development files, not Windows installers. The website
version history contains release notes; its central download links to the installer.

Already testing a build? Include its version when
[reporting a bug](https://github.com/bloxdy-client/BloxdyClient/issues/new/choose).
Please review logs before uploading them and remove account or session data.

## Build and verification

Development targets Windows x64 and uses Node.js, Electron, CMake, and Visual
Studio build tools. Run `npm ci` for JavaScript dependencies. For CPU-only
checks that use only files in this repository, run `npm run test:public`.

```powershell
git clone https://github.com/bloxdy-client/BloxdyClient.git
cd BloxdyClient
npm ci --ignore-scripts
npm run test:public
```

Use Node.js 22 for the public checks. `--ignore-scripts` skips dependency
installation hooks, including the Electron binary download; this is enough
for the public CPU tests. A normal `npm ci` is needed for full local development.

The public suite includes update-lifecycle and release-metadata checks using
mocked services. It never starts an installer or performs a real update.

The complete local verification (`node launcher/verify.cjs` and
`npm run test:launcher`) also uses source-specific test fixtures and mod
archives that are **not included** here. Packaging an identical client release
requires those original mod projects and other local build inputs. Website
screenshots and third-party showcase images are also excluded. Until those
inputs can be redistributed or replaced, this repository is a source and
development reference rather than a reproducible installer build.

The public CPU checks do not start the client or sign into a game account.
Client visuals, input behavior, installation, and real automatic-update acceptance
remain user-run checks. The delivered 1.9.9 package passed 869 local pure checks
and a 376-file package comparison; this is separate from the reproducible public suite.

The repository also contains interactive bridge tests. Those are separate
from the public checks above. Contributors and automation must follow the
verification boundaries in [AGENTS.md](AGENTS.md).

## License and third-party material

Original Bloxdy Client source in this repository is available under the
[MIT license](LICENSE). Third-party components retain their own licenses and
notices; see [third-party material](docs/THIRD-PARTY.md). This repository excludes
account data, private chat exports, local diagnostic logs, copied Bloxd source
fixtures, and third-party mod archives. Bloxd.io is a separate service and is
not owned by this project.
