# Litematica placement rendering — 0.6.49

The user reports approximately 10 FPS with a visible placement, recurring
screen corruption/disappearing previews and changing HUD text, black fluids,
and every partial/model block drawn as a cube. Previous isolated fixes did
not resolve that report. The menu from0.6.48 remains the accepted design.

## Rendering and stability

The production preview now draws against the current native world depth at
the end of the world group, before later foreground groups. It does not
intercept or replay source draws, uniforms, buffers or texture operations.
There is no second world pass, snapshot framebuffer, foreground mask or
full-screen composite in this path. Every overlay draw keeps native depth
read-only; colour is blended directly, and the original GL state is restored
on success and exceptions. Reverse/half depth, source depth range, viewport,
samplers, VAOs and frame/group boundaries are covered by CPU mocks.

Wrong/extra surfaces now blend their red/pink tint onto the actual registered
shape against native depth. This replaces the old scene-colour sampling and
proxy-cube reconstruction. Transparent missing surfaces also blend against
native depth without writing it. Overlapping transparent schematic surfaces
are consequently not sorted with an independent private depth prepass.

Incomplete layout discovery returning a fresh wrapper around the same actual
scene/registry/world reader no longer replaces the connection and discards
its caches. Real scene/world-reader changes still replace it. HUD statistics
are not published from a partly indexed replacement. The existing session,
chat-surface and replay gates remain in place.

These are code defects/costs and CPU reproductions. They do not establish
that the reported two-second timing has been reproduced, or that the real
screen/FPS problem is completely resolved. Preview geometry, uploads, drawing
and world checks still have a cost; no zero-FPS-impact guarantee is possible.

## Materials, shapes and assets

Native normalized water RGB and animated lava tint are converted once, so
the existing renderer's /255 conversion no longer turns them almost black.
Byte-valued custom RGB and native alpha are retained.

The preview consumes actual registered normalized subvoxel boxes, including
custom partial definitions. Explicit source-backed slab/stair/door/trapdoor
rules remain available when those box literals are unavailable. Box union
surfaces omit interior faces. Partial blocks do not hide an entire adjacent
cube face and enclosed partial cells remain eligible for the view.

Blocks with a blockModel use their actual active-pack GLB asset, mesh/node
transforms, UVs, base material/embedded image, native model scale, rotation
and placement offsets. Separate part names such as Cyan Banner and
_Cyan Banner Flag remain distinct cells/assets. Native variant strings are
preserved through import, mapping, actual-name lookup and model resolution.
Old saved mappings that merely discarded the native suffix are upgraded in
memory; explicit replacements retain priority. Registered orientation names
are used for rotated checks and native paste IDs when available. User/native
paste permissions, clipboard confirmation and cancellation are preserved.

Compressed meshes use the bundled Draco glTF decoder in a dedicated worker.
It needs no CDN, paid service or game/renderer API. The reader rejects skins,
morph targets, unsupported required extensions and invalid/excessive assets;
point-only helper primitives inside otherwise valid models are skipped.
Rejected/unavailable assets are not replaced with invented cube geometry.
HTTP image references outside a GLB are not followed by the small reader;
embedded/data images are supported. A future asset using another format
therefore still needs a corresponding reader extension.

Limits: two asset loads and two queued compressed primitives, 8 MiB/model,
128 model entries, 32 MiB estimated cached asset/triangle data, 65,536
vertices/primitive and16,384 decoded faces/primitive. Node and mesh counts,
tree depth, accessors and binary ranges are checked. Parsing yields in small
slices. Existing cooperative mesh work and256 KiB upload slices remain.
Leaving/idle/destroy aborts requests and closes the decoder worker.

Materials sort by Total descending, then English alphabetical name, in
Build, Paste, Save area and Checked. Quantities, check semantics and the
native menu layout are otherwise retained.

## Verification and limits

`launcher/tests/litematica-placement.test.cjs` covers the direct production
path, actual compressed fixture decoding through the worker protocol,
partial registrations, variant/part names, mapping upgrades, sorting,
colours, unchanged source calls and state restoration. Existing capture
tests explicitly retain the old private-target fixture path; their replay
counts are not presented as production behaviour.

In600 inert production-path frames there are600 source world draws,
zero secondary world draws, zero capture framebuffers/renderbuffers/clears
and one stable mesh upload. Both preview GLSL stages compile/link with
glslang.86 GLBs extracted as data from the pinned public source archive
decode successfully,76 of them declaring a required extension. These are
data/parser checks, not live visual coverage of every block or asset pack.

Evidence, test logs, model hashes, shader files, build and package reports:
`outputs/placement-0.6.49/`. No client, account, installer or graphics context
was started; no profiles/logins were mutated and nothing was uploaded.
Live model appearance, depth interaction, FPS, HUD and flicker acceptance
remain with the user's next play session. Native/Iris renderer contracts and
original mod catalogs remain outside this change; irisContractComplete=false.
