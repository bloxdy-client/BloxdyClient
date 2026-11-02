# Source block identity and remaining Iris data gates

21 October,0.6.30 follow-up: observed source metadata registration, frozen family/
variant state and effective render properties now reach actual world/shadow
bindings through optional type33/v5 dictionaries. Raw identity and RGB contracts
are preserved. Minecraft name/state mapping remains open. New current scope,
lifetimes, wire and gates: [SOURCE-BLOCK-MATERIALS.md](SOURCE-BLOCK-MATERIALS.md).

20 October 2026, release 0.6.29. `sourceBlockIdentityContract=1`,
`sourceBlockEmissionContract=3`, `irisContractComplete=false`.

This is a bounded material-data increment within step 1, not completion of the
world/weather/light/material/hand reference contract. No production recipe,
shaderloader or new visible effect is enabled.

## Implemented chain

Observed source worker initialization/job -> returned immutable center block
array and face layout -> exact installed geometry bytes -> exact triangle and
submesh remapping -> atomic type 33/v4 -> JS and native validation ->
`GeometryUniform::SourceBlockId` in actual Gbuffers and Shadow draw callbacks.
The existing observed instance lifetimes use the same binding with their
source block/register/lifetime and mesh/instance-upload generation checks.

Raw IDs are unsigned source values 0..65535. The uniform is an `int` named with
the `source` prefix. It is not `mc_Entity`, a Minecraft registry ID, or a pack
material ID. Iris assigns pack IDs from Minecraft names and properties through
[block.properties](https://shaders.properties/current/reference/miscellaneous/block_properties/).
That separate mapping is still missing. Required unknown reference inputs still
fail, and optional inputs are reset with explicit false validity.

Block identity and own RGB have independent validity. A complete center-owned
face with one source ID may have unknown own RGB. A greedy face containing
different source IDs has unknown block identity even when every cell emits the
same RGB. Known raw zero differs from unknown. Boundary owners outside the full
center array, crossed-face triangles, arbitrary blockId attributes, regular or
deformed instances, late/missed source observations and unsupported layouts
remain unknown. No averaging, material/atlas heuristic or extra chunk queries.

Immutable copies are taken before source pool reuse. Subsequent pooled-array
changes cannot relabel installed geometry. Exact source bytes/indices, source
ownership and export sequences are checked again; new mesh/instance uploads,
missed ownership, reinitialization and failed source frames revoke authorization.
Existing source registry and instance-lifetime invalidation remain in force.
The raw terrain ID supplies no new block-name/property registration proof.

## Wire, storage and drawing

Type 33/v4 keeps v3's six-word entry header: mesh ID, geometry sequence, proof
token, kind, instance sequence (zero for terrain), run count. A terrain run has
three uint32 words: exclusive index end, unchanged RGB/validity word, raw
block/validity word. The last word is **0 for unknown**, otherwise
`65536 | sourceBlockId`; only 65536..131071 are accepted. All indices in a known
run belong to the exact proven face(s). Instance records keep v3's five words
and nonzero block/register/lifetime requirements unchanged. Legacy 33/v1/v2
terrain IDs remain unknown; existing 33/v3 instance IDs are also consumable.
All layouts 1..32 and 33/v1/v2/v3 remain readable.

The unchanged complete nested source frame/light/GPU packet is validated before
accepting any camera, GPU or identity state. 250-ms expiry, root/camera/player/
origin/viewport consistency, source-render high-water mark, replay rejection and
failed-frame commit protection apply to block-only programs too. Hands receive
no world block identity. Instance splitting requires `sourceInstanceRanges`,
excluding reliance on unsplit `gl_InstanceID`.

IDs and RGB are draw constants with separate validity, never interpolated.
Consecutive ranges merge according to the inputs the program consumes: an
RGB-only program does not gain draws merely because unused block IDs differ.
No new VBO, texture, render target or GPU readback. Exact added face-ID/run arrays
are charged to the existing shared 1-MiB source-proof pool. At most 8192 total
runs/entries and a 1-MiB packet; the 512-MiB target and 64-MiB motion limits stay.
Overflow remains unknown. Stop/removal/reset free proof arrays.

Production always enables the v4 identity encoder. `fixture:true` mocks may
explicitly select `sourceBlockIdentity:false` to preserve the independently
tested legacy encoders and historical native fixtures. New tests include the
default encoder without that fixture-only override.

## Evidence and remaining gates

`node tools/audit-source-block.cjs` checks 14 existing local public bundle hashes
and 15 exact producer/clock/hand excerpts as text only. The inventory includes
three separately pinned 3ymzdd sources. This does not add 3ymzdd runtime renderer
compatibility: runtime structural guards remain q9aot and are not cryptographic
bundle attestation. Evidence: [bloxd-source-block-reference.json](bloxd-source-block-reference.json).

| Step-1 obligation | Status after this increment |
| --- | --- |
| Raw block identity for supported faces/instances | Implemented and CPU verified through actual draw callbacks |
| Block names/properties and Minecraft/pack material mapping | Open: generation-bound registry mapping and justified names/states needed |
| Source world/held/sky lighting | Existing type-32 source bindings retained |
| Reference worldTime/worldDay | Open: no authoritative world epoch/day/tick chain; effect clocks are insufficient |
| Reference weather/wetness | Open: no proven producer/unit/update chain; word absence does not prove clear weather |
| Reference scalar own emission/lightmap | Open: source RGB is not the Java scalar/lightmap contract |
| Reference HUD hand camera | Open: observed source projection is separate from reference HUD-FOV/far/hurt/view-bob |
| Real GPU/image/FPS acceptance | Open; performed exclusively by the user |

The live Iris [world/weather documentation](https://shaders.properties/current/reference/uniforms/world/)
was checked as additional guidance; the pinned target stays Minecraft Java 26.3 /
Iris 1.11.7. No reference requirement is declared closed by raw source IDs.
Next material work: establish the exact source name/property registry and its
generation relationship, then define an explicit Minecraft name/state mapping;
do not reinterpret numeric source IDs or infer world/weather data from appearance.

Verification covers actual Capture bytes (uniform/mixed/equal-RGB/unknown-RGB/
zero/remapped terrain, instances, mixed terrain+instances and light+GPU), fragmented
native pipe ingress, draw-only ID consumers, old senders, reflection/name guards,
optional reset, required failure, expiry/replay/resize/rebase/upload changes,
failure without history commit, stable resources and bounded storage. CPU mocks
and GLSL compilation cannot establish live image equality, FPS or universal
source coverage. No client, installer, account or graphics context is executed.

Verified set for 0.6.29: 338 pure Node/DOM/VM tests, 39 launcher syntax files and
both generated preloads; BridgeCpuTests with the actual wire fixtures, twelve
GLSL compile/link probes, MemoryBudgetTests and native compilation. Existing
MSVC warnings in older packet/test code remain. Reports and fixture/source
hashes are saved under `outputs/source-block-identity-0.6.29/`.
