# Archived README (historical snapshot)

This file preserves the earlier README for development history. Its release
paths and relative links reflect the project layout at the time.

# Bloxdy Client

Current version: **1.6.0**. The current project status and release history are
in [PROJECT-CONTEXT.md](PROJECT-CONTEXT.md); earlier technical decisions are in
[the public technical history](docs/history/TECHNICAL-HISTORY-before-1.2.3.md).
The raw chat export, local diagnostics, account data, build products, third-party
mod archives, and copied source fixtures are not part of this public repository.
The original Bloxdy Client code is MIT-licensed; third-party components retain
their own licenses. Client visuals and FPS require live user validation.

## Historical renderer notes (0.6.18)

The experimental engine now has demand-driven prior-world color/depth history:
HDR scene color after world translucency and exact 32F opaque depth, captured
before hand/late overlays. Two GPU slots preserve the previous successful frame
if copying or final presentation fails. History matches camera/motion frames,
invalidates on fallback/resize/depth changes and shares the 512 MiB target cap.
It is an internal render-pass resource, not active TAA or Iris buffer binding.
There is currently no consumer: no extra history allocation/copies are enabled
in the shipped path. Default Bloxd, source capture and distance 10 are unchanged.

The experimental renderer now preserves successful-frame object transforms and
changed CPU poses, with floating-origin compensation and a separate native
motion target. Unknown moving instance slots, new/missing objects, fallback,
resize and invalid reprojections do not invent history. Pose snapshots are
lazy and bounded to 64 MiB CPU/GPU combined; static terrain is not duplicated.
This is temporal data preparation, not enabled TAA or shaderpack compatibility.
The standard Bloxd renderer remains separate and unchanged; new isolation tests
verify it creates no experimental transport/capture/presenter path.

CPU particles now include actual source ramp textures/color-alpha remapping,
subtract/multiply and two-pass MultiplyAdd in source order. Original raw texture
alpha drives the multiply correction before fog. Secondary texture readiness,
reference lifetime and sampler state are guarded; unchanged state is cached.
Actual source standard-blend alpha accumulation is preserved.

CPU particles now support source Y/stretched/local-stretched/fixed-direction
alignment, animated sheet UVs/insets, local emitter directions, world offsets,
texture masks and bounded HDR colors. Extended state is transferred atomically;
cell-only changes reuse transforms and static geometry. GPU/custom
particle programs and sprites retain source fallback.

Source render groups now preserve Bloxd's negative sky group, actual depth-reset
and material/alpha/distance sort policies. Supported isolated hand/overlay groups
use read-only observed source camera matrices and restore world camera state.
Missing/stale observations and mixed world-group overlays retain source fallback.

The native renderer now includes source Cape/TextSampler/Enchantment effects and
CPU particles with atomic position/color data and source system
ordering. Distance stays 10. Remaining special particles, sprites and unknown
source programs retain source fallback. Full Minecraft Java 26.3 / Iris
1.11.7 compatibility, pack stages and real image/FPS parity remain unfinished.
219 pure tests, CPU mocks and eleven GLSL checks passed without starting a
client, browser, account or real graphics context. Matched installer/portable
packages are in `dist-bloxdy-v0.6.18`; see [renderer details](docs/NATIVE-RENDERER.md).

0.6.9 optimizes the user-confirmed stable 0.6.8 path without changing draw distance or appearance. Idle fallback capture pauses camera IPC and write tracking, new active chunks take import priority, native payload reading is batched and presentation texture storage is reused. F8/F9 distinguish source cadence from native render FPS. A CPU-only adapter workload uses about 71% less time; live game FPS and chunk delivery are not yet measured. Existing source fallback remains necessary for unsupported native material/model paths; this does not finish native rendering or Minecraft shaderpack playback. See [Native Renderer Development](docs/NATIVE-RENDERER.md).

This is the active project folder. Project decisions and the imported chat are documented in [PROJECT-CONTEXT.md](PROJECT-CONTEXT.md). The previous 0.6.2 source remains in its original folder; the migration manifest is in docs/reference/v0.6.2/source-manifest.json.

0.6.5 removes launcher mod settings and repairs shader sampler conflicts, sky-cache feedback and missing-geometry shadow retries. Configure mods inside Bloxd. Bloom, glowing ores and custom skies default to On; saved Off choices persist. Golden Hour uses Cumulus clouds.

