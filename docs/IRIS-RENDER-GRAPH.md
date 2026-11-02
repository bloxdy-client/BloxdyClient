# Iris target render graph — development on 0.6.19

19 October, latest: existing Gbuffers/shadow callbacks now bind proven SourceOwnEmissionRgb from atomic type-33 frame/geometry associations. The internal GLSL fixture preserves raw RGB plus validity in an explicit source-data output. No production recipe, graph allocation or new lighting policy is enabled. Expiry between draw and commit aborts successful history commit. See [SOURCE-EMISSION.md](SOURCE-EMISSION.md); earlier no-emission audit paragraphs below predate this bounded provider.

19 October correction: native pipe input now accepts existing SourceLight type 32; CPU verification routes real Capture light/GPU payloads through that ingress before graph/draw/error-commit checks. No new graph resource, recipe or emission contract. The worker reply/block-copy boundary is proven, but its register-generation join remains open; see [SOURCE-EMISSION.md](SOURCE-EMISSION.md).

Status: 17 October 2026. `irisGraphContract=1`, `irisGeometryContract=1`, `irisContractComplete=false`.
This is an executable engine graph, with native geometry callbacks and linked
compute/fragment programs, not a shaderpack loader or a claim of image parity.
The release/package version remains 0.6.19; no new installer was made.

18 October own-emission audit adds no graph resources, recipe or emission
transport. World/shadow CPU draw tests preserve unknown-emission validity and
failure-without-commit. The missing source generation joins are documented in
[SOURCE-EMISSION.md](SOURCE-EMISSION.md); reference emission remains gated.

The q9aot source GPU adapter now draws in WorldTranslucent, after Deferred and
the retained opaque/hand depth snapshots, in source order relative to CPU
particles and before sorted world transparency. An internal recipe must set
`sourceGpuParticleColor` explicitly to a current full-size floating/normalized
color target. No metadata/shadow/hand output, implicit flip, production recipe
or complete Iris particle program is introduced. Immutable texture generations,
record replacement peaks and source GPU memory share the existing target cap.
[Detailed source contract and verification](SOURCE-EFFECTS.md). Sprites remain
unsupported; their selection correction does not provide geometry.

Latest addition: explicit linked Gbuffers/Shadow geometry programs, typed
reflection, vertex/instance/uniform/sampler bindings and reference hand
projection/compression. The optional `IrisPlan::programs` path is described in
[IRIS-GEOMETRY-BINDINGS.md](IRIS-GEOMETRY-BINDINGS.md). No production recipe
is automatically installed. The latest experimental source
provider now delivers actual player feet/eye target and observed hand matrices
through atomic type-30 frames; reference HUD-FOV/far/bob remains unknown. See
[SOURCE-FRAME-DATA.md](SOURCE-FRAME-DATA.md) for the separate explicit source-hand
mode, provenance, identity/freshness rules and mandatory reference gates.

18 October: coherent source world lighting now reaches explicit typed
Gbuffers/Shadow uniforms through atomic type 32/v1 (unchanged embedded type 30
or 31). Source RGB sky/ambient, held RGB/range and position-or-cone direction,
lighting switch and Earth-sky direction retain their actual meanings. No
reference world time/weather/lightmap/emission gate is unlocked. Snapshot,
replay/expiry/commit rules and the per-candidate evidence matrix are in
[SOURCE-FRAME-DATA.md](SOURCE-FRAME-DATA.md). No production recipe is enabled.

The new data is consumed in the existing geometry callbacks; no fullscreen or
compute interface is added. A source-light consumer that expires before final
commit invalidates the frame. Source sky direction does not automatically
replace the existing shadow-light policy or create a production lighting pass.

## Entry and ownership

`Renderer::irisPlan` installs an internal recipe of already linked, immutable
engine programs. The program owner must keep their handles alive until the
recipe is removed; the graph owns its textures, framebuffers and SSBOs, not
these borrowed programs. Remove the recipe before deleting/relinking programs.
`IrisGraph::release` clears the program reflection cache as well as resources.

