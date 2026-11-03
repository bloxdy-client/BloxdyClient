# Windows distribution 0.6.53

26. Oktober 2026, 0.6.53 fertig/bytegeprueft: Auf ausdrueckliche Nutzerkorrektur CrazyGames als feste Kontooption eingebaut, KEINE EZ-Mod. Connect account -> CrazyGames startet direkt das spielbare neue Profil auf der echten https://www.crazygames.com/game/bloxdhop-io Portalseite; eigene persistente Sitzung, spaeterer Play nutzt dieselbe Route. Nutzer meldet sich selbst an. Keine Herkunfts-/Referrer-/siteUsed-/SDK-/Token-Nachahmung und kein Cookieimport. Sandbox/contextIsolation/webSecurity aktiv/Node in Seiten aus; Subframe-Preload nur fuer verifizierten HTTPS-Bloxd-Spielrahmen unter exakter offizieller Bloxd-Portalseite/erlaubten Portalvorfahren, Vorabfreigabe und erneute Pruefung jedes IPC. Portal/Ads/OAuth ohne Launcher-APIs. Mod-/Pack-/Metadatenpfade im Spielrahmen, F9 gezielt an Spielrahmen; F5/Reload gleiches Fenster. CG-Accountfenster ohne automatisches Bloxd-Kontomenue. Auth-CG-Domain aus oeffentlichem Portalcode bestaetigt/Popups ohne Preload oder Node; Native preview fuer CG gesperrt, Standard erforderlich. 498 reine Tests/50Syntax/dreiPreloads/MemoryBudgetTests bestanden, 62 Paketquellen ohne package/63 mit passend/VersionLock synchron. Setup/Portable/Update unter dist-bloxdy-v0.6.53 bytegeprueft; Originalkataloge/JamBloxds16x16/Litematica-/Shaderquellen/beide NativeEXEs gegen0.6.52 bytegleich. Keine Client-/Account-/Installer-/Browser-/Grafikstarts oder echte Profilmutation/Uploads durch Agenten. ECHTER CG-LOGIN/Sessionpersistenz/Live-Modkombinationen/Charakter/FPS weiterhin NICHT bestaetigt und Nutzerabnahme erforderlich; keine Erfolgsbehauptung. docs/CRAZYGAMES-LOGIN.md; outputs/crazygames-0.6.53/. Irisgesamtziel/Litematica-Sichtbarkeit weiter offen.

Bloxdy-Client-Setup-0.6.53-x64.exe: 205502791 bytes, SHA256 fa4452d58f83c6267a825127c7dad9d73b41a9ce70eedb8e5329bb26bde97391

Bloxdy-Client-Portable-0.6.53-x64.exe: 205350001 bytes, SHA256 726d5166e22faa6b068759a052a327defbdad07413b03cde38efa54c0511f0f9

Bloxdy-Client-Update-0.6.53-x64.exe: 205502791 bytes, SHA256 fa4452d58f83c6267a825127c7dad9d73b41a9ce70eedb8e5329bb26bde97391

## Previous 0.6.52

26. Oktober 2026, 0.6.52 fertig/bytegeprueft: JamBloxds 16x16 offiziell gebuendelt; native Packauswahl/-saves nach Initialisierung freigegeben, Ingame-Handover ueber Seitenreload. Beide Handler erlauben scoped Dateileserechte fuer Bloxd-Packpicker. Laufende Profile uebernehmen Launcherauswahl/JSON-Import per ereignisbasiertem Runprotokoll ohne Clientneustart; Reload Bloxd/F5/Ctrl+R bleiben im selben Fenster/Prozess. Authpopup-/Opener-Drosselung temporaer aufgehoben/restauriert; gespeicherte unveraenderte Charaktere nur alle10s voll auditiert, Join/Metadatenwechsel umgehen Wartezeit. CrazyGames-EZ-Mod NICHT implementiert: offizielle SDK-Umgebung/Bloxd-Backend erforderlich. Minecraft-ZIP-Shaderloader weiter offen. 487 reine Tests/49Syntax/beidePreloads/MemoryBudgetTests bestanden; 61 Paketquellen ohne package/62 mit passend, Version/Lock synchron. Originalkataloge, Litematica-/Shaderquellen und beide NativeEXEs gegen0.6.51 bytegleich. Setup/Portable/Update unter dist-bloxdy-v0.6.52 bytegeprueft. Keine Client-/Account-/Installer-/Browser-/Grafikstarts, echte Profilmutation oder Uploads. Live-Pack-/Login-/FPS-Abnahme offen, irisContractComplete=false. docs/PACKS-RELOAD.md; outputs/packs-login-0.6.52/.

