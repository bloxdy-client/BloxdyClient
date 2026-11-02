# Built-in CrazyGames account route — 0.6.53

26 October 2026. This is a source-implemented first attempt with pure tests and
package verification. Actual CrazyGames authentication in Electron is NOT yet
verified. No agent-operated client, account, installer, browser or GPU run.

## User flow

Accounts -> Connect account -> CrazyGames opens the official Bloxd page in the
existing Bloxdy game-window architecture:
https://www.crazygames.com/game/bloxdhop-io

The user signs in using the portal's own interface and starts Bloxd there. A new
CrazyGames account opens its playable profile immediately, so the initial sign-in
does not require closing an account-only window and launching another process.
Later Play uses that same saved account's portal route. Existing account settings
can still open a dedicated account window. No mod installation or toggle is
required: CrazyGames is a built-in provider alongside Google/Apple/Microsoft/Discord.

Each account uses persist:bloxd-<account-id>. A CrazyGames account never reuses the
legacy default session, even if an imported metadata record has legacySession=true.
No browser cookies, passwords, tokens or other profiles are copied or edited by
the agent. The portal and Chromium handle normal session persistence when the
user signs in. The launcher retains public Bloxd metadata and the user's actual
joined 3D character through the existing validated sync path.

## Genuine official embedding

The live public portal HTML was fetched without a browser, cookies or login. Its
loaderType is iframe and loaderConfig.url is https://bloxd.io/. Portal public
configuration names gameframe.crazygames.com and auth.crazygames.com. The client
loads the real portal rather than constructing its own wrapper. It does not spoof
siteUsed, referrer, parent origin, SDK messages, signatures or account tokens.
The official page owns the SDK and Bloxd's existing backend integration.

References:
- https://www.crazygames.com/game/bloxdhop-io
- https://docs.crazygames.com/sdk/intro/
- https://docs.crazygames.com/sdk/html5-v2/user-linking/

## Frame and permission boundaries

CrazyGames windows retain nodeIntegration=false, sandbox=true,
contextIsolation=true and webSecurity=true. nodeIntegrationInSubFrames=true is
used specifically so Electron runs the sandboxed preload in the embedded game.
Electron v44.7.0 source confirms ShouldLoadPreload checks this flag and the
explicit sandbox still enables Chromium sandboxing for renderer processes.
This enables the limited isolated preload; it does not enable the Node engine
in page scripts. No sandbox, same-origin protection or certificate check is disabled.

Before installing any host, account observer, pack override or enabled mod, an
embedded Bloxd preload requests synchronous authorization. The main process
requires its owned webContents, an HTTPS bloxd.io child, the exact official Bloxd
portal game URL as top frame, and only official portal/gameframe/games ancestors
(up to eight frames). Portal, ad, detached, unrelated, auth-callback and wrong
main frames are denied. Every later game IPC repeats the frame authorization.
No launcher APIs are installed in CrazyGames itself, ad frames or OAuth windows.

The same generated mod/storage/texture path runs inside the authorized game
frame. F9 diagnostics target that frame instead of the portal main frame. Native
preview is currently rejected for CrazyGames profiles; Standard Bloxd is required.
Pack reload prepares the embedded preload and reloads the same webContents.
Native pack pickers retain read-only, selected-path scope under the official game
portal; unrelated portals and write requests are denied. The existing microphone
confirmation and enabled-mod rules remain. Portal fullscreen is narrowly allowed.

Official auth popups share only the selected account session. Extra authentication
navigation is limited to the observed auth.crazygames.com Firebase handler/iframe
and portal auth/login/register routes. Popups have empty preloads, sandboxing,
no Node integration (including subframes), and no credential logging. Existing
provider allowlists, popup lifetime throttling restoration and blocked unrelated
navigation remain in force. Account-only observation does not open Bloxd's own
account category in this mode, leaving the CrazyGames account UI user-operated.

## Verification and limits

Pure fixtures cover provider creation and store reload, partition isolation,
no required mod, frame authorization and spoofed ancestors, denied popup origins,
portal/ad preload exclusion, public account sync in an authorized iframe,
read-only imports, F9 frame routing, F5 and immediate playable account creation.
Standard, native-voice and embedded-all-mod generated preloads receive syntax
checks. Existing regular-provider tests also run. Original mod catalog bytes and
native renderer programs are preserved.

This does not prove a successful production login, cookie retention on a real
provider, portal compatibility with Electron, live mod combinations, FPS or actual
character appearance. Portal login errors, consent prompts and any provider
restrictions must be assessed by the user. Native preview remains unavailable
for this route. No external browser session is imported and there is no fallback
that pretends to be CrazyGames on a direct bloxd.io page.

Manual acceptance:
1. Install the update yourself. Choose Accounts -> Connect account -> CrazyGames.
2. Complete login on the official page, then join Bloxd in that same window.
3. Confirm the launcher receives your correct public name and joined character.
4. Close the game yourself and start that profile again; verify the saved session.
5. Test your enabled mods, native pack import and Reload Bloxd in that profile.

User update on 26 October 2026: the user confirms that CrazyGames login works.
This confirms login only; character sync, session retention, live mod combinations
and renderer/FPS acceptance remain separate. No agent operated the account.

Evidence: outputs/crazygames-0.6.53/.

Final release evidence: 498 pure tests, 50 syntax files, Standard/native-voice/
CrazyGames generated preloads and MemoryBudgetTests pass. 62 packaged sources
(63 including package.json) match. Setup/Portable/Update are byte-checked; Update
is identical to the verified NSIS installer. Native programs and original mod
catalogs match 0.6.52. Version and lock are synchronized. No live login verified.
