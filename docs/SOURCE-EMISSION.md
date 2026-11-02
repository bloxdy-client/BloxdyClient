# Own RGB block emission — terrain faces and observed object instances

20 October, 0.6.29 follow-up: type33/v4 adds independent raw source block
identity for supported terrain faces and consumes existing instance identities
as `SourceBlockId`. RGB semantics and sourceBlockEmissionContract=3 remain.
Legacy33/v1/v2/v3 stay readable; reference scalar/ID meanings stay unknown.
See [SOURCE-BLOCK-IDENTITY.md](SOURCE-BLOCK-IDENTITY.md). Earlier wire descriptions
below specify the preserved layouts, not the newest sender.

20 October 2026. `sourceBlockEmissionContract=3`, `irisContractComplete=false`.
A bounded source-emission path is now implemented in the experimental renderer.
Existing layouts 1–32, type 33/v1/v2 and sourceFrame/sourceGpuParticle/sourceWorldLight
contracts remain unchanged. Type 33/v3 adds observed instance identity and RGB.
No production recipe or scalar reference conversion. The instance extension is
included in 0.6.22; building or inspecting packages never starts the client or installer.

## Source provenance and authorization

The user expressly authorized a temporary transparent observer around native
`Worker.prototype.postMessage` on 19 October. It forwards only source-initiated
calls, exactly once, preserving receiver, argument identities, return value and
original exception. It never constructs a Worker, initiates a message, runs a
source mesher, changes registry/block fields or repeats initialization. A native
method is required outside inert fixtures; foreign wrappers are not adopted.
Stop removes listeners and restores the original method only while still owning
that prototype slot. Default renderer never installs this capture observer.

Eleven locally saved bundles are SHA-256 checked and 34 literal spans extracted
by `node tools/audit-source-emission.cjs`; no source bundle is evaluated.
Evidence/coverage: [bloxd-source-emission-reference.json](bloxd-source-emission-reference.json).
The runtime uses explicit pinned profile/shape guards, not a claim that a
function-pattern check is a cryptographic runtime bundle attestation.

Registration `As.vz(id, options)` writes `Us[id]` from `sO` independently of
`Bz[6*id+face]` materials. Public RGB units are 0–15. The writer may clamp negatives
or store null, and packing uses `R | G<<4 | B<<8`; arbitrary caller values are not
silently accepted. At actual `meshingInit`, the observer copies the Uint16 lookup
and marks an entry known only if the current raw registered value is null
(known zero) or three integers in 0–15 exactly matching the packed value.
Missing registrations, fractional/out-of-range values and shared buffers remain
unknown. The root/manager/registry must already be identified at initialization;
late attachment cannot reconstruct a missed worker initialization.

The same worker must subsequently send a real `Oy` job with the manager's
`tempChunk` and source meshJobId. Its full `meshed` reply jointly contains that
job ID, vertexDataInfo, faceLayout and reusableChunkArrs. Slot 7 is the exact
copied center block array. Reply observation runs before the source-installed
onmessage handler returns those arrays to the reusable pool. No pooled block
reference is retained. Chunk.Zs is a real edit revision, but is absent from the
job and reply; no adapter serial is presented as Zs or another source revision.

## Implemented geometry scope

| Variant | Status and exact condition |
| --- | --- |
| Ordinary terrain / unit faces | Known individually for an observed buffer generation with exact source face, center-cell and worker-register association; RGB may differ between faces of one returned group. |
| Greedy rectangles | Every contributing center-owned cell is checked using the mesher's face coordinates, direction, width and height. Same material or propagated light is insufficient. |
| Material-separated returned groups | terrainID joins the returned face layout to the returned buffer; each group is checked independently. It is never treated as a block ID. |
| Submesh/index remapping | Each exported triangle maps through the actual vertexMap to three distinct vertices of one source face and matches the exact immutable source index slice. Partial quads and homogeneous subsets of mixed groups retain the face proof. |
| Mixed RGB in one returned group | Supported as consecutive index runs, including known RGB, known zero and unknown faces. Index order, winding and source triangulation are retained. |
| Mixed or ambiguous owners within a single face | That whole face remains unknown, including when exported as just one triangle. All cells of a greedy face must be proven and have identical own RGB; no averaging or first-cell label. |
| Boundary owners outside center array | Unknown; neighboring pooled arrays are only partially initialized. No neighbor queries or extra chunk requests. |
| Object/thin instances | Implemented for complete storage lifetimes observed from creation through Ms/native matrix append and successful UO upload. Mixed RGB and known zero are supported per slot. Late attachment, custom yz transforms, missing registration data and lost observation remain unknown. |
| Regular instances, deformed geometry, compact-only stand-ins | Unknown; no proven slot/pose/block-generation association in this path. |
| Missing initialization, unmatched/late response, worker/root replacement | Unknown. No initialization replay or fabricated registration revision. |

