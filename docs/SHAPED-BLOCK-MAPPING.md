# Stair and door reference mapping — contract 3

22 October 2026, release 0.6.39. This extends the experimental renderer's
canonical material data. It does not enable a production Iris recipe or a
shaderpack loader. `irisContractComplete=false`.

The table now has 50 exact source roots: the previous 30 cubes and six slabs,
ten stair families, and four roots for the lower/upper halves of Jungle and
Cherry doors. Stair families are Messy Stone, Stone, Stone Bricks, Mossy Stone
Bricks, Andesite, Smooth Andesite, Diorite, Smooth Diorite, Granite and Smooth
Granite. Each maps to the corresponding explicit canonical material in
[bloxd-minecraft-block-map.json](bloxd-minecraft-block-map.json).

## Geometry evidence and reference states

`node tools/audit-minecraft-block-map.cjs` reads the pinned public source bundle
and the official Java 26.3 reference JAR as text/ZIP/JSON/class-file bytes.
Neither is executed. The shaped audit checks every one of the 40 stair
orientation/half/shape combinations against actual reference model occupancy
at all 512 subcell centers. Source box literals, quarter-turn formula, vertical
mirror, actual rendered corner templates/extra quarter turns, generators and
model/class resources are recorded with SHA256 hashes
in [bloxd-minecraft-block-reference.json](bloxd-minecraft-block-reference.json).

Source axes stay unchanged. Canonical directional names use +X east, +Y up,
-Z north; this is a renderer convention, not a claim about Bloxd geographic
names. Rotations 1–4 map to north, west, south, east. `bot/top` map to
`bottom/top`. Source `innerLeft/innerRight/outerLeft/outerRight` map to
`inner_right/inner_left/outer_right/outer_left`. The swapped names are verified
geometrically, including top halves, rather than copied by spelling.

All four reference properties of these ten stairs are known: facing, half,
shape, waterlogged=false. Dry state uses the same exact nonfluid model
registration and cell-ID fluid lookup as the six previously supported slabs;
there is no generic dry fallback for arbitrary blocks.

Jungle and Cherry are explicitly named source/reference wood families; Maple,
Pine and other species are not aliased to an unrelated Minecraft wood. The
source lower root and `_... Top` root establish lower/upper. Both opening
states at all four rotations of both halves are checked for both species:
32 source/reference plane-orientation comparisons. Their fixed opening
direction corresponds to reference hinge=right. Source collision thickness is
1/8 versus Minecraft's 3/16; only orientation/state identity is asserted, not
equal collision geometry or gameplay. Separate upper/lower observations are
not a new validation of neighbor pairing.

Door `powered` remains unknown: source `open` is not evidence of a redstone
signal. Door states are consequently partial. The reference BooleanProperty
has two possible completions, false and true. The internal block.properties
resolver retains a pack ID only if ordered first-match resolution agrees for
both. A selector using the known facing/half/hinge/open can resolve normally;
power-dependent assignments which disagree remain unavailable. Known 0,
known unassigned -1 and unknown retain their separate meanings. As in the
pinned Iris implementation, nonexistent properties are ignored; an existing
but unknown property is never treated as nonexistent.

## Integration and verification

The native Type33/v5 decoder derives canonical data from already proven exact
source names, root IDs, metadata strings, effective flags and registration
tokens. No protocol layout or source observer is added. Root versus variant
ID/name consistency, exact rotation/half/open/corner spellings and model flags
are mandatory. Unsupported/custom/contradictory definitions stay unknown.
Canonical string views refer only to static rule/constants, never temporary
source strings. Runtime work is bounded by 50 rules and the existing maximum
256 source definitions/frame. The new fields are bounded CPU metadata; no new
GPU buffers, textures or target budgets are introduced. Existing range splits
depend only on values actually consumed by a program.

Pure Capture fixtures for stairs and doors pass through the fragmented native
pipe into actual CPU-mocked world/shadow callbacks. Checks cover exact int IDs,
unknown power, equal-ID merging, dictionary/upload/table replacement, expired
frames, resize, generic geometry, unapproved instance ranges, required/optional
bindings, failed draws and history commit prevention. Every newly supported
state of every listed family is also checked with contradictory source inputs.

420 Node/DOM/VM tests, 42 launcher syntax files and both generated preloads,
BridgeCpuTests, 14 GLSL compile/link programs and MemoryBudgetTests passed.
Native applications are compiled only. Release/package evidence is retained in
`outputs/shaped-materials-0.6.39/`. No client, account, installer or graphics
context was started; no profile mutation, installation or upload occurred.

One CPU run concurrent with packaging rejected a synthetic light frame as
stale; the independent final run after packaging passed. The intermediate
failure's cause is not established. Its report is preserved separately as
`native-verification-during-packaging`; the production 250-ms guard was not
changed or relaxed. Package checking confirms all 49 sources and native
resources match; only package.json and the intended native executable differ
from0.6.38, and all six production shader literals are unchanged.

The default renderer, existing production shader literals, Litematica,
character/account paths and original catalogs are preserved. These changes
are an additional material-data building block, not a visible new shader effect
or an image/FPS acceptance claim.

## Remaining work

Contract 4 in 0.6.54 adds exact Jungle/Cherry logs, stripped logs, planks and
Grass Block; see [WOOD-GRASS-MAPPING.md](WOOD-GRASS-MAPPING.md). Log axes and
Grass Block snowy remain unknown, with pack-ID consensus over all possible
reference states. Other species, unsupported fluid states, unknown door power, vertical side slabs
and unsupported variants remain open. World time/weather, reference lightmap/scalar emission, full
hand/player inputs, pack preprocessing/tags/legacy/layers, shader translation,
production activation and real user image/FPS acceptance are also open. The
static Water/Lava material identities are added by contract 5 in 0.6.55 with
unknown Minecraft level and consensus over 0..15; see
[FLUID-MATERIAL-MAPPING.md](FLUID-MATERIAL-MAPPING.md). Known
axis/snowy/level values still require actual source producers. The separate
shaderloader and whole renderer remain unfinished.
