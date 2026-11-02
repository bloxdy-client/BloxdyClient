# Litematica menu

## Current 0.6.47

23. Oktober 2026, 0.6.47 fertig: Profilseiten-Ueberschrift Profiles und Untertitel Your setups. Each one its own world. entfernt; YOUR LAUNCHER standardmaessig auf Launcher-Seiten ausgeblendet. Profilanzahl/Kontenauswahl erhalten. Save bei aktivem Auto-Save und bereits gespeicherter aktiver Vorlage deaktiviert, nach Speicherfehler weiter Retry moeglich; gilt Build/Paste und reagiert auf Einstellung. Litematica-HUD nur bei aktiver Sitzung (Websocket oder Handler/Game), zugehoerigem Enginekontext und vorhandener ChatInput-Spielflaeche; Replay ausgeschlossen. Lobby/Homescreen und Verlassen verbergen HUD sowohl Build/Paste als auch Save area. Nur passive Quell-/DOM-Abfrage, keine Clientbedienung. 453 reine Tests/43 Syntax/beide Preloads/MemoryBudgetTests bestanden. Setup/Portable/Update bytegeprueft,50Quellen ohne package/51mit passend,Version/Lock synchron. Gegen0.6.46 nur UI/Styles/Menuadapter/package anders;Originalkataloge/beideNativeEXEs/anderePaketquellen bytegleich. Keine Client-/Account-/Installer-/Grafikstarts/Profilmutation/Uploads. Reale Optik/Join-Leave-Abnahme offen. Nachweise outputs/profile-copy-0.6.47/.

## Historical 0.6.46 — imported filenames and status alignment, 23 October 2026