Raw source vertex stride is 28/32 bytes. All four face positions must match the
actual source builder equations, indices must be valid, and retained source
vertex bytes and indices must match exactly at capture and draw observation.
Current raw register entries must still match the recorded values. Reinit,
changed storage/bytes/register, foreign prototype ownership or removal revokes
validity. A light-only response creates no new proof. Existing unchanged geometry
may keep its original proof, since propagated light is a separate channel.

## Implemented instance observation — authorized 19 October 2026

After the audit below, the user explicitly approved additional transparent
observers for registration, instance changes and matrix/upload calls. They only
forward source-initiated calls, once, with the original receiver, argument
identities, return and exception. No registry/block values are written, source
functions replayed, simulation invoked or client started. Stop restores owned
method slots; foreign replacements are preserved. Default mode never installs
Capture or these observers.

The bounded adapter observes `As.vz`, `zs.Ms/Ds/iy/Hf/wf/ey`, `root.emit`, the
native `Float32Array.prototype.set`, and `PO/UO` on newly observed object meshes.
The typed-array observer only records 16-element writes during an original,
synchronous Ms call. A source `addingTerrainMesh` during this call starts a known
empty storage lifetime. The append target must be the mesh's actual matrixData,
and its actual destination offset must equal the next live slot. Ms supplies the
block ID, chunk object, Pf object and coordinate key; successful completion must
confirm that same Pf association. This joins an observed operation to the actual
write, rather than interpreting a matrix or slot as a block ID.

Removal follows the pinned last-slot swap, preserving the moved slot's identity.
Reinsertion gets a fresh lifetime token. Emission and the current register array
are captured at allocation; `vz` revokes affected storage, including same-value
re-registration. Registration during allocation is rejected even if values return
to their previous state. Register and lifetime tokens are **adapter observation
identities**, never invented source revision counters or Minecraft IDs. When the
last tracked reference disappears, its registration observation can be released;
a later observation may get a new token even without a source re-registration.

Only a successful matrix UO followed by the light UO can commit a snapshot with
the exact live count. Matrix bytes, matrix-buffer identity/write revision,
register/Pf association, observer ownership, frame and export sequences are
rechecked before use. Buffer replacement, failed uploads, source exceptions,
chunk replacement/disposal, unknown RGB, custom yz callbacks, missed creation,
root/manager replacement and exhausted storage revoke knowledge. Rebase changes
matrix bytes and needs a fresh observed upload. Fallback/write-tracking gaps
invalidate committed snapshots. Existing unidentified storage is never guessed
from its current matrices, atlas, generic blockId attributes or the separate
Fs/sy generic object-ID system.

Type **33/v3** keeps the envelope header and nested 30/31/32 frame choices. Each
entry contains six uint32 words: mesh ID, type-3 sequence, proof token, kind
(0 terrain, 1 instance), type-9 sequence (zero for terrain), run count. Terrain
runs retain v2's two words. Instance records contain five words: exclusive slot
end, RGB/validity value, raw Bloxd block ID, observed registration token, slot
lifetime token. Instance ends advance by exactly one; lifetime tokens are unique
within an entry. Block IDs are 1–65535 and tokens nonzero. Native validates full
coverage against the imported instance count and BOTH upload sequences before
accepting the frame. The record remains attached to the actual native draw.
Old v1/v2 senders and receivers of their unchanged layouts retain their meanings.

