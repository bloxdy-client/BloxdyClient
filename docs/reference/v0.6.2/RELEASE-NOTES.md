# Bloxdy Client 0.6.2

Launcher branding, homepage, window titles, desktop shortcut and installer/portable filenames use Bloxdy Client. The homepage has a large Bloxdy Client heading and the smaller sentence “A custom bloxd.io launcher for mods and performance tuning.” Native preview window captions use the same brand. Internal upgrade identity and user/session directories are preserved.

Performance-preset controls are removed from profile forms. New profiles use standard internal defaults; editing an existing profile retains its previous mod-default configuration. Name, RAM budget and renderer remain available.

Account/profile removal uses the existing themed launcher modal, without an operating-system warning dialog. Cancel is initially focused. Removal requires the exact one-use confirmation issued for that item; Cancel/Escape changes nothing. Local recovery copies remain available and account removal does not delete the remote Bloxd account.

86 pure Node/DOM/VM tests pass. The native renderer compiles after caption-only edits. No client, account or graphics context is started by the agent. Windows packages are in dist-bloxdy-v0.6.2.

Earlier release notes below describe historical versions.

## Bloxd Native Launcher 0.6.1 (historical)

The character initially faces forward. Only left mouse drag rotates it; model zoom/pan and keyboard controls are removed. The homepage’s character area contains model and username, with one automatic-join placeholder if no model exists. Manual sync/reset buttons and bottom notifications are removed.

Character export now reads the local player after a game join without opening or manipulating customization screens. It reads actual body/cosmetic data and worn attachments in a stable rest pose, includes the body hidden by first-person rendering, excludes gameplay armour and checks account/asset identity around texture loading. Late asset changes or the next join refresh the saved GLB.

The public Bloxd bundle installs a beforeunload veto. Native close now allows the user-requested unload, with a bounded destroy fallback for a hung renderer. Closing/killing the game renderer exits only the game app; the parent restores the launcher and permits another Play. Packaged gameplay uses `Bloxd Game Client.exe`, a separate Windows application identity and its own memory job while sharing Electron DLLs/resources. The installer still places only the launcher shortcut on the desktop.

85 pure Node/DOM/VM tests pass, including mouse-only fixed-scale control, front orientation, owned join model export, first-person body, rest-pose accessories, notification removal and scoped close/crash recovery. No client, account or graphics context was opened by the agent; live join and native window closure remain user tests. Packages: `dist-launcher-v0.6.1/`.

The following release notes are historical and superseded by 0.6.1.

## Bloxd Native Launcher 0.6.0 (historical)

All selection controls use themed dropdowns with keyboard support and correct form values. Success notifications dismiss after 3.5 seconds, errors after 8 seconds, with a manual close button.

Official Bloxd account/character windows are restored at the user’s explicit request. Login, sign-up and name changes are completed by the user. These windows omit gameplay mods and the native renderer; the agent’s permanent prohibition against opening/operating clients remains.

The character screenshot path is removed. The new adapter exports the actual own-character rig, body/attachment geometry and clothing texture layers into a self-contained per-account GLB. It checks current username/cosmetics and file hashes. The local preview rotates/zooms, renders on changes and saves a fixed pose. Unsupported/incomplete assets report status without substituting a photo or fake model.

Pure Node/DOM/VM tests cover Khronos GLB validity, transforms, clothing layers, try-on refusal, account identity, embedded resources, independent storage, user-triggered official windows, dropdown keyboard/form handling and notification expiry. No application, account or GPU context is opened by the agent. Live extraction and visuals remain user tests. Packages are in `dist-launcher-v0.6.0/`.

Older notes below are historical and superseded by 0.6.0’s account/model behaviour.

## Bloxd Native Launcher 0.5.0 (historical)

The Play page now has an original cinematic voxel landscape, a stronger headline, a glass character area, a profile selector and a prominent mint Play button. Navigation has a clearer active state. Profiles use larger cards with individual preset colours, selected markers and a more distinct Add profile control. Accounts, settings, content cards and dialogs have consistent spacing, colour, borders and depth. White, Gray and Black remain available. The four navigation pages and requested FastClient-style content header are preserved. No friends, news feed or server sidebar is added.

The background is decorative artwork generated with the built-in imagegen tool. It is not a screenshot of the current shader pipeline. Asset and complete prompt: [launcher/ARTWORK.md](launcher/ARTWORK.md).

The user explicitly requires account and character actions without loading a Bloxd page, even internally. The previous account-window/character-window fallback is therefore removed from both the interface and backend. Account actions cannot spawn a game process. Sign-in, sign-up, username changes and live account/character sync are unavailable until an approved direct integration exists. Existing profiles, account records and previously received real character images remain available locally and are labelled as saved data. The launcher does not turn an unauthenticated name into a fake connected account.

A read-only lookup of the public auth project returned HTTP 403 for native requests and for the launcher's own localhost origin. No account was accessed and no sign-in/token exchange was attempted. This is an authorization blocker for the inspected native connection, not proof that every possible supported integration is impossible. We need a publisher-supported launcher registration/API. No Bloxd origin is impersonated and no game page is loaded as a fallback. Evidence, official documentation and an unsent maintainer request: [ACCOUNT-CONNECTION.md](ACCOUNT-CONNECTION.md).

64 pure Node/DOM/VM tests pass. They cover profile/account isolation, mod loading, deletion confirmation, themes and defaults, scoped game updates, startup visibility, escaped catalog results, saved-data controls and refusal to start a client for account actions. Source/preload syntax and package bytes are checked without launching an application. The existing CPU-only Windows memory-budget proof still applies to the unchanged helper.

Setup and portable packages are built into `dist-launcher-v0.5.0/`; an older installation is not started, stopped or replaced by the agent. No application or account was opened for testing. The real visual result and Play remain user tests. Minecraft shaderpack playback and a measured FPS/RAM improvement remain outside this update and are unfinished.
