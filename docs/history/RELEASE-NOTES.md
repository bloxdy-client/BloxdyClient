# Bloxdy Client 0.6.60

The internal shader loader now creates, compiles, links and reflects owned
vertex/fragment programs on an explicitly supplied existing context. Move-only
leases, eight bounded slots, queued owner-context cleanup and atomic replacement
retain a valid preceding program when compilation/link/reflection fails. Active
resource names/types/locations are checked without inferring Minecraft data or
physical texture routes. No context/window or production program is started.

530 pure tests, 51 syntax files, three preloads, native CPU lifecycle cases and
28 compiler cases pass (24 expected successes, four expected rejections). The
submitted source has an independent glslang interface oracle. CPU/compiler,
both oracles and MemoryBudgetTests pass independently after packaging.
Setup/Portable/Update are byte-checked; all 63 packaged sources and native
resources match, with version/lock synchronized. Only package.json changes in
ASAR against 0.6.59; the native renderer binary is refreshed. Evidence:
docs/LINKED-PACK-PROGRAMS.md and
outputs/linked-programs-0.6.60/. Runtime bindings/producers, draw routing,
production lifecycle/plan installation and image/FPS acceptance remain open.

## Previous release 0.6.59

The internal shader loader now translates a bounded GLSL 120 vertex/fragment
subset to GLSL 330 Core: explicit attributes/varyings, six texture-call variants
and legacy fragment outputs. Sparse output locations and original source/version
mapping are preserved. Interface conflicts and ambiguous or unsupported source
constructs reject preparation without replacing a preceding valid result.

527 pure tests, 51 syntax files and three preload variants pass. Original and
translated compiler fixtures cover color, sparse MRT and 2D/3D/Proj/Lod calls;
26 compiler cases pass (23 expected successes, three expected diagnostic
rejections), with native CPU, existing macro oracle and MemoryBudgetTests
passing independently after packaging. Setup/Portable/Update are byte-checked;
all 63 packaged sources and native resources match. Version/lock agree. Only
package.json changes in ASAR against 0.6.58; the native renderer binary is
refreshed. Evidence: docs/GLSL-LEGACY-TRANSLATION.md and
outputs/glsl-translation-0.6.59/. Broader translation, runtime facts, linked
program ownership/reflection/bindings, draw routing and production activation
remain open. This update does not establish live shaderpack image/FPS acceptance.

## Previous release 0.6.58

The internal shader loader now prepares GLSL object/function macros and nested
conditions after ZIP/folder acquisition and include resolution. Explicit macro
facts, source-declared versions and file/line diagnostics are preserved. Unknown
context, unsupported syntax, arithmetic faults and bounded-work failures reject
preparation while retaining previous valid results. Extension requests do not
infer hardware support.

523 pure tests, 51 syntax files and three preload variants pass. Independent native CPU/MemoryBudgetTests and 19 compiler cases
(17 expected successes, two expected file/line rejections) pass after packaging.
Fifteen common conditions and a function macro agree with glslang preprocessing.
Setup/Portable/Update are byte-checked; all 63 packaged sources and native
resources match, with version/lock synchronized. Only package.json changes in
ASAR against 0.6.57; the native renderer binary is refreshed. Evidence is in
docs/GLSL-MACRO-PREPROCESSOR.md and outputs/glsl-preprocessor-0.6.58/. This is an
internal preparation stage. Shader translation/bindings, authoritative runtime
context, production activation and live image/FPS acceptance remain open.

## Previous release 0.6.57

The internal shader loader can now read an explicitly supplied ZIP or pack
directory into an owned, bounded text snapshot and resolve native GLSL includes.
Local/central ZIP checks, selected-text CRC, link/path/identity guards and native
snapshot validation reject incomplete or ambiguous sources. Includes stay within
the virtual shaders root; missing files and cycles fail before conditions.
Root version ordering and generated file/line mappings are preserved.

520 pure tests, 51 syntax files, three preload variants and native CPU checks
pass. Compiler checks cover the existing 14 programs, one resolved source pair
and one intentional rejection at the expected included file/line. Pack material
snapshots reach existing world/shadow CPU bindings. This does not activate a
shaderpack or complete GLSL preprocessing/translation or live image/FPS
acceptance. See docs/PACK-SOURCES-INCLUDES.md and outputs/pack-sources-0.6.57/.

Setup/Portable/Update are byte-checked. All 63 packaged sources and both native
resources match; version/lock agree. The new reader and its service export are
the only launcher code changes. All other launcher/bridge/catalog/texture bytes
match 0.6.56. CPU, 16 compiler cases and MemoryBudgetTests pass independently
after packaging. No client, account, installer, browser or graphics context was
started by the agent.

## Previous release 0.6.56

The internal shader loader can now prepare raw block.properties with explicit
macro facts into an immutable material ID table. It evaluates nested conditions
and object macros, including ordinary property keys/values, with bounded work
and line diagnostics. Unknown conditional context and unsupported syntax abort
preparation while preserving the previous table and caller context.

511 pure tests, 50 syntax files, three preload variants, native CPU contracts and
14 GLSL programs pass. Eleven real Capture scenarios use prepared conditional
material tables in world/shadow CPU draws, including table replacement and
existing lifetime/cache/failure guards. No ZIP loading, GLSL translation or
automatic pack activation is introduced. Full shaderpack playback and live
image/FPS acceptance remain open. See docs/MATERIAL-PROPERTIES-LOADER.md and
outputs/properties-loader-0.6.56/.

Setup/Portable/Update are byte-checked; all 62 packaged sources and native
resources match, with version/lock synchronized. Compared with 0.6.55 only
package.json and BloxdNative.exe change in the distributed application.
Final CPU/14 GLSL/MemoryBudgetTests pass independently after packaging. The CPU
pipe helper now handles the existing bounded poll yields; production protocol
and freshness limits are unchanged. No client, account, installer, browser or
graphics context was started by the agent.

## Previous release 0.6.55

The experimental native renderer now recognizes exact Bloxd Water and Lava
material roots, bringing the table to 59 roots. Static source blocks retain
their geometry and behavior. No fluid simulation or reference flow/falling data
is introduced. Minecraft level remains unknown; pack IDs require the same
ordered first-match result across all 16 reference levels, resolved in one pass.
Unsupported fluids such as Toxic Waste remain unknown. Existing Water alpha,
Lava animation and independent own RGB emission are preserved.

