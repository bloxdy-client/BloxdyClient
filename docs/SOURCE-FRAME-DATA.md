# Authoritative Bloxd source frame — 0.6.19 development

21 October,0.6.30: bounded observed source name/family/state and render-property
delivery is now implemented through type33/v5, preserving all earlier frames.
The source registration/initialization lifetime and explicit null encodings do
not establish Minecraft mappings, world time/weather, reference hand/lightmap
or scalar emission. [SOURCE-BLOCK-MATERIALS.md](SOURCE-BLOCK-MATERIALS.md).

20 October, 0.6.29: independent raw source block identities now reach the actual
Iris world/shadow draw bindings through type33/v4 and preserved instance proofs.
This does not supply reference material IDs, world time/weather, scalar emission,
lightmap or reference hand inputs. The new complete step-1 status matrix and
14-bundle/15-excerpt audit are in [SOURCE-BLOCK-IDENTITY.md](SOURCE-BLOCK-IDENTITY.md).

19 October, latest: bounded own RGB block emission is now integrated through observed meshingInit/job replies, exact geometry upload sequences and atomic type 33/v1 wrapping unchanged frames 30/31/32. Uniform center-owned terrain groups and their submesh exports reach SourceOwnEmissionRgb in world/shadow draws. Missing/mixed/instanced associations remain unknown; scalar OwnEmission remains unknown. See [SOURCE-EMISSION.md](SOURCE-EMISSION.md). The following audit/ingress paragraphs describe the preceding state; their missing-initialization claim is now closed only for actually observed, validated worker initializations.

19 October correction: the native pipe framing gate now accepts existing type 32 (its previous upper bound was 31). Actual Capture light and light+GPU fixtures traverse fragmented CPU pipes before decoding and draw verification. Layouts and frame/light semantics remain unchanged. The full worker reply does retain job block copies; its initialization register join remains unproven. See [SOURCE-EMISSION.md](SOURCE-EMISSION.md). 248 pure tests, native CPU tests and ten GLSL checks pass.

18 October 2026. Target remains Minecraft Java 26.3 / Iris 1.11.7.
`sourceFrameContract=1`, `irisGeometryContract=1`, `irisContractComplete=false`.
Only the experimental adapter changes. No production recipe, shaderloader,
version, installer, simulation or source-state update is introduced.

Latest 18 October follow-up: [own-emission provenance audit](SOURCE-EMISSION.md).
Eleven pinned bundles and eighteen text excerpts establish the precise missing
generation joins for ordinary/greedy terrain, submeshes and shared instances.
No own-RGB provider or new wire layout is implemented. Current register data
cannot label older installed geometry. Expanded actual world/shadow CPU draws
verify optional OwnEmission reset and required failure without history commit;
246 pure tests and ten GLSL checks pass. Existing frame/light/GPU paths remain.

The q9aot GPU source adapter is now integrated; see [SOURCE-EFFECTS.md](SOURCE-EFFECTS.md).
Type 30 remains unchanged. Atomic type 31 contains a complete type-30 source
frame plus observed GPU draws; native analytical evaluation is expressly
allowed using the exact source time. Sprites remain unsupported.

## Latest increment: coherent source world-light inputs

`sourceWorldLightContract=1`. The complete bounded chain is implemented:
q9aot source fields at an actual selected world mesh pre-draw -> immutable
completed-frame snapshot -> atomic BND1/32 -> JS/native validation ->
`IrisGeometryFrame.light` -> typed uniforms in actual Gbuffers/Shadow geometry
draw callbacks of the existing experimental Iris graph. No production recipe
is installed. Fullscreen/compute interfaces are not extended by this increment.

The source audit reads **eleven existing local public bundles**, verifies their
recorded SHA-256, and records sixteen excerpts with UTF-16 offsets, lengths and
hashes. It never imports or executes source modules. Reproduce with
`node tools/audit-source-light.cjs`. Evidence and the per-candidate coverage
matrix are in [bloxd-source-light-reference.json](bloxd-source-light-reference.json);
the literal excerpts are in `launcher/tests/fixtures/source-light-2026-10-18.json`.
This inventory concerns those exact files, not every possible Bloxd deployment.