Bloxdy-Client-Setup-0.6.52-x64.exe: 205501464 bytes, SHA256 de42eb1b1b0be2b1425f2c763fd033ab07a8784e721b5b7c5a740bce42a3f49b

Bloxdy-Client-Portable-0.6.52-x64.exe: 205348668 bytes, SHA256 065a5c84fb9057a4ebbf545023c994d2c029622b25590e6ba1bc44dfe6735f12

Bloxdy-Client-Update-0.6.52-x64.exe: 205501464 bytes, SHA256 de42eb1b1b0be2b1425f2c763fd033ab07a8784e721b5b7c5a740bce42a3f49b

## Previous 0.6.48

23. Oktober 2026, 0.6.48 fertig: Nutzerpraezisierung zu Profiltexten: Titel Profiles wiederhergestellt, kleine Profilanzahl entfernt. YOUR LAUNCHER und Untertitel bleiben ausgeblendet. Unnoetige CSS-Regel fuer die alleinstehende Anzahl entfernt. Diese Klarstellung ersetzt die Titelentfernung/Anzahlbeibehaltung aus0.6.47. 453 reine Tests/43Syntax/beidePreloads/MemoryBudgetTests bestanden;Setup/Portable/Update unter dist-bloxdy-v0.6.48 bytegeprueft,50Quellen ohne package/51mit passend,Version/Lock synchron. Gegen0.6.47 nur ui.js/style.css/package.json anders;alleanderenPaketquellen/beideNativeEXEs/Originalkataloge bytegleich. Litematica-/Auto-Save-/HUD-Fixes aus0.6.47 erhalten. Keine Client-/Account-/Installer-/Grafikstarts/Profilmutation/Uploads;Liveoptik offen. Nachweise outputs/profile-heading-0.6.48/.

Bloxdy-Client-Setup-0.6.48-x64.exe: 186856990 bytes, SHA256 356922eb34006e0fe3f8b2cf2255d6011ea3e54def4c4dadc683a0f0de5bdb4b

Bloxdy-Client-Portable-0.6.48-x64.exe: 186704203 bytes, SHA256 5a0d9b6a913c50f7fefeec850a054703f568b534fcc159e2a4b768dd66cab6b2

Bloxdy-Client-Update-0.6.48-x64.exe: 186856990 bytes, SHA256 356922eb34006e0fe3f8b2cf2255d6011ea3e54def4c4dadc683a0f0de5bdb4b

## Previous 0.6.47

23. Oktober 2026, 0.6.47 fertig: Profilseiten-Ueberschrift Profiles und Untertitel Your setups. Each one its own world. entfernt; YOUR LAUNCHER standardmaessig auf Launcher-Seiten ausgeblendet. Profilanzahl/Kontenauswahl erhalten. Save bei aktivem Auto-Save und bereits gespeicherter aktiver Vorlage deaktiviert, nach Speicherfehler weiter Retry moeglich; gilt Build/Paste und reagiert auf Einstellung. Litematica-HUD nur bei aktiver Sitzung (Websocket oder Handler/Game), zugehoerigem Enginekontext und vorhandener ChatInput-Spielflaeche; Replay ausgeschlossen. Lobby/Homescreen und Verlassen verbergen HUD sowohl Build/Paste als auch Save area. Nur passive Quell-/DOM-Abfrage, keine Clientbedienung. 453 reine Tests/43 Syntax/beide Preloads/MemoryBudgetTests bestanden. Setup/Portable/Update bytegeprueft,50Quellen ohne package/51mit passend,Version/Lock synchron. Gegen0.6.46 nur UI/Styles/Menuadapter/package anders;Originalkataloge/beideNativeEXEs/anderePaketquellen bytegleich. Keine Client-/Account-/Installer-/Grafikstarts/Profilmutation/Uploads. Reale Optik/Join-Leave-Abnahme offen. Nachweise outputs/profile-copy-0.6.47/.

Bloxdy-Client-Setup-0.6.47-x64.exe: 186857025 bytes, SHA256 059cb9c9cb3055253d7f5fb18a178b47b397eeafbbc5046ef2e6a2d635c90608

Bloxdy-Client-Portable-0.6.47-x64.exe: 186704227 bytes, SHA256 99a22df6eaa64c1e33314eca2ffb9f78866e207df71013f7fbb674588dadc1da