The previous UI update removes the Accounts explanation panel and decorative copy while keeping all three account actions. Settings fills the available width. Launcher labels cannot be selected; editable fields still support normal selection. The native game menu bar is removed. In a game, F8 shows performance and F9 saves a measurement; close the game normally to return to the launcher.

For development, run npm ci, Build-Launcher.ps1 and Build.ps1 -BuildDirectory build-release before starting the launcher yourself. The checked-in mod catalog is ready to use. To refresh it from the existing mod projects on this machine: npm run catalog -- "../../New project". Other source folders can be passed explicitly or set via BLOXDY_MOD_SOURCE_ROOT; the original mod projects are read only.

Windows x64 launcher with Play, Profiles, Accounts and Settings, English UI, per-account profiles, per-profile mods/textures and a 1–32 GiB game memory budget. Installer and portable are in `dist-bloxdy-v0.6.9/`. End users do not need Node or Visual Studio. The release has not been uploaded online.

All selection menus now use themed, keyboard-accessible dropdowns. Bottom notifications are removed. Action failures are shown in an error dialog; successful actions stay quiet. Account sign-in and settings open official Bloxd windows when the user clicks their buttons. The user completes login, sign-up and username changes there.

The character model is automatically exported from the local player after joining a game. No sync button or customization menu is needed. The adapter reads the owned rigid body/cosmetic atlas and attachments, restores a fixed body pose even in first person, and excludes gameplay armour. The Play area contains only model and username; if a model is missing, it states that joining a game will sync it. Left mouse drag rotates the model. The front faces the camera by default, with no zoom, pan, pinch or keyboard sizing. Cached 0.6.0 models also receive the corrected initial orientation. Live extraction and native close behaviour remain user tests.

Read [RELEASE-NOTES.md](RELEASE-NOTES.md), [ACCOUNT-CONNECTION.md](ACCOUNT-CONNECTION.md), [DISTRIBUTION.md](DISTRIBUTION.md) and [VERIFICATION.md](VERIFICATION.md). The permanent agent restriction is in [AGENTS.md](AGENTS.md).

EZ Mods contains verified snapshots of Bloxd Visual Shader, Bloxd-Litematica and Party Voice; their source projects remain unchanged. Mod settings/downloads belong to individual profiles. Native launcher profiles are experimental, with guarded in-window output and explicit source fallback; the legacy bridge has a separate window. Minecraft shaderpack playback, complete native world rendering and measured FPS/RAM improvements remain unfinished.

Play waits for a matching visible-window confirmation and keeps the launcher available. Its Windows Job Object limits committed memory of the game process group; it does not reserve physical RAM or include VRAM. Account windows omit gameplay mods and the native renderer.

Build and verify without starting applications:

- `npm run build:viewer`: bundle the local Three.js viewer and its MIT license.
- `Build-Launcher.ps1` / `Build.ps1`: compile memory helper / renderer.
- `Build-Release.ps1`: build and package, without launching the installer.
- `npm run dist:windows -- --config.directories.output=dist-bloxdy-v0.6.5`: package separately.
- `node launcher/verify.cjs`: pure Node/DOM/VM tests and source/preload syntax.
- `node launcher/check-package.cjs dist-bloxdy-v0.6.5`: compare package bytes and generate hashes.

Do not automatically run `npm test`, `npm run test:bridge` or graphical CTest checks. Installers, Electron, native previews and account actions remain user-only. The user closes previous windows, installs and opens the new version himself.

The game has a separately named `Bloxdy Game Client.exe` and Windows application identity. It shares Electron resources with the launcher and remains in its own memory job. Native close/Alt+F4 permits the page unload and has a bounded fallback if the renderer hangs. Game exit or a killed renderer terminates only the game app; the parent restores its launcher and permits another Play. No real game, account or graphics context was started for verification.

The launcher is now named Bloxdy Client in its title bar, homepage, window names, Windows packages and desktop shortcut. The homepage description is “A custom bloxd.io launcher for mods and performance tuning.” Profile forms omit performance-preset controls; new profiles use ordinary internal defaults, and edits retain existing mod defaults. Account/profile removal uses a compact themed confirmation with Cancel initially focused. No operating-system warning dialog is opened; a one-use scoped confirmation is required before local removal. Existing app identity and data/session directories are retained for upgrades.
