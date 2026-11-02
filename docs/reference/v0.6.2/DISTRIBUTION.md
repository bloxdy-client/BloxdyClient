# Windows distribution 0.6.2

Installer and portable EXE are in `dist-bloxdy-v0.6.2/`. They contain Electron/Chromium, the launcher, local Three.js viewer/license, verified snapshots of the three existing mods, native preview and Windows memory helper. End users need no developer tools. These builds require no paid service or subscription. They are unsigned and have not been uploaded online.

The installer uses a per-user application folder and desktop shortcut; legacy desktop program folders remain hidden. It does not start the launcher automatically. Separate release output avoids replacing an executable the user may be running. `SHA256SUMS.txt` identifies the final bytes.

Runtime state, per-account GLB models, profile downloads/settings and recovery copies live under `%LOCALAPPDATA%/BloxdNative/launcher-data`. UI and official Bloxd sessions have separate userData folders and account partitions. Private data, tokens, cookies, research, logs and tests are excluded from release packages. The parent validates account/profile-scoped updates from its own child; a game cannot overwrite renamed/new profiles.

Play uses a Windows Job Object and confirms its matching game window is visible. The 1–32 GB setting uses GiB of committed memory across the game process group, excluding VRAM. A small budget can close the game. The helper is unchanged from its CPU-tested prior release.

Account actions now use official windows opened by user buttons. The user performs login/sign-up/name changes there. Joining a game automatically saves the owned model and embedded clothing textures as GLB, displayed locally on Play. No character screenshot is taken. Adapter limits and verification are in [ACCOUNT-CONNECTION.md](ACCOUNT-CONNECTION.md).

User release check:

1. Close previous launcher and Bloxd windows yourself. Install 0.6.2 and open the launcher yourself.
2. Save Settings and check no bottom notification appears. Test themes/dropdowns, mouse choices, arrow keys, Enter and Escape.
3. Open Accounts → Settings for the existing session and complete login yourself. Provider buttons add independent sessions; choose the matching provider in Bloxd.
4. Close the account window yourself and click Play. Join a world yourself and allow the model export to complete.
5. Check that Play shows only your character and username. Its default view should face you; mouse drag rotates while wheel/pinch cannot resize it. If no model exists, check the automatic-join placeholder.
6. Test account/profile separation, deletion Cancel, profile name/RAM and Play’s separate game window.
7. Test installation and Play on another Windows x64 computer before public distribution.

The agent does not perform these application/account actions. Pure checks are `npm run test:launcher`, `npm run test:unit`, `node launcher/verify.cjs`, the standalone CPU-only memory test, and `node launcher/check-package.cjs dist-bloxdy-v0.6.2`.

Close Bloxd with its window X, Alt+F4 and the game menu’s Back to launcher. The launcher should remain open and Play should become available again. In Task Manager the game image is named `Bloxdy Game Client.exe`; end only that game process if testing forced termination. Ending the launcher or an entire tree that includes it necessarily closes the launcher. Packaging checks compare both Electron images and the embedded source without executing either.

The 0.6.2 installer upgrades the existing application identity, updates the shortcut name to Bloxdy Client, and keeps existing session/profile storage paths. Check the homepage title/description, a fresh profile without the preset selector, and themed account/profile removal with Cancel/Escape before confirming. Native preview captions also use Bloxdy Client.
