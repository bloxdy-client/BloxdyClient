# Bloxdy Client

Bloxdy Client is a Windows launcher for Bloxd.io with profiles, optional mods,
shader controls, texture selection, and a character preview. This repository
contains the Bloxdy Client source, experimental native renderer, tests, and
technical history. The current source version is **1.6.0**.

The project is still in development. About **10 people have tested it** so far;
that is an approximate tester count, not a public adoption metric. A general
release is planned after the remaining issues are resolved.

## Features and current limits

- Profiles keep selected mods, textures, and client settings together.
- The launcher provides supported mod installation and settings per profile.
- Shader options and Bloxdy shaderpacks extend the game's visual controls.
- Character preview uses the player's actual 3D model and textures after a
  player-initiated game join.
- An experimental native renderer and shader loader are under development.
  The normal renderer remains available as a fallback.

The native renderer is not complete Minecraft/Iris shaderpack support. Graphics,
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
| `docs/` | Technical references and historical records |

The [project context](PROJECT-CONTEXT.md) tracks versions, decisions,
verification, and unfinished work. Earlier technical notes are kept under
[`docs/history/`](docs/history/). Please read the [contribution guide](CONTRIBUTING.md)
before proposing a change.

## Build and verification

Development targets Windows x64 and uses Node.js, Electron, CMake, and Visual
Studio build tools. Run `npm ci` for JavaScript dependencies. For CPU-only
checks that use only files in this repository, run `npm run test:public`.

The complete local verification (`node launcher/verify.cjs` and
`npm run test:launcher`) also uses source-specific test fixtures and mod
archives that are **not included** here. Packaging an identical client release
requires those original mod projects and other local build inputs. Until those
inputs can be redistributed or replaced, this repository is a source and
development reference rather than a reproducible installer build.

No automated verification starts the client or signs into a game account.
Client visuals, input behavior, and real FPS remain user-run checks.

## License and third-party material

Original Bloxdy Client source in this repository is available under the
[MIT license](LICENSE). Third-party components retain their own licenses and
notices; see [third-party material](docs/THIRD-PARTY.md). This repository excludes
account data, private chat exports, local diagnostic logs, copied Bloxd source
fixtures, and third-party mod archives. Bloxd.io is a separate service and is
not owned by this project.
