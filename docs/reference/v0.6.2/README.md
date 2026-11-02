# Bloxdy Client 0.6.2 — Renderer 0.2.1

Windows x64 launcher with Play, Profiles, Accounts and Settings, English UI, per-account profiles, per-profile mods/textures and a 1–32 GiB game memory budget. Installer and portable are in `dist-bloxdy-v0.6.2/`. End users do not need Node or Visual Studio. The release has not been uploaded online.

All selection menus now use themed, keyboard-accessible dropdowns. Bottom notifications are removed. Action failures are shown in an error dialog; successful actions stay quiet. Account sign-in and settings open official Bloxd windows when the user clicks their buttons. The user completes login, sign-up and username changes there.

The character model is automatically exported from the local player after joining a game. No sync button or customization menu is needed. The adapter reads the owned rigid body/cosmetic atlas and attachments, restores a fixed body pose even in first person, and excludes gameplay armour. The Play area contains only model and username; if a model is missing, it states that joining a game will sync it. Left mouse drag rotates the model. The front faces the camera by default, with no zoom, pan, pinch or keyboard sizing. Cached 0.6.0 models also receive the corrected initial orientation. Live extraction and native close behaviour remain user tests.

Read [RELEASE-NOTES.md](RELEASE-NOTES.md), [ACCOUNT-CONNECTION.md](ACCOUNT-CONNECTION.md), [DISTRIBUTION.md](DISTRIBUTION.md) and [VERIFICATION.md](VERIFICATION.md). The permanent agent restriction is in [AGENTS.md](AGENTS.md).

EZ Mods contains verified snapshots of Bloxd Visual Shader, Bloxd-Litematica and Party Voice; their source projects remain unchanged. Mod settings/downloads belong to individual profiles. Native preview is experimental and uses a separate window. Minecraft shaderpack playback, complete native world rendering and measured FPS/RAM improvements remain unfinished.

Play waits for a matching visible-window confirmation and keeps the launcher available. Its Windows Job Object limits committed memory of the game process group; it does not reserve physical RAM or include VRAM. Account windows omit gameplay mods and the native renderer.

Build and verify without starting applications:

- `npm run build:viewer`: bundle the local Three.js viewer and its MIT license.
- `Build-Launcher.ps1` / `Build.ps1`: compile memory helper / renderer.
- `Build-Release.ps1`: build and package, without launching the installer.
- `npm run dist:windows -- --config.directories.output=dist-bloxdy-v0.6.2`: package separately.
- `node launcher/verify.cjs`: pure Node/DOM/VM tests and source/preload syntax.
- `node launcher/check-package.cjs dist-bloxdy-v0.6.2`: compare package bytes and generate hashes.

Do not automatically run `npm test`, `npm run test:bridge` or graphical CTest checks. Installers, Electron, native previews and account actions remain user-only. The user closes previous windows, installs and opens the new version himself.

The game has a separately named `Bloxdy Game Client.exe` and Windows application identity. It shares Electron resources with the launcher and remains in its own memory job. Native close/Alt+F4 permits the page unload and has a bounded fallback if the renderer hangs. Game exit or a killed renderer terminates only the game app; the parent restores its launcher and permits another Play. No real game, account or graphics context was started for verification.

The launcher is now named Bloxdy Client in its title bar, homepage, window names, Windows packages and desktop shortcut. The homepage description is “A custom bloxd.io launcher for mods and performance tuning.” Profile forms omit performance-preset controls; new profiles use ordinary internal defaults, and edits retain existing mod defaults. Account/profile removal uses a compact themed confirmation with Cancel initially focused. No operating-system warning dialog is opened; a one-use scoped confirmation is required before local removal. Existing app identity and data/session directories are retained for upgrades.