Bloxdy-Client-Update-0.6.47-x64.exe: 186857025 bytes, SHA256 059cb9c9cb3055253d7f5fb18a178b47b397eeafbbc5046ef2e6a2d635c90608

## Previous 0.6.46

Current output: dist-bloxdy-v0.6.46/. Close launcher/game yourself before running Bloxdy-Client-Update-0.6.46-x64.exe. Visible version: v0.6.46. Setup/Portable/Update byte-verified; 50 sources excluding package.json (51 including), native resources exact, no private folders. Only menu adapter/package.json differ from 0.6.45; renderer/shaders/original archives/native binaries unchanged. 452 pure tests, both preloads and MemoryBudgetTests passed. Nothing started, installed or uploaded. Evidence: outputs/litematica-filename-0.6.46/.

Bloxdy-Client-Setup-0.6.46-x64.exe: 186856809 bytes, SHA-256 bbb2da910e4f790fcea2d2354fe32e5d4af4d6ac4d73455f48701e393b513261

Bloxdy-Client-Portable-0.6.46-x64.exe: 186704011 bytes, SHA-256 7d5d8716a229f74a3e7ee3173a1071ddf591f05372be36fb8dc2678e73e3339a

Bloxdy-Client-Update-0.6.46-x64.exe: 186856809 bytes, SHA-256 bbb2da910e4f790fcea2d2354fe32e5d4af4d6ac4d73455f48701e393b513261

## Previous 0.6.45

Current output: dist-bloxdy-v0.6.45/. Close launcher/game yourself, run
Bloxdy-Client-Update-0.6.45-x64.exe, then reopen the launcher yourself.
The lower-left version should show v0.6.45. Setup and Portable are included.

50 packaged sources excluding package.json (51 including it) match the final
verified sources. Native resources match; no private folders are included.
Setup/Update: 186856748 bytes, SHA-256 7c384403f44f4112dd49d14fe143942f5bcc7563e4161a3d73e452e27641b443.
Portable: 186703960 bytes, SHA-256 18ed21c08b563c19ddb6db0a558d3e9c23d5db151350edc84038a56219e62d22.
Only litematica-menu.cjs/package.json differ from 0.6.44. Both native binaries,
all renderer/shader/mod archives/account paths and other packaged sources are
unchanged. Adapted mod changes only litematica.js. Version/lock synchronized.
451 pure tests, 43 syntax files, both preloads and MemoryBudgetTests passed.
Evidence: outputs/litematica-layers-0.6.45/. No client, account or installer
started; nothing installed or uploaded. Live visual acceptance remains open.

## Previous 0.6.44

Current output: dist-bloxdy-v0.6.44/. Close launcher/game yourself, run
Bloxdy-Client-Update-0.6.44-x64.exe, then reopen the launcher yourself.
The lower-left version should show v0.6.44. Setup and Portable are included.

50 packaged sources excluding package.json (51 including it) match the final
verified sources. Native resources match; no private folders are included.
Setup/Update: 186856547 bytes, SHA-256 eaa48bffb2501c951d726aa66f3f3008ebaaaa1025fde74d902723e944bd28a3.
Portable: 186703758 bytes, SHA-256 c9bb8f7e20054f04c7e295dc200fc287102f6fdc7ebb0ab2376094d7cf852407.
Only litematica-menu.cjs/package.json differ from 0.6.43. Both native binaries,
all renderer/shader/mod archives/account paths and other packaged sources are
unchanged. Adapted mod changes only litematica.js. Version/lock synchronized.
449 pure tests, 43 syntax files, both preloads and MemoryBudgetTests passed.
Evidence: outputs/litematica-library-0.6.44/. Final same-version rebuild includes
the full-width placeholder correction; earlier build logs are retained.
No client, account or installer started; nothing installed or uploaded.
Live visual acceptance remains open.

## Previous 0.6.43

Current output: dist-bloxdy-v0.6.43/. Close launcher/game yourself, run
Bloxdy-Client-Update-0.6.43-x64.exe, then reopen the launcher yourself.
The lower-left version should show v0.6.43. Setup and Portable are included.

