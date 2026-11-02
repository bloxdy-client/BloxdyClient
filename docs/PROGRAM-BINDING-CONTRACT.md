# Explicit pack binding contract — 0.6.61

The subsequent owned uniform upload API is documented in
[PACK-UNIFORM-UPLOADS.md](PACK-UNIFORM-UPLOADS.md). Sampler checks now also reject
different sampler types sharing one texture unit.

27 October 2026. `PackBindingPlan` is the next internal loader stage after
linked-program reflection. A caller supplies a route for every *active* driver
attribute and uniform, with its reflected type and location, and a physical
color attachment for every active fragment output. No producer, attachment,
Minecraft semantic, sampler texture or VAO layout is inferred from a name.

The plan keeps sparse locations: outputs at 0 and 2 yield draw buffers
`[attachment0, GL_NONE, attachment3]` when the caller chooses those attachments.
The explicit attachment choices must be unique. This is a CPU array for later
graph integration; it does not call `glDrawBuffers` or assert framebuffer
completeness. The caller must establish the FBO and verify its actual limits.

At each use, `checkValues` requires one value for every active uniform. Float
components must be finite and match the reflected shape. Integer, boolean and
sampler values have distinct representations; booleans are 0/1, and a sampler
unit must be below an explicit caller-supplied texture-unit limit. This checks
the number, not texture ownership, target, current binding or source authority.
The result is ordered by the reflected interface and retains driver locations.
No GL uniform/attribute calls or current-program changes happen in this stage.

Route keys are explicit, bounded ASCII labels (at most 127 bytes). The active
interface retains the linked-program bounds of 16 attribute locations, 512
uniforms and eight outputs. The value vector for each uniform has at most 16
components. Optimized-away declarations require no route or value.

Native CPU tests build the plan from a link/reflection mock after compiling an
owned ZIP-derived pair. They check exact/sparse routes, reflected ordering,
missing/duplicate/mistyped routes, invalid values and the absence of GL calls.
The existing compiler and source-map oracles still run. This is not a claim of
runtime producers, GPU bindings, physical FBO installation, shaderpack activation
or live image/FPS acceptance. The default renderer stays in place and
`irisContractComplete=false`.

