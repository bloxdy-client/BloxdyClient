# Packs, page reload and sign-in responsiveness — 0.6.52

Date: 26 October 2026. Code, filesystem, DOM and VM verification only.
No client, installer, account, browser or graphics context was started.

## Texture packs

JamBloxds 16x16 (id `jamBloxds16x16`, metadata version 1, author
`januaryboy`) is included from the official JSON encoding:
https://github.com/Bloxdy/texture-packs/tree/main/jamBloxds16x16
https://raw.githubusercontent.com/Bloxdy/texture-packs/main/_json/jamBloxds16x16.json
The bundled bytes are preserved and validated; using this pack needs no download.
Other downloads now name the canonical `Bloxdy/texture-packs` repository.

The old installer permanently replaced `setFromJson` and `saveTexturePack`.
It therefore replaced later native selections and suppressed their saves. The
new adapter confines substitution to initial atlas setup, avoids a duplicate
initial set, restores `setFromJson`, and forwards later native saves with their
arguments, receiver, return value and exceptions. A small sessionStorage marker
hands subsequent page reloads to native pack preferences. Temporary server-pack
saves do not claim the persistent selection; failed native saves restore the
previous marker. Native handover is reported explicitly and never claims that the
launcher pack itself was applied on that reload. Discovery timeout and page teardown release owned hooks.
Launcher initialization itself does not persist the profile pack to account
IndexedDB. Explicit later selections in Bloxd keep Bloxd's normal persistence.

## File import and reload

Both Electron permission handlers allow `fileSystem` reads for the owned game
contents at `https://bloxd.io`, for a picker-selected file/folder path. Writes,
other origins/contents, embedded cross-origin requests and account windows stay
denied. Chromium reports isMainFrame=false for these requests; it is therefore
not used as a false rejection. See:
https://www.electronjs.org/docs/latest/api/session

Launcher texture selections and JSON imports immediately prepare the running
profile's next preload. A small per-run file carries a checked run ID, profile,
sequence and pack ID. An fs.watch listener coalesces changes; no frame/interval
polling is added. `Reload Bloxd` applies the prepared pack by reloading the same
webContents; it neither closes the window nor starts a process. The reload request
retains the selection token, so reloading after a native selection does not
reapply an obsolete launcher override. F5 and Ctrl+R also reload that page.
Reload leaves the current game; the launcher stays open. Other running profiles
and account-only windows cannot receive these requests. Enabled mods and current
mod storage remain in the regenerated preload. Mod installation/enabling changes
are outside this pack-only reload protocol.

Native Bloxd texture/shader selectors and imports remain native. Minecraft ZIP
shader playback in the launcher's download catalog is still in development;
this change does not implement an Iris/Minecraft shader loader.

## Sign-in and recurring work

Official auth popups and their opener run without background throttling for the
popup lifetime. The opener's previous policy is restored after the final popup
closes. Origins, OAuth callbacks, session isolation, web security, preload
exclusion and manual sign-in are preserved. No token or account data is read.
This removes one scheduling delay; it does not establish the cause or measured
fix of the user's login delays or provider errors.

After successful character sync, unchanged metadata uses a 10-second full mesh
signature audit instead of one every 2 seconds. New session identities and
changed public outfit metadata bypass that delay. Initial asset settling and
the final ownership/signature check before saving are preserved. An asset-only
change with identical public metadata can take up to the next 10-second audit
to be detected. World/session discovery cadence is unchanged. The fixture
performs at most 10 signature audits in 50 unchanged 2-second ticks, instead of
50. This is not a measured FPS result or a fix for every Bloxd lag source.

## CrazyGames limitation

No working CrazyGames-login EZ Mod is claimed or added. The official user SDK
requires the CrazyGames environment, and Bloxd's own current public source
initializes its CrazyGames account adapter only there. Account linking and token
verification also require Bloxd's backend. Setting a platform URL parameter or
injecting a fake SDK would not provide valid account integration.
https://docs.crazygames.com/sdk/html5-v2/user-linking/
https://docs.crazygames.com/sdk/intro/

## Verification and manual acceptance

Evidence: `outputs/packs-login-0.6.52/`. The old packaged texture adapter
replaces a native Custom selection with tinyBits and suppresses its save; the
new adapter keeps Custom and forwards the save. Read-permission and F5 regressions
fail against 0.6.51. Remaining live acceptance is user-operated:

1. Select JamBloxds 16x16 in the launcher while its profile is open; click
   Reload Bloxd. Confirm the window stays open and the pack appears.
2. In Bloxd, select another native texture pack, reload, and confirm it stays
   selected. Import a native texture folder and a supported native shader pack.
3. Import a Bloxd JSON in the launcher, including replacing Custom with another
   file, and use Reload Bloxd without restarting the launcher.
4. Complete your normal official login and compare loading and the same game's
   FPS/lag. F8/F9 remain available. No universal speedup is promised.

The copied workspace's CMake caches point to its sibling checkout. No native
source was changed. Release packaging reuses the existing native resources and
verifies their bytes against 0.6.51; MemoryBudgetTests is run independently.

Final validation: 487 pure tests, 49 syntax files, both generated preloads,
MemoryBudgetTests and 61 packaged source files (62 including package.json) pass.
Setup, Portable and Update are byte-checked in distribution.json; Update equals
the verified NSIS upgrade installer. Package/lock versions are synchronized.