| Candidate / source call site | Proven unit and meaning | Implemented consumer / remaining evidence |
| --- | --- | --- |
| Renderer `yy`, option `applyLighting`, global uniform writer | Boolean source lighting switch. Explicit false is known disabled. | `SourceLightingEnabled` (`int` with validity). No assumed switch when absent. |
| `Ds(renderer, array)` writes `uSkyLightColour` / `uAmbientLightColour` | `skyLightColourOverride ?? sm` / `ambientLightColourOverride ?? ym`, each component raised to `visionMinLightColour` when present. Source RGB shader coefficients; no assumed color-space conversion. | `SourceSkyLight`, `SourceAmbientLight` (`vec3`). Joint valid group only when lighting is enabled and all inputs are finite/in range. |
| Held-light component update -> `XY`, `WY` -> uniform writer | RGB levels **0–15**; W is range override. Zero range selects the source shader's maximum-color-component range. In cone mode the source uses `pow(distance, .75)`, so W is not universally a Euclidean block radius. | `SourceHeldLight` (`vec4`), jointly valid with the vector/cone group. |
| `Hy.prototype.render` updates `pY` before calling the scene render | `FY == 0`: local render-feet position in source blocks. `FY > 0`: normalized view direction from `camera.Ne()`. `FY` is the cone cosine. The adapter reads results and never calls `render` or `Ne`. | `SourceHeldVector` (`vec4`). Origin/frame must match; native code does not shift a direction or relabel a local position as absolute. |
| `updateSunDirection` -> `Tf`, source shader runtime `Tf()` | Unit direction from Earth sky inclination/azimuth/up or explicit sun position. This is a world-axis sky direction, not reference view-space `sunPosition`, radiance or world time. | `SourceSkySunDirection` (`vec3`). Only actual unit-length `Tf`; null stays unknown. The source runtime's fallback direction is deliberately not used. |
| Directional writer `Zs(lights, lightsEnabled, packed)` | Per-material light selection/count, enabled/transformed direction and grayscale scaled intensity. Not a unique astronomical sun. | Existing bounded appearance adapter retained. An authoritative per-draw writer snapshot and program-specific association are still required for a new global/reference binding. No first-light-as-sun equivalence is claimed. |
| Source runtime `time()`, AnimTicker, day/night sky component | Runtime time is `performance.now()/1000 % 3600`; AnimTicker advances from zero every 100 ms. Day/night meshes use sky settings. | **WorldTime remains unknown**: no server/world epoch, day counter, world tick rate or synchronized update chain is proven. No clock derived from sky direction. |
| Weather / rain / wetness | No authoritative producer, unit and update chain in the audited evidence. | **Weather remains unknown**. Missing terms/fields do not mean clear weather. |
| Source block emission API -> registry -> mesher/lighting worker | Separate RGB nibbles 0–15 and a separate sky emission channel. Worker lookup uses source blocks; propagated maxima are distinct from own emission. | **OwnEmission remains unknown for imported primitives**: missing primitive-to-block/registry-generation join for greedy, mixed and instanced surfaces, and no justified RGB-to-reference-scalar equivalence. Bloxd IDs remain separate. |
| Packed terrain/entity light -> source shader transfer | RGB nibbles plus sky nibble, divided by 15 and processed by source spread/transfer. Material emissive tint is also distinct from a block's own emission. | Existing raw source attributes/material paths retained. **ReferenceLightmap remains unknown**: neither an authoritative scalar Java block-light channel nor its actual lightmap texture is proven. |

No newly proven **Minecraft/Iris semantic equivalence** is claimed. This closes
the source-data delivery and actual geometry-binding gap for the six explicit
source inputs above. The reference world/weather/lightmap/emission gates remain
closed, including when all source light inputs are available.

### Observation and atomic type 32/v1

Read-only `onBeforeDrawObservable` observers sample ordinary selected world
meshes (group 0, actual main framebuffer, no custom/hand camera). The pinned
renderer constructor/render layout and root/scene relationships are guarded;
replacement functions invalidate the cached guard. Multiple observations in a
source render must agree on lights, root, player, camera, origin, matrices,
viewport and depth convention. The completed-render observer checks that tuple
again. Missing/conflicting observations yield no valid light group. Values are
copied, never retained as mutable source arrays or recomputed during export.
Later field changes do not alter the saved frame; even the camera clear color
comes from the completed snapshot. No source simulation/update method is called.

The 104-byte envelope before the embedded packet is:

