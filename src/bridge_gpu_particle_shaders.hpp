#pragma once
// Pinned q9aot source shader, mechanically extracted without executing source.
namespace bridge {
inline constexpr const char* gpuParticleVertex=R"GLSL(#version 430 core





#define MAX_STOPS 16
#define COLOR_POSITIONS 3
#define COLOR1 7
#define COLOR2 23
#define VELOCITY 39
#define REMAP 55

uniform mat4 gpuParticleView;
uniform mat4 gpuParticleProjection;
uniform vec4 gpuParticleSystem[71];
// The records' frame offset and the system's clock; the slot drawn first (the oldest) and the slots in use.
uniform vec4 gpuParticleFrame;
uniform ivec2 gpuParticleRange;
uniform int gpuParticleHalfZ;
uniform usampler2D gpuParticleRecords;

out vec2 vUV;
out vec4 vColor;
out vec4 vRemap;

vec3 gravity() { return vec3(gpuParticleSystem[0].x, gpuParticleSystem[0].y, gpuParticleSystem[0].z); }
int colorCount() { return int(gpuParticleSystem[0].w); }
vec4 colorDead() { return gpuParticleSystem[1]; }
int velocityCount() { return int(gpuParticleSystem[2].x); }
int remapCount() { return int(gpuParticleSystem[2].y); }

uint hash(uint v) {
	uint state = v * 747796405u + 2891336453u;
	uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
	return (word >> 22u) ^ word;
}

// The particle's own random pick for a gradient stop, as Babylon picks one when the particle reaches it.
float random(uint seed, int stop) {
	return float(hash(seed ^ (uint(stop) * 0x9e3779b9u)) >> 8u) / 16777216.0;
}

float colourPosition(int i) {
	return gpuParticleSystem[COLOR_POSITIONS + i / 4][i % 4];
}

vec4 stopColour(int i, uint seed) {
	return mix(gpuParticleSystem[COLOR1 + i], gpuParticleSystem[COLOR2 + i], random(seed, i));
}

float velocityFactor(int i, uint seed) {
	vec4 stop = gpuParticleSystem[VELOCITY + i];
	return mix(stop.y, stop.z, random(seed, MAX_STOPS + i));
}

vec4 colourAt(vec4 colour0, float age, float ratio, uint seed) {
	int n = colorCount();
	vec4 colour;
	if (n == 0) {
		colour = mix(colour0, colorDead(), ratio);
	} else if (age == 0.0) {
		return stopColour(0, seed);
	} else if (ratio < colourPosition(0)) {
		colour = stopColour(min(1, n - 1), seed);
	} else {
		colour = stopColour(n - 1, seed);
		for (int i = 0; i + 1 < n; i++) {
			float a = colourPosition(i);
			float b = colourPosition(i + 1);
			if (ratio >= a && ratio <= b) {
				float scale = b > a ? (ratio - a) / (b - a) : 0.0;
				colour = mix(stopColour(i, seed), stopColour(i + 1, seed), scale);
				break;
			}
		}
	}
	colour.a = max(colour.a, 0.0);
	return colour;
}

vec3 travel(float alpha, float beta, vec3 d, vec3 g, float s0, float s1) {
	float ds = s1 - s0;
	float ds2 = (s1 * s1 - s0 * s0) * 0.5;
	float ds3 = (s1 * s1 * s1 - s0 * s0 * s0) / 3.0;
	return d * (alpha * ds) + (g * alpha + d * beta) * ds2 + g * (beta * ds3);
}

vec3 displacement(vec3 d, float age, float life, uint seed) {
	vec3 g = gravity();
	int n = velocityCount();
	if (n == 0) {
		return d * age + g * (0.5 * age * age);
	}
	vec3 total = vec3(0.0);
	float beforeFirst = min(age, gpuParticleSystem[VELOCITY].x * life);
	if (beforeFirst > 0.0) {
		total += travel(velocityFactor(min(1, n - 1), seed), 0.0, d, g, 0.0, beforeFirst);
	}
	for (int i = 0; i + 1 < n; i++) {
		float a = gpuParticleSystem[VELOCITY + i].x * life;
		float b = gpuParticleSystem[VELOCITY + i + 1].x * life;
		float lo = max(a, 0.0);
		float hi = min(b, age);
		if (hi > lo) {
			float fa = velocityFactor(i, seed);
			float beta = (velocityFactor(i + 1, seed) - fa) / (b - a);
			total += travel(fa - beta * a, beta, d, g, lo, hi);
		}
	}
	float afterLast = max(gpuParticleSystem[VELOCITY + n - 1].x * life, 0.0);
	if (age > afterLast) {
		total += travel(velocityFactor(n - 1, seed), 0.0, d, g, afterLast, age);
	}
	return total;
}

vec4 remapAt(float age, float ratio) {
	int n = remapCount();
	if (n == 0 || age == 0.0) {
		return vec4(0.0, 1.0, 0.0, 1.0);
	}
	vec2 stop = gpuParticleSystem[REMAP + n - 1].yz;
	if (ratio < gpuParticleSystem[REMAP].x) {
		stop = gpuParticleSystem[REMAP].yz;
	} else {
		for (int i = 0; i + 1 < n; i++) {
			vec4 a = gpuParticleSystem[REMAP + i];
			vec4 b = gpuParticleSystem[REMAP + i + 1];
			if (ratio >= a.x && ratio <= b.x) {
				stop = mix(a.yz, b.yz, b.x > a.x ? (ratio - a.x) / (b.x - a.x) : 0.0);
				break;
			}
		}
	}
	return vec4(stop.x, stop.y - stop.x, 0.0, 1.0);
}

void main(void) {
	int slot = (int(gpuParticleRange.x) + gl_InstanceID) % int(gpuParticleRange.y);
	int perRow = textureSize(gpuParticleRecords, 0).x / 4;
	ivec2 at = ivec2((slot % perRow) * 4, slot / perRow);
	vec4 spawn = uintBitsToFloat(texelFetch(gpuParticleRecords, at, 0));
	vec4 velocity = uintBitsToFloat(texelFetch(gpuParticleRecords, at + ivec2(1, 0), 0));
	uvec4 sizeSeed = texelFetch(gpuParticleRecords, at + ivec2(2, 0), 0);
	vec4 colour0 = uintBitsToFloat(texelFetch(gpuParticleRecords, at + ivec2(3, 0), 0));
	float age = gpuParticleFrame.w - spawn.w;
	float life = velocity.w;
	// The strip's corners: (0, 0), (1, 0), (0, 1), (1, 1).
	vec2 corner = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1));
	vUV = corner;
	if (!(age >= 0.0 && age < life)) {
		// Dead, or not yet written: outside the clip volume.
		gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
		vColor = vec4(0.0);
		vRemap = vec4(0.0, 1.0, 0.0, 1.0);
		return;
	}
	float ratio = age / life;
	uint seed = sizeSeed.y;
	vec3 centre = gpuParticleFrame.xyz + spawn.xyz + displacement(velocity.xyz, age, life, seed);
	// particles.vertex's billboard: the corner offset in view space.
	vec3 viewPos = (gpuParticleView * vec4(centre, 1.0)).xyz + vec3((corner - 0.5) * uintBitsToFloat(sizeSeed.x), 0.0);
	gl_Position = gpuParticleProjection * vec4(viewPos, 1.0);
	if (gpuParticleHalfZ != 0) gl_Position.z = 2.0 * gl_Position.z - gl_Position.w;
	vColor = colourAt(colour0, age, ratio, seed);
	vRemap = remapAt(age, ratio);
}
)GLSL";
inline constexpr const char* gpuParticleFragment=R"GLSL(#version 430 core
layout(location=0) out vec4 gpuParticleColor;
uniform int gpuParticleMultiply;



uniform sampler2D gpuParticleTexture;
uniform sampler2D gpuParticleRampTexture;
uniform float gpuParticleRamp;

in vec2 vUV;
in vec4 vColor;
in vec4 vRemap;

void main(void) {
	vec4 textureColour = texture(gpuParticleTexture, vUV);
	vec4 colour = textureColour * vColor;
	if (gpuParticleRamp != 0.0) {
		float alpha = colour.a;
		float index = clamp((alpha - vRemap.x) / vRemap.y, 0.0, 1.0);
		vec4 rampColour = texture(gpuParticleRampTexture, vec2(1.0 - index, 0.0));
		colour = vec4(colour.rgb * rampColour.rgb, clamp((alpha * rampColour.a - vRemap.z) / vRemap.w, 0.0, 1.0));
	}
if (gpuParticleMultiply != 0) {
	// The MULTIPLY pass of BLENDMULTIPLYMODE, which MULTIPLYADD draws before its ADD pass.
	float sourceAlpha = vColor.a * textureColour.a;
	colour.rgb = colour.rgb * sourceAlpha + vec3(1.0 - sourceAlpha);
}
	gpuParticleColor = colour;
}
)GLSL";
}
