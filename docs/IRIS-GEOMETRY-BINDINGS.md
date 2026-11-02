# Iris geometry bindings (0.6.19 development increment)

22 October,0.6.39: canonical contract3 extends the internal PackBlockId producer
to ten exact stair families and Jungle/Cherry door halves. Facing/half/shape/
hinge/open are explicit; door power is unknown and requires consensus across
both Boolean completions. Existing registration/frame/upload guards and range
merging apply through actual world/shadow callbacks; no new GPU bindings or
production recipe. [SHAPED-BLOCK-MAPPING.md](SHAPED-BLOCK-MAPPING.md).

21 October,0.6.32: optional exact integer PackBlockId from an explicit immutable
preprocessed pack table now reaches world/shadow draw constants for proven
terrain ranges. Known0/unassigned−1/unknown differ; no raw source IDs become
reference IDs. Generic/hand/unapproved-instance paths remain unknown. Only
consumed resolved values split runs. The combined SemanticIds and mc_Entity
attribute remain unavailable; no production loader/recipe is installed.
Canonical slab waterlogged=false is now explicitly supported for the six mapped
families. [PACK-BLOCK-MATERIAL-IDS.md](PACK-BLOCK-MATERIAL-IDS.md).

21 October,0.6.31: the current source material descriptor can now retain an
explicit canonical Minecraft identity (30 complete cubes/6 partial slab
families). Mapping is computed once per bounded dictionary entry, with static
reference strings. This does not add a GLSL binding or change existing range
coalescing; SemanticIds remains unknown pending pack-specific resolution.
Exact reference/source evidence and limits:
[MINECRAFT-BLOCK-MAPPING.md](MINECRAFT-BLOCK-MAPPING.md).

21 October,0.6.30: source-only RootId/Properties/State constants now consume
observed, frozen source metadata and effective properties through type33/v5.
Exact names remain in the native dictionary; no Minecraft semantic ID or name
is inferred. Required/optional bindings and consumed-field range merging are
covered by actual world/shadow CPU callbacks. [SOURCE-BLOCK-MATERIALS.md](SOURCE-BLOCK-MATERIALS.md).

20 October, 0.6.29: `SourceBlockId` is a source-prefixed integer draw constant
with independent bool validity. It uses proven type33/v4 terrain identities or
preserved observed instance lifetimes, never `mc_Entity`/Minecraft semantics.
Block-only consumers receive exact ranges; RGB-only consumers merge unused ID
boundaries. Required/optional freshness and commit gates also cover this input.
See [SOURCE-BLOCK-IDENTITY.md](SOURCE-BLOCK-IDENTITY.md).

19 October, latest, 0.6.21: GeometryUniform::SourceOwnEmissionRgb now covers individually proven faces within mixed terrain groups. Exact source triangles survive index/submesh remapping; type33/v2 authorizes dense EBO index runs for that exact type-3 generation. RGB and bool validity are draw-constant uniforms in actual world/shadow draws, explicitly outside interpolation. Known zero is valid; ambiguous greedy faces bind zero/false and required unknown aborts without commit. No new GPU buffer or reference scalar/ID mapping. Type33/v1 and layouts1–32 remain unchanged. No production pack recipe or shaderloader. [SOURCE-EMISSION.md](SOURCE-EMISSION.md) specifies provenance, limits and remaining variants. Earlier audit statements below describe historical states.

19 October ingress repair: existing source-light bindings are now reached through the actual native type-32 pipe gate in CPU verification, including fragmented Capture-generated light/GPU payloads and world/shadow draws. No new emission uniform or geometry variant is enabled. The proven worker reply preserves block copies; its register initialization join remains open. Details: [SOURCE-EMISSION.md](SOURCE-EMISSION.md).

17 October 2026. Internal linked geometry programs now execute in the real
Renderer graph callbacks. No recipe is installed automatically, no shaderpack
is parsed or loaded, and `irisContractComplete` remains false.