50 packaged sources excluding package.json (51 including it) match the final
verified sources. Native resources match; no private folders are included.
Setup/Update: 186855522 bytes, SHA-256 ce28ca80bb2fa82c4246868dee46c47ed400453973c5cb82cc19263a1f288f9f.
Portable: 186702734 bytes, SHA-256 810ee5151c7c4d266a5ef48801c56591216356cb18289bec2577323d62b5a64a.
Only litematica-menu.cjs/package.json differ from 0.6.42. Both native binaries,
all renderer/shader/mod archives/account paths and other packaged sources are
unchanged. Adapted mod changes only litematica.js. 442 pure tests, 43 syntax
files, both preloads and MemoryBudgetTests passed. Version/lock synchronized.
Evidence: outputs/litematica-polish-0.6.43/. No client, account or installer
started; nothing installed or uploaded. Live visual acceptance remains open.

## Previous 0.6.42

Current output: dist-bloxdy-v0.6.42/. Close launcher/game yourself, run
Bloxdy-Client-Update-0.6.42-x64.exe, then reopen the launcher yourself.
The lower-left version should show v0.6.42. Setup and Portable are included.

50 packaged sources excluding package.json (51 including it) match the final
verified sources. Native resources match; no private folders are included.
Setup/Update: 186855391 bytes, SHA-256 0b6727bd2f3ba5cb13051677385918c0ccb17769207b4f9382476e0c553edd73.
Portable: 186702595 bytes, SHA-256 683a4d1062b585eb9b82b8086ead7eedfffd69b44abc779001f53ecd3bf2c50e.
Only litematica-menu.cjs/package.json differ from0.6.41. Both native binaries,
all renderer/shader/mod archives/account paths and other packaged sources are
unchanged. 441 pure tests, both preloads and MemoryBudgetTests passed.
Evidence: outputs/litematica-native-design-0.6.42/. The initial intermediate
archive was replaced by a same-version build including the final input-font fix.
No client, account or installer started; nothing installed or uploaded.
Native source-CSS comparison passed; live in-game visual acceptance remains open.

## Previous 0.6.41

Current output: dist-bloxdy-v0.6.41/. Close launcher/game yourself, run
Bloxdy-Client-Update-0.6.41-x64.exe, then reopen the launcher yourself.
The lower-left version should show v0.6.41. Setup and Portable are included.

50 packaged sources excluding package.json (51 including it) match; native
resources match and no private folders are included.
Setup/Update: 186854341 bytes, SHA-256 92e5ea8781ec319643429e302fe93f447b1e43e71a13f8b4ca60606ff7c434f0.
Portable: 186701553 bytes, SHA-256 f37da2a7980b05843e347ebb2f81e28034f0dfdc1e4f4a4864782987c481c668.
Only litematica-performance.cjs/package.json differ from 0.6.40 and
litematica-menu.cjs is added. Original mod archives, both native binaries and
preview shader literals are unchanged. 438 pure tests, both preloads and
MemoryBudgetTests passed. Evidence: outputs/litematica-menu-0.6.41/.
No client, account or installer started; nothing installed or uploaded.
Live visual/gameplay acceptance remains open. This is the approved menu step.

## Previous 0.6.40

Current output: dist-bloxdy-v0.6.40/. Close launcher/game yourself, run
Bloxdy-Client-Update-0.6.40-x64.exe, then reopen the launcher yourself.
The lower-left version should show v0.6.40. Setup and Portable are included.

49 packaged sources/native resources match; no private folders.
Setup/Update: 186847626 bytes, SHA-256 3c645fa5f89138dd7d1afa51149d56736b977f2fa1fe270c56272c2633117d74.
Portable: 186694825 bytes, SHA-256 ecfe236904206b4254b019f7d7914463a2b8089561905aa1bd4712cd1d4c9976.
Only launcher/main.cjs and package.json differ from 0.6.39. Both native
executables, mods, catalogs, bridge and renderer are byte-identical.
425 pure tests, both preloads and MemoryBudgetTests passed. Reports:
outputs/client-status-write-0.6.40/. No client, account or installer started;
nothing installed or uploaded. Original Windows file blocker unknown.

## Previous 0.6.39

Current output: dist-bloxdy-v0.6.39/. Close launcher/game yourself, run
Bloxdy-Client-Update-0.6.39-x64.exe, then reopen the launcher yourself.
The lower-left version should show v0.6.39. Setup and Portable are included.

49 packaged sources/native resources match; no private folders.
Setup/Update: 186847358 bytes, SHA-256 0f9e3d21176e009695f6e0be690fc768b6d94b8a1da41f0a6dcc3f388a562895.
Portable: 186694566 bytes, SHA-256 5d500e9c7760f8d42b6065a23f1d007ebe5bf491861cdcc35f0ac683c5020c56.
Only package.json and the intended native renderer differ from0.6.38.
All six production shader literals, catalogs and other packaged sources are
unchanged. This is an experimental material-data increment, not a production
Iris activation. Reports: outputs/shaped-materials-0.6.39/.
No client, account or installer started; nothing installed or uploaded.

