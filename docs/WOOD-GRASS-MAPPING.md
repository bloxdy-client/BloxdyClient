# Wood and Grass Block material mapping (0.6.54)

Contract 4 extends the native material table from 50 to 57 source roots. It
contains 48 complete reference states and nine partial states: four door roots,
four log roots and Grass Block. This is material identity support in the opt-in
experimental renderer, not production Minecraft shaderpack playback.

| Exact Bloxd root | Minecraft name | Reference state |
| --- | --- | --- |
| Jungle Log | minecraft:jungle_log | axis unknown |
| Barkless Jungle Log | minecraft:stripped_jungle_log | axis unknown |
| Cherry Log | minecraft:cherry_log | axis unknown |
| Barkless Cherry Log | minecraft:stripped_cherry_log | axis unknown |
| Jungle Wood Planks | minecraft:jungle_planks | complete, no properties |
| Cherry Wood Planks | minecraft:cherry_planks | complete, no properties |
| Grass Block | minecraft:grass_block | snowy unknown |

The exact source names, immutable empty metadata, flags=3, matching root/name
and root/ID, and existing registration/upload/frame lifetime proofs are required.
No numeric Bloxd ID becomes a Minecraft ID. Rotated/custom/TreeBase variants,
contradictory metadata and other species stay unknown. Maple/Pine/Mango wood
does not become oak/spruce/jungle. Barkless identifies stripped logs, not wood
with bark on all faces.

## Unknown properties and pack IDs

The pinned source does not supply a proven Minecraft log axis or Grass Block
snowy producer. Neither reference defaults, texture names, the atlas, matrices
nor neighboring cells supply that missing contract. `MinecraftBlockState`
therefore carries the exact name with `complete=false`; its axis/snowy property
accessors return unknown. No default Y axis or snowy=false is assigned.

The isolated preprocessed `block.properties` resolver evaluates the ordered
first match for x/y/z or false/true. A PackBlockId is known only if every possible
completion produces the same ID. Different results, including assigned versus
unassigned, remain unknown. A common ID 0 and unassigned -1 retain their separate
known flag. Predicates for nonexistent properties retain the pinned Iris behavior.
Fully supplied internal reference states are validated separately; the source
mapper does not manufacture them.

For example, an unconditional `block.20=jungle_log` resolves to 20. Separate
IDs for axis=x/y/z remain unknown. Mapping all three axes to 20 resolves to 20.
The same rule applies to both Grass Block snowy values and to earlier first
matches. The result reaches actual CPU world/shadow callback bindings, including
unknown validity, compatible draw coalescing and frame-local cache invalidation.

## Source evidence and bounded verification

`node tools/audit-minecraft-block-map.cjs` validates pinned public source bytes
and Java 26.3 reference JAR bytes as data. `tools/audit-wood-grass.cjs` checks the
reference class chains, Direction.Axis enum and BooleanProperty domain. The
generated report is `docs/bloxd-minecraft-block-reference.json`; the generated
native table is `src/bridge_minecraft_block_rules.inc`. No Java or game bundle
is executed by this audit.

504 pure Node/DOM/VM tests pass, including new real Capture binary fixtures for
Jungle logs, Cherry logs, planks and Grass Block. Native BridgeCpuTests exercise
those frames through fragmented pipe decoding, mesh lifetime proofs, material
resolution, world/shadow draw bindings, cache reuse, stale frames, table changes,
upload replacement and failure recovery. All 14 GLSL programs compile/link.
These checks create no graphics context and prove no displayed pixels or FPS.
Release evidence lives under `outputs/wood-grass-0.6.54/`.

Setup, Portable and Update are byte-checked in `dist-bloxdy-v0.6.54`. All 62 ASAR
source files (63 including package.json) match the workspace. The native resource
matches the fresh build from this checkout. Against 0.6.53 only package.json and
BloxdNative.exe change in the distributed application; MemoryBudgetRunner and
all launcher/bridge/catalog/texture bytes match. Five production shader headers
match their 0.6.39 hashes. Native CPU/14 GLSL/MemoryBudgetTests pass independently
after packaging. Artifact hashes are in `distribution.json` and `SHA256SUMS.txt`.

No wire version, source observer, GPU resource, production shader literal,
default renderer, view distance, memory limit, original mod or account path is
changed. Existing metadata limits and the 250 ms freshness guard remain intact.

## Open gates

A real source producer is still required before axis/snowy can become known.
Door power and unsupported families remain unknown. Contract 5 in 0.6.55 adds
static Water/Lava identities and pack-ID consensus over unknown reference levels;
see [FLUID-MATERIAL-MAPPING.md](FLUID-MATERIAL-MAPPING.md). This introduces no
fluid simulation or fabricated flow/falling data. The complete loader, preprocessing,
shader translation, production recipe and real image/FPS acceptance remain open.
`irisContractComplete=false`. CrazyGames profiles still require Standard Bloxd.