18 October emission audit: no geometry variant gains own RGB or a new binding.
The pinned mesher/registry/instance producers do not preserve a complete
generation association; see [SOURCE-EMISSION.md](SOURCE-EMISSION.md) and its
coverage matrix. Expanded CPU world/shadow draws verify that optional
OwnEmission clears stale values with false validity even with nonzero material
tint, source lights and instances. Required emission still aborts without commit.

The q9aot GPU source adapter now executes real instanced analytical draws in
WorldTranslucent through an explicit source-color target. It is separate from
this reference geometry program table, has no invented Minecraft semantics and
never draws in hand/shadow phases. Sprites remain unsupported. Exact scope,
atomic snapshot and tests: [SOURCE-EFFECTS.md](SOURCE-EFFECTS.md).

Latest increment: the experimental read-only source provider now supplies
render-sampled player feet/eye target, exact origin and actual observed hand
matrices through atomic validated BND1/30 transactions into `IrisGeometryFrame`.
Frame/scene/camera/player/origin identity, freshness and viewport must agree.
An explicit `HandProjectionMode::ObservedSource` consumes source projection
with reference depth compression; the default `Reference` mode still fails
without proven reference HUD-FOV/far/hurt/view-bob. Source observations never
set `hand.known`. Provenance, packet layout, verification and remaining semantic
gates: [SOURCE-FRAME-DATA.md](SOURCE-FRAME-DATA.md).

18 October: coherent source world lighting now reaches explicit typed
Gbuffers/Shadow uniforms through atomic type 32/v1 (unchanged embedded type 30
or 31). Source RGB sky/ambient, held RGB/range and position-or-cone direction,
lighting switch and Earth-sky direction retain their actual meanings. No
reference world time/weather/lightmap/emission gate is unlocked. Snapshot,
replay/expiry/commit rules and the per-candidate evidence matrix are in
[SOURCE-FRAME-DATA.md](SOURCE-FRAME-DATA.md). No production recipe is enabled.

## Reference and projection

Target: Minecraft Java 26.3 / Iris 1.11.7, Modrinth `vTN4NRGW`. The existing
SHA512-verified JAR was read as a ZIP, never installed or executed. The pure
class parser additionally inspects HandRenderer, MatrixUniforms, CommonUniforms,
IrisSamplers and ShaderKey. `tools/inspect-iris-reference.cjs` verifies the actual
HandRenderer setup call order and float constants 0.125, 0.4375 and 0.05.
Evidence: `outputs/iris-reference/geometry-reference-contract.json` and
`docs/iris-geometry-reference.json`.