## Previous Windows distribution 0.6.38

Current output: dist-bloxdy-v0.6.38/. Close launcher/game yourself, run
Bloxdy-Client-Update-0.6.38-x64.exe, then reopen the launcher yourself.
The lower-left version should show v0.6.38. Setup and Portable are included.

49 packaged sources/native resources match. No private folders.
Setup/Update: 186845018 bytes, SHA-256 60a6a681d40e1e2847f7737ef0ea1040641e6ad1702e8aa62a4c3016189feb13.
Portable: 186692230 bytes, SHA-256 ea203b12518f62ad3071baafa568e4e97482378608ac09c2474430cd65def611.
Three Litematica adapters/package.json differ from0.6.37. Native binaries,
original catalogs and quality defaults are unchanged; the preview fragment
depth policy is intentionally updated. No client/installer started or uploaded.
Reports: outputs/litematica-stability-0.6.38/. Real gameplay acceptance is open.

## Previous Windows distribution 0.6.37

Current output: `dist-bloxdy-v0.6.37/`. Close the launcher and game yourself, run
`Bloxdy-Client-Update-0.6.37-x64.exe`, then reopen the launcher yourself. The
lower-left version should show `v0.6.37`. Setup and Portable are also included.

Byte verification passed for all 49 packaged sources and both native resources.
Setup/Update are identical (186,843,927 bytes), SHA-256
`77f3de7f56d6491fe0f789c24c07574a4f73158ffa05ada0860291dcc64f8a14`.
Portable is 186,691,139 bytes, SHA-256
`1f0646e8a7cd85f76ee089afc0fd7a976414a27139ccc4da0abddd6083ae9579`.
Only the two Litematica adapters and package.json differ from 0.6.36. Original
catalogs, native binaries, shader formulas and quality defaults are unchanged.
No private folders included; no installer/client launched or upload performed.
Reports: `outputs/litematica-recovery-0.6.37/`. Gameplay acceptance remains open.

## Previous Windows distribution 0.6.35

Current output: `dist-bloxdy-v0.6.35/`. Use
`Bloxdy-Client-Update-0.6.35-x64.exe` to upgrade an installed launcher. Close the
launcher and game yourself, run the update, then reopen the launcher yourself.
The lower-left version should show `v0.6.35`. Setup and Portable are included.

Byte verification passed for all 49 packaged sources and both native resources.
Setup/Update are identical (186,842,483 bytes), SHA-256
`5ace03a403f37cdbb938500fd3b97626ef9a8b44c2a8848054d335765b5c55bf`.
Portable is 186,689,693 bytes, SHA-256
`3f8576a604f0833025cc757a4192e4142d0b064b6c4f28a38994fbb655bb65d5`.
Original catalogs and native binaries are unchanged from 0.6.34. No private
folders included; no installer/client launched. Reports and CPU comparisons:
`outputs/litematica-overhaul-0.6.35/`. Gameplay acceptance remains with the user.

## Previous Windows distribution 0.6.20

Current output: `dist-bloxdy-v0.6.20/`. Use
`Bloxdy-Client-Update-0.6.20-x64.exe` to upgrade an installed launcher. Close the
launcher and game yourself, run the update executable, then reopen the launcher
yourself. The lower-left version label is populated from the installed package
and should show `v0.6.20`. Existing application identity and all data paths remain
unchanged. The update executable is byte-identical to this release's complete
NSIS installer. It can also install the application when none is installed;
it does not overwrite a separate portable executable in an arbitrary folder.

Build future releases with `Build-Release.ps1`: this increments the patch version
in package.json/package-lock.json and packages into its own versioned directory.
Use `-KeepVersion` only to rebuild the same release. The packaging hook emits an
Update EXE whenever a Windows NSIS installer is built. Run
`node launcher/check-package.cjs dist-bloxdy-v<version>` to check all three EXEs,
including identical Setup/Update hashes and matching packaged sources.

Includes the shader performance fixes and current guarded experimental work.
There is no agent-run installer/client test or live FPS/visual acceptance.

0.6.20 packaging and file verification passed: 43 sources byte-identical,
matching native resources, no private folders; Update and Setup hashes match.
261 pure tests passed. Reports: `outputs/release-0.6.20/verification.json` and
`distribution.json`. All three artifact hashes: `dist-bloxdy-v0.6.20/SHA256SUMS.txt`.