508 pure tests, 50 syntax files, three preload variants, native CPU contracts and
14 GLSL programs pass. New terrain/instance fixtures cover world/shadow bindings,
level conflicts, cache/lifetime/failure guards and unchanged geometry bytes.
This does not complete Minecraft shaderpack playback or establish live pixels
or FPS. See docs/FLUID-MATERIAL-MAPPING.md and outputs/fluids-0.6.55/.

Setup/Portable/Update are byte-checked; all 62 packaged sources and native
resources match, and version/lock agree. Compared with 0.6.54 only package.json
and BloxdNative.exe change in the distributed application. Native CPU, memory
and 14 GLSL checks pass independently after packaging. No client, account,
installer, browser or graphics context was started by the agent.

## Previous release 0.6.54

The experimental native renderer now recognizes seven additional material roots:
Jungle/Cherry logs, their stripped variants, both plank types and Grass Block.
The table contains 57 roots. Unproven log axes and Grass Block snowy state stay
unknown; pack IDs resolve only when all possible reference states agree. Exact
species, registration/upload lifetime and stale-frame guards remain required.

504 pure tests, 50 syntax files, three generated preload variants, native CPU
contracts and 14 GLSL programs pass. This material-data update does not complete
Minecraft shaderpack playback or establish real rendered pixels/FPS. CrazyGames
login was confirmed working by the user; its account implementation is unchanged.
CrazyGames profiles continue to require Standard Bloxd. See
docs/WOOD-GRASS-MAPPING.md and outputs/wood-grass-0.6.54/.

Setup/Portable/Update are byte-checked. All 62 packaged sources and the native
resources match; version/lock agree. Compared with 0.6.53 only package.json and
BloxdNative.exe change in the distributed application. CPU, memory and GLSL
verification passed again independently after packaging. No client, account,
installer, browser or graphics context was started by the agent.

## Previous release 0.6.53

CrazyGames is now a built-in account provider. Connect account -> CrazyGames
opens the official Bloxd portal in a playable, isolated account profile. The user
signs in on the official page; later Play reuses that account's persistent session.
No login mod, cookie import, fake SDK or platform impersonation is used.

The sandboxed preload authorizes the real Bloxd iframe before installing client
features and checks its frame ancestry again for every IPC. Portal, ad and OAuth
frames receive no client API. Existing mod, pack, character and diagnostic paths
are connected to the game frame. CrazyGames currently requires Standard Bloxd.

498 pure tests, 50 syntax files, all three preload variants, MemoryBudgetTests
and 62 packaged sources pass. Setup/Portable/Update are byte-checked. Real login,
production session retention and live mod compatibility require user acceptance.
No client, browser, account, installer or graphics context was started.
See docs/CRAZYGAMES-LOGIN.md and outputs/crazygames-0.6.53/.

## Previous 0.6.52

Include the official JamBloxds 16x16 texture pack. Restore Bloxd's native texture
selection and saves after initial profile setup; grant read access to files and
folders selected in the official game picker. Launcher imports and selections
prepare the open profile immediately. Reload Bloxd, F5 and Ctrl+R reload its
existing page without restarting the launcher or game process.

Keep official sign-in callbacks responsive while an auth popup is open, then
restore the opener's previous background policy. Reduce repeated mesh signature
audits for already-synced, unchanged characters; preserve immediate checks on
joins and public outfit changes. Live login timing and FPS remain unverified.

CrazyGames-login EZ Mod is not implemented: official user authentication requires
the CrazyGames environment and Bloxd's backend. Native Bloxd shader packs keep
the native import path; Minecraft ZIP shader playback is still in development.
Litematica visibility and the full Iris renderer contract remain unresolved.

Evidence and user-operated acceptance: docs/PACKS-RELOAD.md and
outputs/packs-login-0.6.52/. No client, account, installer, browser or graphics
context was started. Original catalogs and native programs are preserved.

## Previous 0.6.50

Establish the direct Litematica overlay's scissor, cull-face and colour-output
state instead of inheriting source states that can suppress every fragment
while the frame counter advances. Restore the actual default-framebuffer
draw-buffer state afterwards. The user's0.6.49 invisible-preview report
supersedes its earlier CPU-only rendering results.

Confirm new Stick corner coordinates immediately. An old unloaded endpoint
defers automatic area reads and never prevents editing either corner.
Automatic interior-read errors explain that the area must be loaded; explicit
export retains full validation. Existing opposite coordinates are preserved.

471 pure tests,47 syntax files, both preloads, MemoryBudgetTests and the
preview shader pair passed. Setup/Portable/Update are byte-checked against58
package sources; original catalogs/native programs/other sources match0.6.49.
No client/account/installer/graphics starts. Actual visibility/FPS/flicker
remain user verification. Details: docs/LITEMATICA-VISIBILITY.md;
evidence: outputs/visibility-0.6.50/.

## Previous 0.6.49

Litematica placement now uses native world depth without replaying the world
or compositing a captured screen. Preserve caches across discovery-wrapper
refreshes and withhold partial HUD reindex counts. Correct normalized water/
lava colours; use registered partial shapes and actual static GLB block models,
including worker-decoded Draco geometry. Retain native variant and multiblock
part identities. Sort Materials by Total descending, then alphabetically.

The accepted menu remains intact.468 pure tests,47 syntax files, both preloads,
the CPU memory-budget test, the preview GLSL pair and86 source GLB data checks
passed. Setup, Portable and Update are byte-checked against58 packaged sources;
the original catalogs and both native executables match0.6.48. Evidence is
recorded under outputs/placement-0.6.49; live FPS, flicker and model appearance
remain user verification. Details and format/resource limits:
docs/LITEMATICA-PLACEMENT.md. No client/account/installer/graphics starts.

## Previous 0.6.48

23. Oktober 2026, 0.6.48 fertig: Nutzerpraezisierung zu Profiltexten: Titel Profiles wiederhergestellt, kleine Profilanzahl entfernt. YOUR LAUNCHER und Untertitel bleiben ausgeblendet. Unnoetige CSS-Regel fuer die alleinstehende Anzahl entfernt. Diese Klarstellung ersetzt die Titelentfernung/Anzahlbeibehaltung aus0.6.47. 453 reine Tests/43Syntax/beidePreloads/MemoryBudgetTests bestanden;Setup/Portable/Update unter dist-bloxdy-v0.6.48 bytegeprueft,50Quellen ohne package/51mit passend,Version/Lock synchron. Gegen0.6.47 nur ui.js/style.css/package.json anders;alleanderenPaketquellen/beideNativeEXEs/Originalkataloge bytegleich. Litematica-/Auto-Save-/HUD-Fixes aus0.6.47 erhalten. Keine Client-/Account-/Installer-/Grafikstarts/Profilmutation/Uploads;Liveoptik offen. Nachweise outputs/profile-heading-0.6.48/.