The [pinned HandRenderer source](https://github.com/IrisShaders/Iris/blob/671a5c87747d33983d7ed659461a64f46dfcb1f0/common/src/main/java/net/irisshaders/iris/pathways/HandRenderer.java)
is supporting source, not an established exact-release source tag: this branch
still declares 1.11.6. The relevant hand constants/calls are corroborated in the
actual 1.11.7 artifact. Hand setup uses HUD FOV, near 0.05, depthFar, viewport
aspect and the supplied hurt/view-bob matrix. It does not use world FOV.

The reference first left-multiplies the zero-to-one projection by a matrix
with `m22 = 0.125`, `m32 = 0.4375`. With `N` converting zero-to-one clip Z to
minus-one-to-one, `N * C * inverse(N) = diag(1, 1, 0.125, 1)`. The canonical
implementation is therefore `C_NO * perspectiveRH_NO * bob`, with clip Z
negated for native reverse depth. XY/W and depth range remain unchanged. This
compresses canonical NDC Z to [-0.125, 0.125], not to a guessed near-only band.
`gbufferProjection` remains the uncompressed world projection; the per-draw
`projectionMatrix` is the hand projection. See also the
[reference matrix interface](https://shaders.properties/current/reference/uniforms/matrices/).

`IrisGeometryFrame` carries explicit source-camera-frame/scene/origin identity.
Its hand input defaults to unknown. Missing/stale HUD FOV, far or bob data is an
error when a Reference hand draw is needed. An identity bob is valid only when explicitly
provided as known. No source FOV extraction or invented player motion occurs.
The new observer supplies actual source data, not a claim that Bloxd exposes
Minecraft's independent hand inputs. ObservedSource is selected explicitly and
never automatically substitutes for a required reference projection.

## Programs, attributes and resources

`IrisPlan::programs` is an optional table of borrowed, linked, immutable vertex
and fragment programs. `GeometrySlot` follows the supported
[ProgramId fallback edges](https://github.com/IrisShaders/Iris/blob/671a5c87747d33983d7ed659461a64f46dfcb1f0/common/src/main/java/net/irisshaders/iris/shaderpack/loading/ProgramId.java):
terrain solid/cutout to terrain, water to terrain, hand-water to hand,
entities-translucent to entities, block-translucent to block, and corresponding
shadow families to shadow. Missing terminal programs fail. An invalid existing
program is never silently replaced by its fallback.

Terrain classification uses the existing source terrain contract. Hand and
transparency come from actual source draw state. Other meshes remain generic
basic/textured/textured-lit unless an internal authoritative adapter supplies a
GeometryRole. A generic source ID is never interpreted as a Minecraft entity or
block-entity ID. Explicit roles can select entity/block/item variants; the
current wire protocol does not newly populate them.

Before drawing, reflection checks linked status, attached vertex/fragment
stages, every active attribute/uniform and its scalar/vector/matrix/sampler
type, uniform names/locations, physical attribute spans, sampler-unit collisions
and active fragment output locations/types. Undeclared resources, arrays,
uniform/storage/atomic blocks, tessellation/geometry shaders and fragment-depth
outputs are rejected. This is a bounded core-profile interface, not a legacy
GLSL translator or arbitrary pack reflection engine. Reflection currently runs
per recipe frame; no performance claim is made for this experimental path.

| Binding | Runtime meaning |
| --- | --- |
| Position, normal, UV0, color | Actual imported source streams, explicit program locations |
| Instance matrix and extras | Four divisor-one columns, 72-byte source stride, layer/light override; explicit identity stream for a non-instanced draw |
| Tangent, midpoint, mid-block | Existing source-derived extended buffers; incomplete quad/center data rejects the requested attribute |
| Source surface / source integer lightmap | Distinct raw source inputs; source IDs are not `mc_Entity`, RGB-derived light is not an authoritative Minecraft lightmap |
| Model/view and inverse, normal matrix | Current world/shadow/observed-hand view times object world transform; instance composition and inverse-transpose instance normals are explicit shader operations |
| Gbuffer model/view | Only with known absolute player-feet coordinates and known render origin |
| Previous reference matrices | Only from a successful preceding geometry frame, matching camera history; previous feet and view are expressed consistently through rebase |
| Gbuffer projection / inverse | Canonical world projection, including half-Z conversion exactly once |
| Shadow matrices / inverses | Actual matrices used by the graph shadow pass; player-relative view requires known feet, projection requires a known sun |
| Texture matrix | Converts source `(u,v,1,0)` input to reference `(u,v,0,1)` convention |
| Lightmap matrix | Reference coordinate normalization only; it does not fabricate light levels or a lightmap texture |
| SourceLightingEnabled / SourceSkyLight / SourceAmbientLight | Current atomic source switch and RGB coefficients; unknown required fails, optional zero plus bool validity |
| SourceHeldLight / SourceHeldVector | Source RGB 0–15/range and local position or unit direction selected by cone cosine; same origin/frame |
| SourceSkySunDirection | Actual Earth-sky world-axis direction; no reference sun position, radiance, world-time or shadow-enable equivalence |
| Material sampler | Actual plain texture, native array, or explicitly requested padded 2D atlas |
| Graph samplers | Declared color/shadow/depth domains and numeric types; producer availability, current-side feedback and mip rules checked |

A separate reusable VAO prevents mutation of imported native VAOs. Unused
attributes/divisors are reset between programs. The only extra vertex storage
is a 72-byte identity instance record allocated on demand; it is released with
the binder or when the graph is removed. No vertex/instance payload is copied
per draw. The internal GLSL fixtures in `bridge_geometry_shaders.hpp` exercise
plain material and explicit atlas/instance adapters. They are compile fixtures,
not production effects or pack programs.

The atlas fixture transforms UV and recoverable partial-quad midpoint together,
normalizes instance normals, preserves tangent handedness, transforms source
block offsets and handles actual instance layer/light overrides. Raw source
emission remains -1/unknown. Repeating out-of-tile UVs, sRGB atlas storage and
atlas mip chains currently require a dedicated adapter and fail explicitly;
the native array path remains available. Missing lightmap/PBR maps fail rather
than binding fabricated neutral maps. Special source appearances, sky, particles,
animated material atlases and unclassified world cameras remain unsupported by
this geometry binding increment, even where the separate native adapter supports
them.

Unknown world time (integer), weather, player state, Minecraft semantic IDs,
own emission and reference lightmap values are never substituted with native
animation clocks or propagated RGB light. Optional internal uniforms require an
explicit boolean validity location and receive zero plus false on every draw.
A required unknown uniform aborts the frame. Zero without validity is not an
accepted unknown value. Required unknown Minecraft attributes are rejected.

## Graph, depth and failure boundaries

Geometry writes explicitly selected **current** logical output sides; compact
fragment locations are independent of logical indices. Programs may use sparse
targets without installing the six native Gbuffer outputs. Geometry cannot flip
targets. Fullscreen flips still determine the sides used by later geometry.
Storage formats and dimensions must match the reflected output contract.

Order remains shadow opaque, shadow-depth snapshot, shadow translucent, world
opaque, `depthtex2` snapshot, opaque hand, `depthtex1` snapshot, Deferred, world
translucency and translucent hand. Hands never cast world shadows. A single
isolated observed source hand group may now request ClearDepth **when the new
geometry binding and current reference hand input are available**: the native
clear is omitted, because reference compression shares the depth buffer.
The legacy native geometry adapter still rejects clear-hand groups. Mixed
positive world/hand groups and inconsistent group policies continue to fail.

An Iris hand program may sample retained `depthtex2`, but cannot sample its
attached `depthtex0`. MRT writes are the program's declared contract, including
hand/transparency outputs; the native adapter's one-color hand policy is not
imposed on Iris programs. Shadow snapping uses graph shadow resolution rather
than the legacy native target's size.

GL state restoration includes ARRAY_BUFFER and all touched sampler objects in
addition to textures, VAO, program, FBOs, images, SSBO ranges, viewport and raster
state. Source/native VAOs retain their element/attribute state. A failed draw,
binding, final pass, presentation or state restoration prevents graph, camera,
object and reference-feet history commit. Resize/fallback invalidates temporal
validity; known rebases preserve matching reference coordinates. Graph target
allocation/resize peaks remain within the existing shared 512 MiB cap.

## Verification and remaining gates

Allowed verification: 219 Node/DOM/VM tests, expanded BridgeCpuTests, eight
native/presenter/graph/geometry GLSL compile/link checks, MemoryBudgetTests and
native compilation. CPU mocks inspect actual renderer draw calls, programs,
attributes/divisors/integer pointers, matrices, sampler identities, current-side
sparse routing and depth snapshots. Tests cover half-Z/reverse-Z, opaque and
transparent hands, rebase/resize, unknown and stale inputs, reflected mismatches,
sampler feedback, all six draw-phase failures and state restoration. They do not
render pixels or demonstrate image/FPS parity. Reports remain under
`outputs/native-renderer-verification` and `outputs/launcher-verification`.

Open production gates: authoritative reference hand/world/weather/Minecraft
semantics and actual reference lightmap/PBR data; complete special-material,
sky/entity/particle coverage and their program adapters; general original-quad
and moving-instance identity; reference shadow directives/offscreen casters;
remaining optional graph features and broader pack interfaces; a validated
production recipe and dedicated history consumer; user-operated GPU/image/FPS
acceptance. The shaderloader remains a separate later mod. Default Bloxd mode,
original modules, distance 10 and ownership safeguards are unchanged. Capture
and experimental transport now include type 30; layouts 1–29 remain compatible.
