# Owned pack uniform uploads — 0.6.63

`PackUniformWriter` adds actual `glProgramUniform*` calls after the explicit
[binding contract](PROGRAM-BINDING-CONTRACT.md). It owns the move-only linked
program lease and creates its immutable routes from that lease's reflection.
Every call checks the same owner thread and current context through the lease.
An old plan cannot be supplied at upload time with another program handle.

The native function table is resolved explicitly on that existing context.
It initializes no window/context and does not change the global GL loader.
The [Khronos program-uniform reference](https://raw.githubusercontent.com/KhronosGroup/OpenGL-Refpages/main/gl4/glProgramUniform.xml)
defines the direct program argument, float/integer setters, sampler integer
setters and matrix transpose flag used here. The current program binding stays
unchanged. CPU verification injects independent entry points; no native GL
context is opened by the tests.

Supported uploads are float/vec2/vec3/vec4, mat2/mat3/mat4, int/ivec2/ivec3/ivec4,
bool/bvec2/bvec3/bvec4 and sampler2D/sampler3D/samplerCube. Each upload has count
one, with no arrays. Matrices contain explicit column-major values and use
`GL_FALSE` for transpose. Samplers receive only explicit unit numbers, checked
against the real context's `GL_MAX_COMBINED_TEXTURE_IMAGE_UNITS`. Two different
sampler types may not alias one unit; equal sampler types may share it. The
writer does not bind or assert ownership/target of a texture.

Before the first GL mutation, all values are copied into a fully validated CPU
snapshot with the existing type/shape/finite/boolean checks. Missing values,
invalid routes or incompatible sampler aliases perform no setters. A new write
invalidates uniform readiness until all setters and their GL error checks
succeed. `programForDraw()` requires that readiness and the owner context, but
does not validate VAO, textures, framebuffer, source authority or frame age.

A driver error or context change after an earlier setter can leave partial
values in the target program, including an installed program being updated for
a new frame. There is no rollback claim. The caller must not draw it until a
subsequent complete upload succeeds; destroyed/reset contexts cannot
be recovered by reusing a domain. Pre-existing GL errors reject before setters.
The original domain lifetime contract still applies, including explicit close
before teardown and no external deletion/relinking of borrowed program names.

`PackUniformSlot::replace` accepts only a candidate with complete uniform values.
It moves ownership without a GL bind. Candidate failures preserve the installed
program and its values. Old leases retire through the existing domain collector;
a still-bound retired program remains occupied until the caller unbinds it.
Foreign-thread destruction performs only CPU retirement.

The writer uses the existing eight-slot program budget and introduces no GL
objects. Its transient snapshot is bounded by 512 active uniforms and at most
16 four-byte components each, plus bounded names/vector metadata. Driver time
and GPU allocations are not bounded by this component.

CPU tests exercise the real ZIP-derived preparation/link/reflection path into
matrix/sampler uploads, all 18 supported types, exact driver locations and
values, moves, construction rejection, partial failures, wrong contexts/threads,
readiness, replacement and collection. A hand-prepared core shader ABI fixture
uses all 18 types; glslang independently compiles it and checks active names and
types. That fixture does not widen the legacy translator's accepted syntax.

This remains an explicit internal API. Authoritative game producers, texture
and VAO bindings, physical output/FBO installation, production recipe/lifecycle
integration, broader translation and live image/FPS acceptance remain open.
The production default/fallback paths are retained; `irisContractComplete=false`.
