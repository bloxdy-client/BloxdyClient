# Litematica visibility and independent corner picks — 0.6.50

The user reports that0.6.49 displays no schematic/selection in Build, Paste
or Save area, while reporting rendering rather than an error. The newest
user-created startup report lists the requested Litematica scripts without a
synchronous startup error. This supersedes any inference of live success
from0.6.49's CPU tests. No live GL state or frame pixels were observed.

## Direct rendering state

0.6.49 removed the private capture target and its prepare step. Its direct
replacement disabled several inherited tests but left scissor enable/box,
face-cull mode and draw-buffer selection inherited from the source pass.
An empty scissor or disabled colour draw buffer can suppress every fragment
without a JavaScript error, while the renderer still increments its frame
counter. Culling both faces also suppresses Build/Paste triangles; the area
draw already disables culling itself.

The direct overlay now disables scissor, selects back-face culling, and enables
the appropriate current target colour buffer. Source framebuffer, viewport,
depth, uniforms/textures/VAOs and the rest of the state retain the existing
save/restore contract. Default-framebuffer draw-buffer state is read instead
of assumed BACK, so a legitimate native NONE state is restored exactly.
There are no new capture targets, world replays, source draw/resource hooks,
extra fullscreen passes or quality/default reductions.

The CPU acceptance fixture distinguishes submitted draws from draws permitted
to write colour by those particular raster states. Against actual0.6.49 ASAR
code, its frame counter advances but colour acceptance is zero in11 of12
state/mode cases. All12 accept colour with the fix; the remaining baseline
case was selection with only culling changed, which already accepted colour.
The original600-frame call-count tests alone could not detect these cases.
This is not GPU rasterization, screenshots, or confirmation that the user's
unobserved state was one of these cases.

## Stick selection

The Stick picker resolves only the newly aimed loaded block. Previously its
successful corner update immediately scheduled a whole-volume scan combining
that corner with the older opposite corner. An unloaded old endpoint then
caused a selection error, replacing the status without explaining that the
new coordinates had already been stored. Old area limits could similarly
obscure the successful pick.

Each Stick pick now confirms Corner1/2 and its new coordinates immediately.
The old opposite coordinates remain available for editing; they are not
silently cleared. Automatic material scans run only when both endpoint cells
are loaded. An unloaded endpoint leaves both corners editable and explains
that loading is required for the material list/export. An automatic scan
finding an unloaded interior gives the same explanation. Explicit export
continues to validate the entire selection and report its actual error.
No world loading, terrain modification, native item placement or input
simulation is introduced.

CPU/DOM tests exercise actual fire/alt-fire selection-control wrappers,
replacement of both corners despite an old remote corner, continued picking
after interior-read failure, coordinate retention and bounded readiness reads.

Evidence: `outputs/visibility-0.6.50/`. The accepted menu, material sorting,
fluid colours, shapes/GLB/Draco support and limits from0.6.49 remain intact.
No client, account, installer or graphics context is started by verification.
Live visibility, real FPS and flicker acceptance still require the user's
next play session. `irisContractComplete=false` remains unchanged.
