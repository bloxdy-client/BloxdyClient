# q9aot GPU particles: implemented source adapter and remaining gates

19 October, latest: source own RGB emission type 33/v1 can wrap the existing atomic source-light/q9aot transaction without altering particle layouts or formulas. Actual combined Capture bytes are checked through JS/native validation and world/GPU draws. CPU particles are still separate existing packets. The explicitly authorized Worker observer creates no worker, sends no extra messages and performs no simulation. See [SOURCE-EMISSION.md](SOURCE-EMISSION.md); earlier audit paragraphs below are historical.

19 October ingress repair: the native pipe now accepts existing type 32. Combined Capture light+q9aot packets are tested through actual fragmented anonymous CPU pipes into decoding and GPU draw mocks, including partial-upload failure/recovery. CPU/GPU particle semantics and budgets are unchanged. No new emission provider; see [SOURCE-EMISSION.md](SOURCE-EMISSION.md).

18 October own-emission audit: CPU and q9aot GPU paths remain unchanged and pass
the combined capture/decoder/draw checks. No particle RGB, glow or material tint
is relabeled as block own emission. See [SOURCE-EMISSION.md](SOURCE-EMISSION.md).

17 October 2026, development on **0.6.19**, no release or installer.
`sourceFrameContract=1`, `sourceGpuParticleContract=1`,
`irisContractComplete=false`. Shaderloader remains separate.

The user's explicit decision authorizes stateless native evaluation of the
same analytical vertex formula using Bloxd-created spawn data, actual bound
parameters and the observed source clock. It does not authorize emitters,
random spawning, time extrapolation, state advancement or source method calls.
The earlier permission question is resolved and superseded.

18 October addition: atomic type **32/v1** can wrap the complete unchanged
**31/v1** GPU transaction with coherent source world-light inputs. JS and native
validators validate the entire envelope before camera/light/GPU acceptance.
The earliest light or GPU observation governs expiry; a scene-frame high-water
mark prevents replay through intervening unknown-camera packets. Partial GPU
upload cannot commit lights or camera. Shader formulas, exact GPU time, records,
CPU particle packets, texture generations and all budgets remain unchanged.
Actual combined Capture bytes are exercised by native CPU draws. No source
light values are injected into the q9aot shader. See [SOURCE-FRAME-DATA.md](SOURCE-FRAME-DATA.md).
Current verification: 244 pure tests, ten GLSL checks, expanded CPU tests,
MemoryBudgetTests and native build; older counts below describe the preceding
GPU increment. Sprites, shaderloader and production activation remain separate.

## Implemented chain

The experimental capture observes real WebGL instanced draws of the pinned
`gpuParticles` program, sends atomic BND1/31 snapshots, and the native renderer
uploads owned RGBA32UI record textures and executes four-vertex triangle strips.
This is integrated in Renderer::render, including the optional Iris graph's
WorldTranslucent callback. It is not an unconnected shader or packet definition.
It is source appearance coverage, not complete Iris particle semantics.

### Evidence and observation

`tools/audit-source-effects.cjs` reads eleven local public bundles as bytes and
verifies recorded hashes. Fifteen exact excerpts now include the GPU layout,
ring, uniform packing, shaders, factory, upload/draw calls, applied raster state,
alpha/depth policy, raw shader ownership and sprite dispatch. URLs, SHA-256,
UTF-16 offsets and excerpt hashes are in
`bloxd-source-effects-reference.json`. No module or excerpt is evaluated.

The source factory uses `KY?.particles` when present; that alternative is
rejected. Only the pinned `root.vy.Zk / Qs / gs` ownership relationship and
known raw vertex/pixel source are accepted. Raw shader fingerprints are derived
from the verified excerpts. Custom preprocessing, overrides, unknown defines,
foreign programs/providers, sampler objects and unsupported raster state fail.

The low-level observation occurs immediately before the source GL draw, after
`drawArraysType` has applied engine state. It does not invoke render, animate,
spawn, prepareDraw, drawTime, takeUploads or any other source mutation method.
Real source callers still run normally. The observer reads actual bound GL
uniforms, samplers, blend factors/equations, depth state, viewport and matrices;
it never reconstructs these later from mutable emitter settings. Temporary
texture-unit and bounded readback bindings are restored.

