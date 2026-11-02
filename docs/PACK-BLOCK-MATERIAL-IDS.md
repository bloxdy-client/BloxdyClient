# Pack-specific block material IDs — internal contract1, 0.6.32

**Current extension0.6.39:** canonical contract3 adds ten stair families and
Jungle/Cherry door halves. The resolver now consumes facing/half/shape/hinge/
open and retains unknown door power through two-completion consensus. The
door/stair mapping gaps described below are historical for these listed
families; power and other species remain open.
[SHAPED-BLOCK-MAPPING.md](SHAPED-BLOCK-MAPPING.md).

The isolated loader component `src/shader_loader/block_ids.hpp` compiles an
explicit **preprocessed** `block.properties` string into an immutable material
ID table. It resolves the canonical names/states supplied by the native source
material dictionary. Internal Iris world/shadow geometry programs can consume
the result as `PackBlockId`, an exact integer `packBlockId` uniform with optional
independent bool validity. A required unknown value aborts without committing
the frame. This is a bounded loader component, not an activated shaderpack
loader, pack filesystem/UI, shader translator or complete Iris implementation.

No production recipe is installed. The existing `SemanticIds` aggregate and
`mc_Entity` attribute remain unavailable. The latter also requires a terrain
attribute/render-type/float encoding contract and is not replaced with raw
Bloxd IDs or this internal integer uniform. Entity/item/block-entity IDs remain
separate and unknown. `irisContractComplete=false`.

## Matching and validity

Supported syntax includes names with an optional namespace, whitespace-separated
selectors, exact `:property=value` predicates, standard properties separators,
comments, CR/LF/CRLF, continuations and ASCII Unicode escapes. Default namespace
is `minecraft`. Duplicate property keys retain their first insertion position
and last value. Different numeric spellings of the same ID replace that ID's
selector group without moving its first position. The first matching group wins.
Predicates on nonexistent reference properties are ignored, as in the pinned
Iris implementation; an existing property with an unknown value is different.

An explicitly supplied empty table yields known unassigned ID−1 for known
canonical states. Missing/removed tables or unknown source/canonical states
yield unknown, zero/false optional bindings. ID0 and known unassigned−1 are not
confused with unknown. Accepted IDs are−1..2147483646; values such as16777217
remain exact integers throughout the native binding. No float conversion or
packed vertex encoding is claimed. Unsupported negative/out-of-range keys fail
the whole parse, rather than wrapping or installing a partial table.

For an incomplete supported slab descriptor, the resolver checks both possible
waterlogged states. It releases an ID only if both produce the same first-match
result. This prevents skipping a possibly matching earlier rule in favor of a
later general rule. Invalid enum values match no state; agreeing alternatives,
unconditional earlier matches and unassigned results can still be known.

Recognized preprocessing directives, includes, macros, tag selectors, render-layer
overrides, comma predicate lists and malformed selector syntax are rejected.
The explicit preprocessed-input precondition still applies; this directive
check is not a substitute for the separate future pack preprocessor.
The module does not silently load a reduced pack. A missing block.properties
file does not invent Iris's legacy IDs; that separate fallback remains open.
Other reference names remain unknown until the canonical source mapping covers
them. These limits are explicit; no general shaderpack compatibility is claimed.

The actual1.11.7 artifact parses integer keys, preserves ordering and uses
`putIfAbsent` for first-match precedence. Its predicate comparison uses exact
`String.equals` and does not split comma lists. This differs from part of the
current web documentation; the bounded implementation rejects that syntax.
Four exact artifact class hashes and supporting public-source hashes are
recorded in [iris-material-id-reference.json](iris-material-id-reference.json).
The public source commit is supporting evidence, not asserted to be the exact
release tag. Reproduce with `node tools/audit-iris-material-ids.cjs`; no Java
bytecode or public source is executed.

## Slab correction and remaining source states

The user's21 October observation prompted a targeted source check. For the six
supported source slab families, the observed effective registration is solid,
model, nonopaque and **nonfluid** (flags9). The pinned physics adapter reads
`registry.Xz[cell block ID]`; these source slab states do not carry a second
fluid occupancy in that contract. Their canonical mapping now explicitly sets
`waterlogged=false`. This is a bounded inference from those exact registrations
and source path, not a generic dry default for an unknown/custom/future block.