No recipe is installed by the shipped launcher/native entry point. This keeps
the existing experimental scene path stable while source/hand program adapters
are incomplete. The graph is exercised through the **actual Renderer::render
path** by the CPU tests, with nonempty recipes and actual geometry draw calls.
There is no UI switch, downloaded pack, filename parser or source translation.
Optional stages without programs are skipped, as in Iris; an explicitly
declared empty step is rejected. No identity effects were installed merely to
make every stage appear active. Geometry uses the explicit geometry-program
table when supplied, otherwise the legacy native adapter. Final is mandatory.

Default Bloxd rendering is unchanged. Main/preload/game runner/presenter compare
byte-for-byte with 0.6.19. Experimental capture/transport add atomic type 30;
existing layouts 1–29, active-mesh selection, view distance, ownership lease and
original mods are preserved.

## Reference evidence

The release is [Iris 1.11.7 for Fabric 26.3](https://modrinth.com/mod/iris/version/vTN4NRGW).
The artifact was downloaded as an audit file under `outputs/iris-reference`,
SHA-512 checked against [release metadata](https://api.modrinth.com/v2/version/vTN4NRGW),
and read as ZIP/class bytes only. **No Java, Minecraft, Iris or client code was
loaded/executed, and the artifact was not installed.** Its manifest names
Minecraft 26.3 and `fabric.mod.json` names `1.11.7+mc26.3`.

Public branch commit `671a5c87747d33983d7ed659461a64f46dfcb1f0` targets 26.3 but
its build file still declares 1.11.6. It is supporting source evidence, **not an
asserted exact source tag for 1.11.7**. The read-only class parser in
`tools/inspect-iris-reference.cjs` independently records method calls/constants
from the verified release. This confirms depth-copy methods, compute dispatch /
barrier before fragments, shadow composite, and composite before final. The
parser does not reconstruct all Java control flow or prove full source identity.
Hashes and provenance are in `docs/iris-graph-reference.json`; detailed class
records remain in `outputs/iris-reference/bytecode-contract.json`.

Primary source sections consulted:

- [IrisRenderingPipeline](https://github.com/IrisShaders/Iris/blob/671a5c87747d33983d7ed659461a64f46dfcb1f0/common/src/main/java/net/irisshaders/iris/pipeline/IrisRenderingPipeline.java): begin, prepare, pre-hand and pre-translucent depth, deferred, composite, final.
- [CompositeRenderer](https://github.com/IrisShaders/Iris/blob/671a5c87747d33983d7ed659461a64f46dfcb1f0/common/src/main/java/net/irisshaders/iris/pipeline/CompositeRenderer.java) and [FinalPassRenderer](https://github.com/IrisShaders/Iris/blob/671a5c87747d33983d7ed659461a64f46dfcb1f0/common/src/main/java/net/irisshaders/iris/pipeline/FinalPassRenderer.java): pass flips, mips and persistent alt-to-main copies.
- [ComputeProgram](https://github.com/IrisShaders/Iris/blob/671a5c87747d33983d7ed659461a64f46dfcb1f0/common/src/main/java/net/irisshaders/iris/gl/program/ComputeProgram.java), [ProgramSet](https://github.com/IrisShaders/Iris/blob/671a5c87747d33983d7ed659461a64f46dfcb1f0/common/src/main/java/net/irisshaders/iris/shaderpack/programs/ProgramSet.java), [IrisImages](https://github.com/IrisShaders/Iris/blob/671a5c87747d33983d7ed659461a64f46dfcb1f0/common/src/main/java/net/irisshaders/iris/samplers/IrisImages.java): direct/relative/indirect dispatch, 100 program slots and base plus `_a`–`_z` compute chain, images use the current sampler side.
- [ShadowRenderer](https://github.com/IrisShaders/Iris/blob/671a5c87747d33983d7ed659461a64f46dfcb1f0/common/src/main/java/net/irisshaders/iris/shadows/ShadowRenderer.java), [HandRenderer](https://github.com/IrisShaders/Iris/blob/671a5c87747d33983d7ed659461a64f46dfcb1f0/common/src/main/java/net/irisshaders/iris/pathways/HandRenderer.java), [ShaderStorageBufferHolder](https://github.com/IrisShaders/Iris/blob/671a5c87747d33983d7ed659461a64f46dfcb1f0/common/src/main/java/net/irisshaders/iris/gl/buffer/ShaderStorageBufferHolder.java): shadow depth boundary, hand projection obligations and storage lifecycle.
- Khronos [image binding](https://registry.khronos.org/OpenGL-Refpages/gl4/html/glBindImageTexture.xhtml), [barriers](https://registry.khronos.org/OpenGL-Refpages/gl4/html/glMemoryBarrier.xhtml), [indirect dispatch](https://registry.khronos.org/OpenGL-Refpages/gl4/html/glDispatchComputeIndirect.xhtml): sized formats, visibility and indirect-count hazards.

## Executed order and resources

| Boundary | Actual work and available results |
| --- | --- |
| Frame initialization / early Shadow compute | Initialize new/recovered storage and SSBOs; clear depth. Run Shadow compute before Begin and before ordinary per-frame color clears, using shadow-resolution dispatch dimensions. Then clear requested color pairs. Recovery also resets persistent storage. |
| Begin | Ordered compute chains followed by linked fullscreen fragments; current color/image sides and SSBOs. Current frame depth reads are rejected here. |
| Shadow geometry | After Begin: native opaque/cutout casters, copy `shadowtex1`, native transparent casters into `shadowtex0`. Hand/sky/particles excluded. Native graph shadow outputs carry sampled material color and normal, not zero placeholder colors. Unknown sun yields clear maps, not invented lighting. |
| Shadowcomp | Ordered compute/fragments on a separate shadow-color pool. Samples completed shadow depth and shadow colors; output routing is independent of world colortex indices. |
| Prepare | Ordered compute/fragments after shadows, before world geometry. |
| Gbuffers opaque | Actual native sky and opaque/cutout draws into explicit current logical targets; snapshot `depthtex2` before the opaque hand. |
| Gbuffers hand opaque | Observed hand camera draws into scene color; snapshot `depthtex1` after opaque hand. No implicit color flip. |
| Deferred | Ordered compute/fragments after opaque hand/depth1, before transparency. Later geometry follows the resulting current color sides. |
| Gbuffers translucent | Source particles and sorted world transparency, then transparent hand. `depthtex0` is the current shared scene depth; depth1/2 remain unchanged. |
| Composite | Ordered compute/fragments after geometry. |
| Final | Compute chain followed by exactly one linked fragment writing native scene color. No logical MRT outputs or final flips. Native readback/presentation consumes that result. |
| Successful completion | Copy odd persistent color sides back to physical main, restore GL state, then commit graph/camera/object history only after the complete native output succeeds. |

The legacy native adapter maps its six existing geometry outputs explicitly; these
are **native meanings**, not Minecraft semantic IDs. Hand and transparency write
scene color only, preserving the existing opaque metadata policy. The graph
does not secretly convert those meanings into shaderpack geometry interfaces.
The existing prior-world archive has a different pre-hand contract and is
deliberately rejected alongside an Iris recipe rather than mislabelled depth1/2.

The new geometry-program path instead uses each linked program's declared
current-side MRT outputs, also for hand/translucency; six native targets are not
required. One isolated clear-hand group is accepted only with that path and
current known reference hand inputs. It uses compression without a depth clear.
The world projection remains separate from the per-draw hand projection.

## Program and buffer rules

- Program handles must be linked. Compute local sizes are read from the linked
  program. Stages have ascending ordinals 0–99; Shadow and Final use ordinal 0.
  Each compute chain has at most 27 actual programs. Final is required.
- Inputs declare a texture domain, logical index, numeric sampler kind, uniform
  location, unit and mip policy. Outputs declare ordered logical destinations,
  numeric kind and flip behavior. Current-frame depth cannot be read before its
  producer. Missing resources, duplicate units, conflicting filters, mismatched
  output sizes/types and output/image/sampler feedback fail the frame. Shadow
  compute is an early-frame exception to the stage's geometry position; this
  ordering comes from the reference pipeline, not the list of stage names.
- Independent world/shadow pools each support the existing 32-index paired
  storage, 30 sized formats, typed clears, fixed/relative dimensions and mips.
  Geometry writes current sides; fullscreen writes alternate sides. Only a
  successful draw flips its outputs. Additional explicit post-flips are separate
  toggles, including on a drawn output, matching the reference's separate loops.
  Compute image writes operate in place and do not implicitly flip.
- Image bindings use level-zero 2D color storage and exact format/access. The
  supported sized normalized/float/signed/unsigned formats are checked. Writable
  images cannot also be sampled by the same program; duplicate image aliases
  are rejected conservatively. Image writes dirty the mip chain.
- SSBOs use explicit slots 0–7, fixed or viewport-relative byte sizes, multiples
  of four, maximum 128 MiB per buffer and the queried GPU block-size limit.
  They are zeroed on allocation/recovery and persist across successful frames.
  Existing source SSBO slots 4/6/7 are rebound for geometry; stage bindings do
  not leak across that boundary. No caller-owned SSBO is used implicitly.
- Compute supports absolute groups, relative `ceil(ceil(viewport*scale)/local)`
  and an aligned, bounded indirect pointer into an owned SSBO. A 12-byte CPU
  argument read validates indirect counts before dispatch; this can synchronize
  the GPU and is **not a performance optimization**. Zero groups are legal.
  No unchecked indirect count is sent to the driver.
- Shader-image, texture-fetch, storage, framebuffer and update barriers surround
  shader writes; indirect arguments additionally use the command barrier.
  Reserved dirty mips can be sampled across domains and by compute programs.
- All graph textures, depth, mip storage and SSBOs share the 512 MiB target cap
  with native frame targets and retained native shadow storage. Replacement peak
  includes old and new sets; an over-budget resize fails without discarding the
  old graph resources. Stable descriptors reuse storage and cached capabilities.
- RAII preserves textures, image bindings, indexed SSBO bases/ranges, indirect
  buffer, framebuffer bindings, program, VAO, viewport and touched raster state.
  Renderer completion explicitly checks restoration errors before history commit.
  Failed graph frames invalidate both scratch sides and SSBO contents; they are
  not rollback archives. No failed frame becomes a completed history frame.

## Verification and remaining gates

`BridgeCpuTests` exercises the graph and Renderer integration: real draw/dispatch
entry points replaced with CPU mocks, stage ordering, depth stamps, sparse
bindings, deferred side changes, persistence copies, direct/relative/indirect
dispatch, image formats/feedback, mips, SSBO limits/ranges, stable allocation,
partial allocation cleanup, shared/peak budgets, removal/resize, every geometry
and fullscreen failure boundary, failed final/presentation, and recovery.
Mock stamps demonstrate identity/order, **not pixel correctness**.

219 Node/DOM/VM tests passed. The native application and CPU helpers compile.
Eight native/presenter/graph/geometry GLSL compile/link checks pass, including a real
image-store/atomic SSBO compute program and an integer fragment/image program.
MemoryBudgetTests passes. No client, account or graphics context was started.
Reports: `outputs/native-renderer-verification/glsl-verification.json`,
`mode-isolation.json`, `outputs/launcher-verification/verification.json`.

Still open before this is a complete Iris renderer:

1. Complete source/material/semantic coverage for the now-executable geometry
   bindings. Supported core vertex/fragment program families and fallback edges
   run through the new optional table; arbitrary legacy GLSL, tessellation,
   geometry shaders and other unsupported active resources still fail.
2. Authoritative current source HUD FOV/far/bobbing and player-feet inputs for the
   implemented reference hand projection. Render-sampled source feet now feed
   matrix bindings; an explicitly selected observed-source hand mode preserves
   actual source matrices without fabricating reference data. The new path supports isolated clear-hand groups without
   clearing world depth; the old native adapter still rejects them. Mixed
   positive world groups remain unsupported.
3. Remaining optional reference features: setup compute, custom 1D/3D images,
   hardware comparison samplers, broader texture formats and per-pass viewport/
   blend variants. These have no descriptors and are not silently emulated.
   Geometry now reflects active attributes/uniforms/output types and stages;
   broader reflection/binding features remain outside the bounded contract.
4. A production internal recipe/activation after those source contracts are
   supported, plus a dedicated graph history consumer. Current controlled
   recipes are test input; no pack program or cosmetic effect is enabled.
5. Existing source coverage, authoritative semantics/world values, moving thin
   identities and user-operated GPU/image/FPS acceptance remain open.

Shaderloader remains a separate later mod. This increment closes execution and
resource-lifecycle mechanisms within the declared engine API; it does not close
the complete reference program/binding gate or the overall renderer goal.