## Previous 0.6.47

23. Oktober 2026, 0.6.47 fertig: Profilseiten-Ueberschrift Profiles und Untertitel Your setups. Each one its own world. entfernt; YOUR LAUNCHER standardmaessig auf Launcher-Seiten ausgeblendet. Profilanzahl/Kontenauswahl erhalten. Save bei aktivem Auto-Save und bereits gespeicherter aktiver Vorlage deaktiviert, nach Speicherfehler weiter Retry moeglich; gilt Build/Paste und reagiert auf Einstellung. Litematica-HUD nur bei aktiver Sitzung (Websocket oder Handler/Game), zugehoerigem Enginekontext und vorhandener ChatInput-Spielflaeche; Replay ausgeschlossen. Lobby/Homescreen und Verlassen verbergen HUD sowohl Build/Paste als auch Save area. Nur passive Quell-/DOM-Abfrage, keine Clientbedienung. 453 reine Tests/43 Syntax/beide Preloads/MemoryBudgetTests bestanden. Setup/Portable/Update bytegeprueft,50Quellen ohne package/51mit passend,Version/Lock synchron. Gegen0.6.46 nur UI/Styles/Menuadapter/package anders;Originalkataloge/beideNativeEXEs/anderePaketquellen bytegleich. Keine Client-/Account-/Installer-/Grafikstarts/Profilmutation/Uploads. Reale Optik/Join-Leave-Abnahme offen. Nachweise outputs/profile-copy-0.6.47/.

## Previous 0.6.46

Name newly imported schematics after their filename without .bloxdschem,
including automatic saves. Show Saved text/icons in green and Not saved in red.
Reduce the selected schematic control's right padding so the status aligns
beside the dropdown arrow. Existing saved names remain unchanged.

452 pure tests, both preloads, 43 syntax files and MemoryBudgetTests passed.
No client or installer started. Evidence: outputs/litematica-filename-0.6.46/.

## Previous 0.6.45

Add All layers above / All layers below to Litematica, including the selected
boundary layer and keeping its number controls visible. Automatic layer advance
remains Single-only. Use regular Materials/Settings title weight, explicit
right-facing closed / down-facing open chevrons, and Shader-style circle-info
icons for every help button. Existing renderer filters and defaults are retained.

451 pure tests, 43 syntax files, both generated preloads and MemoryBudgetTests
passed. Both new regressions fail against the previous adapted source. No client
or installer started. Evidence: outputs/litematica-layers-0.6.45/.

## Previous 0.6.44

Start schematic selection with Select Schematic. Selecting a stored entry
enables Load/Remove; Save becomes available when that entry is loaded. New
imports immediately select their active entry with all three actions. Show an
inline check + Saved or warning + Not saved beside names in the dropdown and
selected field, with reload-loss guidance in Schematics help.

Add Automatically save new schematics directly under Hide checked blocks,
off by default and persisted with settings. Reuse the local library and its
eight-entry limit. Storage failures keep Not saved; queued/deduplicated writes
and selection guards prevent late saves from taking over newer imports.

449 pure tests, 43 syntax files, both generated preloads and MemoryBudgetTests
passed. Seven new DOM regressions all fail against the previous adapted source.
No client, account or installer started. See docs/LITEMATICA-MENU.md and
outputs/litematica-library-0.6.44/. In-game visual acceptance remains open.

## Previous 0.6.43

Polish Litematica using the user's annotated screenshots and existing Shader
controls: full-width enable row, matching Materials/Settings sections, taller
text and number fields, horizontal +/− coordinate buttons, less upload spacing
and the Schematics label. File buttons and task tabs fill three equal columns.
Shared controls are updated across Build, Save area and Paste.

442 pure tests, 43 syntax files, both generated preloads and MemoryBudgetTests
passed. No client or installer was started; in-game visual acceptance remains
open. See docs/LITEMATICA-MENU.md and outputs/litematica-polish-0.6.43/.

## Previous 0.6.42

Use native Bloxd Settings styling for Litematica, including the texture-pack
upload component, native blue buttons, dropdowns, input boxes, checkboxes,
sliders and tooltip chrome. Remove the extra Close button. Replace rotation
arrows with a schematic-style dropdown offering 0°, 90°, 180° and 270°.

441 pure tests, 43 syntax files, both generated preloads and MemoryBudgetTests
passed. Source-CSS comparisons cover native component styling. The renderer,
mod archives, account paths and gameplay behavior remain unchanged from0.6.41.
No client or installer was started; in-game visual acceptance remains open.
See docs/LITEMATICA-MENU.md.

## Previous 0.6.41

Implement the approved Litematica menu with Build / Save area / Paste, blue
Bloxd controls and question-mark help. Add coordinate ± buttons, explicit
library loading, rotation arrows, the single-layer dependency, compact material
tables with Checked / Reset, and Hide checked blocks for the preview.

438 pure tests, 43 syntax files and both generated preloads passed. Original
mod archives, native renderer, shaders and account paths are unchanged.
No client or installer was started. Live appearance and gameplay acceptance
remain open; this menu release does not claim to fix the reported FPS/flicker
or server placement problems. See docs/LITEMATICA-MENU.md.

## Previous 0.6.40

Handle local client-status save failures without an uncaught main-process error.
Keep the previous committed file and retry sharing/access conflicts on a timer,
publishing the latest combined status after recovery. Avoid reporting a saved
measurement while its write is pending. Record bounded failure/recovery details.

425 pure tests, 42 syntax files and both generated preloads passed. Five new
regressions fail against the packaged 0.6.39 source and pass with this change.
The original Windows file blocker is unknown; live recurrence is not verified.
See docs/CLIENT-STATUS-WRITES.md. No client, account or installer started.

## Previous 0.6.39

Extend the experimental renderer's canonical material mapping with ten stair
families and Jungle/Cherry door halves. Verify all rotations, halves and stair
corners against the pinned Minecraft models. Preserve unknown door power and
resolve a pack material ID only when both power states agree.

420 pure tests, both generated preloads, BridgeCpuTests, 14 GLSL programs and
MemoryBudgetTests passed. This is an internal material-data increment; the
complete Iris renderer and shaderpack loader remain unfinished. No client,
account or installer started. See docs/SHAPED-BLOCK-MAPPING.md.

