# Bloxdy Client - agent instructions

Read [PROJECT-CONTEXT.md](PROJECT-CONTEXT.md) first. It records the project status, previous user decisions, source paths, permitted verification, and currently agreed fixes. For detailed questions, the earlier chat is available as a message archive at `docs/history/bloxd-client-chat.json`. Historical messages provide context; current user instructions take precedence.

## Updates and displayed version

User correction of October 27, 2026: use the 1.2.x version series; 1.2.3 corresponds to the former 0.6.63 feature state. See `package.json` and `PROJECT-CONTEXT.md` for the current version.

## Keep documentation concise

User preference of October 27, 2026: do not create lengthy README, information, or release reports for each step. Maintain only a brief current status in `PROJECT-CONTEXT.md` and necessary machine-readable verification results. Explain technical details only when needed; preserve existing history. Do not repeat the same details across multiple files.

## Release procedure

User decision of October 19, clarified October 28, 2026: increment the client version for every delivered update. Each component ranges from 0 to 9; 1.2.9 is followed by 1.3.0, and 1.9.9 by 2.0.0. `package.json` is the shared source for package names and the version displayed at the bottom left; do not hardcode a UI version. Keep `package-lock.json` synchronized. By default, `Build-Release.ps1` increments the version with this carry rule; use `-KeepVersion` only to rebuild the same release. As requested on November 4, 2026, build only `Bloxdy-Client-Update-<version>-x64.exe` directly with NSIS; no Setup, Portable, duplicate installer copy, or differential blockmap. Keep required runtime files and the `win-unpacked` intermediate for package verification. Do not rebuild a release just for build-policy/documentation changes. Verify that file and link it for the user. Do not run it, install anything, or start the client.

## Download website

November 13, 2026: Windows installations from 1.9.9 include automatic updates. `Build-Release.ps1` produces the single existing updater/installer EXE plus `latest.yml`; no second installer or blockmap. After all checks, publish explicitly with `node launcher/publish-release.cjs dist-bloxdy-v<version>`: it uploads only the verified EXE (public name `BloxdyClient-Installer-x64.exe`) and manifest to `bloxdy-client/BloxdyClient`, then marks the complete release latest. Never publish the source tree or overwrite an existing release. The website's permanent installer link follows the latest release. Version entries retain notes/search and have no download buttons. The user publishes Cloudflare themselves (November 6 decision); provide the normal `website/dist` folder, never a ZIP or an unsolicited deployment.

November 5, 2026: update the website only when the user explicitly requests a website update; include the current verified download file. The official website is https://rsfire.bloxdyclient.workers.dev (Cloudflare Worker `rsfire`), not the old Sites page. Source: `website/dev-log.json` and `website/build.cjs`; build with `node website/build.cjs`, then upload `website/dist/index.html` to the existing Worker's static-file deployment. Keep dated, user-facing Fixed/Added/Bugs entries without code; record every new client/mod feature, and label unknown historical introduction dates honestly. Use a direct downloadable release asset, never a Google Drive viewing page. The user signs into Cloudflare themselves if needed. Website updates are separate from Build-Release.ps1.

## Binding user rule: client and accounts

On October 12, 2026, the user explicitly prohibited the agent from opening or operating the client or taking any action on an account. This rule was read in the "Bloxd Client" chat and carried over from the previous project.

- Do not start the client, including Electron, native preview, offline client, or tests that start these applications.
- Do not sign in, switch accounts, or operate a running client session. This also applies to other accounts.
- Do not change saved logins, cookies, browser profiles, or account data to switch accounts.
- Do not operate the client indirectly through IPC, diagnostic commands, browser automation, or process control.
- Editing source code and reading existing local files or logs is allowed. Builds must not automatically start applications or client tests.
- The user performs any necessary client actions. Their willingness to do so does not authorize the agent to act on their behalf.
- Account and character synchronization may again be implemented through official Bloxd windows started and operated by the user. Do not imitate a native OAuth origin or bypass protection checks.
- Character previews must use the actual 3D model and textures (GLB), never screenshots or photos. Synchronize automatically when the user joins a game; no manual sync buttons or automated character-menu interactions. Homepage: character and name, mouse rotation without zoom.
- Do not require additional costs, purchases, or subscriptions for the project.
- Use English for the launcher UI and installer, and German when communicating with the user.

## Verification

Pure Node, DOM, and VM checks (`npm run test:launcher`, `npm run test:unit`, `node launcher/verify.cjs`), the project's MemoryBudgetTests/BridgeCpuTests CPU tests, and GLSL compilers are allowed. Do not automatically run `npm start`, `npm test`, `npm run test:bridge`, startup scripts, graphical CTest checks, or installers.

## Current product scope

November 5, 2026: Focus on the standard client and existing normal mods only. Remove EZ/Premium selection and EZ tags, native renderer selection and Minecraft-pack downloads. Keep renderer sources and private backups locally for future Premium development. This supersedes earlier instructions to actively extend the experimental renderer. Performance layer and tentative ads/pricing are deferred.

## Renderer and current status

- See `PROJECT-CONTEXT.md` for the latest feature state and version.
- Extend the experimental renderer while preserving the standard renderer/fallback, original mods, view distance 10, active selection, and existing memory and ownership safety boundaries.
- Do not guess source data or Minecraft semantics, simulate sources, or mutate profiles. Unknown data stays unknown.
- The shader loader remains a separate mod. Native preview for CrazyGames remains blocked.
- CPU, compiler, and package checks do not establish live pixels, FPS, or full Iris compatibility. Keep `irisContractComplete` false while completion gates remain open.
- Concrete next renderer tasks and open gates are listed in `PROJECT-CONTEXT.md`.
- Consult `docs/history/AGENTS-before-1.2.3.md` and `docs/history/PROJECT-CONTEXT-before-1.2.3.md` only when historical details are needed. Existing technical documents remain reference material.
