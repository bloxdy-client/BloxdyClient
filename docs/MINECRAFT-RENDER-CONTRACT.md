# Minecraft Java / Iris Rendering Reference

22 October,0.6.39: canonical contract3 adds ten exact stair families with
geometry-verified facing/half/shape and proven dry state, plus Jungle/Cherry
lower/upper door roots with facing/open/fixed right hinge. Door power remains
unknown; the internal pack resolver checks consensus across both Boolean
completions. 50 exact source roots total; no wire/observer/GPU-resource change
or production recipe. Other families/reference inputs and image/FPS acceptance
remain open. [SHAPED-BLOCK-MAPPING.md](SHAPED-BLOCK-MAPPING.md).

21 October,0.6.32: isolated preprocessed block.properties name/property-to-ID
resolver and internal exact integer PackBlockId draw binding implemented;
first-match ordering, partial-state consensus, unknown/unassigned distinction
and frame/table lifetime guards. No production loader/recipe or mc_Entity
attribute. Canonical contract2 proves waterlogged=false for the six exact
supported nonfluid horizontal slab families; the earlier water-unknown statement
is superseded for them. Door/stair base states are evidenced but their exact
reference mapping remains open. [PACK-BLOCK-MATERIAL-IDS.md](PACK-BLOCK-MATERIAL-IDS.md).

21 October,0.6.31: explicit native mappings now retain canonical Java26.3 names
for30 full cube families (complete empty property sets) and6 slab families
(known bottom/top; waterlogged unknown, states incomplete). Exact source
names/state/flags and existing registration/upload/frame guards are required;
unlisted/custom/side variants remain unknown. No numeric reference/pack IDs or
new shader bindings/production recipe. Pack-specific resolution is next;
world time/weather/lightmap/scalar/hand/player/source coverage and user image/FPS
acceptance remain open. Step1 and the full renderer are not complete.
[MINECRAFT-BLOCK-MAPPING.md](MINECRAFT-BLOCK-MAPPING.md).

21 October,0.6.30: bounded observed source names/root family/full metaStr and
effective properties are now generation-bound via type33/v5 and typed actual
world/shadow draw inputs. This closes the bounded source-registry delivery
portion, not Minecraft name/state/pack mapping or other reference gates.
[SOURCE-BLOCK-MATERIALS.md](SOURCE-BLOCK-MATERIALS.md) specifies exact lifetime,
source-null encodings, limits and remaining work. No production recipe enabled.

20 October, 0.6.29: independent raw source block identity now reaches actual
Gbuffers/Shadow draw constants for proven uniform center-owned faces and
observed instances. Type33/v4 preserves old layouts and separates ID validity
from RGB validity; equal RGB cannot certify a mixed-ID greedy face. This is not
Minecraft names/states or pack material mapping. World time/weather, scalar
emission/lightmap and reference hand inputs remain unknown; step 1 is still
open. No production recipe or shaderloader. Source scope, evidence and complete
remaining data matrix: [SOURCE-BLOCK-IDENTITY.md](SOURCE-BLOCK-IDENTITY.md).

19 October, latest, 0.6.21: bounded SourceOwnEmissionRgb (raw RGB0–15 plus explicit validity) now reaches actual world/shadow draws per proven face inside mixed terrain groups, including exact triangle/submesh remapping and known zero. Mixed/ambiguous cells within a face stay unknown. Type33/v2 index runs use constant RGB/validity uniforms without interpolation or new GPU storage; layouts1–32 and33/v1 remain unchanged. No Minecraft/Iris semantic equivalence is inferred; reference OwnEmission and Minecraft IDs remain unknown. This closes the bounded mixed-group source delivery subset, not a reference scalar/full-renderer gate. Instanced/boundary/compact/deformed variants, shaderloader, testpack and visual acceptance remain open. Details: [SOURCE-EMISSION.md](SOURCE-EMISSION.md). Earlier audit paragraphs below describe historical states.

19 October correction: existing source-light type 32 is now accepted by the native pipe (previously capped at 31). This closes a transport defect, not a Minecraft/Iris semantic requirement. The worker reply contains the job block copies, but its initialization register snapshot is still missing from the proven read-only join. Own emission remains gated; see [SOURCE-EMISSION.md](SOURCE-EMISSION.md).