## Previous 0.6.38

Fix EZ Building consuming native right-button events and cancelling a held click
when automatic hotbar selection replaces the held item. Preserve the original
input payload, return and errors, and keep the user's held gesture through that
item change. Release, menus and world changes still cancel it.

Close pending Litematica captures at frame boundaries when a world group does
not arrive. Discard interrupted-frame commands, normalize private depth ranges,
and account for target depth precision. Validate wrong/extra highlights against
the reconstructed native surface before rejecting their proxy geometry.

416 pure tests, both generated preloads, MemoryBudgetTests and the linked ES300
preview shader check passed. Real gameplay appearance and placement acceptance
remain unverified. Original quality settings/mod packages and native binaries
are preserved. No client or installer started. See docs/LITEMATICA-STABILITY.md.

## Previous 0.6.37

Keep large Litematica mesh builds moving while further world colour changes
arrive. Build from private row snapshots, limit live builders, and release pending
uploads on explicit selection or appearance changes. Restore merged source chunks
to reduce the extra draw groups introduced in 0.6.35.

Finish nearby pending placement selections before processing the latest camera
cell request. Crossing a cell boundary can no longer restart that selection on
every sample; explicit layer/position/mapping changes still apply immediately.

401 pure tests, 42 syntax files, both generated preloads and MemoryBudgetTests
passed. CPU fixtures reproduce repeated cancellations and unfinished camera
selections in the shipped 0.6.36 adapter and verify progress with this update.
Actual gameplay FPS and visual acceptance remain unverified. Quality settings,
original mod packages, idle behavior and native rendering remain preserved.
See docs/LITEMATICA-RECOVERY.md. No client or installer was started.

## Previous 0.6.35

Fix Creative paste intercepting its own native Enter key after launcher mod-host
adaptation. Add an explicit **Paste at these coordinates** button that closes
Settings after the user's click. Creative and Owner / Builder rights still apply;
native clipboard and server checks remain required.

Prioritize colour checks along the crosshair, split masked chunk rebuilds into
smaller units, distribute mesh work fairly, cancel stale builds and recover from
upload failures. Release graphics when the view becomes empty. Add clear
**Build guide / Select & export / Creative paste** tasks, a colour legend and short
instructions; keep advanced settings available under collapsed sections.

386 pure tests, 42 syntax files, both generated preloads and MemoryBudgetTests
passed. A CPU fixture checks a changed target behind 20,000 other rows in its
first scan instead of after 300 synthetic milliseconds; another uploads 5,184
instead of 6,912 bytes for one local change. These are fixture results, not
gameplay FPS or a claim that all visual glitches are solved. Actual Place,
performance and appearance require user verification. No client/installer started.
See docs/LITEMATICA-INTERACTION.md.

## Previous 0.6.34

Batch Litematica's secondary world capture to reduce repeated framebuffer
switches when a schematic is visible. Preserve draw state and finish pending
capture before source resource uploads; retain immediate compatibility for
already wrapped draw methods. Replace periodic full foreground scene searches
with mesh events and bounded incremental audits.

Existing quality settings, original mod packages and rendering formulas remain
unchanged. Pure CPU/VM checks verify command order and fewer framebuffer binds;
actual gameplay FPS and visual glitch resolution still require user testing.
See docs/LITEMATICA-FRAME-COST.md. No client or installer was started by the agent.

## Previous 0.6.33

Add optional **No Ads 1.0.0** to EZ Mods. Hide known Bloxd banners, promotional
tiles and video ad surfaces, with zero size and disabled click targets. Apply
user-origin CSS from document start, including to ads inserted later. Enable
the mod in your profile and restart the game to apply it.

This is visual ad hiding. Ad requests, audio and waiting periods may remain;
current live coverage requires user verification. Existing profiles, accounts,
original mod packages and rendering behavior are preserved.

See docs/NO-ADS.md for scope and pure verification. No client or installer was
started by the agent. Renderer work through 0.6.32 remains included and open.

## Previous 0.6.30

Carry observed Bloxd block names, root families, variant states and effective
solid/opaque/fluid/model properties to the experimental Iris geometry pipeline.
Bind definitions to actual successful source registrations and worker/instance
lifetimes; re-registration cannot relabel older geometry. Preserve exact names
and metadata text alongside typed, validity-checked world/shadow inputs.

Validate the complete atomic type33/v5 dictionary before accepting camera, GPU
or material state. Preserve all old layouts, existing buffers and memory limits;
bound definition storage and avoid repeated lookups for identical definitions.

346 pure tests, both preloads, native CPU contracts, thirteen GLSL compile/link
checks and MemoryBudgetTests passed. No client, account, installer or graphics
context was started. Minecraft name/state/pack mappings, the other reference
inputs and real image/FPS acceptance remain open; no production effect is enabled.

## Previous 0.6.29

Carry proven raw source block identities to the experimental Iris geometry
programs for supported terrain faces and observed object instances. Keep block
identity separate from own RGB: mixed-ID greedy faces stay unknown even with
equal RGB, while a proven block may have unknown RGB. Preserve exact index and
submesh mapping, source ownership, upload generations and frame freshness.

Validate atomic type 33/v4 alongside all preserved layouts. Reuse existing GPU
buffers and merge draw ranges according to the inputs a program actually uses.
Charge identity proof arrays to the existing source-proof memory limit.

This is a material-data foundation within the open renderer project. It enables
no new production effect or shaderpack. Minecraft material mappings, reference
world time/weather/lightmap/hand inputs and user GPU/image/FPS acceptance remain
open. Default mode and original mod packages retain their existing paths.

338 pure tests, both generated preloads, native CPU contracts, twelve GLSL
compile/link checks and MemoryBudgetTests passed. No client, account, installer
or graphics context was started. Live image/FPS acceptance remains open.

## Previous 0.6.28

Address additional Litematica work during import and with visible schematics.
Count compressed block runs without visiting millions of individual cells;
yield during parsing, conversion and uploads. Preserve the previous complete
mesh until a replacement upload finishes. Reuse unchanged vertex bindings.

Capture world colour only for visible wrong/extra highlights. Limit secondary
capture fragment work to a conservative screen region when useful, preserving
full depth resolution and the original game draws, shaders and quality settings.
Avoid full view-map copies and honour preparation budgets for filtered cells.

