# Explicit Minecraft block identities — contract 1

**Current0.6.39 / contract3:** ten exact stair families and Jungle/Cherry door
halves now map canonical properties through the existing native decoder and
internal pack-ID bindings. Door power remains unknown. Geometry evidence,
first-match consensus, limits and current open gates:
[SHAPED-BLOCK-MAPPING.md](SHAPED-BLOCK-MAPPING.md). The account below is historical.

**Superseded in0.6.32:** canonical contract2 now proves `waterlogged=false` for
the six exact supported nonfluid horizontal slab families. Their reference
states are complete. The internal pack-specific ID resolver is also implemented.
Current evidence, unknown-state list and limits:
[PACK-BLOCK-MATERIAL-IDS.md](PACK-BLOCK-MATERIAL-IDS.md). The0.6.31 account below
is historical; its earlier unknown-water statement no longer describes these
six families. Source/registration/upload lifetime restrictions remain in force.

21 October 2026, release 0.6.31. This closes a bounded part of the material-data
step, not the whole renderer or Iris contract. `irisContractComplete=false`.

The native decoder now attaches an explicit canonical Minecraft name and the
known reference properties to each supported, proven source definition in
Type33/v5. No wire layout changed. Versions1–4 remain readable and do not gain
names from numeric IDs. The original source name, family, state, ID and flags
remain available independently.

The curated [mapping table](bloxd-minecraft-block-map.json) contains30 full cube
families with complete empty reference property sets, plus6 slab families with
known `type=bottom` or `type=top`. Examples:

| Exact Bloxd family | Canonical Minecraft identity | Properties |
| --- | --- | --- |
| Stone | minecraft:stone | Complete, no properties |
| Messy Stone | minecraft:cobblestone | Complete, no properties |
| Snow | minecraft:snow_block | Complete, no properties; not a snow layer |
| Glass | minecraft:glass | Complete, no properties |
| Stone Slab | minecraft:stone_slab | type=bottom or top; waterlogged unknown |

These are deliberate renderer identity mappings, not assertions of equal game
mechanics, light values, resource textures or numeric registry ordinals. They
are also not shaderpack IDs. The future loader must resolve the canonical names
and known properties against that pack's `block.properties` rules. `SemanticIds`
still binds zero/false when optional and fails when required; no `mc_Entity`
values are fabricated by this change. No pack parsing, loader, production
recipe or additional shader draw is enabled.

## Evidence and boundaries

The official public26.3 client JAR is downloaded as reference bytes only to
`outputs/minecraft-block-reference/reference.jar`. It is not installed,
executed or included in the distribution. The official version metadata SHA1
is checked, then the41,483,720-byte JAR's SHA1
`e877b6a07acd633fb3bb475002175cec036e7b87`. ZIP/JSON/class-file readers inspect
the actual target resource names, block registrations, constructor factories
and inherited `createBlockStateDefinition` methods. For the30 cube targets,
the effective definition has no properties; for SlabBlock it contains TYPE and
WATERLOGGED. This prevents treating a model's ignored properties as absent.

The pinned q9aot public source supplies concrete block definitions, textures,
the frozen metadata parser and the slab generator. Its base slab spelling is
`Stone Slab` with `meta|rot1|bot`; the top spelling is
`Stone Slab|meta|rot1|top`. The generator separately emits vertical sides.
The observed registration supplies effective source flags9 (solid/model,
nonopaque/nonfluid), rotation1, half1/2 and null-open0. All must agree. Source
side slabs and other rotations remain unmapped. WATERLOGGED is not observable
from this source contract and remains unknown, never a dry default. Slab states
therefore remain explicitly incomplete even when their name/type are known.

Cube rules require exact case-sensitive source/root names, sourceID==rootID,
empty metaStr, null rotation/open/half and exact effective flags. Unknown names,
extra suffixes, contradictory properties, unsupported families and custom
variants remain unknown. There is no lowercasing, fuzzy matching, suffix
stripping, lookup by numeric sourceID or fallback to the root's mapping.
Grass Block, water/lava, logs, doors, stairs and other unlisted families remain
open. In particular an arbitrary Stone variant does not inherit Stone's name.

Static evidence and registration/class chains:
[bloxd-minecraft-block-reference.json](bloxd-minecraft-block-reference.json).
The mapping choices are explicit project policy supported by those source and
reference facts; the two games do not publish a universal equivalence registry.

Reproduce the byte/text audit without executing either game:

```
node tools/fetch-minecraft-block-reference.cjs
node tools/audit-minecraft-block-map.cjs
```

The first command downloads only the pinned reference JAR and metadata. The
second checks its actual hash and the pinned Bloxd bundle, then regenerates the
bounded native include and evidence report. Existing unchanged includes retain
their timestamps. Neither command evaluates public JavaScript or Java code.

## Lifetime, cost and verification

The mapping is calculated once per decoded definition (at most256 per packet,
36 rules), before the entire transaction is accepted. Names/property values
refer to static compiled strings; mapping adds no per-definition string
allocation. It adds a bounded descriptor to the existing native dictionary,
not a second per-mesh/per-instance registry. GPU resources, source observations,
Capture's shared1-MiB proof pool, wire1-MiB/8192-run limits, target512-MiB and
motion64-MiB budgets are unchanged. Programs that consume only the previous
source values retain their draw coalescing; canonical data adds no draw splits.

Consumers must obtain the descriptor through the authorized source material
for the current run (`GeometryMatrices::sourceMaterial` for the initial bind,
and the per-run material passed to `bindSourceMaterial`), not by treating a
retained dictionary as a fresh frame. The same source registration, worker initialization barrier,
instance lifetime, exact upload, frame/epoch/origin/viewport and expiry guards
apply. Required unknown data, malformed packets, source replacement, expiry,
reset, resize and failed drawing retain their previous rejection/commit rules.

Pure checks include all36 rules and contradictory flags/names/states/IDs,
actual Capture bytes with bottom/top/side spellings through fragmented native
pipes, retained canonical descriptors, real world/shadow binding callbacks,
unknown pack semantics, previous layouts and failure/expiry/resize/reset cases.
The complete native source-material lifecycle tests also run for the slab
fixture. No client, account, installer or graphics context is started.

Final verification:350 pure Node/DOM/VM tests,39 launcher syntax files and both
generated preloads, BridgeCpuTests,13 GLSL compile/link checks and
MemoryBudgetTests passed. Setup/Portable/Update0.6.31 are byte-checked; all46
packaged sources match0.6.30, with only the version in package.json and the
intended native renderer binary changed. All36 canonical names are present in
that binary; six existing production shader literals and MemoryBudgetRunner
are unchanged. The reference JAR is excluded. Reports:
`outputs/minecraft-block-map-0.6.31/`; artifact hashes in the release folder.
Nothing installed, started or uploaded; no real GPU image/FPS claim.

Sources: [official26.3 release](https://www.minecraft.net/en-us/article/minecraft-java-edition-26-3),
[official version metadata](https://piston-meta.mojang.com/v1/packages/61fff1316bd50312624a858bbb5eb18fa45208ed/26.3.json),
[Iris block.properties specification](https://shaders.properties/current/reference/miscellaneous/block_properties/).

Next is pack-specific name/property-to-ID resolution in the separate loader.
Reference lightmap/scalar emission, world time/weather, hand/player inputs,
remaining source families and actual user image/FPS acceptance remain open.