RGB remains a vec3 plus bool draw constant. Instance draws reuse the existing
72-byte instance VBO and EBO, shifting all matrix columns and instance extras to
the selected slot. No new GPU buffer is allocated. A consuming internal program
must explicitly declare `sourceInstanceRanges=true`: it must not depend on the
unsplit value of gl_InstanceID. Other programs retain an unsplit draw with unknown
optional emission; required emission fails. No production program is activated.

The existing 1-MiB accounted proof pool is shared with terrain proofs: 256 bytes
per tracked storage, 256 bytes plus UTF-16 key bytes per live slot (including its
64-byte matrix snapshot and fixed metadata charges), and exact exported arrays
plus 32 bytes per export. At most 256 storages and 8192 slots per storage; the
shared byte budget usually binds earlier. Registration entries have counted live
references and are released with the last slot. Source-owned arrays/chunks are
referenced, not copied in full; JavaScript allocator overhead is independently
bounded by object counts. Overflow yields unknown before allocating a snapshot.
Removed storage and stop release hooks and proofs. Unselected native exports
release their run arrays; still-live source slot ledgers remain bounded so a later
selection can be identified. There is no additional full-scene/chunk scan or
per-frame matrix copy. Draw-time byte validation and per-slot draw calls add
bounded work; no live FPS improvement is claimed. Native targets/motion budgets
remain 512 MiB/64 MiB, with at most 8192 records and a 1-MiB envelope.

New inert Capture tests cover mixed RGB/zero, exact identity tokens, swap and
same-key reuse, uncommitted mutation, register ABA and re-registration during
allocation, late attachment, chunk disposal, buffer changes, incomplete/failed
uploads, rebase, observer loss, frame conflict, stop and proof-budget overflow.
Actual Capture bytes pass the JS validator and native pipe/decoder to real CPU-
mocked world/shadow draws, with exact matrix/extras offsets, stale-sequence and
invalid-identity rejection, program-range opt-in, expiry and failed commit checks.
Final test counts and release checks are recorded in PROJECT-CONTEXT.md.

## Historical instance audit — before the additional observer authorization

The five additional complete, hashed producer spans are `instanceLifetimeStorage`,
`instanceOwnershipManager`, `instanceRegistryOverwrite`,
`instanceChunkCreateAndReplace` and `instanceChunkEditAndDispose` in the evidence
JSON/fixture. They are extracted as text from the existing pinned `public-8.js`;
no public function is evaluated. This is an audit with a concrete blocker, not
an implemented instance-emission path or a new release. Contract 2 is unchanged.

The source relation is **live slot s < storage.count -> storage.Df[s] -> absolute
coordinate key -> owning chunk.Pf[key] -> Bloxd block ID**. The inverse is
`storage.jr[key] == 16*s`, and the manager's closure-local `Os[ID]` must select
that exact storage. Chunk ownership is required: the coordinate string alone
does not identify a chunk lifetime. `KN.tf` contains meshes, not storage objects.
`addingTerrainMesh` exposes the mesh, not the `zN` owner. Neither the identified
mesh nor its matrix/light stream exports `Os`, `jr`, `Df` or a register generation.

| Source operation | Proven behavior | Consequence for identity |
| --- | --- | --- |
| `KN.Ms` / `zN.VO` | Reads previous ID from chunk.Pf, removes old entry, appends new key at count, writes jr offset and matrix; then records block ID in Pf. Optional yz callback supplies a transformed matrix. | Matrix inversion cannot establish the source block or registration. Multiple IDs share storage when meshes or geometry jv match. |
| `zN.oO` | Deletes removed jr entry; copies last live matrix/light/key to the removed slot, updates inverse mapping and decrements count. | Slot number is unstable. Tail Df/matrix/light can remain populated beyond count; capacity is not live membership. |
| Reinsert at same coordinates | A removed key can be appended again, including the same block ID and matrix. | Key, ID and byte equality do not prove uninterrupted lifetime (ABA). |
| `zN.Kf` / `ce` | Capacity changes replace buffers and copy a prefix; ce commits count and matrix/light updates when FR is dirty. | CPU ownership mutations and the drawn upload are distinct boundaries. An observed Ms call alone cannot certify the draw. |
| `KN.iy`, chunk `Ls` / dispose | Removes each Pf entry through storage, sets Pf null; replacement creates a fresh Pf and increments chunk.Zs. Empty storage is disposed during ey. | Chunk replacement and empty-storage recreation end ownership. Zs is a chunk edit revision, not a slot or register generation. |
| `KN.Hf` / `wf` | Rebase changes matrix translations; light update changes Nf using the current ownership map. | Changed matrix/light does not necessarily mean a new block; neither carries own RGB. |
| `As.vz` | Overwrites model/callback/emission fields for an ID without emitting a registration generation or invalidating the cached Os storage in this function. | Current Us or bf cannot date existing slots. es(ID) returns cached storage first, before consulting the current model register. |