328 pure tests, both preloads and MemoryBudgetTests passed. These verify CPU
behaviour and recorded GL calls; actual loading/gameplay FPS and image fidelity
still require user testing. No client, account or graphics context was started.

## Previous 0.6.27

Reduce Litematica overhead for completed, hidden and offscreen schematics by
capturing world depth only when an overlay can actually be drawn. Keep block
checks and mesh updates running so later edits restore the preview automatically.
Prepare views once per frame, share work between placements and index large
schematics incrementally. Avoid repeated full copies of growing placement lists.

Build the full settings page only when selecting Litematica, then detach and
reuse it between visits. Skip hidden material-table updates. Preserve existing
quality settings, full-resolution visible overlays and original mod packages.

316 pure tests, both generated preloads and MemoryBudgetTests passed. CPU call
counts confirm the removed work; actual gameplay FPS still require user testing.
No client, account, installer or graphics context was started.

## Previous 0.6.26

Use the actual joined Bloxd session and local model ownership for automatic
character capture when a websocket URL is unavailable. Show real sync readiness
and progress in the launcher; account changes refresh waiting status correctly.

Recognize the actual game-window closed marker before helper-process teardown
and notify the launcher UI immediately. Preserve process-exit fallback and
reject stale runs or late events from a previous session.

303 pure tests cover these paths, including generated preload-to-GLB transfer
without mods, session/ownership checks, mocked cosmetic fixtures and lifecycle
races. The user's live sync failure and close latency still require verification;
no client, account, installer or graphics context was started.

## Previous 0.6.25

Fix automatic character export when worn cosmetics such as High Society attach
separate 3D models without Player armour groups. Use the source cosmetic
registry to exclude held items and other gameplay attachments. Preserve verified attachment
ownership and use local accessory transforms in the body rest pose, including
first-person-hidden roots. Bake observed cosmetic colour variants from the
original asset textures and include them in outfit invalidation.

289 pure tests pass, including the previously failing attachment regression and
GLB validation. No client, account or graphics context was started. Live sync
and the user's actual cosmetic appearance still require user verification.

## Previous 0.6.24

Reduce repeated shader adapter work during combat and menu opening. Ordinary
game settings now receive only the Shader tab; the full controls are built on
explicit selection and reused offscreen. Observe scene mesh changes to avoid
whole-scene membership scans for transient hit helpers. Preserve immediate real
caster updates and the existing periodic/fallback discovery.

Track observed native sampler assignments after the initial read, including
location aliases and array uploads. Unknown writes, relinks and context
restoration still require fresh values. Shader formulas, visual settings, view
distance and the native renderer remain unchanged.

283 pure tests passed. CPU regressions cover 1,000 helper changes without scene
iteration and 1,000 sampler changes with one initial driver read. These are
operation counts, not measured gameplay FPS. No client, account or graphics
context was started. Actual combat/menu frame pacing remains user verification.

## Previous 0.6.23

Update automatic character capture for the observed Bloxd source layouts. Local
player ownership is checked through the humanoid ECS component and thin manager;
replaced components, managers or account metadata invalidate pending exports.
Incomplete model signatures now report a waiting status.

Isolate preload startup failures per launcher component and mod script. Record
requested/executed scripts and bounded errors in each user's run directory;
one synchronous injection error no longer aborts all later mods. Original mod
packages are unchanged. Both actual mod menus initialize in synthetic DOM tests.
The reported missing-menu failure has not been reproduced; user confirmation
and the new run reports are still needed if it persists.

278 pure Node/DOM/VM tests and both generated preload syntax checks passed.
No client, account session, installer or graphics context was started.

## Previous 0.6.22

Preserve proven instanced RGB emission identities in the experimental renderer;
see PROJECT-CONTEXT.md and docs/SOURCE-EMISSION.md. The experimental renderer
and shaderpack compatibility remain incomplete.

## Previous 0.6.21

The experimental renderer now preserves proven own RGB emission per face within
mixed terrain groups, through index/submesh remapping to world and shadow draws.
Known zero is valid; ambiguous greedy faces stay unknown. RGB and validity are
draw constants, with no interpolation or new GPU buffers. Existing packet
layouts, resource limits, fallback and the Default renderer are preserved.

264 pure Node/DOM/VM tests, CPU renderer tests, eleven GLSL checks and memory
budget tests passed. No client, account or graphics context was started.
Instanced/boundary/compact/deformed geometry, Minecraft/Iris scalar semantics,
the shaderloader, first test shaderpack and visual/FPS acceptance remain open.
This is a source-data extension, not full shaderpack compatibility.

## Previous 0.6.20

The launcher now displays its actual package version in the lower-left rail,
replacing the hardcoded v0.6.3 label. Package and lockfile versions are 0.6.20.
New releases built with Build-Release.ps1 increment the patch version by default;
KeepVersion is reserved for rebuilding the same release.

Windows packages now include Bloxdy-Client-Update-0.6.20-x64.exe, a standalone
copy of the full NSIS upgrade installer with the existing application identity,
installation discovery and unchanged session/profile storage paths. The updater
does not auto-launch the client after installation. No update server is required.

Includes the shader action-stutter fixes described in docs/SHADER-PERFORMANCE.md
and the existing guarded experimental renderer work. 261 pure Node/DOM/VM tests
passed. No client, account or graphics context was started; gameplay performance
and appearance remain user verification.

## Previous 0.6.19

Add the experimental renderer's native fullscreen target/execution runtime.
Logical targets 0-31 use separate main/alternate textures and explicit physical
output routing, checked flips, persistence, typed clears, fixed/relative sizes,
30 normalized/float/integer formats and budgeted dirty mip chains. Validate
feedback, sampler conflicts, dimensions, integer filtering and GPU limits.
Reuse stable resources and cached limits; use fixed routing arrays per draw.

Internal compiled postprocess passes can consume native geometry/depth and
matching prior-world textures. Temporal bindings request history and require
validity. A selected normalized/float result resolves into scene color for
embedded output. Scratch failure triggers full recovery clears while successful
world-history slots remain protected. Combined frame/history/scratch mip storage
stays within the existing 512 MiB target budget. Partial allocations roll back.

No default effects or scratch descriptors are installed, so embedded rendering
adds no extra targets/history/draws/copies. The existing preview final shader now
uses the same executor. Main/preload/capture/presenter/transport match 0.6.18;
original mods, view distance, selection and fallback protections are preserved.