## Previous 0.6.19

The current build is packaged separately in `dist-bloxdy-v0.6.19/`. It includes
the experimental native fullscreen target/execution runtime: paired logical
targets, explicit output routing, typed clears, persistence, reserved mips and
shared target budgets. Internal compiled effects can resolve into embedded
scene output. No effect list is installed by default; the shipped embedded path
adds no scratch/history textures, draws or copies.

The renderer is not complete and does not execute shaderpacks. Main/preload/
capture/presenter/transport sources match 0.6.18 byte-for-byte. View distance 10,
source selection/fallback and original mod snapshots are retained. Builds need
no paid service or subscription. Packages are built/inspected as files only;
the agent never starts the client or installer.

The 0.6.19 file check passed: 39 sources byte-identical, native resources match,
no private folders. Installer 186,746,060 bytes, SHA256
fb7ee5e683a4613043912ebef8959835af1fec6008e2635fd1aa91c06361119c.
Portable 186,593,259 bytes, SHA256
8b2dbde9302039070b572e0e04215f331fb7798507c80b8b7deec90a804976e3.
Both packages are Authenticode NotSigned. Checksums are recorded in
`dist-bloxdy-v0.6.19/SHA256SUMS.txt`; file-check report:
`outputs/launcher-verification/distribution.json`. No package was executed or
installed; all previous releases remain intact.

## Previous 0.6.18

Installer and portable EXE are built separately in `dist-bloxdy-v0.6.18/`. They contain Electron/Chromium, the launcher, local Three.js viewer/license, verified snapshots of the three existing mods, guarded experimental native renderer and Windows memory helper. End users need no developer tools. These builds require no paid service or subscription. They are unsigned and have not been uploaded online.

0.6.18 adds an internal demand-driven previous-world HDR color/32F opaque-depth
resource, isolated from hand output and committed only after successful frames.
No existing pass requests it, so the shipped path adds no history allocations or
copies. No TAA, shader loader or complete Minecraft/Iris compatibility is enabled.
Default/Main/Preload/Capture/Presenter/Transport sources match 0.6.17 byte-for-byte.
Distance 10, original mods, selection/budget/ownership protection are unchanged.

The 0.6.18 file check passed: 39 sources byte-identical, native resources match,
no private folders. Both EXEs are Authenticode NotSigned. Installer 186,739,641
bytes, SHA256 db524acf48291d49c17089f6efbc845423e831a175a6fe6d9b978e7e17933909.
Portable 186,586,856 bytes, SHA256
2a994e986f2512a1bdf0d1fb3e24de4f03042c895008de66eab8f143be5cbdc9.
Checksums: `dist-bloxdy-v0.6.18/SHA256SUMS.txt`; report:
`outputs/launcher-verification/distribution.json`. No executable was run or
installed; previous releases remain intact.

## Previous 0.6.17

0.6.17 advances only the experimental renderer: successful-frame object/CPU-pose
history, origin-compensated reprojection and a sixth native motion attachment.
Static geometry is not duplicated; CPU/GPU pose reservations share a 64 MiB cap.
Unknown moving thin-instance slots and invalid history remain marked unknown.
This is not enabled TAA or complete Iris compatibility. Original standard Bloxd
remains unchanged and excludes native transport/capture/presentation.

The 0.6.17 file check passed: 39 sources byte-identical, native resources match,
no private folders. Both EXEs are Authenticode NotSigned. Checksums:
`dist-bloxdy-v0.6.17/SHA256SUMS.txt`; report:
`outputs/launcher-verification/distribution.json`. No executable was run or
installed; previous releases remain intact.

## Previous Releases

0.6.16 adds CPU particle ramp textures/remap and subtract/multiply/two-pass
MultiplyAdd, source alpha accumulation and guarded secondary resources. Packet
29 requires matching capture/native builds; existing layouts remain readable.
Source state/bindings are cached. GPU particles, sprites and the full Iris
contract remain unfinished. Distance 10 and ownership/budget guards remain.

The 0.6.16 file check passed: 39 sources byte-identical, native resources match,
no private folders. Both EXEs are Authenticode NotSigned. Checksums:
`dist-bloxdy-v0.6.16/SHA256SUMS.txt`; report:
`outputs/launcher-verification/distribution.json`. No executable was run or
installed; previous releases remain intact.

