# Observed source block names and properties

Follow-up0.6.31: explicit bounded canonical Minecraft names/states are now
attached natively; see [MINECRAFT-BLOCK-MAPPING.md](MINECRAFT-BLOCK-MAPPING.md).
The0.6.30 source-registry description below is historical; its wire/lifetime
contract is preserved. Pack IDs and the other reference gates remain open.

21 October 2026, 0.6.30. `sourceBlockMaterialContract=1`,
`sourceBlockIdentityContract=1`, `sourceBlockEmissionContract=3`,
`irisContractComplete=false`. This completes the bounded source-registry portion
following 0.6.29. It does not implement Minecraft names/states or pack material IDs.

## Proven producer and lifetime

There are two distinct source registries. Engine `root.As` stores effective
block flags and render resources. The joined game object `root.bloxd`, with
`bloxd.my === root`, exposes `bloxd.As.metadatas`; source `getItemId` and
`getItemName` use its string/numeric aliases. The source builds frozen `meta`
objects containing root name/ID, full metaStr and variant values. Actual render
registration passes each metadata record's `id` to engine `As.vz`.

The existing authorized, transparent `As.vz` observer now samples that metadata
before the original call and confirms it after success. Names must have matching
numeric/name aliases, IDs and root aliases; `meta` must be frozen, own data
fields must have valid types, and source property arrays must be known booleans.
No source getter, lookup method, mesher or simulation is invoked. No source
table is scanned, wrapped with accessors, frozen or modified. Original receiver,
arguments, return value and exceptions retain their source behavior.

Each successful observed registration gets a new adapter token; same-value
re-registration also revokes the old token. Tokens are observation identities,
never invented source counters. Late attachment cannot certify past calls.
Terrain takes a token barrier at its actual observed worker initialization.
A homogeneous center-owned face can retain only an already observed definition
at/before that barrier. New registrations cannot label an old job or installed
geometry; a fresh observed initialization/job/installation is required. Instances
retain the token at their observed allocation alongside existing slot lifetime,
registry and mesh/instance-upload proofs. Slot swaps retain the moved identity.

Values/aliases/frozen-object identity/property flags and owners are checked again
before export. Replacements, observed mutation, missing data, a mutable meta,
lost observer ownership or registry update yields unknown metadata. The same
definition is checked once per reply/packet, not for each repeated face/run.
Arbitrary transient unobserved writes are not claimed observable. Raw block ID
and own RGB remain independent and can remain valid when metadata becomes unknown.

## Atomic wire and native use

Type **33/v5** adds a dictionary before v3/v4-style mesh entries:

- After epoch/version/nested-size/entry-count: definition count, 1..256.
- Per definition: token, source ID, root ID, effective flags, rotation, open,
  half-placement and three byte lengths (all uint32).
- Exact source name, root name, and full metaStr concatenated as printable ASCII,
  each at most 128 bytes, followed by zero padding to four-byte alignment.
- Terrain v4 runs gain one definition-token word; instance v3/v4 records gain
  the same final word. Zero means unknown. Every nonzero token must refer to a
  dictionary definition with that exact known raw block ID; every definition
  must be referenced. Duplicate tokens/IDs, bad lengths/characters/padding,
  wrong IDs, dangling/unreferenced entries and invalid enums are rejected.

The complete unchanged source frame/light/GPU transaction follows the entries.
JS/native validate the entire packet before accepting camera, GPU or dictionary
state. v5 is emitted only with known referenced definitions; other transactions
retain the existing v1..v4 encoders. Layouts1..32 and33/v1..v4 remain readable.
Replay/250-ms freshness, epoch, root/player/camera/origin, viewport, upload
sequence, source-render high-water mark and failed-frame commit gates remain.

Native retains exact names/root names/full metaStr in `currentDefinitions` for
the authorized frame. This is source metadata for a future explicit mapping,
not a hash pretending to be a Minecraft name. Actual world/shadow callbacks can
consume typed source-only draw constants:

| Uniform | Actual source encoding |
| --- | --- |
| SourceBlockRootId (`int`) | Source meta.rootId, not a Minecraft registry ID |
| SourceBlockProperties (`int`) | Bits 0..3: effective solid/os, opaque/Qs, fluid-UR/Xz, custom-model/us |
| SourceBlockState (`vec3`) | Rotation: null=0 or source 1..4; open: null=0, false=1, true=2; placement: null=0, bottom=1, top=2, side=3 |

Each optional binding has its own bool validity and resets to zero/false when
unknown. A required unknown fails without history commit. The encoded nulls
are known absence of source variant fields, not guessed neutral Minecraft states.
No axis/facing conversion, transparency equivalence, time/weather, scalar
emission, reference lightmap, or reference hand input is inferred. Source inputs
require a `source` prefix; reference SemanticIds stays unknown. Hands receive no
world block definition. Instance splitting still requires explicit approved
range semantics. Consumers split only on fields they use; unused material
boundaries add no draws to block-ID/RGB-only programs.

## Budgets and verification

At most 256 directly observed definitions; exact copied strings plus fixed
metadata charges, face token arrays and optional exported token arrays share the
existing 1-MiB proof pool with RGB/identity/instance proofs. Overflow remains
unknown; unobserved definitions are not reconstructed later. The native dictionary
is also capped at256. Packet/run/entry limits remain 1MiB/8192/8192. No new GPU
buffers, targets, textures, readbacks or source calls; 512-MiB targets and64-MiB
motion budget remain. Removal/stop/reset release corresponding proofs; failed
transactions clear native metadata authorization.

Reproduce the static audit with `node tools/audit-source-material.cjs`:
14 pinned public bundle hashes and12 exact producer spans, text/bytes only.
[Evidence](bloxd-source-material-reference.json). Runtime still requires the
q9aot structural profile; the saved3ymzdd inventory is not new runtime support.

Pure checks cover observed/late/changed registration, initialization barriers,
name/root aliases, frozen meta, getters, property/owner changes, slot swaps,
proof budgets and cleanup; actual Capture bytes through fragmented native pipes,
typed world/shadow draws, required/optional validity, malformed dictionaries,
failure/expiry/resize/upload replacement, complete nested light/GPU frames and
unchanged CPU batches. These establish code/data behavior, not real GPU images
or FPS. No client, account, installer or graphics context is started.

Final pure verification:346 Node/DOM/VM tests,39 launcher syntax files and both
generated preloads, BridgeCpuTests including material-only/properties-only draws
and expiry during drawing,13 GLSL compile/link probes and MemoryBudgetTests.
Native application compiled only. Existing MSVC warnings in older packet/test
code remain. Reports and source/package byte comparisons are saved under
`outputs/source-material-registry-0.6.30/`.

Next: an explicit justified source-name/property -> Minecraft name/state mapping,
then the separate pack's block.properties resolution. Unknown/custom variants
must remain unknown until that mapping exists. The overall renderer, step1's
other reference inputs, shaderloader, production recipe and user image/FPS
acceptance remain open.