Canonical mapping contract2 therefore supplies complete states for30 cube and6
horizontal slab families. The slab families are Messy Stone Slab, Stone Slab,
Smooth Stone Slab, Stone Bricks Slab, Mossy Stone Bricks Slab and Andesite Slab.
Bottom/top and dry state are known. A changed fluid/model/solid/opaque flag,
unrecognized suffix, source identity mismatch, vertical side slab or unsupported
rotation still prevents a canonical identity.

Still open in the current mapping:

- Vertical `side` slabs, unsupported rotations and additional/custom metadata.
- Water/lava, Grass Block, logs and other families outside the explicit36 rules.
- Doors: source rotation1–4, open/closed and distinct top/bottom entries exist;
  the exact Minecraft facing/half/hinge/powered mapping is not implemented.
- Stairs: source rotation1–4, bottom/top and inner/outer corner variants exist;
  the exact Minecraft facing/half/shape mapping is not implemented.

Thus the remaining door/stair gap is an adapter mapping task, not a claim that
Bloxd lacks their familiar behavior. Exact source inventory and actual Java26.3
DoorBlock/StairBlock property definitions are retained in the canonical
[source/reference evidence](bloxd-minecraft-block-reference.json). The0.6.31
statement that these six slabs' waterlogged value is unknown is superseded.

## Native integration, bounds and verification

`IrisPlan::blockIds` is an optional shared immutable table. A frame retains its
snapshot; replacement during drawing prevents commit. Resolved values are
cached once per referenced definition per frame, at most256 entries, and shared
by world/shadow draws. Cache reset/replacement cannot relabel prior frames.
Source registration, initialization barrier, exact geometry/instance uploads,
epoch/frame/origin/viewport and expiry guards still apply. Generic geometry,
hands and unapproved instance ranges do not acquire a terrain pack identity.

Only consumers of PackBlockId split ranges on its resolved value and validity.
Equal resolved IDs merge across unused raw source-name/ID/property boundaries;
programs without this input retain their previous draw behavior. No GPU buffer,
texture, target, readback or source observer is added. Source/wire/proof budgets,
512-MiB targets,64-MiB motion and all old wire layouts are preserved.

Input is capped at256KiB,4096 property keys,8192 selectors and16 predicates per
selector. Conservative final-table accounting including vector capacity is
capped at1MiB; temporary parsing structures are additionally bounded by the
input/key limits. The per-frame cache is bounded by the existing dictionary.
Failed parsing returns no replacement table. Runtime code has no file, account,
profile, client-launch or public-module execution path.

Pure verification covers ordered/duplicate/escaped/multiline properties,
first-match and incomplete-state consensus, dry slab state, known0/−1/high IDs,
invalid/unsupported input and budgets. Actual Capture fixtures traverse the
fragmented native pipe into world/shadow draw callbacks. Tests include cache
reuse, equal-ID range merging, map changes/removal, generic/instance guards,
required/optional validity, malformed transactions, expiry during drawing,
resize, replaced uploads, reset, failure without commit and stable GPU resources.
The new GLSL probe preserves integer bits through two16-bit output words.

Final verification:353 pure Node/DOM/VM tests,39 launcher syntax files and both
generated preloads, native CPU contracts,14 GLSL compile/link checks and
MemoryBudgetTests passed. Setup/Portable/Update0.6.32 are byte-checked:46 sources
match0.6.31, only the version in package.json and intended native binary differ.
Six previous production shader literals and MemoryBudgetRunner are unchanged.
Reports: `outputs/pack-block-material-ids-0.6.32/`. No client, account, installer
or graphics context started; no profile changes, installation or upload.

World time/weather, reference lightmap/scalar emission, full hand/player data,
remaining source families, preprocessing/tags/legacy/layers, shader translation,
production activation and real user image/FPS acceptance remain open.

Sources: [Iris block.properties](https://shaders.properties/current/reference/miscellaneous/block_properties/),
[Iris mc_Entity](https://shaders.properties/current/reference/attributes/mc_entity/).
