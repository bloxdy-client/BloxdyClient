# Native Renderer Development

19 October, latest, 0.6.21: type33/v2 adds exact per-face RGB/validity within mixed terrain groups through export/index/submesh remapping to actual world/shadow draws. Dense index runs retain the original EBO and bind draw-constant emission uniforms; ambiguous greedy faces remain unknown, known zero stays valid. At most8192 runs per frame, within the existing1MiB envelope and proof pool. Layouts1–32 and33/v1, GPU budgets, fallback and Default remain unchanged. No reference scalar/ID mapping, extra GPU buffer or production recipe. Full layout, provenance and limits: [SOURCE-EMISSION.md](SOURCE-EMISSION.md).

Updated: 15 October 2026, Bloxdy Client 0.6.19, guarded native-gbuffer-v3. This extends
the existing renderer. It is not a completed Minecraft shaderpack renderer.

## Latest 0.6.19 increment: q9aot analytical GPU source

The implemented type-31 source adapter, actual native instanced draws and
explicit Iris WorldTranslucent routing are documented in
[SOURCE-EFFECTS.md](SOURCE-EFFECTS.md). It preserves bitwise spawn seeds,
actual source time/parameters/depth/blends, immutable texture generations,
bounded recovery and atomic failure handling. Packets 1–30 remain unchanged;
`sourceFrameContract=1`, `sourceGpuParticleContract=1`,
`irisContractComplete=false`. Sprites and full Iris particle semantics remain
open; no production recipe, release or installer. Following version sections
are historical and do not override this GPU increment.

## 0.6.19 Fullscreen Targets And Execution

`bridge_postprocess.hpp` adds native target descriptors, paired logical buffers
0-31 and fullscreen execution. Compact physical attachments preserve requested
output order, even for target 31. Reads use main, writes alternate, successful
GL checks precede flips, and flip-disabled outputs retain their sampler side.
Thirty supported R/RG/RGBA normalized/float/integer formats use appropriate
allocation and clear types. Descriptors specify persistence, clear color,
fixed/relative axes, filtering and reserved mips. Clear both new sides, including
persistent targets; regenerate dirty chains only when required. Reject invalid
formats/dimensions/clear values, feedback, conflicting texture filters, duplicate
units/outputs, physical capability excess and mixed output dimensions.

Renderer `postBufferSpecs`, `postPasses` and `finalBuffer` are internal engine
APIs. Passes are already compiled/owned by their caller; no pack parser or loader
is added. Ordered passes currently run after native source groups. Native input
identities rebind current handles each frame, including matching previous-world
color/depth. Temporal inputs automatically demand storage and require an explicit
validity uniform; unavailable inputs bind a complete neutral texture with false
validity. A selected normalized/float result resolves back to native scene color
without changing opaque depth or geometry metadata. Embedded readback sees that
result. Existing preview final output uses the same executor.

Default pass/descriptors are empty. No default effect/TAA or extra embedded
textures/history/draws/copies are enabled. Default preview still uses the existing
identity final shader. Scratch/history/frame targets and reserved mip chains
share the 512 MiB target limit. Stable resources avoid new allocations/queries;
fullscreen routing uses fixed arrays. Partial scratch allocation rolls back.
An aborted frame invalidates persistent scratch, which clears before reuse;
completed world-history slots remain protected independently. Fallback/resize/
scene resets invalidate appropriately. External offscreen destinations must
declare their attachments to make feedback checks possible.

`postprocessContract=1`; six-target native-gbuffer-v3 and packets 1-29 remain.
Full reference stages, pack geometry/texture/uniform/frame-boundary bindings,
additional formats, compute/images and source-coverage gaps are still open.
See MINECRAFT-RENDER-CONTRACT.md for exact limits and primary references, and
RENDERER-FINISH-PLAN.md for the requested completion target. 219 pure tests,
expanded CPU GL mocks and eleven GLSL checks passed; no real client/GPU/image/FPS
verification. Main/preload/capture/presenter/transport match 0.6.18 byte-for-byte.

## 0.6.18 Demand-Driven World History