0.6.15 extends actual active CPU particles with Y/stretched/local-stretched/fixed
alignment, animated sheet cells/insets, emitter directions/world offsets, masks
and bounded HDR color. Packet 28 carries extended state atomically and requires
matched capture/native builds. Existing geometry and unchanged buffers are reused.
GPU/ramp/multiply/custom particle programs, sprites and the full Iris contract
remain unfinished. Distance 10, active selection, budgets and ownership guards
are unchanged. Client/account/image/FPS checks remain user-only.

The 0.6.15 file check passed: 39 sources byte-identical, native resources match,
no private folders. Both EXEs are Authenticode NotSigned. Checksums:
`dist-bloxdy-v0.6.15/SHA256SUMS.txt`; report:
`outputs/launcher-verification/distribution.json`. No executable has been run or
installed. Previous releases remain intact.

0.6.14 adds actual source group/depth/sort policy and read-only observed cameras
for supported isolated hand/overlay groups. Source matrices are never modified.
World camera/surface/depth/shadow data stay separate; missing/stale observations,
unknown sorters and mixed world-group overlays keep fallback. Packet 27 requires
matched native/capture binaries. Full Iris semantics/stages/buffers, complex
particles and sprites remain unfinished. Distance 10 and ownership guards remain.

The 0.6.14 package check passed: 39 sources byte-identical, native resources match,
no private folders. Both EXEs are Authenticode NotSigned. Current checksums:
`dist-bloxdy-v0.6.14/SHA256SUMS.txt`; report:
`outputs/launcher-verification/distribution.json`. No executable was run or
installed; previous releases remain intact. Following entries are historical.

0.6.13 adds source Cape/TextSampler/Enchantment effects and basic CPU camera-
billboard particles with atomic data and source system ordering. Unsupported
special particles, sprites, render groups and hand projections retain source
fallback. New BND1 packets 24-26 require matched native/capture builds. Full Iris
uniform/semantic/stage/buffer contracts and real image/FPS parity remain open.

The 0.6.13 package check passed: 39 sources byte-identical, native resources
match, no private folders. Both EXEs are Authenticode NotSigned. Checksums:
`dist-bloxdy-v0.6.13/SHA256SUMS.txt`; report:
`outputs/launcher-verification/distribution.json`. Nothing was executed or
installed; previous releases remain intact. The following entries are historical.

0.6.12 extends Armour/Hue/per-face materials, source min/mag/mip/sRGB sampling,
actual atlas animation and completed-frame camera history with precise origins.
It is experimental, not a finished Minecraft/Iris engine. New BND1 packets 20-23
require matched capture/native builds. Distance 10 and fallback guards remain.

The 0.6.12 package check passed: 39 sources byte-identical, matching native
resources, no private folders; both EXEs are Authenticode NotSigned. Current
checksums: `dist-bloxdy-v0.6.12/SHA256SUMS.txt`. No executable was run.

0.6.11 adds targeted Lifeform mob/clothing, Overlay/Dither/Fade/Light/Animated
adapters and initial Iris vertex buffers, not complete Minecraft/Iris support.
Unknown and unimplemented source programs retain fallback. New packets 18/19
require matched capture and native binaries. The visual-shader chunk-edge
candidate fix retains complete shadow maps briefly while new data is pending.
Real images/FPS and whether the reported edge is gone remain user checks.

Package checks passed: 39 source files byte-identical, native resources match,
no private folders. Both EXEs report Authenticode NotSigned. Checksums are in
`dist-bloxdy-v0.6.11/SHA256SUMS.txt`; the report is
`outputs/launcher-verification/distribution.json`. Neither package was executed.

0.6.10 extends the native material contract (UV matrix, independent address modes,
alpha/culling/depth/fog) for the user-selected Minecraft Java / Iris reference.
It is not a complete Minecraft engine or shaderpack implementation. Unknown real
source plugins and mob/cosmetic paths remain source fallback. Capture and native
binary must stay matched because packet 17 is new. Earlier packages are retained.

0.6.9 reduces idle capture overhead, prioritizes new active chunk imports and reuses presentation texture storage. The source fallback and configured distance remain intact. F8/F9 distinguish source engine cadence from native output, so a paused native renderer's zero FPS is not the game rate. Synthetic CPU improvements are not live FPS or server-delivery measurements. Installation, opening, visual comparisons and FPS/chunk measurements remain user-only.

0.6.8 stabilizes severe user-reported 0.6.7 regressions, not full native rendering. Native capture uses only source-active meshes and removes obsolete geometry/textures. Configured distance remains unchanged. Unsupported mob/clothing/material/mod/particle pipelines retain the actual Bloxd image; native image generation pauses during fallback. Successful supported handover suppresses source canvas draw calls, not gameplay or resource updates. Real visuals and performance must be checked by the user; the agent must not install, open or operate any client or account.

