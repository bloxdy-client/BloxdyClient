# Bloxdy Client

Bloxdy Client is a Windows launcher for Bloxd.io with profiles, mods, shader
options, character preview, and an experimental native renderer. The current
source version is **1.6.0**.

## Project map

| Path | Contents |
| --- | --- |
| `launcher/` | Desktop interface, built-in mods, adapters, and tests |
| `bridge/` | Game-to-native transport and CPU tests |
| `src/` | Experimental native renderer and shader loader |
| `shaderpacks/` | Bloxdy shaderpack examples |
| `docs/` | Technical references and archived project history |

The [current project status](PROJECT-CONTEXT.md) records decisions, versions,
verification, and remaining work. [Older technical history](docs/history/TECHNICAL-HISTORY-before-1.2.3.md)
and [archived notes](docs/history/) preserve the earlier development record.

## Development

The project uses Node.js, Electron, CMake, and Visual Studio build tools on
Windows. `npm ci` installs JavaScript dependencies. `node launcher/verify.cjs`
and `npm run test:unit` run CPU-only checks. The root `Build-Launcher.ps1`,
`Build.ps1`, and `Build-Release.ps1` build native components and packages.
These checks do not validate live graphics or FPS.

The public repository omits local account data, chat exports, diagnostics,
build outputs, copied source fixtures, and third-party mod archives. Some
catalog entries therefore need their original mod packages before a release
can be packaged. The original Bloxdy Client code is under the [MIT license](LICENSE);
third-party components keep their own notices.