1. Unchanged 16-byte BND1 header, type **32**.
2. Five uint32 words: epoch, version **1**, embedded byte length, availability
   flags, enabled (0/1).
3. Seventeen Float32 values: sky RGB, ambient RGB, held RGB/range,
   held XYZ/cone cosine, sky sun XYZ.
4. One **complete unchanged type 30 or type 31 packet**, including its header.
   No recursive envelopes. Old layouts **1–31 are preserved**.

Availability bits: 1=lighting switch, 2=joint sky/ambient, 4=joint held group,
8=sky direction. Unknown fields must be zero and unknown switch must be zero;
these zeros are sent with false validity, not asserted as real light values.
Color/held groups require a known enabled switch. Sky direction is independent.
Nested framing, epoch, lengths, source flags, finite/ranged values, unit vectors,
all particle records and existing camera/player rules are validated before any
new state is accepted. The **entire envelope remains at most 1 MiB**. No new
textures, vertex buffers, render targets or GPU allocations are introduced.

Freshness uses the earliest light/GPU observation and the existing 250 ms
wall/monotonic deadline, including transport time. Native validation requires
current origin and a fresh completed source frame. A scene-scoped source-render
high-water mark survives intervening legacy/unknown camera packets: neither a
new serial nor an unknown packet can revive an already observed source render.
Scene reset clears that mark. Malformed/replayed/stale type 32 revokes current
light validity; a combined GPU failure also revokes GPU readiness without
accepting a new camera/serial. Scene-mismatched packets are ignored.

Bindings check scene/camera-frame/origin/viewport/expiry at each draw. Unknown
required inputs fail; optional inputs are explicitly zeroed and receive a bool
validity on every bind. New source uniforms must use a `source` name prefix;
they cannot impersonate reference uniform names. Rebase/resize/ownership loss
require fresh coherent samples. Expiry after a light-consuming draw but before
commit fails the frame. Geometry, final, restore and combined GPU upload errors
cannot commit graph/camera/object/feet/history state.

### Verification and next coherent step

244 Node/DOM/VM tests, expanded BridgeCpuTests, ten GLSL compile/link checks,
MemoryBudgetTests and a native build are the verification set for this increment.
Actual Capture bytes (`source-light.bin`, `source-light-gpu.bin`) pass the JS
transport validator and native decoder; only CPU-fixture freshness timestamps
are renewed. Real Renderer entry points are exercised with CPU GL mocks for
Gbuffers/Shadow uniform values, units/validity, required and optional unknowns,
expiry before commit, replay across unknown-camera packets, rebase/resize,
fallback/recovery, half/reverse-Z, partial GPU upload and final failures. CPU and
q9aot GPU particle paths remain covered by the existing tests and a combined
capture fixture. No client/account/browser/graphics context is started. These
are no image/FPS proofs. The prior legacy MSVC local-variable warnings remain.

Reports: `outputs/source-light-verification.json`, existing launcher/native
verification reports and `outputs/world-light-work/build-final.log`.
The next coherent step is the **source primitive-to-block/registry-generation
association for own RGB emission**, preserving unknowns for ambiguous greedy
or instanced faces, before any reference scalar-emission decision.

The following sections describe the preserved type-30 player/hand contract.

## Evidence and meaning

`tools/audit-source-frame.cjs` reads the existing anonymous public q9aot bundles
as bytes, verifies their recorded SHA-256 and extracts sixteen text excerpts.
It never evaluates bundles or initializes modules. Exact URLs, bundle hashes,
UTF-16 offsets and excerpt hashes are in `bloxd-source-data-reference.json` and
`launcher/tests/fixtures/source-frame-2026-10-17.json`. The pinned profile is
`bY / Lj / hY.le().OI / camera.cI`; historical `Dw`/other obfuscations are not
assumed to share these field meanings. Structural method/layout guards must
match. Changed or ambiguous layouts supply unknown data.