18 October 2026 own-emission follow-up: no reference requirement is newly closed.
The local source audit proves RGB registration and its loss of generation
association at exported terrain/instance geometry. It does not justify scalar
OwnEmission or Minecraft IDs. Required bindings remain blocked; actual CPU
world/shadow draws verify optional zero/false reset and failure without commit.
See [SOURCE-EMISSION.md](SOURCE-EMISSION.md) for exact evidence and coverage.

Reference chosen by the user: Minecraft Java **26.3** with its matching Iris
release. Pinned on 15 October 2026 to **Iris 1.11.7**, artifact
`1.11.7+26.3-fabric` (OpenGL reference, not a new installed dependency).
[Minecraft release](https://www.minecraft.net/en-us/article/minecraft-java-edition-26-3),
[official Iris project](https://www.curseforge.com/minecraft/mc-mods/irisshaders),
[exact Iris release](https://modrinth.com/mod/iris/version/vTN4NRGW).
Machine-readable target: `docs/render-reference.json`. Renderer foundations
come first; no shader loader or shaderpack execution is added by 0.6.19 or its
current Iris graph development increment.

"One-to-one" must mean equivalent input semantics, render stages and resulting
images for this pinned reference, not simply GLSL compilation or Minecraft-like
lighting. The native code is a separate Bloxd renderer, not Minecraft's engine.
Bloxd simulation, networking, input and loaded-world selection remain Bloxd's.
Distance stays 10; native rendering cannot create server data it has not received.

## Current Contract

18 October: coherent source world lighting now reaches explicit typed
Gbuffers/Shadow uniforms through atomic type 32/v1 (unchanged embedded type 30
or 31). Source RGB sky/ambient, held RGB/range and position-or-cone direction,
lighting switch and Earth-sky direction retain their actual meanings. No
reference world time/weather/lightmap/emission gate is unlocked. Snapshot,
replay/expiry/commit rules and the per-candidate evidence matrix are in
[SOURCE-FRAME-DATA.md](SOURCE-FRAME-DATA.md). No production recipe is enabled.


The q9aot `gpuParticles` source path is now implemented end to end: observed
spawn/upload/uniform/raster snapshots, atomic type 31, native RGBA32UI resources,
analytical instanced draws and explicit world-transparency graph routing.
The user's analytical-evaluation decision is resolved. This covers its proven
bounded source formula/gradient/ramp/blend variants, not full Iris particle
semantics. Sprites remain unsupported. See [SOURCE-EFFECTS.md](SOURCE-EFFECTS.md).

Latest increment (17 October): authoritative render-sampled source player
feet/eye target and observed hand matrices now reach the existing geometry
bindings through atomic validated type-30 frames. Identity, origin, viewport
and freshness govern availability. Reference hand HUD-FOV/far/hurt/view-bob,
world/weather/lightmap/Minecraft semantics remain unknown. The explicit source
hand mode does not satisfy the reference hand gate. Details and source evidence:
[SOURCE-FRAME-DATA.md](SOURCE-FRAME-DATA.md). No production recipe is installed;
`sourceFrameContract=1`, `irisContractComplete=false`.

Preceding increment (16 October): explicit linked Gbuffers/Shadow geometry bindings
and reference HUD hand projection/depth compression, described in
[IRIS-GEOMETRY-BINDINGS.md](IRIS-GEOMETRY-BINDINGS.md). Typed reflection,
vertex/instance streams, current-side MRT routing, matrix/sampler bindings and
unknown-value gates are implemented. Authoritative hand/player/world/semantic
reference-semantic providers and complete source appearance adapters remain open; no
production recipe is enabled. `irisGeometryContract=1`, `irisContractComplete=false`.

The preceding executable engine stage/resource graph on 0.6.19 is described
in [IRIS-RENDER-GRAPH.md](IRIS-RENDER-GRAPH.md). Real native geometry callbacks,
linked compute/fullscreen programs and Renderer integration are CPU-tested.
No production recipe is enabled yet; native geometry meanings are not a complete
Iris shader interface. `irisGraphContract=1`, `irisContractComplete=false`.

| Area | Implemented foundation | Missing for reference equivalence |
| --- | --- | --- |
| Geometry | Indexed triangles, active source selection, submaterials, regular/thin transforms, CPU bone/morph poses, source groups -1..3 and isolated observed hand cameras | Complete entity appearance, authoritative offscreen casters, mixed world-group camera overlays, arbitrary custom draw programs |
| Material state | UV0 matrix, U/V wrapping, tint/emission, alpha/culling/depth/fog; Lifeform, Armour, HueTint, per-face atlas, Overlay, Dither, TerrainFade, EntityLight, TerrainLight, Animated, Enchantment and TextSampler; CPU cape joint poses; source min/mag filters, dirty native mip chains and sRGB | Arbitrary unknown programs, combined cape/skeleton variants, additional maps, custom source mip chains/anisotropy, remaining UV/blend states |
| Lighting | Preserved raw RGB/sky channels; atomic observed source switch, sky/ambient RGB, held RGB/range/vector/cone and sky direction; proven per-face own RGB in mixed center-owned terrain via actual geometry draws | Reference world time/weather/lightmap and own-emission scalar equivalence; instance/boundary/compact/deformed own emission, per-material directional snapshot, exact shading |
| Vertex interface | Position/normal/UV/tint, source layer/RGB light, surface ID/class; tangent/handedness, recoverable quad midpoints, unit-face block offsets, raw integer lightmap buffers; exact emission face/index/submesh join with noninterpolated draw constants; explicit core bindings and bounded source-atlas adapter | Original quad identity for general triangles, per-block centers within greedy faces, reference scalar own emission, Minecraft semantic IDs, authoritative reference lightmap and remaining material/atlas variants |
| Buffers | Six native geometry targets; demand-driven HDR/32F world history; separate 32-index paired targets with explicit sparse geometry/fullscreen routing, 30 normalized/float/integer formats, typed clears, persistence, fixed/relative sizes and reserved mips | Remaining optional formats/features and broad pack interfaces; native targets are not automatically Iris colortex buffers |
| Camera | Canonical projection/inverses, completed-frame camera/object/CPU-pose history, rebase compensation, atomic sampled source feet/eye/origin and isolated hand matrices; explicit core matrix bindings, separate reference and observed-source hand projection modes | Proven reference HUD-FOV/far/hurt/view-bob, stable moving thin-instance identities and custom-camera temporal history |
| Instanced block ownership | Bounded observed empty-storage append/swap/reuse, registration and committed upload chain implemented through type33/v3 and actual native world/shadow draws | Generic or missed lifetimes, custom transforms and unsplit gl_InstanceID-dependent programs remain unknown. Observer tokens are not source counters or Minecraft IDs; see SOURCE-EMISSION.md. |
| Draw stages | Grouped native sky, opaque/cutout, CPU ALL/Y/stretched/local-stretched/fixed particles with source sheet cells/directions/offsets/masks, actual ramp/remap and subtract/multiply/two-pass MultiplyAdd, source-system order, q9aot analytical GPU instanced draws, source sorting/depth resets, isolated camera-attached output, translucent, shadow and presentation | Bounded q9aot analytical GPU particles now draw with exact source time, gradients, ramp, blend and source order via an explicit graph color adapter; sprite renderer/layout remains missing. Other custom programs/cameras/groups, mixed world-group overlays, full sky/entities and reference deferred/composite/final behavior remain open. See SOURCE-EFFECTS.md. |
| Ownership | Complete supported active selection only; explicit pause/revision/lease, source fallback; appearance updates pause ownership | Remaining material variants and user-operated verification of actual native coverage |
| Verification | Node/DOM/VM mocks, CPU GL mocks, GLSL compile/link, builds and package file checks | User-operated real GPU/image/FPS comparisons against the pinned reference |

## Attribute Semantics To Preserve

- The reference light coordinates carry separate block and sky levels, currently
  0-240, transformed to lightmap coordinates. Bloxd's RGB light must remain
  available separately; it is not already the Java lightmap contract.
  [Iris lightmap attribute](https://shaders.properties/current/reference/attributes/gl_multitexcoord1/)
- Texture midpoint is defined per quad, including the actual partial texture
  coverage of slabs. Averaging arbitrary neighboring triangles is not sufficient.
  [Iris mc_midTexCoord](https://shaders.properties/current/reference/attributes/mc_midtexcoord/)
- Block-center offset is in 1/64-block units. Its emission component in Iris 1.7+
  is the block's own emission, not propagated light from nearby sources. Unknown
  source values must not be fabricated.
  [Iris at_midBlock](https://shaders.properties/current/reference/attributes/at_midblock/)
- Native atlas layer and block IDs are distinct. Pack semantic IDs derive from
  Minecraft block names/properties; arbitrary Bloxd IDs cannot substitute for them.
  [Iris block.properties](https://shaders.properties/current/reference/miscellaneous/block_properties/)

These are future engine data obligations, not a statement of shader compatibility.
Existing fallback remains mandatory until unsupported source contracts are
implemented and complete geometry/material/texture coverage is established.

## 0.6.11 Vertex Preparation

The native VAO now has tangent/handedness at location 12, quad midpoint at 13,
block-center offset at 14 and an integer lightmap buffer at 15. Tangents update
with CPU poses. Light updates replace only the small integer lightmap buffer,
not tangent data. Quad reconstruction accepts adjacent coplanar triangles with
four corners; triangles and ambiguous shared corners are not labelled complete.
Only axis-aligned unit terrain faces receive inferred local block offsets.
Greedy faces do not pretend to represent individual blocks. The offset is in
model space; applying an instance/world transform and a pack-specific atlas
coordinate conversion remains a later program-binding responsibility.

Raw native RGB is retained separately. Scalar block light uses its maximum
channel, with block/sky coordinates scaled by 16 (0-240), normalized as
`(raw + 8) / 256`. This is an explicit adapter choice, not equivalence between
Bloxd RGB lighting and Minecraft lighting. `at_midBlock.w` is -1 for unknown
source emission, not propagated light disguised as own emission.

The complete Iris contract is NOT implemented: authoritative world/weather/player
uniforms, semantic IDs, complete instance/atlas bindings, program stages and pack
buffer rules are still missing. `irisContractComplete` stays false. No pack is
executed. These data cannot be made identical by fabricating missing Bloxd state.

## Verification Boundary

The agent never starts or operates a client, preview, browser or account. Pure
checks demonstrate packet/math/state correctness, not visible Minecraft parity.
Image and performance validation is performed solely by the user. The engine
goal remains open; 0.6.19 is another engine development increment, not completion.

## 0.6.12 Camera And Textures

Camera history stores only successfully rendered frames, not every received
source camera packet. It includes canonical full-Z projection and inverse,
source-local view and inverse, an eye-relative view, prior view adjusted into the
current render origin, prior projection and camera. High/low origin components
are summed as doubles. Unknown origins remain marked unknown. Fallback, resize
and changed origin availability invalidate temporal history. This does not claim
the source-local or eye-relative matrix is already every Iris feet-player-space
uniform. Final pack bindings remain separate; see
[Iris matrix semantics](https://shaders.properties/current/reference/uniforms/matrices/).

Textures preserve the twelve source sampling modes and source sRGB storage.
Native mip chains are generated from imported base pixels only when dirty,
once per render batch; dimensions and full mip memory are bounded. This does
not reproduce arbitrary custom source mip content or anisotropy. Ordinary block
rendering samples the true array, avoiding adjacent 2D-atlas tiles at lower mip
levels. The padded 2D atlas is retained for future pack-coordinate work.

The atlas animation adapter preserves the source parameter table and exact
tick/stride/interval formula. Required animation frames are prefetched as
textures only, without extra chunks. Clock changes preserve mesh, pixel and
parameter-buffer storage and do not invalidate ownership each tick. No
authoritative world time is inferred from this texture animation clock.

## 0.6.13 Special Materials And Particles

Cape deformation reads the source joint array and max-Y define; the original
vertex Z provides the pivot. Poses update existing geometry after morphing.
Combined cape/skeleton or submaterial layouts remain unsupported. TextSampler
preserves LOD bias, texture unpremultiplication and source premultiplied output.
Enchantment preserves independent color/speed/node attributes, source clock,
procedural noise and pre-fog color mixing. This is Bloxd's source effect, not
Minecraft glint or execution of a shaderpack.

Basic world-space CPU particles read source positions/colors/size/scale/angle;
capture never advances simulation or inserts meshes into the source scene.
Transforms and colors arrive in one bounded, validated packet. Billboards use
the actual view/inverse view and pivot. Source system order, additive/standard
blends, fog and explicit depth-write policy are retained. They draw scene color
after opaque depth retention and before translucency, not surface metadata or
shadows. GPU, non-ALL billboard, local, sheet, ramp, custom mask/program/group and
non-neutral image-processing cases retain whole-scene source fallback.

Render groups and temporary hand projection overrides now explicitly prevent
handover instead of being silently drawn with the main world camera. These
paths still need implementation. `irisContractComplete` remains false.

## 0.6.14 Observed Draw Contract

Groups -1..3 now preserve source depth reset policy and recognized comparator
identities, including Bloxd's material-ID transparent sorting rather than an
assumed generic distance sort. Ordering values are doubles; source sphere centers
are separate from compact imported submesh bounds. A read-only source pre-draw
observer snapshots actual view/projection/camera data, only on the main canvas.
Positive groups and camera-attached/ignoreCameraMaxZ output require fresh,
matching, invertible observations. No source camera or FOV is modified.

Supported hand/overlay draws need an isolated positive group; mixed world-group
overlays, unknown sorting and missing/stale observations keep fallback. Native
draws use their own matching frustum/camera, do not cast/receive world shadows,
and preserve world surface metadata and the retained world opaque-depth copy.
Later draws restore the main camera. Rebase compensation covers observed data,
but previous per-object/instance state and final Iris hand semantics remain open.
This is not shaderpack stage execution or proof of Minecraft image equivalence.

## 0.6.15 Extended CPU Particles

The actual active CPU ParticleSystem upload contract now covers ALL, Y,
stretched, local-stretched and nonbillboard fixed-direction geometry. Local
positions are already source-world positions; only fixed local directions use
the actual emitter normal transform. Source world/floating offsets are retained.
Animated sheet cells use actual source dimensions/cell index, flipped UV rows
and the noninstanced epsilon for both geometry and UVs. Capture copies source
data without advancing simulation or mutating particle directions/scene meshes.

Extended batches carry pivot, texture mask, direction, UV rectangle/inset and
color together, including bounded HDR RGB. Neutral transitions explicitly clear
old extended state. Unchanged native buffers are reused; a cell-only change
uploads appearance, not transforms/static geometry. Particles still write scene
color only, in source system order, without world metadata or shadow casting.

GPU/ramp/multiply/custom programs, unknown directions, degenerate alignments,
custom cameras, clip/log-depth and non-neutral image processing retain fallback.
Sprites and the final Iris particle/uniform/stage contract remain unimplemented.
209 pure tests, CPU mocks and eleven shader checks are not real image/FPS proof.

## 0.6.16 Ramps And Particle Blending

Actual CPU ramp textures are imported as secondary sampled resources, with
source color/alpha remap ranges. Multiply uses the original unmasked texture
alpha times particle alpha, not the ramp-remapped alpha, before source fog.
MultiplyAdd draws an entire multiply batch then an additive batch in the same
source-system slot. Subtract and actual alpha accumulation factors are retained.
Missing textures block native ownership/output; shared ramps stay alive until
their last reference and neutral changes clear old state together.

These are Bloxd source effects, not Iris particle stages. GPU particles/sprites,
authoritative world/player/weather values, semantic mapping and full pack
program/buffer binding remain unfinished. No synthetic replacements are enabled
to label those contracts complete. 217 pure tests, CPU mocks and eleven shader
checks passed; no live client/GPU/image/FPS comparison was performed.

## 0.6.17 Temporal Object Foundation

World reprojection now uses prior successful object transforms and CPU poses,
not just a prior camera. A sixth native motion target carries backward UV motion,
half-float prior normalized depth and validity; it is not a named Iris colortex
or enabled temporal effect. Camera and object origins are compensated together.
Pose snapshots are lazy, shared CPU/GPU reservations are capped at 64 MiB and
static terrain is not copied. Only fully successful draws become history.

New/missing objects, changed unidentified thin-instance slots, fallback, resize,
depth conventions, custom cameras and invalid projections are explicitly marked
unknown. Moving thin-instance identity, reference coordinate bindings, prior
frame depth/color history and actual pack-stage consumption remain open.
219 pure tests, expanded CPU mocks and eleven GLSL checks do not prove live parity.
The original standard Bloxd mode remains separate and receives no native code.

## 0.6.18 World Image/Depth Foundation

Native passes can request two-slot previous-world history, keeping HDR world
color after its transparency separate from exact 32F opaque depth and later
hand output. Validity matches the prior successfully completed camera/object
frame; failed copies/presentation never overwrite that frame. Resize, fallback,
scene/depth changes and skipped zero-sized output invalidate it. Storage and
copies are demand-driven: no existing pass enables them. Target memory remains
bounded to 512 MiB, including both slots when requested.

This removes the lack of a native prior-color/depth storage mechanism, not the
remaining Iris render-buffer lifecycle/format/ping-pong binding contract. It is
not enabled TAA, disocclusion filtering or a ready shaderpack pipeline.

## 0.6.19 Native Fullscreen Runtime

`bridge_postprocess.hpp` implements independent logical targets 0-31, each with
main/alternate storage. Fragment output location N maps to the Nth requested
logical target rather than using that target's index as a physical attachment.
Reads use main, writes use alternate, and successful GL checks precede each
requested flip. Explicitly disabling a flip preserves the sampler side. Physical
draw/attachment and fragment texture-unit limits still apply.
These choices follow the documented [color buffer model](https://shaders.properties/current/reference/buffers/colortex/),
[output routing](https://shaders.properties/current/reference/constants/rendertargets/)
and [flip/size rules](https://shaders.properties/current/reference/shadersproperties/rendering/).

Explicit descriptors select supported R/RG/RGBA normalized 8/16-bit, float
16/32-bit, signed and unsigned integer 8/16/32-bit formats. Integer clears use
typed GL entry points and integer buffers reject linear filtering. Unsupported
formats are rejected. Both sides are initialized; per-frame clears can be
disabled to preserve contents. Defaults use fog/alpha 1 for target 0, ones for
target 1 and zeros otherwise. Custom clears, independent fixed/relative axes,
exact rectangular mip-chain budgets and dirty mip regeneration are supported.
See [clear rules](https://shaders.properties/current/reference/constants/buffer_clear/),
[clear colors](https://shaders.properties/current/reference/constants/buffer_clear_color/),
[formats](https://shaders.properties/current/reference/buffers/image_format/)
and [mips](https://shaders.properties/current/reference/constants/colortex_mipmaps/).

The native renderer now accepts an internal list of already compiled fullscreen
passes after its source draw groups. Bindings explicitly select native scene,
opaque metadata, current/opaque depth or matching prior-world color/depth;
temporal bindings automatically request history and require a validity uniform.
A selected floating/normalized logical result resolves back to scene color only,
so embedded readback and preview output consume the result. The existing preview
identity final pass also uses this executor. Source capture/presentation are
unchanged. No default effect list or scratch descriptors are installed, so the
shipped embedded path adds no scratch/history textures or extra draws/copies.

Scratch pairs are not a completed-frame archive: an aborted frame invalidates
all persistent scratch contents and both sides clear before recovery. The
separate world-history archive still preserves its completed slot. Failed or
partial allocation preserves working scratch resources, and all frame targets,
history and scratch mip storage share the existing 512 MiB target budget.
Stable descriptors reuse resources and cached GPU limits; pass routing uses
fixed arrays rather than creating temporary routing vectors every frame.

This is a functioning native postprocess runtime, not the complete reference
stage scheduler, a GLSL pack translator, parser, loader, compute/image runtime
or full Iris uniform/geometry binding. Native history is explicitly the world
before hand and postprocess output, not an invented pack buffer assignment.
`postprocessContract=1`; `irisContractComplete=false`. The completion gates below
still apply. CPU mocks verify routing/state/identities, not rendered pixels.

## Remaining Completion Gates

1. Native source coverage: GPU variants outside the pinned q9aot formula/world-group/sampler/budget contract,
   sprites (actual renderer/layout/application evidence absent from the audited
   bundles), unknown programs and remaining
   entity/camera variants, with explicit fallback until each is supported.
2. Authoritative world/player/weather values and Minecraft block/property/own-
   emission semantics, rather than guessed values or arbitrary Bloxd IDs.
3. Complete coordinates/vertex/instance contracts, including identifiable moving
   thin instances, general quad centers and authoritative offscreen shadow input.
4. The explicit engine graph now executes the requested stage order, five depth
   boundaries, logical world/shadow outputs, compute/images/SSBOs and failure-safe
   clear/flip/persistence. Remaining reference binding gates: complete geometry
   source adapters and authoritative vertex/uniform semantics for the implemented
   geometry program table; current proven reference HUD-FOV/far/hurt/view-bob for the implemented
   reference hand projection (clear-hand groups supported conditionally);
   setup/custom multidimensional images/comparison
   samplers/additional formats and viewport/blend options, complete shader
   reflection beyond the new bounded core geometry interface, dedicated history
   consumers and production recipe activation.
   See the exact supported/rejected contracts in IRIS-RENDER-GRAPH.md. Shaderpack
   loading remains a later separate mod and does not close these engine gates.
5. User-operated GPU/image/FPS acceptance against the pinned reference. CPU mocks
   and compilation alone cannot establish image parity or performance.

The whole renderer is not finished until these gates are closed. No percent-
complete estimate or unconditional 1:1 claim is supported by current evidence.
