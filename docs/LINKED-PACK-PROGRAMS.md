# Owned linked shader programs — 0.6.60

The subsequent [owned uniform upload API](PACK-UNIFORM-UPLOADS.md) in 0.6.63
retains this lease/context lifetime and adds explicit DSA uniform setters. It
does not install the program into production rendering.

27 October 2026. This adds the internal program creation/lifetime stage after
[bounded GLSL translation](GLSL-LEGACY-TRANSLATION.md). `ProgramDomain::compilePack`
prepares the owned source snapshot, submits the exact translated text to frozen
GL entry points, compiles both stages, links a program and validates its active
interface. It returns a move-only lease with the program and reflection metadata.
`ProgramSlot::replace` commits only after every stage succeeds.

## Concrete execution and interface

`ProgramDomain::native()` reads an already existing current GLFW context. It
creates no window/context, changes no context and does not load or replace global
GL entry points. The domain fixes its context identity, owner thread and function
table. Its actual GL version/limits must permit desktop OpenGL 4.3 reflection;
the existing native backend already has its own requirements. CPU verification
injects function callbacks and a mock identity instead of accessing any context.

The builder uses explicit source lengths, compile/link status and bounded driver
logs. Compile errors include the raw driver diagnostic plus a bounded source-ID
legend. It does not guess a vendor log grammar or rewrite error locations. A
successful lease keeps per-stage source maps and compile/link logs.

Reflection reads active attributes/uniforms and validates names, types, scalar
array size, locations and counts against prepared declarations. Matrix attributes
occupy multiple locations and cannot overlap or exceed the available slots.
Unused declarations can be optimized away; they are not fabricated as active
resources. Active fragment outputs must be declared vec4 locations. Sparse
locations such as 0/2 stay 0/2, with no inferred colortex/attachment route.
Uniform blocks, SSBOs and atomic-counter buffers are rejected.

No attribute location or Minecraft value is prebound. Reflection returns actual
driver locations; runtime uniform/sampler producers, VAO binding, texture routes
and graph installation remain later gates. The loader never calls UseProgram or
changes the current program binding.

## Ownership, replacement and context lifetime

Each domain has eight slots total, including live leases, a candidate under
construction and retired programs awaiting collection. A successful program
retains its two attached shader stages, marked for deletion. This matches the
[documented OpenGL deletion lifetime](https://raw.githubusercontent.com/KhronosGroup/OpenGL-Refpages/main/gl4/glDeleteShader.xml)
and preserves the existing attached-stage validator. It deliberately differs
from Iris's detach-after-link sequence.

Compile/link/reflection failures retire the entire candidate and delete its
objects when the owning context is current. A context change interrupts further
driver access and retains bounded cleanup work. Returning the same domain to its
own context permits `collect()` to drain it. Releasing a lease from another thread
only queues retirement under a mutex; it performs no GL call. A still-bound
retired program stays allocated and counted until its caller unbinds it. The
loader does not change that binding itself.

Replacement builds a new candidate before changing the installed lease. All
failure paths retain the previous lease. Committing a successful lease only
retires the old one; cleanup remains a separate owner-context operation and
cannot turn the completed commit into an apparent failure.

The caller must keep the domain alive, release all leases, unbind retired
programs and close the domain on its current owner context before context
teardown. `close()` rejects outstanding leases/retirements. This component does
not install that ownership into the production client lifecycle yet. Final
destruction on an unrelated context never calls a driver; any uncollected names
increment `uncollectedOnDestruction()`. That records a lifecycle-contract
violation, not successful cleanup. Borrowed GLuint handles must never outlive
their lease, be externally deleted/relinked/mutated or be used on another context.
An equal context pointer is not a context-generation proof. This API does not
recover destroyed/reset contexts; an existing domain must never be reused for
a replacement context. Production lifetime integration must enforce that rule.

Source text is at most 8 MiB per stage, with at most 4096 mapped source files per
stage. Each stage/program log is capped at 16 KiB plus a truncation marker, as is
each error's source legend. Reflection is capped at 16 attribute locations, 512
active uniforms, 127-byte active names and eight outputs, additionally limited
by the current context. Existing source/frame/material/GPU budgets are unchanged.
These are object/input bounds, not a bound on driver compiler time or GPU bytes.

## Reference and bounded evidence

`tools/audit-linked-programs.cjs` reads the pinned Iris GlShader/ProgramCreator
class bytes as data, checking creation, source/compile/status/log, attach/link
and shader lifetime operations. Iris semantic attribute prebindings are not
copied. Evidence: `docs/iris-linked-program-reference.json`. No Java or Iris
module executes, and full Iris lifecycle/binding parity is not claimed.

530 pure Node/DOM/VM tests, 51 syntax files and three preloads pass.
The native CPU test decodes the real ZIP/directory-derived source snapshot,
prepares/compiles/links via independent mock callbacks and writes the exact text
submitted to ShaderSource. It checks object cleanup, raw diagnostics/source maps,
shader attachment lifetime, moves, eight-slot capacity, atomic replacement,
creation/status/GL/reflection failures, optimized-away declarations, wrong
threads/contexts, interrupted cleanup, bound retirements, matrix columns and
repeated allocation/release. No graphics context is created.

glslang compiles those captured sources and independently checks active resource
names/types through `-l -q`. A separate source pair must fail at the link stage
with mismatched varying types. This adds one successful set and one expected
link rejection to the preceding 26 compiler cases: 28 cases, 24 expected
successes and four expected rejections. The existing macro oracle remains.
glslang reflection does not verify native-driver locations; CPU mocks do not
verify native-driver behavior, live pixels or FPS.

Broader source translation, authoritative runtime inputs, uniform/sampler/VAO
bindings, physical output routing, production plan/lifecycle installation and
user image/FPS acceptance remain open. CrazyGames still requires Standard Bloxd.
`irisContractComplete=false`. Evidence: `outputs/linked-programs-0.6.60/`.

## Release verification

Setup/Portable/Update are byte-checked in `dist-bloxdy-v0.6.60`. All 63 packaged
sources (64 including package.json) and native resources match; version/lock
agree. Against 0.6.59 only package.json changes in ASAR; all other launcher,
bridge, mod, texture and account bytes match. BloxdNative is freshly built;
MemoryBudgetRunner is unchanged. CPU, 28 compiler cases, both interface/macro
oracles and MemoryBudgetTests pass independently after packaging. No client,
installer, browser, account or graphics context was started by the agent.