| Contract | Implemented behavior |
| --- | --- |
| Spawn records | 16 words / 64 bytes: position 0–2, time 3, velocity 4–6, lifetime 7, size 8, uint seed 9, reserved 10–11, RGBA 12–15. Uint copies and RGBA32UI preserve seeds, including NaN-like bit patterns. Reserved words are retained, never interpreted as float parameters. |
| Count and ring | Draw uses highWater, source cursor-derived start and actual instanced count. getActiveCount/liveCount is not used for this path. Native storage can have a different row width; slot order remains identical. |
| Dead/unwritten slots | Included in the draw count. The unchanged age >= 0 && age < life shader condition clips dead, future and unwritten slots. No CPU live-particle compaction or new particles. |
| Upload ownership | Observe actual typed integer texture uploads into a separate bounded mirror. Compare every drawn record bit with the source-owned CPU ring at the draw; require the actual frame and drained upload ranges. Observed zero allocation can establish unwritten slots. |
| Initial/missed uploads | Queue a bounded integer framebuffer-to-PBO read at the source draw, with a zero-timeout fence poll. Compare it with the CPU copy made at that exact point. Later observed slot uploads supersede the corresponding older readback words. Until proven, retain fallback. No synchronous GPU readback or wait loop is introduced. |
| Uniforms | All 284 system floats as actually bound, including the selected/truncated gradient tables and counts. No calls to gradient packing or ramp generation. Exact frame.xyz and source-relative frame.w, view and projection; no native particle clock. |
| Source identity | Completed source-render frame, scene epoch, source serial, root/camera/player/origin tuple, viewport and double origin. Draw matrices must agree with the contained type-30 frame. Isolated hand cameras are not substituted for world particles. |
| Textures | Actual particle and ramp/white-ramp source resources through the existing bounded texture transfer. Private immutable native generations prevent later mesh/texture updates from changing an older GPU snapshot. Sampling/filter/wrap/sRGB remain explicit; source WebGL handles never cross the wire. |
| Raster/order | Actual source depth-test/function/write and blend factors/equations. Subtract, OneOne, Combine, Add, Multiply and whole-system Multiply then Add. CPU and GPU systems retain their relative source order before sorted world transparency. No inherited CPU-particle fog, mask, pivot, force-depth-write or sheet behavior is imposed. |

At most 32 draw records and 8,192 drawn slots per transaction (including both
MultiplyAdd passes), 1 MiB wire packet, and 8,192 registered source-capacity slots.
Recovery reads share the existing three-job limit with color reads; integer
readbacks total at most 512 KiB in flight and copy at most 512 KiB per poll.
Unsignaled jobs are never waited on and are discarded after the bounded deadline.
Native record replacement reserves CPU copies and both texture sides, with a
4 MiB peak cap within the unchanged shared 512 MiB target budget. Particle color
textures are capped at 8 MiB base per texture and 16 MiB of retained generations
including mips; their allocations and overlap also count against 512 MiB.
Stable records reuse storage and skip uploads. Removed systems, scene resets,
missed ownership and release paths clear resources or draw readiness.

### Atomic wire and native resources

Type **31**, layout version **1**, leaves packet layouts **1–30 unchanged**.
After the unchanged 16-byte BND1 header:

1. Four uint32 values: epoch, version, embedded-frame byte length, draw count.
2. One complete validated BND1/30 frame, including its header (240/312/452 bytes).
   GPU transactions require the observed source frame and known origin/player
   group. Its age begins at the earliest contained draw, including transport time.
3. Per ordered draw: 18 uint32 words (system identity, order, draw count, start,
   native color/ramp IDs, flags, depth function, four blend factors, two blend
   equations, four wrap values); 320 floats (view, projection, frame, 284 system
   parameters); drawCount * 16 raw uint32 record words.

Flags are depth test=1, depth write=2, blending=4, multiply shader=8. Order is
source system index * 2 + pass. A repeated identity is permitted exactly once
for its matching additive second pass. Both passes must share records and
analytical parameters. The JS transport validator and native CPU decoder check
exact sizes, integer ranges, finite non-seed data, ordered gradients, safe ramp
ranges, known blend rules, frame agreement and complete payloads before use.

