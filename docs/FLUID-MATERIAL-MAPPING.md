# Static Bloxd Water/Lava material mapping (0.6.55)

Material contract 5 adds exactly two source roots: `Water` -> `minecraft:water`
and `Lava` -> `minecraft:lava`. The complete table has 59 roots: 48 complete
reference states and 11 partial states. This is a material-data step in the
opt-in experimental renderer, not complete Minecraft shaderpack playback.

## Bloxd behavior and source evidence

The user states that Bloxd Water/Lava are individual static blocks with no
spreading physics. This update preserves their source geometry and behavior.
It does not install Minecraft fluid simulation, change neighboring blocks,
rebuild fluid surfaces, or create flow/falling uniforms.

The pinned public source defines both roots with `UR:!0`, plain immutable empty
metadata and no model/solid/shape override. The registration path uses
`solid:...!ys.UR`, `opaque:!Os` and `UR:ys.UR`. Water's RGBA array and Lava's
RGBA animation both set transparency. The registry stores the fluid bit in
`Xz`; the source physics adapter reads that bit for the cell's block ID.
The exact effective flags are therefore non-solid/non-opaque/fluid/non-model
(`4`). Root/name and root/ID must match, and registration, upload, source-frame
and instance-lifetime proofs remain mandatory. Changed flags, custom metadata,
variants, rotations and unsupported fluids such as Toxic Waste stay unknown.

Water's source color is `[.5,.5,.8,.9]`. Lava uses `[.95,.4,.05,.95]`, eight
animation frames at 200 ms, and separate own-emission RGB `[14,8,2]`. Those
existing appearance/emission paths are unchanged. Alpha, animation or RGB
emission are not a source for Minecraft fluid level, scalar lightmap or flow.

## Reference contract and unknown levels

Java 26.3 Water/Lava registrations instantiate `LiquidBlock` with the respective
`Fluids.WATER` / `Fluids.LAVA` object. `LiquidBlock.createBlockStateDefinition`
adds `LEVEL`, whose alias points at `BlockStateProperties.LEVEL`. Its class
bytes register IntegerProperty `level` with inclusive bounds 0 and 15. The
property-free `water.json` / `lava.json` model variants do not imply a block
without properties. The numeric class reader is opt-in and executes no Java.

Bloxd's static cell identity supplies no producer for that Minecraft property.
`MinecraftBlockState` therefore knows the exact material name but carries
`complete=false` and unknown `level`. Static behavior does not establish
Minecraft level=0, a reference surface height or a reference flow/falling state.
No defaults, neighbor inference, texture-name inference or transform inference
are substituted. `falling` is not a property of this reference **block state**;
the separate reference fluid-state contract is not claimed to be implemented.

The isolated preprocessed `block.properties` resolver checks ordered first
matches across all 16 possible reference block levels. It uses a 16-bit pending
mask in a single selector-table pass, without allocating a list of states or
rescanning the table 16 times. A PackBlockId becomes known only when every level
has the same result. Known ID 0, known unassigned -1 and unknown remain distinct.
An unmatched level counts as unassigned, so an assigned/unassigned mixture is
unknown unless both results are -1. Duplicate keys/IDs retain the existing
ordered parser semantics and limits.

For example, `block.20=water` resolves to 20. Assigning a different ID for
`water:level=15` makes the partial result unknown. All 16 level selectors with
the same ID resolve to that ID. An earlier unconditional match wins. The pinned
Iris implementation compares property names as strings: `level=00`, `-0`, `01`,
out-of-range values and invalid strings do not match. Predicates for nonexistent
reference block properties retain Iris's documented-in-source ignore behavior;
this does not assert that any Bloxd flow/falling value is known.

## Verification and limits

508 pure Node/DOM/VM tests, 50 syntax files and three generated preload variants
pass. The source/JAR audits independently hash source spans, LiquidBlock/property
class bytes, the 0..15 integer operands, reference factories and blockstate JSON.
No public game bundle, reference Java or graphics context is executed.

New Capture fixtures cover both terrain and instances. The terrain fixture
preserves vertex/index bytes and independent Water/Lava/Toxic Waste RGB data.
Native BridgeCpuTests decode the real binary fixtures through fragmented pipe
ingress and check world/shadow ID bindings, all 16 conflicting level cases,
common-ID range merging, unsupported-fluid validity, cache reuse, stale frames,
table changes, replaced uploads and failure without history commit. Direct
resolver tests compare the single-pass result with all concrete reference states
over ordered/overlapping/duplicate-ID maps. All 14 GLSL programs compile/link.
These are CPU/compiler checks, not visible-pixel, live-liquid or FPS acceptance.

No wire version, source observer, production shader literal, GPU resource,
default renderer, view distance, memory limit, original mod or account path is
changed. The 256-definition/1 MiB proof limits, material table limits and 250 ms
freshness guard remain intact. CrazyGames still requires Standard Bloxd.

Evidence: `outputs/fluids-0.6.55/`. The complete shader loader, preprocessing,
translation, production recipe, reference inputs and live image/FPS acceptance
remain open. `irisContractComplete=false`. A future source producer is required
before Minecraft `level`, log axis or Grass Block snowy can become known.

## Release verification

The next internal loader increment in 0.6.56 accepts raw conditional
block.properties and explicit macro facts; see
[MATERIAL-PROPERTIES-LOADER.md](MATERIAL-PROPERTIES-LOADER.md). The fluid material
contract and its unknown reference levels are unchanged.

Setup, Portable and Update are byte-checked in `dist-bloxdy-v0.6.55`. All 62 ASAR
source files (63 including package.json) match the workspace. The native helper
matches the fresh build from this checkout; MemoryBudgetRunner is unchanged.
Against 0.6.54 only package.json and BloxdNative.exe change in the distributed
application. Five production shader headers match their 0.6.39 hashes. Native
CPU/14 GLSL/MemoryBudgetTests pass independently after packaging. Artifact hashes
are in `distribution.json` and `SHA256SUMS.txt`. No client, installer, browser,
account or graphics context was started; no real profile was changed.