Imported schematics use the exact file.name with only the trailing .bloxdschem
suffix removed (case-insensitive). Embedded names do not override the filename.
This happens before selecting the model or automatically saving it; existing
saved records are not renamed. Saved status text/icons are green (#63d471),
Not saved red (#ff7070), both in options and in the selected control. Icons
inherit currentColor. The schematic control overrides the native 6em right
padding with 2.5rem, keeping the status right-aligned beside the arrow.

452 pure tests, both preloads, 43 syntax files and MemoryBudgetTests passed.
The new regression uses a mismatched embedded name and mixed-case extension,
checks saved filename persistence, both colors and arrow spacing against native
CSS. Evidence: outputs/litematica-filename-0.6.46/. No client/account/installer
or graphics application was started; live visual acceptance remains open.

## Historical 0.6.45 — layer choices and info icons, 23 October 2026

Layer now offers All layers, Single layer, All layers above and All layers
below. The existing model/renderer filters implement the two inclusive modes:
the chosen boundary layer is included. The layer number and previous/next
controls are visible in Single/Above/Below; automatic layer advance remains
Single-only. No renderer, shader, budget or existing default changed.

Materials and Settings headers and their title elements use regular weight
400. Closed chevrons display a right-facing triangle; open ones face down.
Explicit transform/rotate resets prevent an inherited rotation changing the
glyph direction. All Litematica help buttons now use circle-info, copied from
the pinned Shader mod's circleInfoSvg, with the existing tooltip interactions.
This supersedes the earlier question-mark icon and bold-header requirements.

Two pure DOM regressions cover dropdown interaction, inclusive filtering,
boundary controls, automatic-layer dependency, regular titles, chevrons under
inherited rotation and exact Shader info-icon paths. Both fail against the
captured adapted 0.6.44 source. Evidence: outputs/litematica-layers-0.6.45/.
No client, account, installer or graphics application was started; live visual
acceptance remains for the user.

## Historical 0.6.44 — schematic selection and saving, 23 October 2026

The initial dropdown reads Select Schematic. Merely selecting a saved entry
does not load it: Load and Remove are enabled, Save is disabled until that entry
is the active model. A newly imported file immediately selects its active
session entry, with Load/Save/Remove visible and enabled. The equivalent Save
guard applies in Paste, where Paste retains its explicit load-and-paste route.
Selecting another entry cannot save the previous active model over it.

Saved entries show a check icon and Saved at the right inside the same option
and selected-control surface as the name. The active unsaved import instead
shows an outlined warning triangle and Not saved, with the same inline layout.
Names remain plain text; badges introduce no separate box. The selected label
overrides the native fixed 5rem placeholder width to fill the available control;
long names use ellipsis while keeping the status visible at the right. Native
CSS is installed before adapter CSS in this layout fixture. Schematics help
explains that an unsaved schematic is lost when the page reloads. As before,
only the active unsaved import is retained; replacing it does not create a
second session library. Removing that import does not delete stored entries.

Automatically save new schematics appears directly below Hide checked blocks.
It defaults off, persists with existing settings, and affects successful future
file imports. It uses the existing IndexedDB library and its eight-entry limit,
including placement and mapping. Saved is shown only after a successful storage
transaction. Failed/full saves retain Not saved and allow manual retry. Writes
are queued, repeated Save requests for the same active model are coalesced, and
late completion cannot steal a newer import or user selection. Rebuilt options
close any stale open dropdown. Existing stored IDs and records are preserved.

Seven pure DOM regressions cover selection/button states, native-format import,
save/recreated-page behavior, persisted opt-in, invalid imports, failures/limit,
delayed completion/duplicate saves, stale dropdowns and selective removal. All
seven fail against the captured previous 0.6.43 adapted source. No client,
account, installer, graphics application or real browser profile was operated.
Evidence: outputs/litematica-library-0.6.44/. In-game visual acceptance remains
for the user. Renderer, shaders and native paste guards are unchanged.

## Historical 0.6.43 — annotated layout polish, 23 October 2026

The user's five annotated screenshots request the Shader mod's main enable row
and collapsible sections, taller text/number fields, less space above the upload
area, the plural Schematics label, horizontal +/− coordinate buttons, and three
equally wide file buttons filling the row. Shared controls change in Build,
Paste and Save area together. The three task tabs also fill equal columns.

The enabled checkbox is now the first full-width SettingBox with a visible
Litematica enabled label. Materials and Settings use the Shader category
structure and its header padding, color, weight and keyboard focus styling;
their inner rows own SettingBoxGroup. Text/number inputs use the Shader's
3.2rem height, .7rem padding and inherited font. Coordinate steps match that
height. The native texture-pack container's extra top margin is removed while
the normal section gap is retained. The upload component and native chrome
from 0.6.42 remain. No Shader mod or original mod archive was modified.

442 pure Node/DOM/VM tests, 43 syntax files, both generated preloads and
MemoryBudgetTests passed. The new DOM/CSS regression reads the pinned Shader
adapter's actual checkbox/category/input source, compares layout metrics and
checks shared controls, keyboard toggles, plural labels, upload spacing and
three visible equal-column buttons in Build and Paste. Evidence is under
outputs/litematica-polish-0.6.43/. No client/account/installer/graphics application
was started. Actual in-game appearance remains for user verification.

## Historical 0.6.42 — native Bloxd design, 23 October 2026

The user accepted most functionality in 0.6.41 but rejected the custom skin.
The new requirement is the actual Bloxd Settings appearance, especially the
texture-pack upload field. The extra Close button is removed. Rotation is one
native-style dropdown with exactly 0°, 90°, 180° and 270°, using the same helper
and classes as the schematic selector. Placement locking also disables this
dropdown; a disabled dropdown cannot open or apply an already-open option.

The upload area now uses the native CustomTexturePackContainer /
CustomTextureFolderUpload / CustomTextureFolderUploadIcon /
CustomTextureFolderUploadInstructions structure and styles, with the same
ActiveDrag/Active states. It supports click and Enter/Space file selection,
nested drag-enter/leave, file drop, and active schematic name. The persistent
file picker and native-format parser are unchanged. SVG upload, file and
question icons use the same shapes as the native UI.

The previous custom palette, bevel overrides, dashed upload button, compact
font overrides, small page padding, custom slider/checkbox colors and colored
dropdown overrides have been removed entirely. BlueButton / DarkBlueButton /
DisabledNewButton, native ButtonBody/bevel children, SettingsMenuRightInner,
SettingBox / SettingBoxGroup, native dropdowns, rc-checkbox and rangeslider
classes now own their appearance. Local CSS handles only layout, hidden states,
responsive coordinates, checked opacity and native-tooltip positioning. Help
uses Bloxd's tooltip-container / CircleInfoTooltip / tooltip-arrow structure
and its normal WholeAppWrapperInner portal. HUD appearance is retained.

Reference: public Bloxd HTML, main JavaScript, main/chunk-8 CSS and icon definition
bytes fetched without executing any JavaScript, using accounts, cookies,
browser profiles or a client. The 9s8fb source contains the same upload class
structure as the earlier 3ymzdd/q9aot snapshots. Runtime code inherits the actual
loaded game styles; downloaded styles/scripts are not bundled into the client.
287 source CSS rules and icon paths are pinned only in a test fixture and audit.
The old hashed CSS URLs returned 404; the references use the current public
HTML's versioned asset names. No runtime layout discovery coverage is implied.

441 pure Node/DOM/VM tests, 43 syntax files, both generated preloads and
MemoryBudgetTests passed. Three added tests cover all four dropdown rotations /
lock guards, upload structure / input / drag / active states, and computed-style
equality against native counterpart elements using the source CSS: page padding,
upload metrics, bevels, dropdown chrome, number input font, checkboxes and slider.
Existing Close/rotation-arrow checks were updated to the new user requirement.
This is DOM/CSS verification, not an in-game screenshot or pixel-equality proof.
No client/account/installer/graphics application was started, no profiles changed.
Evidence: outputs/litematica-native-design-0.6.42/.

Icons: Font Awesome Free by Fonticons, Inc., https://fontawesome.com,
CC BY 4.0 https://creativecommons.org/licenses/by/4.0/. Icon shapes are unmodified;
the attribution also accompanies the serialized source delivered in the client.

## Historical 0.6.41 design

User-approved design, 23 October 2026. This release implements the user's edited
menu, with blue Bloxd controls and setting explanations behind question-mark
icons. It is the menu step; it does not claim to resolve the reported gameplay
flicker, placement failures or low FPS.

## Visible layout

Header: Litematica, enable checkbox, close button. Three tabs: Build, Save area,
Paste. Existing native Settings category and Controls keybindings remain.

Build, in order:

- Schematics: clickable .bloxdschem drop target, saved-schematic dropdown,
  Load / Save / Remove.
- Position: X, Y, Z, each with one ± button. Left click adds one; right click
  subtracts one without opening the context menu. Direct integer entry remains.
- Move to player; Rotation with left/right 90-degree buttons; Lock Placement.
- Layer: All layers / Single layer; a bounded layer number with previous/next
  buttons for Single layer. Next layer when complete is disabled outside Single
  layer. The existing complete-layer verifier, cancellation and budgets remain.
- Easy building; Only build in schematic; Prevent extra blocks; building speed.
- Collapsed Materials and Settings.

Save area: Name; Save schematic / Clear selection; Corner 1 and Corner 2 with
the same coordinate controls. Materials and Settings use the same styling.
The material table omits Missing and Inventory. Stick corner selection and the
existing read-only paced world scanner / native-format exporter remain.

Paste: same Schematics block with Paste / Save / Remove; Show preview; Position;
Move to player; Rotation; Materials; Settings. Paste explicitly loads a selected
saved schematic if needed and invokes the existing guarded native paste route
only after the user's click. Reusing the active library entry preserves edited
coordinates. Native permission, upload, named-clipboard and server-result guards
are unchanged. Busy state has progress and Cancel. Preview visibility is scoped
to Paste, so hiding it cannot leave Build without a preview switch.

Settings: Highlight missing blocks; Highlight wrong blocks; Highlight extra
blocks; Show Litematica HUD; Hide checked blocks; Render Distance; Placement
transparency; Outline width; Missing block tint; Wrong blocks tint; Extra blocks
tint. Existing ranges / speed limits / texture quality remain. New default for
auto-layer is on (inactive until Single layer); existing saved choices are read.

The old permanent guide, debug counters, legend, mapping editor, scene controls,
undo/redo and extra advanced controls are absent from this menu. Internal mapping,
existing library data and source mod bytes remain; no user data was modified by
the agent. Instructions about coordinates, Creative/Owner/Builder rights,
unknown material counts, import warnings and selection are help content.

## Materials and preview

Build/Paste table: Material / Total / Missing / Inventory / Check. Missing is the
observed remaining count for the current active placement, including wrong blocks;
`≥` marks incomplete/unloaded classification, rather than asserting unknown
positions are missing. Inventory is `—` when unavailable and `∞` for native
unlimited stacks. Totals still include required blocks outside the current view.

Checking a material moves it into a Checked table (Material / Total), using the
same table style at reduced opacity. Reset materials restores all rows. Checks
are shared between the three tabs during this session and reset on model import
or Clear selection; they do not mark world blocks correct. Hide checked blocks
filters only mesh snapshot candidates. All source rows still participate in the
existing world classification and totals. Immutable checked sets and a revision
in the mesh signature invalidate pending work on a check/reset, within the
existing cooperative geometry / upload budgets. No shader formula is changed.

Unchanged material snapshots retain their DOM; data is refreshed only while the
menu and Materials are open. Tooltip popups are placed above scrolling tables,
clamped to the viewport, and dismissed on blur, Escape, mode/category change,
menu replacement or pagehide. Help clicks do not toggle the associated checkbox.

## Implementation and verification

`launcher/litematica-menu.cjs` adapts only already SHA-verified `litematica.js`
and `renderer.js`, after the existing performance/capture/interaction adapters.
It is included explicitly in electron-builder.yml. Original catalog archives,
account code, bridge/native renderer and native shaders are untouched.

438 pure Node/DOM/VM tests, 43 syntax files and both generated preload scripts
passed. Thirteen new tests exercise the agreed layout, coordinate click buttons
and bounds, placement lock, layer dependency, help isolation/lifecycle, material
checks/reset/counts, stable table DOM, unavailable/unlimited inventory, explicit
library Load/Paste with edited coordinates, an actual native-format import,
Remove, slider keyboard controls, preview-only filtering, and SHA rejection.
Two old menu tests were updated to the newly requested labels and tabs.

No client, account, installer or graphics application was started. Pure DOM/CPU
verification is not a live visual/gameplay acceptance test. No visual match,
game FPS improvement, server paste success or global bug fix is asserted.
Release evidence: outputs/litematica-menu-0.6.41/.