219 pure tests, expanded CPU GL mocks and eleven GLSL checks passed. No client,
account or graphics context started. Full Iris stages/bindings/source coverage
and user-operated image/FPS acceptance remain open; this is not renderer
completion, TAA activation, a shader loader or shaderpack compatibility.

## Previous 0.6.18

Add the experimental renderer's demand-driven world image/depth history.
Store RGBA16F world color after world transparency and 32F opaque depth before
isolated hand/late groups. Two independent slots prevent failed copies or
presentation from overwriting the previous successful frame. Commit matches
camera/object-motion history; invalidate across fallback, scene epochs, resize,
zero-sized output and changed depth/origin-availability conventions.

Allocate only when an internal render pass requests history. No pass currently
requests it, so the shipped path adds no history textures/copies. Enabling or
disabling at fixed dimensions preserves existing geometry targets. Static
dimensions reuse textures without additional limit queries. Combined targets
and two history slots are bounded to 512 MiB (60 or 84 bytes/pixel); allocation
failures keep working resources, partial slots are released. No new wire format
or changes to default Bloxd/source capture/presentation/original mods.

219 pure tests, expanded CPU GL mocks and eleven GLSL checks passed. CPU tests
cover world/hand separation, exact copied source/depth formats, matching frame
IDs, ping-pong reuse, failed copy/composite rollback, partial allocation failure,
fallback/resize/depth/scene resets and memory/resource release. No client,
browser, account or real graphics context started. This does not activate TAA,
execute packs or finish Minecraft/Iris semantics; the renderer goal stays open.

## Previous 0.6.17

Advance the experimental renderer's temporal contract: previous successful-frame
object transforms and CPU positions, origin-compensated reprojection and a sixth
native RGBA16F motion target. Store backward UV displacement, prior normalized
depth and a validity marker for eligible opaque/cutout world surfaces. These
are native semantics, not predefined Iris colortex bindings or enabled TAA.

Lazy pose snapshots preserve the last drawn pose across intermediate updates,
with a 64 MiB shared CPU/GPU reservation. Static terrain has no pose duplicates.
Unidentified instance-matrix changes invalidate history instead of assuming slot
identity. Frame gaps, fallback, resize, depth-convention changes, custom cameras
and offscreen/invalid reprojection are guarded. Histories commit only after
successful scene/composite rendering and a final GL error check. Existing pose
buffers/geometry are reused; removed/replaced objects release history resources.

219 pure tests, expanded CPU GL mocks and eleven GLSL checks passed. New launcher
tests verify standard Bloxd excludes native transport/capture/presentation.
No client, browser, account or real graphics context started. Distance 10,
selection/budgets/ownership and original mods preserved. GPU particles, sprites,
moving thin-instance identities, full Iris semantics/programs/buffers and real
image/FPS parity remain unfinished. No shader loader or pack execution added.

## Previous 0.6.16

Extend actual active CPU particles with source ramp textures/remap ranges,
subtract/multiply and two-pass MultiplyAdd (whole multiply batch, then additive
batch). Ramp RGB/alpha remapping and original texture/color alpha multiply
correction run before fog. Retain source sampling/wrap, bounded async texture
readback and shared references; missing/incomplete textures cannot draw white
fallback particles. Disabling ramp clears it atomically and frees unused data.

Packet 29 carries the V3 particle state and source blend identity; old layouts
1-28 remain readable. Unchanged state is cached; remap-only changes reuse
transforms/static geometry. Actual source blend factors also correct standard
alpha accumulation and add generic engine blend modes 3/4. Custom effects on
either MultiplyAdd pass, snapshot capacity and source wireframe remain fallback.

217 pure tests, expanded CPU mocks and eleven GLSL checks passed. Source fixtures
execute isolated blend/upload/render-wrapper methods only against inert mocks;
no full module, particle simulation, client, browser, account or real graphics
context started. Distance 10, active selection, budgets and original mods remain.
Capture/native must match. GPU particles, sprites, unknown programs and the full
Iris uniform/semantic/stage/buffer contract remain unfinished, not claimed done.
Real rendering and FPS remain user-only checks.

## Previous 0.6.15

Extend actual active CPU particles with Y, stretched, local-stretched and fixed-
direction alignment, including local emitter direction transforms without
transforming already-world-space positions twice. Preserve source world/floating
offsets, animated atlas cells, flipped rows and noninstanced UV/geometry insets.
Texture mask, bounded HDR color and pivot are part of one validated batch.
Capture never simulates particles or changes the source scene/particle objects.

Packet 28 atomically carries the extended state. Standard neutral ALL billboards
retain the smaller legacy packet; extended systems stay on 28 when returning
to neutral so old UV/mask/pivot state clears together. Native unchanged buffers
are reused; cell-only updates do not upload transforms or rebuild geometry.
GPU/ramp/multiply/custom programs, custom cameras/clip planes, non-neutral image
processing and sprites remain explicit source fallback. Full Iris is not done.

209 pure tests, expanded CPU mocks and eleven GLSL checks passed. Source fixtures
execute only an isolated upload method and inspect hashed shader strings. Native
renderer compiled, no client/account/browser/real graphics context started.
Matched capture/native builds required; packet layouts 1-27 unchanged. Distance
10, active selection, budgets, ownership guards and original mods preserved.
Real image/FPS confirmation remains user-only.

## Previous 0.6.14

Add source render groups -1..3 with actual depth-reset and recognized ordering
policies, including Bloxd's material-ID transparency sorting. Preserve double
alpha/material indices, source sphere centers and active mesh/submesh order.

Observe actual per-draw camera matrices without modifying source cameras.
Supported isolated positive-group hand/overlay draws use their own projection,
frustum and camera, then restore the world camera. They do not pollute world
surface buffers, retained opaque depth or world shadow passes. Missing/stale/
invalid observations, arbitrary sort callbacks and mixed world-group camera
overlays retain source fallback. Observation hooks are removed when unused.

200 pure tests, expanded CPU mocks and eleven GLSL checks passed. Native renderer
compiled only; no client, browser, account or real graphics context started.
Distance stays 10, budgets/ownership/original mods remain. New packet 27 requires
matched capture/native builds. Full Iris semantics/program stages/buffers,
complex particles and sprites remain unfinished; real visuals/FPS unverified.

## Previous 0.6.13 Materials And Particles

Extend the existing native renderer with source Cape joint poses, TextSampler
LOD/unpremultiplication and Enchantment color/speed/node/clock effects. Preserve
premultiplied and additive blend states. Pose/clock updates reuse static data.