The source-frame serial and source render frame reject replay/reordering.
Native freshness uses the existing 250 ms wall/monotonic deadline. Repeating a
sample cannot renew it. New camera/root/origin/scene or viewport requires a new
matching transaction. Rebase never adjusts stored spawn data speculatively.
Failed allocation/upload/restore leaves no drawable partial batch and does not
advance the camera transaction. Draw/final/restore/expiry failure never commits
graph, camera, object, feet or world history. A native redraw within a valid
snapshot still uses the exact captured time, never extrapolated time.

### Shader and graph

`tools/extract-gpu-particle-shaders.cjs` mechanically extracts the shader text
without evaluating JavaScript. Native differences are GLSL 430 declarations,
integer range uniform, explicit color output, a multiply uniform instead of a
compile define, and exactly one half-Z conversion. The deterministic seed hash,
velocity-gradient integral, gravity, lifetime, color gradients, remap,
billboard corners, sampling and original-alpha multiply formula are retained.

The ordinary experimental path draws scene color after opaque-depth retention
and before sorted world transparency. The optional Iris recipe must explicitly
set `IrisPlan::sourceGpuParticleColor` to a full-size floating/normalized current
logical target. The adapter runs only in WorldTranslucent, after Deferred and
both hand/opaque depth snapshots. It neither writes metadata nor flips targets,
casts shadows, draws in hand phases, clears world depth or claims a reference
Particles/ParticlesTrans pack program. Sparse graph routing is supported via
this explicit source-color target. No production recipe is installed.

## Remaining scope gates

The named analytical source formula, its gradient/ramp/blend variants and the
bounded world/group-0 draw are implemented. Unknown providers/programs,
modified raw shaders, extra raster/sampler states, custom cameras/other groups,
missing ownership observations, invalid parameters and over-budget batches
retain whole-scene fallback. Source textures outside the existing RGBA base
transfer contract, custom mip content and anisotropic sampling are not newly
claimed. Reference lightmap/Minecraft particle semantics and shaderpack program
binding remain separate gates. Live GPU/image/FPS acceptance belongs to the user.

**Sprites are not implemented.** The eleven audited bundles prove manager
selection/dispatch/stubs but no SpriteManager renderer/layout/creation contract.
Atlas meshes and soundtrack names do not establish one. The existing correction
for explicitly disabled/masked-out managers remains only selection handling.
Selected unknown sprite managers retain fallback. No generic sprite renderer was
invented or source scene/module modified.

## Verification

238 pure Node/DOM/VM tests pass. The actual capture emits
`outputs/native-renderer-verification/gpu-particles.bin`; those bytes pass the
transport validator and native decoder (only test freshness is renewed).
Inert mocks cover ring wrap across a 256-slot row, highWater versus live count,
bit seeds, unchanged source objects/no mutation calls, all six blend choices,
partial passes, unknown upload/program/provider, asynchronous recovery,
immutable texture generations, ownership revocation and stale/resize cases.

Expanded BridgeCpuTests pass through real Renderer calls with GL CPU mocks:
actual uniform/record bindings and instanced draws, source pass order, graph
routing/depth separation, half/reverse-Z, fresh resize/rebase, replay/staleness,
reused resources, release, shared/peak budget rejection, partial upload and
GPU-draw/final errors without history commit. Nine GLSL compile/link checks,
MemoryBudgetTests and native compilation pass. Build warnings remain the prior
MSVC possible-uninitialized warnings in legacy packet local variables.

Reports: `outputs/source-effects-verification.json`,
`outputs/launcher-verification/verification.json`,
`outputs/native-renderer-verification/glsl-verification.json`,
`outputs/native-renderer-verification/mode-isolation.json`,
`outputs/gpu-build-final.log`. These mocks are not image/FPS evidence.
No client, browser, Electron, account, graphics context, source simulation,
installer, new version or production recipe was started or activated.
Default renderer, original modules, view distance 10, active mesh selection,
chunk requests and the existing fallback/ownership rules remain preserved.