**Concrete blocker:** the available capture boundary lacks an immutable,
source-initiated association between the actually drawn instance upload and
its storage owner, live slot-to-chunk/block mapping, registration lifetime and
slot lifetime. The existing meshingInit observer covers terrain-worker jobs;
object-instance allocation does not pass through that worker job/reply. A
worker's emission lookup must therefore not be attached to object slots.
No alternate exported ownership producer was found in the eleven local bundles.
This is a conclusion about those inspected sources, not every possible build.

A future implementation needs a proven observation boundary exposing the above
tuple at allocation/removal/registration and successful upload, with complete
coverage from a known empty storage or an authoritative snapshot. Late attachment,
missed transitions, replacement and unknown ownership must revoke it. A transparent
wrapper of public Ms alone, a reconstructed closure map, extra world queries or
scanning all chunks does not fill this gap. No such wrapper, scan, source mutation,
fabricated source generation, new packet or native binding has been installed.

Regression checks pin the real source operations and use inert counterexamples
for alias IDs, same-key reuse and register ABA. The actual Capture VM test first
establishes valid terrain emission, then adds thin instances, swaps/reuses/removes
slots and changes/restores register RGB: no new type-33 authorization is emitted,
even with plausible blockId/Df/jr fields on the mesh. These are negative tests,
not evidence of successful instanced RGB delivery. Existing native unknown-data
and instance invalidation behavior is unchanged; no new native tests or GPU/image
claims follow from this audit. Targeted run: 113 Node/VM tests passed in
`outputs/instance-identity-tests.log`.

## Capture, transport and native consumption

A proof is recorded with the exported type-3 mesh packet sequence. This sequence
identifies an adapter upload transaction, not a source revision. The actual
ordinary world pre-draw observes proof, camera, player/origin and viewport;
conflicting observations in the same frame become unknown. Completed-frame and
send-time checks prevent later state from being mixed into the snapshot.

Type 33/v1, following the unchanged 16-byte BND1 header:

- epoch, version=1, nested byte length, entry count (four uint32 words).
- Per entry: mesh ID, exact type-3 packet sequence, actual source meshJobId,
  packed own RGB (four uint32 words). Presence means known, including packed 0.
- One complete unchanged type 30, 31 or 32 packet. No recursive type 33.

Maximum 8192 unique entries and 1 MiB for the entire envelope. JS and native
validate all lengths, versions, ranges, uniqueness, nested framing/epoch and
source frame before acceptance. Native additionally checks the imported mesh
sequence, terrain flag and absence of instances. Frame serial/render-frame
replay, 250-ms expiry and origin checks remain enforced. Unknown/legacy source
frames revoke emission authorization; pose/instance changes and mesh replacement
cannot reuse it. A failed combined transaction cannot accept a new camera or
retain GPU-particle readiness.

Type 33/v2 keeps the same four envelope words and inner frame choices. Each entry
has mesh ID, exact type-3 sequence, source meshJobId and run count. Each run is two
uint32 words: exclusive index end and value (`0` unknown, `0x1000 | packedRgb`
known, including `0x1000` for known zero). Starts are implicit from zero and the
preceding end. Ends strictly increase, cover complete triangles and must end at
the imported mesh index count. No gaps, overlap or partial coverage are accepted.
At most 8192 runs total across at most 8192 unique meshes, within the same 1 MiB
envelope. Homogeneous fully known exports still use unchanged v1. Unknown-only
exports need no entry. V2 cannot recursively wrap v1/v2 emission envelopes.