| Value | Actual source and evidence | Unit / space / meaning | Sampling and use |
| --- | --- | --- | --- |
| Local player identity | Root constructor creates `bY` with `entities.add`; `hY === entities` | Local ECS identity, **not** Minecraft entity/semantic ID | Sampled with its position component object identity; identity only |
| Tick feet | Position component `position`, `vD`; `WI` and position system add `component.Lj ?? root.Lj`; bounds use Y through Y+height and X/Z +/-width/2 | Source blocks, absolute `position`; local simulation `vD`; base-center feet rather than body/eye center | Inspected, not substituted for render-interpolated feet |
| Render feet | `root.hY.le(root.bY).OI`; actual path-preview consumer adds `root.Lj` to `OI` | Source blocks, local render position; add exact double origin to get absolute feet | Read after source scene render; delivered to `IrisGeometryFrame.feet` and feet-relative Gbuffer/shadow matrix bindings |
| Render origin | `root.Lj`, initialized to `[0,0,0]`; `cD` subtracts it and `PY` adds it | Absolute source-block offset; double precision; not a camera/feet offset | Exact Float64 in the atomic frame; existing Rebase/Origin must agree; changed origin object has separate identity |
| Render eye target | Position component `OI` of `root.camera.cI`, whose `nD.CD` follows the local player; follow-render adds parent `OI` and current offset | Local player camera target, including source eye-height interpolation and view bob; **not** a third-person camera's displaced eye or guaranteed anatomical eye | Read together with feet; absolute Float64 in `IrisGeometryFrame.eye`, explicit `eyeKnown`; no guessed height, no `getLifeformEyeHeight` cache/fallback calls |
| Actual rendering eye | Current camera `globalPosition`/`position` and invertible view | Local render-camera position; + origin gives absolute rendering eye; may differ from player eye target | World camera and observed hand view/eye must agree numerically; no player feet derived by subtracting an assumed eye height |
| Actual hand camera | Existing isolated-hand mesh `onBeforeDrawObservable`, real scene view/projection, active camera, main framebuffer | Actual Bloxd hand matrix; source mesh temporarily sets camera `cO=0` for `ignoreCameraMaxZ` and restores it after its draw | Require the same source scene frame, camera, player tuple, origin, group, dimensions and depth convention as the completed frame; conflicting hand samples remain unknown |
| Source FOV | `playerCameraAdjustment.FD` writes `vy.camera.fov` from `movementBasedFov`, zoom/options/multipliers | Radians, source camera FOV; **no separately proven reference HUD-FOV** | Preserved through the actual observed projection; not exported as reference HUD FOV |
| Source far | Renderer `tk` writes `camera.cO = chunkSize * (maxLoadedRadius+2) * 2`; hand draw temporarily uses zero | Source camera far convention, including the source engine's special zero-far behavior; not proven Iris `depthFar` | Preserved as observed projection, not converted into a guessed finite reference far |
| View bob | `playerCameraAdjustment` computes `bobbleValue` and changes followed eye offset; renderer copies camera target into holder and applies heading/pitch/roll offsets | Source blocks/radians, source render adjustment; not Minecraft's hurt/view-bob pose matrix | Already present in actual view/model transforms; no simulation, replay, identity bob, or reconstructed Minecraft motion |
| Hurt bob | No proven equivalent independent reference pose input in audited paths | Unknown | Reference hand path stays gated, even when observed source hand is known |
| Animation time | `AnimTicker`: increment from zero every 100 ms while consumers exist; native source environment uses `performance.now` seconds | Effect/animation elapsed time, not Minecraft integer world time/day count | Never bound to `GeometryUniform::WorldTime` |
| Weather | No audited authoritative mapping to reference precipitation/rain/wetness | Unknown; sky appearance is not sufficient evidence | Required weather uniforms remain errors; optional uniforms keep explicit false validity |
| Light | Source terrain/entity packed RGB+sky, renderer sky/ambient overrides, held and directional colors/intensities | Source lighting, RGB and source levels; not an authoritative Java block/sky lightmap or own emission | Existing source channels retained; no reference lightmap or Minecraft ID supplied |

Source coordinates keep their existing axes and matrices (+Y upward). There is
no claim that source world axes, dimensions or semantic IDs define Minecraft's
world. The source player coordinates now close the previously missing provider
for the existing **source feet-relative matrix calculation**. They do not close
unrelated reference player-state or world-semantic gates.

## Atomic wire and lifetime

BND1 type **30**, layout version **1**, replaces experimental camera writes;
legacy layouts 1–29 remain readable. The 16-byte BND1 header is unchanged.
Capture, `bridge/source-frame.cjs`, transport and `SourceFrameData::read` must
be distributed together. The packaging manifest includes the new validator;
no package was built for this increment.

Payload order (little endian):