Add bounded world-space CPU billboard particles: read real source state without
advancing simulation; transmit transforms/colors atomically; preserve source
system order, pivot, blend, fog and forced depth. Particle drawing does not
overwrite opaque surface buffers or enter shadow passes. Unsupported special
particles, sprites, render groups and hand projections retain source fallback.

192 pure tests, expanded CPU mocks and eleven GLSL checks passed. No client,
browser, account or real graphics context started. Distance remains 10; original
mod packages and ownership guards remain intact. New packets 24-26 require
matched capture/native builds. Full Iris semantics, hands/groups and pack
stages/buffers remain unfinished; no complete Minecraft parity is claimed.

## Previous 0.6.12 Engine Foundations

Reference target is now pinned to the user's Minecraft Java 26.3 selection with
matching Iris 1.11.7 (`1.11.7+26.3-fabric`, OpenGL). This is not an installation
or an assertion of compatibility; target provenance is in docs/render-reference.json.

Extend source material coverage with Armour atlas/tint, HueTint and per-face
block-atlas indices. Versioned 24-float appearance records preserve independent
colors and instance constants; legacy records remain supported. Unknown atlas
programs, custom shader resolvers and invalid face indices keep source fallback.

Preserve the source engine's twelve texture sampling modes and sRGB storage.
Generate dirty mip chains once per render batch within an exact memory budget;
sample block texture arrays directly to avoid cross-tile 2D-atlas mip bleed.
Transfer actual atlas animation tick/stride/interval data and prefetch required
texture frames without rebuilding geometry or retransmitting unchanged pixels.
Clock-only updates do not repeatedly release native draw ownership.

Keep double-precision origins using split floats, checked/inverse/current/previous
camera matrices, canonical OpenGL depth projection and completed-frame history.
Rebases do not introduce false camera motion. Fallback/resize invalidate history.
These are native engine foundations, not a full Iris uniform/program contract.

181 pure tests, expanded CPU tests and eleven GLSL checks passed. Native binaries
compiled; no client/account/real graphics context started. Distance remains 10.
The complete renderer is NOT finished: full special materials, particles/hands,
authoritative world/player values, semantic IDs and reference pack stages/buffers
remain outstanding. Real rendering/FPS and Minecraft parity are unverified.

## Previous 0.6.11 Appearance Contract

Add source adapters for layered Lifeform mob/clothing atlases, Overlay, Dither,
TerrainFade, EntityLight, TerrainLight and animated textures. Preserve actual
per-vertex/per-instance values, premultiplied layer composition and source light
uniforms. Fade updates do not rebuild chunk geometry. Unknown programs and
unimplemented armour/enchantment/hue/per-face variants still use source fallback.

Prepare tangent/handedness, recoverable quad UV midpoints, unit-face block-center
offsets and integer lightmap vertex buffers. This is NOT the full Iris contract:
semantic IDs, own emission, authoritative world/weather/player values, final
atlas/instance bindings and pack stages/buffer rules remain unfinished. No
shaderpack is executed and no one-to-one Minecraft engine is claimed.

Keep a complete visual-shader shadow map and its matching projection briefly
while a newly selected chunk lacks geometry or cutout textures, including during
projection changes. The regression is covered by CPU tests; whether this fixes
the reported visible bright edge remains a user-only check.

Distance 10, active selection, budgets and ownership/fallback guards remain
unchanged. 173 pure tests, expanded CPU tests and eleven GLSL compile/link checks
passed. No client, account or real graphics context started. Real visuals and
performance remain unverified. New capture packets 18/19 require matched native
and launcher builds.

## Previous 0.6.10 Material Contract

Renderer material-contract development, targeting the user-selected Minecraft
Java / Iris reference. This is not a finished one-to-one Minecraft engine or a
shaderpack loader. Exact Minecraft/Iris versions and remaining data contracts
are documented in docs/MINECRAFT-RENDER-CONTRACT.md.

Use actual diffuse UV matrices and independent U/V wrap modes, source texture
level/alpha, two-sided normals and per-material fog. Preserve source winding,
reflected world transforms, culling and depth-write/comparison policy. UV changes
do not replace static geometry. Correct standard transparency's separate RGB and
alpha blend factors. Preserve opaque metadata/depth and isolate composite state.

Unsupported material plugins, mob/clothing atlases and additional depth/blend/UV
states still use Bloxd fallback. Distance 10 and existing active-chunk limits are
unchanged. 166 pure tests, expanded CPU contracts and three GLSL checks passed.
No client, account or real graphics context started; appearance/FPS remain user
checks. Capture and the native binary are packaged together as 0.6.10.

## Previous 0.6.9 Performance

Performance update on the user-confirmed stable 0.6.8 image path. Draw distance and appearance settings remain unchanged. Unsupported native scenes keep the existing Bloxd fallback; native model/material compatibility is not expanded by this update.

Pause camera IPC and GPU-write bookkeeping during fallback, recheck eligibility every 250 ms and directly pass through source draws without repeated engine lookups. Resume with fresh import data and current source bindings. New active chunks are imported before already-transferred geometry within the same count/time budgets.

Bulk-copy native float/index payloads with size and finite-value validation preserved. Check GPU errors per input batch before drawing. Reuse presentation texture storage and cached uniforms/layout instead of reallocating it every frame. Paused native output skips unnecessary graphics queries.

F8 distinguishes source engine cadence from active native render FPS. F9 saves renderer-path/capture values alongside existing samples. A paused native renderer's zero is not treated as the game's FPS.

163 pure tests, extended CPU contracts and three GLSL checks passed. A five-round CPU-only capture benchmark against packaged 0.6.8 reduced this synthetic adapter workload from 73.75 ms to 21.40 ms, approximately 71%, with all original mock draw/write calls retained. This is not measured live FPS or server chunk delivery. Real results remain user-only checks; no client/account/graphics context started by the agent.

## Previous 0.6.8 Stabilization

Responds to severe real-world 0.6.7 regressions. Import only the source engine's active geometry instead of the entire scene cache. Remove old meshes, orphaned textures and pending readbacks. Do not change the configured draw distance, request more server chunks or retain an extended native chunk cache.

Correct populated atlas-page offsets, reject unrelated textures as base color, preserve zero instance counts, avoid multiplying regular instances by their source thin batch and honor single-material submesh ranges.