`bridge_history.hpp` adds two GPU-resident RGBA16F-color/DEPTH_COMPONENT32F-depth
slots. At the end of world group 0, after its particles/transparency, stage world
color from the scene target and depth from the separately retained opaque target.
Do not capture hand/late groups or mutable post-transparency scene depth. Copies
use matching formats/dimensions and NEAREST into a different framebuffer; see
[Khronos framebuffer blit rules](https://wikis.khronos.org/opengl/GlBlitFramebuffer).
No CPU pixel readback or extra shader is involved in maintaining these slots.

`previousWorld` is a native resource descriptor, not an Iris texture binding. Its
validity requires the immediately preceding successful camera/motion frame,
matching dimensions/depth convention and valid camera history. Known-origin
rebases keep compatible history; unknown-origin rebases/availability changes,
fallback, scene epochs, resize and zero-sized output invalidate it. New slots
are never exposed as valid before their first successful copy/frame completion.
Copy errors and later composite/GL failures cannot flip slots, advance any
history or overwrite the previous completed slot. Retry still sees that frame.

`temporalHistoryRequired` is an internal pass demand, default false. No existing
pass consumes history, so the shipped path adds no history textures or blits.
Enabling at stable size allocates only the two slots, not the geometry targets;
disabling releases all four textures/two framebuffers. Stable demand/viewport
avoids allocations and extra GL limit queries. Combined memory is 60 bytes/pixel
without history or 84 with it, within the same 512 MiB target cap. Failed lazy
activation or partially allocated resize keeps the working resources intact.

Status adds worldHistoryContract=1, required/allocated/previous-valid and commit
counters. Native-gbuffer-v3, motionContract=1 and wire layouts 1-29 are unchanged;
irisContractComplete=false. Source bridge/presenter/default mode are unchanged.
219 pure tests, expanded CPU GL mocks and eleven GLSL checks passed. No client,
browser, account, real graphics context, live image or FPS check was performed.
This is native engine infrastructure, not enabled temporal effects, reference
deferred/composite/final execution or full Iris compatibility.

## 0.6.17 Successful-Frame Object Motion

The user confirmed two separate modes: original standard Bloxd, and the
experimental Minecraft-target renderer. Standard preloads still contain no
native capture/presenter and standard games create no native transport. Source
capture/presentation files and original mod packages are unchanged this release;
two additional pure launcher regressions guard mode isolation.
The byte comparison with the 0.6.16 package is recorded in
`outputs/native-renderer-verification/mode-isolation.json`.

The native world pass now tracks the previous successfully drawn transform and
CPU pose for each mesh. Matrices are compensated into the current floating
origin, matching camera history. A separate sixth RGBA16F attachment records
backward UV displacement (previous UV minus current UV), previous normalized
window depth and validity in W. Previous depth has half-float precision; it is
not a replacement for an exact retained prior-frame depth texture. New objects,
frame gaps, paused/failed frames, resize, changed depth conventions and invalid/
offscreen reprojections cannot claim valid history. Custom cameras, hand, sky,
particles and transparent draws do not supply opaque world motion.

Previous local positions are captured lazily before the first changed pose after
a completed frame; additional pose packets preserve that same snapshot. Static
terrain and transform-only objects do not duplicate positions. CPU vec4 snapshots
plus GPU SSBO storage share a 64 MiB reservation cap. Exhaustion marks motion
unknown without changing scene rendering. GPU snapshot buffers are reused and
bound at SSBO slot 4 only as needed; shader appearance/atlas slots are unchanged.
Normal-only and light-only updates do not generate position-history uploads.

Regular meshes/instances have stable mesh identity. Thin batches have no source
entity IDs in the current wire contract, so matrix/count/layout changes invalidate
one frame rather than inventing old-to-new slot identity. Unchanged thin transforms
can retain world/camera motion; full moving thin-instance tracking remains open.
Topology replacement/removal releases reservations and buffers. Camera and object
history commit together only after all scene/composite work and a final GL check;
a failed output pass never becomes the previous successful frame.

219 pure tests, expanded CPU GL mocks and eleven GLSL checks passed. Tests cover
object/camera motion, multiple poses, unchanged uploads, floating origins,
instance ambiguity, invisible/reappearing objects, fallback, resize, depth changes,
failed composite rollback, memory limits and no motion leakage into other passes.
No client/account/browser/real graphics context started. This is native temporal
foundation, not active TAA, full Iris binding or real-image/FPS verification.
Six targets use 60 bytes/pixel within the existing 512 MiB target budget.
Status: motionContract=1; irisContractComplete=false. No new wire packets.

## 0.6.16 Ramp And Blend Completion For CPU Particles

Source ramp textures and per-particle color/alpha remap ranges now transfer as
one V3 state with source blend identity. The actual secondary 2D one-row GPU
texture is read through the existing bounded async readback path, never rebuilt
from guessed gradient colors. Its sampler/wrap and readiness are preserved.
Unknown/aliased/incompatible ramps, zero remap divisors, nonfinite/oversized data
and incomplete reads keep fallback. Shared resources are retained until the
last active reference; disabling a ramp clears its binding/remap atomically.
Native release/resize checks protect live ramp references.

Subtract/multiply and MultiplyAdd now preserve actual source factors and order.
Multiply's color correction uses original texture alpha times particle alpha,
before ramp changes and fog. MultiplyAdd issues a whole multiply draw then a
whole additive draw, not interleaved passes per particle. Particles retain
scene-only output, world-depth policy and shadow exclusion. Zero-alpha particle
fragments are not discarded before a possible multiply contribution. Source
standard blending accumulates destination alpha with ONE, not an assumed
ONE_MINUS_SRC_ALPHA; engine modes 3/4 are supported in the material contract.

V3 remap-only updates reuse instance transforms/static quads. Uniform/secondary
binding caches avoid repeated ramp work on ordinary world meshes. Custom effects
on either pass, fixed snapshot capacity and wireframe stay explicit fallback.
GPU particle buffers, sprites and full Iris semantics/stages/buffers remain open;
sourceParticleContract=3, irisContractComplete=false. Matched native/capture
builds required; packet layouts 1-28 remain readable.

217 pure tests, expanded CPU GL mocks and eleven GLSL checks passed. Hashed
actual source blend/upload/render-wrapper excerpts run only against inert CPU
stubs; no simulation, module initialization, client, browser, account or real
graphics context started. Distance 10, active selection, budgets, ownership
guards and original mod packages remain. Live image/FPS parity is unverified.

## 0.6.15 Extended CPU Particles

Actual active CPU systems now support ALL/Y/stretched/local-stretched/fixed
orientation, animated sheets and local emitters. Source particle positions are
already world-space: only fixed local directions use the actual emitter matrix.
Capture preserves source iD/worldOffset minus floating origin, initialDirection
selection, copied vertical-direction correction, source cellIndex, base texture
dimensions and noninstanced epsilon on both UVs and geometry. No simulation or
source object mutation occurs. Billboard alignment uses the actual source eye.

Pivot, texture mask, bounded HDR color, UV rectangle/inset and direction travel
atomically in new packet 28. Simple neutral ALL systems retain packet 26;
extended systems remain on 28 even after returning to neutral, clearing stale
state in one batch. Native data validation completes before replacing live
state; unchanged buffers are reused and sheet-only updates do not upload
transforms. Static quads/index buffers remain unchanged. Conservative bounds
cover nonorthogonal stretch axes and pivot without enlarging world selection.
Source system order, supported blend/fog/depth behavior, scene-only output,
opaque-depth retention and exclusion from shadows remain intact.

GPU/ramp/multiply/custom programs, unsupported groups/cameras, clip planes,
log-depth, non-neutral image processing and degenerate direction/alignment stay
fallback. Sprites/full Iris uniforms/stages/buffers are still unfinished.
sourceParticleContract=2, irisContractComplete=false. Capture/native must match.

209 pure tests, expanded CPU GL mocks and eleven GLSL checks passed. A new
hash-verified fixture executes only the isolated actual particle upload method
with inert CPU vector/array mocks and inspects literal source shaders. No full
module, simulation, client, browser, account or real graphics context started.
Distance 10, import budgets, source selection/ownership guards and original mods
remain. Visible correctness, native coverage and FPS remain user-only checks.

The following version sections describe their historical release state.

## 0.6.14 Groups And Observed Hand Cameras

Render groups -1 through 3 preserve the actual source depth policy and default
material/alpha/distance/front sorting modes. Bloxd's public initialization sets
minimum group -1, material-ID sorting in groups -1/0/1 and disables depth clear
for group 0. These source choices are read, not replaced with generic engine
defaults. Material IDs and alpha indices travel as doubles, retaining
Number.MAX_SAFE_INTEGER / Number.MAX_VALUE. Source sphere centers and active
mesh/submesh ordering are preserved. Unknown comparator functions stay fallback.

Positive groups, explicit ignoreCameraMaxZ and camera-attached meshes obtain
their actual scene view/projection through a read-only onBeforeDrawObservable.
No camera property is changed, no updateTransformMatrix is called, and no FOV
is invented. Only main-canvas non-intermediate draws qualify. Observation age
is bounded to 250 ms, with camera/group/origin identity and finite/invertibility
checks. Missing, stale, invalid or identity-mismatched observations release ownership.
Matrix-only updates reuse geometry and do not repeatedly release ownership.
Observers exist only after other scene/material eligibility checks and are
removed on deselection/reset/stop; unrelated fallback does not keep probing.

The native receiver atomically validates group/camera/order data and converts
half-Z projections once. It binds each observed view/projection/inverse/camera
and uses the matching frustum, restoring world matrices on subsequent draws.
Camera-attached and ignoreCameraMaxZ meshes require an isolated positive group;
mixed world-group overlays remain fallback because their depth must not enter
retained world depth. Supported hand/overlay output writes scene color only and
does not cast or receive the native world shadow. The world opaque-depth copy
is retained once, before later group clears. Main camera history remains separate;
origin rebases compensate observed views, inverses, cameras and sorting centers.
Previous per-object matrices and a complete Iris hand/stage binding are NOT added.

200 pure tests, expanded CPU GL mocks and eleven GLSL checks passed, including
isolated hash-verified actual source comparators/pre-draw notification. No
client, browser, account or real graphics context started. Real coverage, images
and FPS remain user-only checks. Distance 10, active selection, budgets, original
mod packages and fail-open ownership remain. Full Iris semantics/stages/buffers,
complex particles, sprites and unknown source programs remain outstanding.

## 0.6.13 Special Material And Particle Extensions

CapeMaterialPlugin now deforms actual CPU vertices using its source joints,
max-Y define and original vertex-Z pivot, after source morphing. Subsequent
poses keep the static vertex/index storage. Combined cape/skeleton or
submaterial deformation remains fallback rather than guessing the ordering.
TextSampler preserves explicit LOD bias and source texture unpremultiplication.
Premultiplied modes 7/8 preserve source output/blend semantics; additive modes
1/6 preserve separate alpha factors. Existing standard blend behavior is intact.

Enchantment carries independent color, speed, optional node position/Y-rotation/
offset and the actual bound animation clock when available, otherwise the source
WebGL2 performance clock. Its procedural simplex/line/hue effect runs before
fog. Clock-only changes update a small uniform, not geometry or appearance data,
and do not relinquish ownership each tick. This is a source Bloxd effect, not
Minecraft glint or a shaderpack loader.

Basic CPU ParticleSystem/current sY systems read only actual active source
particles, never their simulation callbacks. Private adapter quads are not added
to scene.meshes. Position/color/angle/size/scale are sent atomically, at most 8192
particles per system, with source-system ordering. ALL camera billboards use
source view/inverse view and translation pivot; rotation-independent bounds
avoid edge popping. World-space particles draw scene color between opaque depth
retention and translucent geometry, not G-buffer surface metadata or shadows.
Actual fog, additive/standard blend and forced-depth behavior are retained.
GPU/local/sheet/ramp/stretch/custom-mask/program/group or non-neutral image-
processing variants retain whole-scene source fallback. Sprites, render groups
and temporary hand projection overrides also remain explicit fallback.

192 pure tests, expanded CPU mocks and eleven GLSL checks passed; native renderer
compiled only. New public hash-verified fixtures run only isolated Cape/Text/
Enchant string builders, no modules/physics/timers. No client, browser, account
or real graphics context started. Distance 10, active selection, import budgets,
fallback/ownership guards and original mod packages remain unchanged. Full Iris
uniform/semantic/stage/buffer contracts and real image/FPS parity remain open.

## 0.6.12 Engine Extensions

Armour uses actual horizontal atlas indices and independent RGB tint. HueTint
uses the source HSV/shortest-hue-shift formula; Overlay and Hue remain distinct.
Per-face block atlas attributes preserve all six source face mappings, including
actual per-instance texture-layer requirements. Unknown atlas-shaped plugins,
custom shader resolvers and invalid selectors remain fallback. At that release,
Enchantment, Cape, TextSampler and particle programs remained unimplemented.

Sampler state preserves all twelve source modes, actual mip use and sRGB format.
Dirty native mip chains generate once per render batch with full memory bounds.
Ordinary block drawing samples array textures directly, not lower levels of a
combined 2D atlas. Arbitrary custom source mip content/anisotropy are not copied.
The padded 2D atlas remains available for future pack coordinate bindings.
Atlas animation uses actual source table/tick/stride/interval values. Required
animation frames are prefetched, without extra geometry/chunks. Tick-only updates
do not rebuild parameter buffers or invalidate draw ownership.

`bridge_camera.hpp` retains canonical-Z projection/inverses and completed-frame
history, compensates previous view/camera for origin rebases, resets on
fallback/resize and preserves high/low origins in doubles. Camera packet
validation is atomic and rejects singular matrices. The native built-in pass
uses the canonical projection. A complete Iris uniform binding, authoritative
player feet/world values and previous per-object transforms remain future work.

## Appearance And Chunk Boundaries

0.6.11 adds adapters for the actual public Bloxd Lifeform, Overlay, Dither,
TerrainFade, EntityLight, TerrainLight and Animated plugins. Material programs
are not enabled merely because they are unknown. Remaining unknown programs,
armour/enchantment/hue/per-face variants and incomplete attributes stay fallback;
diagnostics include a bounded plugin class name. The current public standard
material alias `nY` is recognized in addition to StandardMaterial.

Lifeform uses the actual GPU 2D atlas, 1-8 layer indices per vertex/instance,
source grid dimensions and source top-first premultiplied composition. No PNG
roundtrip, character screenshot or manual model-menu operation is involved.
Overlay, opacity, source Bayer coverage and normalized entity light are separate
attributes in a bounded SSBO. Zero instances remain zero; appearance changes do
not replace static geometry. Block fade updates small uniforms instead of
reimporting whole chunks on each visibility step. Source lighting transfers
actual ambient/sky, held-light and up to four directional-light records; raw
RGB/skylight remains separate from the shading curve.

An isolated, hash-recorded public Lifeform shader-string builder is evaluated
only in a CPU VM regression. The public source was downloaded anonymously as
text, never initialized as a client. Provenance:
`launcher/tests/fixtures/lifeform-shader-2026-10-15.json` and
`outputs/renderer-source-audit/`. Original catalog modules are unchanged.

The user's intermittent bright chunk-edge line is not visually confirmed fixed.
Read-only render logs still show source fallback and no native frames. A
reproducible source-shadow failure is corrected: changing projection/settings
must not bypass the preflight for pending chunk geometry or cutout textures.
The previous complete texture/projection survives the bounded grace period;
the existing 100-ms retry/350-ms timeout behavior remains. A new regression
adds a pending chunk and changes the light projection in the same update.

Iris vertex preparation and its remaining limitations are described in
[the reference contract](MINECRAFT-RENDER-CONTRACT.md). This is not a completed
Iris uniform/program/buffer contract or an assertion of native world parity.

## Java / Iris Reference

The user selected Minecraft Java 26.3 as the rendering reference. The matching
reference is Iris 1.11.7 (`1.11.7+26.3-fabric`), verified on 15 October 2026 from
the official project's release metadata. See `docs/render-reference.json` for
sources and the exact release ID. This pins a target, not an installation or
implemented compatibility. The shader loader remains out
of this implementation step. See [the reference contract](MINECRAFT-RENDER-CONTRACT.md)
for implemented foundations and outstanding prerequisites; neither complete
native Bloxd appearance nor one-to-one Minecraft rendering is established.

0.6.10 adds an explicit material draw-state adapter rather than treating every
mesh as two-sided with the same depth/alpha/UV rules. Plain diffuse textures use
the actual source texture matrix, multiplied by `(u, v, 1, 0)` as in Babylon's
[sampler vertex implementation](https://github.com/BabylonJS/Babylon.js/blob/master/packages/dev/core/src/Shaders/ShadersInclude/samplerVertexImplementation.fx).
UV changes update material state only, not geometry. U/V address modes are
independent (clamp/repeat/mirror), with redundant native parameter updates cached.
Source texture level, alpha usage, two-sided normal handling and per-material
fog are transferred. Block array sampling remains the existing dedicated path.

Source clockwise/counter-clockwise orientation, world-matrix reflection,
front/back culling, depth-write policy and explicit depth comparison are
preserved. Default scene comparison is LEQUAL / reverse-depth GEQUAL; shadow
comparison stays LESS. Standard alpha combine uses separate RGB and alpha
factors, preventing output alpha from being multiplied twice. Translucency
still writes only scene color; any explicitly forced depth writes do not alter
the previously retained opaque-depth copy. Composite output resets culling and
blending after material draws. Reference:
[Babylon mesh binding](https://github.com/BabylonJS/Babylon.js/blob/master/packages/dev/core/src/Meshes/mesh.pure.ts)
and [engine raster state](https://github.com/BabylonJS/Babylon.js/blob/master/packages/dev/core/src/Engines/thinEngine.pure.ts).

Unsupported blend modes/equations, stencil, polygon offsets, depth prepasses,
separate culling passes, logarithmic depth, secondary UVs and missing/non-finite
UV matrices stay source fallback. At the historical 0.6.10 stage, Lifeform and
all unknown plugins still remained blocked. The targeted 0.6.11 adapters above
extend that coverage, but no live result establishes how many formerly blocked
meshes now qualify. Particles, distance 10 and active-mesh ownership are unchanged.
Texture filtering/mipmaps and exact full source lighting still need further work.

## Performance Update

The user reports the 0.6.8 image path is free of the previous visible bugs.
The last saved game run used source fallback: 612 unsupported active meshes,
zero native geometry/frames, yet 7,856 camera packets. Native FPS 0 was not the
game's frame rate. 0.6.9 optimizes that stable path as well as eligible native
imports, retaining distance 10, appearance and all handover safeguards.

Fallback eligibility is rechecked at 250 ms intervals, not on every 33 ms tick.
Camera IPC and write bookkeeping stop during fallback; original GL calls still
execute. Without native ownership, draw wrappers pass through without engine
lookups. Resuming imports starts from fresh geometry/texture state and seeds
current source bindings, including buffers already bound during fallback.
Eligible native capture retains the existing scan/camera cadence. The fallback
recheck interval is not a game FPS cap or a chunk/network polling interval.

Newly active, unimported chunks go before already imported meshes. The original
16-upload, 64-visit and 4-ms scan budgets remain; no extra server requests or
world cache are created. Native payload readers bulk-copy validated float/index
blocks instead of scalar bounds checks for each element. GPU errors are checked
once per applied input batch before the next image. Paused native output skips
unnecessary graphics queries. Shader logic and all original mods are unchanged.

The presenter reuses texture storage between same-sized frames, reallocating on
resize, and caches the sampler uniform and layout signature. This follows the
existing-storage update contract of
[WebGL texSubImage2D](https://registry.khronos.org/webgl/specs/latest/2.0/).
F8/F9 distinguish the source engine's cached frame cadence from active native
render FPS and save capture/pending-import state. Source cadence uses the
[engine getFps getter](https://github.com/BabylonJS/Babylon.js/blob/master/packages/dev/core/src/Engines/abstractEngine.pure.ts),
not a GPU-time measurement; absent/invalid values remain unavailable.

The CPU-only comparison in `tools/benchmark-capture.cjs` reads the frozen 0.6.8
ASAR source and the current capture into separate VMs. Five-round median for
600 unsupported meshes, 200 simulated ticks and 120,000 original draw/write
pairs: 73.7468 ms vs 21.3957 ms, about 71% less synthetic adapter time. Original
calls are preserved; geometry checks drop from 120,000 to 15,000 and camera
packets from 200 to 0. Source hashes and workload are recorded in
`outputs/renderer-performance/capture-benchmark.json`. This is not measured live
game FPS, end-to-end chunk visibility latency or server delivery acceleration.

## Regression Response

The user reported severe actual 0.6.7 failures: growing apparent draw distance,
missing player geometry, displaced mob textures, phantom atlas/block surfaces,
missing/incorrect chunks and lag. Those observations override previous isolated
test results. Read-only render logs recorded 1,720 imported meshes, 315 textures,
zero removals and a 53.6 ms capture tick. They do not prove the cause of every
visual defect or measure the game's FPS.

0.6.8 removes the whole-scene background import. Only `getActiveMeshes()` is an
authoritative source draw selection; its empty or unavailable state never means
"draw the entire scene cache." Old imports, unreferenced textures and their PBO
jobs are released. The source's configured distance is not changed: 10 remains
10. No additional chunk requests or extended world cache are introduced.

Native handover now requires imported coverage, loaded color textures and a
supported source contract. Lifeform/cosmetic atlas layers, opacity/overlay
attributes, unknown shader/plugin programs, the known visual shader mod,
billboards, LOD, UV transforms, extra material maps, particles/sprites,
postprocessing and multiple cameras force an explicit source fallback. This
protects the user from incomplete native frames; it does not implement those
appearance paths. In normal Bloxd worlds this fallback may remain necessary.
Native rendering and image readback pause while fallback is active.

Source world-canvas draws are suppressed only after a current native image was
successfully presented and capture grants ownership. Simulation, input, active
mesh evaluation, buffer writes and required offscreen resource passes remain
enabled. The source evaluation observer immediately restores the source image
if selection changes. A 500 ms ownership lease fails open if presentation stops.
Errors latch fallback until scene reset instead of repeatedly creating broken
overlays. Both scene epoch and draw-selection revision are rechecked after IPC;
old-sized frames cannot cover a resized source canvas.

Source conventions are informed by the official Babylon
[instance shader](https://github.com/BabylonJS/Babylon.js/blob/master/packages/dev/core/src/Shaders/ShadersInclude/instancesVertex.fx)
and [scene evaluation implementation](https://github.com/BabylonJS/Babylon.js/blob/master/packages/dev/core/src/scene.pure.ts).
These references are not a claim of full Bloxd material compatibility.

## Objective

Continue the existing C++ OpenGL renderer and Bloxd data bridge. Build a complete
world renderer with interfaces capable of hosting Minecraft shaderpack programs
and later renderer extensions. Bloxd remains responsible for gameplay and its
server connection. Shaderpack compatibility requires a defined subset of the
Iris/OptiFine rendering contract; this work does not implement that contract yet.

## Implemented Foundation

The imported scene now renders into an owned framebuffer before a separate
 fullscreen composition pass presents it. The current compositor copies the
scene color without introducing a new tone mapping or gamma policy.

Native launcher profiles instead read that scene buffer asynchronously and
present it inside the existing Bloxd window. The native context stays hidden.
The original canvas keeps input/engine operation; DOM menus remain with Bloxd.
The presentation layer has no pointer events and hides the source image only
after an eligible current frame and ownership grant. Scene change, unsupported
source data, presentation error or a 1.5-second frame timeout restores the source
image. This is a CPU/IPC image transfer, not shared
GPU textures; no performance improvement is claimed. The legacy bridge still
uses a separate preview window.

| Buffer | Format | Current contents |
| --- | --- | --- |
| Scene color | RGBA16F | Lit opaque/cutout color, then blended transparent surfaces |
| Surface albedo | RGBA8 | Unlit opaque/cutout texture multiplied by vertex/material tint |
| Surface normal | RGBA16F | World normal encoded as normal * 0.5 + 0.5; alpha 1 marks a surface |
| Surface light | RGBA16F | Native Bloxd RGB block light and skylight in four channels |
| Surface identity | RGBA32F | Native Bloxd block ID, native material class, reserved 0, surface-present marker 1 |
| Surface motion | RGBA16F | Backward UV displacement XY, prior normalized depth Z, validity W; opaque/cutout world group only |
| Scene depth | DEPTH_COMPONENT32F | Opaque/cutout depth in the source camera convention |
| Opaque depth copy | DEPTH_COMPONENT32F | Separate retained copy made before transparency |

These are native buffer semantics, not predefined Minecraft `colortex` bindings.
Background pixels have zero albedo/normal/light metadata. Transparent surfaces
currently update only scene color and leave the opaque metadata/depth intact;
they are not yet a separate water/material G-buffer. Reverse depth and half-Z
camera conventions remain supported. Resize uses replacement resources and
retains the old allocation if creation fails. Total target allocation is bounded
to 512 MiB (60 bytes/pixel). Source samplers have complete fallback textures.

Block arrays now also populate a real 2D atlas, with an extruded one-pixel gutter
around each tile. Referenced layers still load progressively. Individual atlas
allocation is limited to 256 MiB and the driver's maximum texture dimensions.
Page offsets use populated `imagesPerAtlas` counts rather than spare GPU page
capacity. Unrelated active material maps are not color-texture fallbacks.
The original array resource remains available. Atlas coordinates are native,
not yet the full Minecraft vertex/texture contract.

Source sky cubemaps transfer their actual six faces. Sky geometry is drawn before
terrain without writing world depth or surface metadata. Source directional
lights, fog and camera clipping values use a separate environment packet. A
2048-pixel directional depth pass uses imported eligible casters, snapped light
projection, alpha cutoff and PCF receivers. It never samples its target depth
texture while writing. Shadows are disabled if a source sun is unknown. These
are native shadow shaders, not a Minecraft pack's shadow program.

Terrain face IDs come from an explicit block attribute or a read-only voxel
lookup just inside the world-transformed face, with the render origin restored.
Registry definitions classify actual Water/Flowing Water and Lava/Flowing Lava,
including shared animated atlas layer zero. Late definitions invalidate affected
static import state. Unknown ID is -1; atlas position is never used as block ID.
Classes: 0 unknown, 1 solid, 2 water, 3 lava, 4 reserved cutout, 5 entity, 6 reserved
hand, 7 sky. These classes and native IDs do not assert Minecraft name mappings.

The bridge exports each multi-material submesh with its own material, compact
vertex mapping and indices. Material tint, visibility, emission, lighting disable
and alpha cutoff are transferred. Single-material submesh ranges are respected
as well. Obsolete parts are removed. Regular instances do not inherit a source
thin batch, and explicit zero batch counts are not replaced by forced counts.
Billboards and the separate particle rendering system remain source fallback.

Bone poses and CPU-readable position/normal/UV morphs are supported. Morphs apply
before skinning. Changed positions/normals update the existing vertex buffer,
without recreating index buffers; unchanged poses send nothing. UV morph changes
use a full mesh update, including restoration when the morph is disabled.

Active source meshes are scanned fairly within the count/time limits. Cached
offscreen scene geometry is not an extra draw list. This means native shadows
currently lack offscreen source casters; a separate bounded authoritative caster
selection is future work. Texture readbacks retain their asynchronous job limits.
The renderer does not request more chunks or cache unloaded world chunks.

## Bridge Extensions

Existing BND1 packets 1-10 retain their layout. Added payloads use little-endian
32-bit words/floats following the existing 16-byte header:

| Type | Words | Float payload |
| --- | --- | --- |
| 11 Pose | epoch, mesh ID, vertex count | position XYZ and normal XYZ per exported vertex |
| 12 Material | epoch, mesh ID, flags | alpha cutoff, emissive RGB |
| 13 Environment | epoch, flags, fog mode | sun XYZ, sun RGB, fog RGB, fog start/end/density, near/far, rendering seconds |
| 14 Surface | epoch, mesh ID, vertex count | native block ID and native material class per vertex |
| 15 RenderControl | epoch, nonzero selection revision, ready flag 0/1 | none |
| 16 ReleaseTextures | epoch, count, unreferenced texture IDs | none |
| 17 MaterialState | epoch, mesh ID, draw flags, depth comparison, blend mode, U wrap, V wrap | 16-float source UV matrix, texture level |
| 18 AppearanceMaterial | epoch, mesh ID, flags, grid columns/rows, layer count, directional count | ambient RGB, sky RGB, held RGBA, held position/cone XYZW, visibility, fade alpha, directional XYZW records |
| 19 AppearanceData | epoch, mesh ID, mode 0 vertex / 1 instance, total, offset, count | 20 floats per record: 8 layer indices, overlay RGBA, source light RGBA, opacity, 3 reserved |
| 20 AppearanceDataV2 | same range fields as 19 | 24 floats: first 20 retain their positions; 17-19 armour RGB, 20-23 Hue RGBA; first six indices also carry per-face atlas values |
| 21 TextureSampling | epoch, texture ID, GL min filter, GL mag filter, mip flag | none |
| 22 Origin | epoch, known flag | high XYZ then low XYZ, summed as doubles |
| 23 AtlasAnimation | epoch, texture ID, parameter count | tick, stride, triples of state mask, start layer, interval |
| 24 SpecialMaterial | epoch, mesh ID | source effect tick, text LOD bias, particle pivot XY |
| 25 AppearanceDataV3 | same range fields as 19 | 36 floats: first 24 unchanged; 24-27 enchant RGB/speed, 28-31 node position XYZ/Y rotation, 32-34 node offset XYZ, 35 reserved |
| 26 ParticleBatch | epoch, mesh ID, count, source system order | 20 floats per particle: affine matrix 16, source color RGBA |
| 27 DrawState | epoch, mesh ID, group + 1, flags, active mesh order, submesh order | if flag 1: view 16, projection 16, camera XYZ; if flag 16: source center XYZ; then two little-endian float64 values: alphaIndex, material sort ID |
| 28 ParticleBatchV2 | epoch, mesh ID, count, source system order, orientation mode | pivot XY, mask RGBA, then 28 floats per particle: matrix 16, color RGBA, UV rectangle 4, direction XYZ, corner inset |
| 29 ParticleBatchV3 | epoch, mesh ID, count, source system order, orientation mode, ramp texture ID, source blend + 1, ramp U wrap, ramp V wrap | pivot XY, mask RGBA, then 32 floats per particle: V2 first 28, remap XYZW |

Appearance flags: 1 Lifeform, 2 Overlay, 4 Dither, 8 TerrainFade, 16 EntityLight,
32 TerrainLight, 64 source lighting enabled, 128 dither ignores texture alpha.
V2 adds 256 Armour, 512 HueTint and 1024 per-face atlas. V3 adds 2048 Enchantment,
4096 TextSampler, 8192 Enchantment node transform, 16384 CPU particles.
Old packets 19/20 expand to 36 floats internally, without changing wire layout.
V2 or V3 is mandatory for extended attributes; Enchantment requires V3. Text and
particle flags do not require generic appearance records: packets 26/28/29 create
transforms and colors together. Appearance uses SSBO binding 7, atlas animation
binding 6. Source appearance status is version 3; irisContractComplete is false.
At most 8 cosmetic layers / 4 directional lights. Packet 19 sends contiguous
segments of at most 262144 records, with existing vertex/instance limits.
Ranges, indices, opacity/light values and complete payloads are validated before
applying a segment; GPU upload waits for the last segment. Changing the material
layout clears obsolete appearance records. Missing/incomplete records cannot
draw. Mesh flag 8 marks authoritative source terrain, avoiding a second tangent
rebuild when its separate surface metadata arrives. Existing fields are intact.
Mesh flag 16 marks the private particle quad. Packet 26 validates affine
transforms/colors/count/order and the matching particle-only contract before
replacing live CPU/GPU batches. Empty batches clear both transforms and colors.
Packet 28 additionally validates pivot (absolute <=16), mask (0..1), the 2D
corner basis, UV rectangle endpoints, inset (0..1] and required direction.
Modes: 0 ALL, 1 Y, 2 stretched, 3 local-stretched, 4 fixed-direction. Count is
at most 8192 and source order at most 1000000. Particle RGB is 0..64, alpha 0..1.
The 28-float wire records become 18-float transform and 36-float appearance
records; appearance offsets 20..23 hold UV offset/scale, 24..26 direction and
27 corner inset. Legacy 26 defaults to mode 0, neutral mask/UV/inset and retains
its prior SpecialMaterial pivot convention. New extended batches never split
the pivot into packet 24. Packet 29 adds four remap values at appearance offsets
28..31, with bounded absolute values <=64 and positive divisors >1e-8 when a
ramp is enabled. Ramp ID zero disables it. Source blend + 1 is 0 subtract,
1 one-one, 2 standard, 3 additive, 4 multiply, 5 multiply-add. All other values
are rejected before live mutation. Ramp wraps use the material wrap enum.
Sampler unit 7 is dedicated to the complete 2D ramp/fallback texture; SSBO
binding 7 remains the separate appearance namespace. Legacy batches clear V3
ramp/blend/remap state. Status exposes sourceParticleContract=3.

DrawState flags: 1 observed camera, 2 group depth reset, 4 source half-Z,
8 isolated camera-attached/ignoreCameraMaxZ output, 16 source sphere center,
32 material-ID transparency sort, 64 distance-only back-to-front, 128 front-to-
back. With no sort bit, transparency uses alphaIndex then back-to-front.
Sort bits are mutually exclusive. Opaque then cutout use source material order.
Group is encoded +1 so -1 needs no unsigned reinterpretation. Status exposes
sourceDrawContract=1, not complete Iris compatibility. New capture/native builds
must stay matched; packets 1-28 keep their previous layouts.

MaterialState flags: 1 culling, 2 clockwise front face, 4 cull front rather than
back, 8 depth write, 16 use texture alpha, 32 two-sided lighting, 64 material fog.
Depth comparison is 0 (default) or GL_NEVER through GL_ALWAYS (512-519). Blend
mode is 0 disabled, 1 additive, 2 standard, 3 subtract, 4 multiply, 6 one-one,
7/8 premultiplied; factors follow the hashed actual source blend method.
U/V wrap are 0 clamp, 1 repeat,
2 mirror. Every field, float, payload length and unknown flag is validated before
the live material is modified. Capture invalidates image ownership before a
changed material state is transmitted. Existing packet layouts remain unchanged.

Material flags currently allow only bit 0 (disable lighting). Pose updates must
match the stored vertex count. Both extensions are validated before CPU geometry
or material state is changed. The capture source and native binary must be built
and distributed together. Development launcher, legacy bridge and packaging now
use `build-release/Release/BloxdNative.exe`.

Environment flags mark a known directional sun and enabled fog separately. All
surface IDs/classes and environment ranges are validated before state changes.
The rendering clock is not labelled as authoritative world time.

The return channel is a unique local Windows named pipe. Its BNF1 header is nine
uint32 words (36 bytes): magic 0x31464e42, version 2, sequence, scene epoch, width,
height, RGBA8 byte count, flags 1 (bottom-left rows), nonzero selection revision.
Version 1 is rejected; source and native binary must be updated together.
Dimensions are limited to 8192 on
each axis and 16 million pixels total. GPU readback allows at most three pending
jobs, never waits on an unsignalled fence and discards stale scene/revision jobs. An
overlapped pipe write retains at most one pending image. Node parses fragmented
frames into one bounded allocation and retains only the latest complete frame.
Presentation polling permits only one outstanding request. Only the owned Bloxd
main frame may fetch pixels; account-only windows never start this channel.

## Verification

The agent must never launch or operate the client, native preview, offline scene,
browser, account or graphical test. Only compilation and pure Node/DOM/VM/CPU and
GLSL compiler checks are permitted.

- `node launcher/verify.cjs`: 181 pure checks passed. New coverage adds
  Armour/Hue/per-face/independent instance constants, exact source sampler modes,
  atlas animation prefetch/tick-only updates, unknown shader fallback and split
  source origins. Hash-verified source builder fixtures run only in CPU VMs.
  Earlier appearance coverage includes
  actual Lifeform layer composition/grid bounds, per-instance data, overlay,
  source lighting, fade without geometry reimports, transparent-material
  preservation and named unknown-plugin fallback. An isolated public shader
  string builder is evaluated only in a CPU VM, without module/client startup.
  Shadow regression coverage preserves complete maps during new-chunk/projection
  changes. Material coverage includes
  exact UV payloads, matrix updates without mesh reimports, independent address
  modes, mirrored orientation/depth/fog state and unsupported-state fallback.
  Performance coverage adds
  fallback IPC/write-tracker pause, limited rescans, already-bound buffer resume,
  new-chunk priority with a 200-mesh backlog, texture/uniform reuse and resize,
  bounded source cadence and F8/F9 source/native distinction. Earlier coverage includes
  active-list-only import, walking with a retained source cache, orphan texture
  release, zero-count/regular instances, atlas capacity vs populated ranges,
  unsupported entity/material fallback, source draw ownership, lease expiration,
  stale selection/viewport frames and late replies losing eligibility. Earlier
  coverage includes
  cubemap faces, actual fog/sun values, real/unknown block IDs, late definitions,
  fragmented return frames, sequence wrapping, source restoration and own-frame
  native IPC access. The earlier material/pose/morph checks remain included.
- Native diagnostics whitelist bounded render counters, ready/fallback reason,
  ownership and presentation state in
  the run's `capture-status.json`, excluding arbitrary source/page fields.
- Build `BridgeCpuTests` explicitly with CMake, then run its CPU mock executable.
  No GLFW initialization, graphics context or client is created.
- `node tools/verify-native-renderer.cjs`: compiles/links the actual native
  G-buffer, composite and WebGL2 presentation GLSL with glslang, and runs only
  `BridgeCpuTests.exe`. It rejects a CPU binary older than its source dependencies.
- CPU coverage also includes layered alpha/Bayer, validated appearance packets,
  tangents/handedness, partial-UV quads, degenerate UVs, unknown greedy centers,
  pose updates and separate integer lightmap buffers. Current tests add V2
  appearance, sampler/mipmap caching, animation table/range/clock behavior,
  canonical matrices/inverses, double origins and history/reset/rebase checks.
- `node outputs/shader-audit/verify-glsl.cjs`: eight visual-shader programs pass
  compile/link checks, for eleven GLSL programs together with the native checks.
- Reports: `outputs/launcher-verification/verification.json` and
  `outputs/native-renderer-verification/glsl-verification.json`.

The native renderer binary compiled successfully. Real GPU execution, complete
world appearance, frame rate and memory behavior remain unverified user checks.
Installer and portable 0.6.12 are built separately under `dist-bloxdy-v0.6.12`.
They are not executed by verification. Package source/resource comparison and
checksums are recorded by `launcher/check-package.cjs`.
Package checks compare source files and native resources and reject private
folders. Packages are never executed by verification.
The 0.6.12 check passed: 39 source files byte-identical, matching native resources
and no private folders. Both installer and portable Authenticode status is
NotSigned. Reports: `outputs/launcher-verification/distribution.json` and
`dist-bloxdy-v0.6.12/SHA256SUMS.txt`. Previous releases are retained.

## Remaining Renderer Work

1. Map preserved native IDs to the reference pack's Minecraft block/entity/item
   names and finish its vertex contract, including authoritative quad/block
   identity, own emission and final atlas/instance bindings.
2. Complete remaining UV channels/modes, custom source mip content/anisotropy,
   additional material maps and remaining entity/particle programs, including
   enchantment/cape/text appearance and render-group/hand-camera behavior.
3. Extend the source environment adapter with authoritative world time, moon,
   weather and player state where those values are available.
4. Implement the reference pack's geometry, shadow, deferred,
   translucent, composite and final stages, uniforms and buffer rules.
5. Complete remaining non-cubemap skies, separate particle systems, held-item
   cameras and full entity appearance. Verify the actual integrated window.
6. Add the separate shader loader and verify a pinned reference pack. A ZIP
   download or successful compiler result does not establish playable support.
7. Investigate extended render distance separately: existing loaded data,
   possible stale chunk caches and the actual server delivery limit.

The native preview remains experimental. Minecraft shaderpacks are not executed,
and neither higher render distance nor measured performance gains are claimed.

## Later EZ Mods

Requested for later: Zoomer (zoom), Adless (ads hidden) and CrazyGames Login
(official login option outside CrazyGames-hosted play). Feasibility and supported
authentication integration of the last item have not been established.