1. Thirteen uint32 words: epoch, layout version, flags, width, height, strictly
   increasing transaction serial, camera object identity, root object identity,
   source entity identity, position-component identity, origin-object identity,
   actual scene `getFrameId`, isolated hand group+1.
2. 39 Float32 values: world view, world projection, local camera XYZ, clear RGBA.
3. Two Float64 values: observation UTC milliseconds and monotonic observation
   age milliseconds. These are freshness metadata, never world/animation time.
4. If the player group is present: nine Float64 values, origin/absolute render
   feet/absolute player eye target. Missing any member makes the group unknown.
5. If the observed-hand group is present: 35 Float32 values, actual hand
   view/projection/local camera XYZ. No reference HUD/bob fields exist.

Flags 0/1 retain half-Z/reverse-Z; 2/3 denote the joint origin/player group;
4 is observed hand; 5 denotes a completed source-render observation. Sizes are
240, 312 or 452 bytes **including** the BND1 header. Unknown groups are absent,
with zero identity/group fields, rather than neutral known values. A completed
source render is observed through a read-only `onAfterRenderObservable`; before
that, or after a mismatch, ordinary camera data can still arrive with player/
hand unknown. No forced source render or source simulation is called.

Transport/native validation checks exact sizes, version/flag dependencies,
finite values, dimensions, nonzero identities, bounded coordinates, invertible
matrices and agreement of view with camera XYZ. Native processing parses the
whole transaction before changing camera or geometry. Wrong epochs are ignored;
reordered/repeated serials are rejected without mutation. Camera, scene, player
and origin identity changes prevent previous reference-player history reuse.

Observations expire after 250 ms, using the maximum of the transmitted monotonic
age and local wall-clock elapsed time. Future timestamps beyond 10 ms are
unknown. The native deadline then uses a steady clock, including time spent in
transport/receive queues. Repeated packets cannot renew the original sample's
deadline. Clock discontinuities conservatively lose known data. Freshness is
checked again per draw and before successful reference-history commit.

Rebase invalidates the current snapshot until a fresh matching-origin
transaction arrives; previously successful absolute feet/view history remains
available with existing origin compensation. Missing origin, changed dimensions,
camera/player/root/origin-object replacement, scene switch, pause or stale source
frame prevent reuse. Failed draws/final/state restoration never commit geometry,
camera, object or graph history. Window letterboxing that keeps the actual
viewport unchanged is distinct from a render-viewport resize.

## Hand consumption and remaining gates

`IrisGeometryProgram::handProjection` defaults to **Reference**. This continues
to require explicitly known current HUD FOV, reference far and hurt/view-bob.
The source provider never sets `hand.known`, even when source bob is disabled.
There is no fabricated identity bob or invented neutral hand movement.

The explicit **ObservedSource** mode consumes the captured source hand
projection and checks it against the mesh's actual observed draw state. It
canonicalizes half-Z once and applies Iris's 0.125 clip-Z compression while
preserving the source FOV/near/far and the source view. Reverse depth is already
in the captured matrix. It shares world depth without a depth clear, as the
existing bound hand path requires. `gbufferProjection` stays the uncompressed
world projection. A source near of 1/32 is **not** relabelled reference near 0.05.
This is a functioning explicit source adapter, not a completed reference hand
projection provider or an automatic fallback for Reference programs.

Open gates remain: separately proven reference HUD-FOV/far/hurt/view-bob;
reference player state, world time/weather, own emission/lightmap/PBR and
Minecraft semantic mapping; remaining source/pack features; production recipe;
user-operated GPU/image/FPS acceptance. Shaderloader stays separate.

## Verification

224 pure Node/DOM/VM tests include source-profile evidence and the actual capture
packet passed to the transport validator. A generated 452-byte CPU fixture is
also decoded by native tests (only its test freshness timestamp is renewed).
Expanded Renderer CPU mocks cover actual feet/hand matrix consumption,
required-reference rejection, malformed/truncated/reordered transactions,
staleness, identity changes, origin/rebase, resize, half/reverse-Z and failures
without history commit. GLSL compile/link, MemoryBudgetTests and native build
results are recorded in the existing verification outputs. These tests create
no client, browser, account, simulation or graphics context and prove no live
image/FPS parity. The default mode/main/preload/game runner/presenter and
original modules are verified independently of intentional experimental
capture/transport changes.