Native presentation now requires complete supported source data and matching scene/selection revision and viewport. Unsupported mob/clothing atlases, material/plugin shaders, the visual shader mod, billboards, LOD, UV transforms, particles and postprocessing keep the original Bloxd image. Native drawing and image readback pause during this fallback. These native appearance paths are not implemented by this fix.

Successful native handover suppresses source world-canvas draw calls, with simulation, input and resource updates retained. Source selection changes release ownership synchronously; a draw lease fails open if presentation stalls. Presentation failures latch source fallback for the scene. Version 2 native frame headers reject old selection frames even within the same scene.

156 pure Node/DOM/VM checks, expanded CPU-only contracts and three GLSL compilation/link checks passed. No application, client, account or real graphics context started by the agent. Live rendering and performance remain user checks; the renderer and Minecraft shaderpack execution are still unfinished.

## Previous 0.6.7 Development (Not Visually Successful)

The existing native renderer now uses a padded 2D block atlas, actual sky cubemap faces, source fog/camera/environment values and a directional shadow pass when a real sun light is available. Native block IDs and solid/water/lava/entity/sky classes are transferred separately from texture layers into a fifth surface buffer. Missing world values remain unknown.

Native profiles return frames to the Bloxd game window through a bounded local pipe and asynchronous GPU readback. The presentation canvas leaves input and DOM controls with Bloxd. It hides the original canvas only after successful presentation and restores it on scene changes, errors or frame timeout. Account-only windows never create the native output path. The legacy bridge retains its separate preview.

This remains experimental development. No Minecraft shaderpack is executed, and complete world/material appearance, particles, held items, performance and visual equality with Minecraft have not been verified. Existing native meshes and source textures are imported; the renderer does not rewrite gameplay or request extra server chunks. No client, graphics context or account was started by the agent. Pure VM/DOM/CPU checks and compilation do not prove the live image.

## Bloxdy Client 0.6.6 (historical)

Ore block lighting recognizes the current native meshing worker, adds local RGB emission and preserves native server sky/block light. Late ore metadata updates existing workers and queues lighting once per emission change.

Wavey water and lava now connect to the current chunk mesh layout and rebuild already loaded surfaces with interior 3D vertices. Existing light updates survive subdivision and Flat/Wavey changes. Physics also reads the current entity position list, including the local player. Adoption runs incrementally to limit work per maintenance pass.

Animated atlas frame zero is classified from the actual voxel ID before texture metadata arrives. Opaque materials containing both lava and normal terrain receive the liquid program while retaining each face's identity. Custom lava remains available in both Flat and Wavey.

111 pure Node/DOM/VM tests pass, including the current native worker algorithm, packed chunk uploads, existing geometry recovery, lighting updates, mixed-material lava identity and entity ripples. Eight GLSL programs compile/link. No client, browser, real Worker, graphics context or account was started. Visible rendering and FPS remain a user check. Launcher mod settings remain removed; configure mods inside Bloxd.

## Bloxdy Client 0.6.5 (historical)

Installed mods now expose Enable/Disable and Remove in the launcher. The mod settings button, form and launcher configuration action are removed. Mod settings and their profile-scoped persistence remain available inside Bloxd. Profile, account and launcher settings are unchanged.

The sky-cache pass uses a separate complete neutral texture rather than sampling its own render target. Sky, ore and shadow effects now share one sampler-unit allocation per program while respecting native samplers and native assignment changes. Inactive ore/cloud/shadow samplers retain complete textures; this is checked across the assembled water/lava pipeline with effects switched on and off.

The unconditional darkening of sun-facing-away block faces, extra entity preflight and forced higher shadow cadence from 0.6.4 are removed. Missing or partial chunk geometry no longer counts as a completed shadow revision: retries continue with a 100 ms delay until geometry is ready. Stale maps have a bounded grace period. Block light adjustment runs after its declaration to support liquid shader variants with a different declaration order.

105 pure Node/DOM/VM tests pass, including 17 shader regressions with program-specific uniform state, sampler types and framebuffer feedback validation. Eight GLSL programs compile/link, including assembled water and lava variants. No application, live client, graphics context or account was started. Actual visual recovery and FPS remain unverified until the user tests the build.

## Bloxdy Client 0.6.4 (historical; rendering regressions reported)

Client shader fixes are applied to the verified 5.6.14.2 snapshot through a guarded launcher adapter, including previously installed copies. The original catalog and separate shader project remain intact.

Bloom, glowing ores and custom skies are enabled by default in all profiles. Explicit saved Off choices remain Off. Golden Hour selects Cumulus clouds. The launcher mod settings now expose glowing ores, custom skies and entity shadows.

Native sky draws retain a complete cache sampler when custom skies are disabled, and cached atmosphere/cycle uniforms are cleared. The shadow renderer no longer changes the native sky material. All inactive shadow cascades also keep valid comparison textures. Block-face bias is bounded in world units; faces pointing away from the sun no longer sample bright edge texels.

Complete shadow maps and their matching projections survive pending chunk geometry and settings refreshes. Moving casters target at least 30 Hz when the game cadence permits, use current world transforms, and preflight incomplete geometry before replacing their previous map. CPU skinning handles missing influences and zero-weight vertices. Empty entity sets remove the old silhouette promptly.

98 pure Node/DOM/VM tests and six GLSL compile/link checks pass. No client, account or graphics context was started. Visual confirmation remains a user check.

## Bloxdy Client 0.6.3 (historical)

Accounts now shows the heading, Connect account and compact account rows. The complete character/sign-in banner, decorative account introduction and saved-account counter are removed. Saved accounts show only their profile count beneath the name. Existing Settings, Profiles and Remove account buttons, selection and deletion confirmations remain in place.

The Settings panel fills the content width. Launcher text cannot be selected; inputs, text areas and editable content retain normal selection and editing.

Bloxd and account windows no longer have the native Launcher menu bar, including when Alt is pressed. F8 displays performance; F9 saves the measurement during game sessions. Native window close/Alt+F4 still returns to the launcher.

Source, assets, catalog snapshots and build tools now live in the Bloxdy Client project. Development native preview uses build-release; catalog refresh accepts an explicit source root or BLOXDY_MOD_SOURCE_ROOT. Existing data/session paths and application upgrade identity are preserved.

87 pure Node/DOM/VM tests and the Windows CPU memory check pass. Native components compile in the new folder. Both Windows packages pass bytewise source/resource and private-folder checks. Original project files remain unchanged. No client, account or graphics context was started; actual visual behavior remains a user check.

Earlier release notes below describe historical versions.

## Bloxdy Client 0.6.2 (historical)

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