`GeometryUniform::SourceOwnEmissionRgb` is an actual vec3 binding in existing
Gbuffers/world and shadow geometry draws. Its name must start with `source`.
Optional missing data is reset to RGB zero AND false validity on every bind;
required missing data aborts the draw. `OwnEmission` (reference scalar) remains
unknown. The internal GLSL fixture writes raw source RGB plus validity to an
explicit source-data output; it does not install a production lighting recipe.
RGB and validity are uniforms constant over each draw, explicitly outside the
raster interpolator. The native renderer splits the original EBO into the
validated runs only when the selected program consumes source own emission.
Adjacent equal values are coalesced at export; programs without this binding
retain one draw. Only emission uniforms change between runs; geometry, VAOs,
samplers, index data and matrices are reused. Unknown runs bind zero/false;
required data aborts at the first unknown run without history/frame commit.
Expiry between draw and successful commit also aborts history/frame commit.

No GPU attribute or buffer is added. Existing VAOs/VBOs are reused. Observer
limits: eight workers; 65536 packed/validity entries each (1.5 MiB typed storage
at the maximum); 64 pending jobs per worker; 1024 retained proofs, at most 256
used IDs per proof, and a 1-MiB accounted proof pool including byte copies and
fixed metadata charges. The same pool now charges two bytes per source face,
compact exported run arrays and a fixed charge per exported association.
Export removal, replacement or proof eviction drops those arrays, including
through retained tokens. Job scans are capped at 1048576 cell visits and 8192
faces per group. JavaScript object allocation overhead is implementation-defined;
counts are bounded independently. Eviction yields unknown. Removed/unselected
geometry proofs and departed workers are released, and stop clears all observer
state. Native retains one bounded current-frame entry/run vector and three uint32
association fields per imported mesh. New/failed/legacy source frames revoke the
old vector; replacement, pose, instances and removal release affected run arrays;
fallback and reset clear it. No new GPU allocation or increase to the
512-MiB/64-MiB budgets. No extra full scene scan, block query, chunk request or
per-frame geometry copy is introduced. Alternating emissions can increase draw
calls up to the explicit run limit; no live FPS claim is made.

## Verification and remaining work

Inert VM mocks exercise the actual Capture observer and packet generation;
public source functions are never executed. Actual bytes pass the JS validator
and the native anonymous-pipe ingress/CPU decoder, then real renderer callbacks
with mocked GL. Checks cover adjacent known RGB/known zero/ambiguous faces in one
group, shuffled source index order, submesh vertex renumbering and partial quads,
changed block jobs, pooled-array reuse, exact world/shadow EBO offsets and counts,
material tint, source mutation/late reply/reinit/ownership failures, camera
conflicts, original argument/return/error preservation, stop, combined CPU/q9aot
particles, stale generations, replay, expiry, resize, rebase, fallback and failed
commit/recovery. GLSL compilation is separate from GPU/image validation.
Final run details are recorded in PROJECT-CONTEXT.md and
outputs/source-emission-verification.json. No client, browser, account or graphics
context is started; the native application is compiled only.

No Minecraft/Iris semantic equivalence is newly established. Bloxd IDs remain
Bloxd IDs; own RGB is not propagated RGB/sky, material tint, glow or held light.
No maximum/average/luminance scalar mapping is inferred. Mixed source groups and
noninterpolating per-face validity are implemented within the scope above.
Unobserved/generic instanced block identity, boundary-owned/compact/deformed geometry, reference
scalar semantics, production pack bindings and the shaderloader remain open.
The first test shaderpack is a later step. The full renderer is not finished or
visually accepted.

## 0.6.22 verification

271 pure Node/DOM/VM tests, 36 syntax checks, both preloads, BridgeCpuTests, eleven GLSL compile/link checks and MemoryBudgetTests passed. Actual capture bytes cover mixed RGB/known-zero/unknown instance draws, exact divisor-one offsets and counts, swap/reuse/removal, registration ABA, intermediate upload changes, observer/chunk replacement, exceptions, budget overflow and expiry/GL errors without history commit. Evidence: `outputs/instance-emission/verification.json`. No client, account or graphics context was started; visual acceptance remains unverified.

Release 0.6.22 package inspection passed: 43 source files and native resources match; Setup and Update are byte-identical. Reports: `outputs/instance-emission/distribution.json`, checksums in `dist-bloxdy-v0.6.22/SHA256SUMS.txt`. No installation or application execution.