The installer uses a per-user application folder and desktop shortcut; legacy desktop program folders remain hidden. It does not start the launcher automatically. Separate release output avoids replacing an executable the user may be running. `SHA256SUMS.txt` identifies the final bytes.

Runtime state, per-account GLB models, profile downloads/settings and recovery copies live under `%LOCALAPPDATA%/BloxdNative/launcher-data`. UI and official Bloxd sessions have separate userData folders and account partitions. Private data, tokens, cookies, research, logs and tests are excluded from release packages. The parent validates account/profile-scoped updates from its own child; a game cannot overwrite renamed/new profiles.

Play uses a Windows Job Object and confirms its matching game window is visible. The 1–32 GB setting uses GiB of committed memory across the game process group, excluding VRAM. A small budget can close the game. The helper is unchanged from its CPU-tested prior release.

Account actions now use official windows opened by user buttons. The user performs login/sign-up/name changes there. Joining a game automatically saves the owned model and embedded clothing textures as GLB, displayed locally on Play. No character screenshot is taken. Adapter limits and verification are in [ACCOUNT-CONNECTION.md](ACCOUNT-CONNECTION.md).

User release check:

1. Close previous launcher and Bloxd windows yourself. Install 0.6.17 and open the launcher yourself.
2. Save Settings and check no bottom notification appears. Test themes/dropdowns, mouse choices, arrow keys, Enter and Escape.
3. Open Accounts → Settings for the existing session and complete login yourself. Provider buttons add independent sessions; choose the matching provider in Bloxd.
4. Close the account window yourself and click Play. Join a world yourself and allow the model export to complete.
5. Check that Play shows only your character and username. Its default view should face you; mouse drag rotates while wheel/pinch cannot resize it. If no model exists, check the automatic-join placeholder.
6. Test account/profile separation, deletion Cancel, profile name/RAM and Play’s separate game window.
7. Test installation and Play on another Windows x64 computer before public distribution.

The agent does not perform these application/account actions. Pure checks are `npm run test:launcher`, `npm run test:unit`, `node launcher/verify.cjs`, the standalone CPU-only memory test, and `node launcher/check-package.cjs dist-bloxdy-v0.6.17`.

Close Bloxd with its window X or Alt+F4. The launcher should remain open and Play should become available again. In Task Manager the game image is named `Bloxdy Game Client.exe`; end only that game process if testing forced termination. Ending the launcher or an entire tree that includes it necessarily closes the launcher. Packaging checks compare both Electron images and the embedded source without executing either.

The 0.6.6 installer upgrades the existing application identity, updates the shortcut name to Bloxdy Client, and keeps existing session/profile storage paths. Check the homepage title/description, a fresh profile without the preset selector, and themed account/profile removal with Cancel/Escape before confirming. Native preview captions also use Bloxdy Client.

0.6.6 release check: Accounts has no explanation box or decorative intro/counter, while Settings/Profiles/Remove account remain visible. Settings fills the content width. Launcher labels cannot be selected; profile-name and search inputs still support selection/editing. Bloxd has no native menu bar even after Alt. F8 displays performance and F9 saves a game measurement. All visual checks are user-only.

0.6.6 shader check (user only): toggle Custom skies Off/On and verify the original Bloxd sky returns; inspect a block side without a bright rim; move near chunk borders; watch player and mob silhouettes while moving and switching perspective. Select Golden Hour and verify Cumulus is selected. Default shader settings enable Bloom, Glowing ores and Custom skies; existing explicit Off choices persist.

0.6.6 check (user only): installed mods offer Enable/Disable and Remove, with no launcher mod settings button. Configure water, lava, sky and lighting inside Bloxd. Switch these effects On/Off, inspect moving entities and chunk borders, and check whether the reported black sky and long shadow gaps are gone. The pure tests do not establish actual in-game appearance or FPS.

0.6.6 shader check (user only): place an ore near ordinary blocks and compare Glowing ores / block-light strength On and Off; neighbouring blocks should receive light. Select Wavey for water and lava, inspect actual surface height from the side and move a player/mob through each liquid to check 3D ripples. Change Flat/Wavey and confirm light stays current. Compare custom/native lava texture, including immediately after joining and after chunk streaming. Enable/Disable/Remove remain the only launcher mod actions. CPU tests and GLSL compilation do not establish visible rendering or FPS.
