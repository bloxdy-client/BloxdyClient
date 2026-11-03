# Bloxdy Client

Bloxdy Client is a Windows launcher for Bloxd.io. It brings profiles, optional
mods, shader controls, texture selection, and a character preview into one
desktop app. The current source version is **1.6.0**.

## What it does

- **Profiles:** Keep selected mods, texture packs, and client settings together.
- **Mods:** Install and manage supported Bloxdy and Bloxd mods per profile.
- **Shaders:** Adjust the Bloxdy Visual Shader and try Bloxdy shaderpacks.
- **Character preview:** Show the player's actual 3D model and textures after
  the player joins a game; no character screenshot is used.
- **Native renderer research:** Develop an experimental renderer and Minecraft
  shaderpack support while retaining the normal renderer as a fallback.

The launcher and installer interface are in English. The current distribution
target is Windows x64. The native renderer and full shaderpack compatibility
are still in development; their live appearance and FPS are not guaranteed by
source checks alone.

## Getting the client

Use an official Bloxdy Client installer or portable release supplied by the
project owner. This repository is the private development workspace and is not
an installer download. Do not run files shared by an unofficial source as if
they were an official release.

Updates use the same visible version number as `package.json`. Release builds
produce a setup program, a portable program, and a separate updater. Installing
or starting the client is a user action; development verification does not
start the client or access a game account.

## Project status and documentation

The [current project context](PROJECT-CONTEXT.md) tracks versions, decisions,
verification, and open work. Technical detail is grouped under [`docs/`](docs/),
with older development records under [`docs/history/`](docs/history/).

| Directory | Purpose |
| --- | --- |
| `launcher/` | Desktop interface, built-in features, adapters, and tests |
| `bridge/` | Transport between the game and native components |
| `src/` | Native renderer and shader loader research |
| `shaderpacks/` | Bloxdy shaderpack examples |
| `installer/` | Windows installer support |

For approved CPU-only verification, use `node launcher/verify.cjs`,
`npm run test:launcher`, or `npm run test:unit`. A successful check confirms
only the tested source behavior. Graphics, controls, account flows, and actual
performance still need testing by the user in the client.

## Use and ownership

The source code is private. An official, unmodified client release may be
installed and used under the [binary use terms](LICENSE). Repository access
does not grant permission to copy, modify, republish, or redistribute the
source. Third-party components keep their own license terms. Bloxd.io is a
separate service and is not owned by this project.

An earlier public source revision carried an MIT license. This change does not
take back permissions already granted for copies obtained under that license.
