#pragma once
namespace shaders {
inline constexpr const char* sceneVertex = R"GLSL(#version 430 core
layout(location=0) in vec3 position;
layout(location=1) in vec3 normal;
layout(location=2) in vec2 texcoord;
layout(location=3) in vec3 blockPosition;
layout(location=4) in float material;
uniform mat4 viewProjection;
uniform mat4 lightViewProjection;
out vec3 worldPosition;
out vec3 faceNormal;
out vec2 uv;
out vec4 lightPosition;
flat out int tile;
void main() {
    worldPosition = position + blockPosition;
    faceNormal = normal;
    uv = texcoord;
    int id = int(material);
    tile = id == 0 ? (normal.y > 0.5 ? 0 : (normal.y < -0.5 ? 2 : 1)) : id;
    lightPosition = lightViewProjection * vec4(worldPosition, 1.0);
    gl_Position = viewProjection * vec4(worldPosition, 1.0);
}
)GLSL";
inline constexpr const char* sceneFragment = R"GLSL(#version 430 core
in vec3 worldPosition;
in vec3 faceNormal;
in vec2 uv;
in vec4 lightPosition;
flat in int tile;
uniform sampler2D albedoAtlas;
uniform sampler2D shadowDepth;
uniform vec3 sunDirection;
uniform vec3 cameraPosition;
uniform int shadowsEnabled;
layout(location=0) out vec4 outputColor;
float visibility(vec3 n) {
    if (shadowsEnabled == 0) return 1.0;
    vec3 p = lightPosition.xyz / lightPosition.w * 0.5 + 0.5;
    if (any(lessThan(p, vec3(0.0))) || any(greaterThan(p, vec3(1.0)))) return 1.0;
    vec2 pixel = 1.0 / vec2(textureSize(shadowDepth, 0));
    float bias = max(0.0015 * (1.0-dot(n, sunDirection)), 0.00035);
    float visible = 0.0;
    for (int y = -1; y <= 1; ++y) for (int x = -1; x <= 1; ++x)
        visible += p.z-bias <= texture(shadowDepth, p.xy+vec2(x,y)*pixel).r ? 1.0 : 0.0;
    return visible/9.0;
}
void main() {
    vec2 origin = vec2(tile % 4, tile / 4);
    vec2 atlasUV = (origin + (clamp(uv, 0.0, 1.0)*15.0+0.5)/16.0)/4.0;
    vec3 albedo = pow(texture(albedoAtlas, atlasUV).rgb, vec3(2.2));
    vec3 n = normalize(faceNormal);
    float diffuse = max(dot(n, sunDirection), 0.0);
    vec3 ambient = mix(vec3(0.16,0.19,0.24), vec3(0.33,0.39,0.47), n.y*0.5+0.5);
    vec3 color = albedo * (ambient + vec3(1.22,1.12,0.93)*diffuse*visibility(n));
    if (tile == 4 || tile == 5) {
        vec3 halfway = normalize(sunDirection + normalize(cameraPosition-worldPosition));
        color += pow(max(dot(n, halfway),0.0), 56.0)*vec3(0.6)*visibility(n);
    }
    float fog = 1.0-exp(-length(cameraPosition-worldPosition)*0.006);
    color = mix(color, vec3(0.48,0.65,0.83), fog);
    color = color/(vec3(1.0)+color);
    outputColor = vec4(pow(color, vec3(1.0/2.2)),1.0);
}
)GLSL";
inline constexpr const char* shadowVertex = R"GLSL(#version 430 core
layout(location=0) in vec3 position;
layout(location=3) in vec3 blockPosition;
uniform mat4 lightViewProjection;
void main() { gl_Position = lightViewProjection * vec4(position+blockPosition,1.0); }
)GLSL";
inline constexpr const char* shadowFragment = R"GLSL(#version 430 core
void main() {}
)GLSL";
inline constexpr const char* compute = R"GLSL(#version 430 core
layout(local_size_x=1) in;
layout(std430, binding=0) buffer Result { uint value; };
void main() { value = 42u; }
)GLSL";
}
