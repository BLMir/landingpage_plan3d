import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { DisplacementSphere } from './DisplacementSphere';
import * as THREE from 'three';
import { MeshStandardMaterial } from 'three';

// --- ARTIFACT TRANSFORMS (Position, Rotation, and Scaling) ---
export const GLOBAL_POSITION_OFFSET: [number, number, number] = [0, 0, 0]; // Bulk shift for all 4 slots
export const GLOBAL_SCALE_MULTIPLIER: number = 1.0; // Global master scale for everything
export const ARTIFACT_TRANSFORMS: Record<string, { position: [number, number, number], rotation: [number, number, number], overallScale: number, planetScale: number, cloudScale: number, cometScale: number, ringScale: number }> = {
    digital: { position: [0, 0, 0], rotation: [-9, 70, 0], overallScale: 1.0, planetScale: 1.0, cloudScale: 1.0, cometScale: 0.95, ringScale: 1.0 },
    lamp: { position: [0, -2, 0], rotation: [-9, 70, 0], overallScale: 1.0, planetScale: 1.0, cloudScale: 1.0, cometScale: 1.0, ringScale: 1.0 },
    necklace: { position: [-0.75, -3, 0], rotation: [-9, 70, 0], overallScale: 0.9, planetScale: 1.0, cloudScale: 1.0, cometScale: 1.0, ringScale: 1.0 },
    bracelet: { position: [0, -4.1, 0], rotation: [-9, 70, 0], overallScale: 0.7, planetScale: 1.0, cloudScale: 1.0, cometScale: 1.0, ringScale: 1.0 }
};

// --- SHADER HELPERS (Wow Procedural Patterns) ---
const noisePars = `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise_planet(vec3 v) {
    const vec2  C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(
        i.z + vec4(0.0, i1.z, i2.z, 1.0))
        + i.y + vec4(0.0, i1.y, i2.y, 1.0))
        + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3  ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
`;

const getGrowthAlphaLogic = `
float getGrowthAlpha_planet(vec3 pos, vec3 seedPoint, float intensity) {
    vec3 posNorm = normalize(pos);
    if (intensity <= 1e-4) return 0.0;
    if (intensity >= 0.999) return 1.0;
    float align = dot(posNorm, normalize(seedPoint));
    float grad = align * 0.5 + 0.5; 
    float n = snoise_planet(posNorm * 3.5) * 0.5 + 0.5;
    float growthMap = mix(grad, n, 0.15); 
    float threshold = 1.05 - (intensity * 1.10);
    return smoothstep(threshold, threshold + 0.15, growthMap);
}
`;

const sharedVertPars = `
varying float vIsForest, vIsRing;
varying vec3 vWorldPos, vOriginalPos;
varying vec2 vCustomUv;
attribute vec3 aOriginalPos;
uniform float uSliders[5], uTime, uHasDesertMap, uHasOceanMap, uIsArtifact;
uniform float uIsForest, uIsRing;
uniform sampler2D uDesertMap, uOceanMap;
uniform vec3 uDesertColor, uOceanColor;
uniform int uIndices[8];
${noisePars}
${getGrowthAlphaLogic}
`;

const sharedFragPars = `
varying float vIsForest, vIsRing;
varying vec3 vWorldPos, vOriginalPos;
varying vec2 vCustomUv;
uniform float uSliders[5], uTime, uHasDesertMap, uHasOceanMap, uIsArtifact;
uniform sampler2D uDesertMap, uOceanMap;
uniform vec3 uDesertColor, uOceanColor;
uniform int uIndices[8];
${noisePars}
${getGrowthAlphaLogic}
`;

const sharedFragLogic = `
vec3 bC = diffuseColor.rgb;
float s1 = uSliders[0], s2 = uSliders[1];
float iV = (s1 < 0.5) ? (0.5 - s1) * 2.0 : 0.0, iO = (s1 > 0.5) ? (s1 - 0.5) * 2.0 : 0.0, iD = (s2 < 0.5) ? (0.5 - s2) * 2.0 : 0.0, iF = (s2 > 0.5) ? (s2 - 0.5) * 2.0 : 0.0;
vec3 p1 = vec3(0.0, 1.0, 0.0), p2 = vec3(0.8, -0.5, 0.3);
float aV = getGrowthAlpha_planet(vOriginalPos, p1, iV), aO = getGrowthAlpha_planet(vOriginalPos, p1, iO), aD = getGrowthAlpha_planet(vOriginalPos, p2, iD), aF = getGrowthAlpha_planet(vOriginalPos, p2, iF);
vec3 mD = bC;
if (aV > 0.05) {
    float rN = snoise_planet(vOriginalPos * 10.0 + vec3(10.0));
    vec3 rD = bC * 0.2, rB = bC * 0.5, fR = mix(rD, rB, rN * 0.5 + 0.5);
    float riv = smoothstep(0.85, 0.98, 1.0 - abs(snoise_planet(vOriginalPos * 0.3 + vec3(0.0, uTime * 0.1, 0.0))));
    mD = mix(mD, mix(fR, bC * 2.5, riv), aV);
}
if (aO > 0.001) {
    vec3 oC = bC * 0.8; if (uHasOceanMap > 0.5) oC = mix(oC, oC * texture2D(uOceanMap, vCustomUv).rgb, 0.85);
    float wave = smoothstep(0.88, 0.99, 1.0 - abs(snoise_planet(vOriginalPos * 0.25 + vec3(0.0, uTime * 0.12, 0.0))));
    mD = mix(mD, mix(oC, bC * 1.5, wave * 0.4), aO);
}
if (aD > 0.001) {
    vec3 dC = bC; if (uHasDesertMap > 0.5) dC = mix(dC, dC * texture2D(uDesertMap, vCustomUv).rgb, 0.85);
    dC += abs(snoise_planet(vOriginalPos * 6.0)) * 0.03;
    mD = mix(mD, dC, aD);
}
if (aF > 0.001 || vIsForest > 0.5) {
    if (vIsForest > 0.5 && aF < 0.01) discard;
    float gN = snoise_planet(vOriginalPos * 12.0) * 0.5 + 0.5;
    mD = mix(mD, bC * 0.4, aF * (0.5 + 0.5 * gN));
}
diffuseColor.rgb = mD;
`;

export const applyArtifactShader = (shader: any, uniforms: any) => {
    shader.uniforms.uSliders = uniforms.uSliders;
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uDesertMap = uniforms.uDesertMap;
    shader.uniforms.uOceanMap = uniforms.uOceanMap;
    shader.uniforms.uHasDesertMap = uniforms.uHasDesertMap;
    shader.uniforms.uHasOceanMap = uniforms.uHasOceanMap;
    shader.uniforms.uIndices = uniforms.uIndices;
    shader.uniforms.uIsForest = { value: 0.0 };
    shader.uniforms.uIsRing = { value: 0.0 };
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>\n${sharedVertPars}`).replace('#include <begin_vertex>', `#include <begin_vertex>\nvCustomUv = uv; vOriginalPos = position; vIsForest = uIsForest; vIsRing = uIsRing;
        float s1 = uSliders[0], s2 = uSliders[1];
        float iV = (s1 < 0.5) ? (0.5 - s1) * 2.0 : 0.0, iO = (s1 > 0.5) ? (s1 - 0.5) * 2.0 : 0.0, iD = (s2 < 0.5) ? (0.5 - s2) * 2.0 : 0.0, iF = (s2 > 0.5) ? (s2 - 0.5) * 2.0 : 0.0;
        vec3 p1 = vec3(0.0, 1.0, 0.0), p2 = vec3(0.8, -0.5, 0.3);
        float aV = getGrowthAlpha_planet(transformed, p1, iV), aO = getGrowthAlpha_planet(transformed, p1, iO), aD = getGrowthAlpha_planet(transformed, p2, iD), aF = getGrowthAlpha_planet(transformed, p2, iF);
        float maskD = aD*(1.0-aF), maskO = aO*(1.0-aV)*(1.0-aD)*(1.0-aF), maskV = aV*(1.0-aO)*(1.0-aD)*(1.0-aF);
        float mI[8]; for (int i=0; i<8; i++) mI[i] = 0.0;
        for (int i=0; i<8; i++) { int t = uIndices[i]; if (t==0) mI[i]=maskD; else if (t==1) mI[i]=maskO; else if (t==2) mI[i]=maskV; else if (t==3) mI[i]=aF; }
        ${THREE.ShaderChunk['morphtarget_vertex'].replace(/morphTargetInfluences/g, 'mI')}
        vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>\n${sharedFragPars}`).replace('#include <color_fragment>', `#include <color_fragment>\n{${sharedFragLogic}}`);
};

// --- MATERIAL REGISTRY (EXPOSED) ---
export const ARTIFACT_MATERIALS = {
    lamp: new MeshStandardMaterial({ color: '#ffffff', roughness: 0.1, metalness: 0.3 }),
    necklace: new MeshStandardMaterial({ color: '#4a4a4b', roughness: 0.15, metalness: 0.95 }),
    bracelet: new MeshStandardMaterial({ color: '#3d2b1f', roughness: 0.7, metalness: 0.0 }),
    digital: new MeshStandardMaterial({ color: '#1a1a1c', roughness: 0.9, metalness: 0.0 })
};

interface ArtifactProps { values: number[]; materialOverride: string; }

export const UnifiedArtifactRenderer: React.FC<ArtifactProps> = ({ values, materialOverride }) => {
    return (
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            <Canvas camera={{ position: [0, 0, 18], fov: 45 }} frameloop="demand">
                <Suspense fallback={null}>
                    <InnerArtifact values={values} materialOverride={materialOverride} />
                </Suspense>
            </Canvas>
        </div>
    );
};

const InnerArtifact: React.FC<ArtifactProps> = ({ values, materialOverride }) => {
    const trans = ARTIFACT_TRANSFORMS[materialOverride] || ARTIFACT_TRANSFORMS.digital;

    // Apply Global Offset:
    const finalPos: [number, number, number] = [
        trans.position[0] + GLOBAL_POSITION_OFFSET[0],
        trans.position[1] + GLOBAL_POSITION_OFFSET[1],
        trans.position[2] + GLOBAL_POSITION_OFFSET[2]
    ];

    // Bulk scale multipliers (Multi-tier: per-render x global master)
    const master = GLOBAL_SCALE_MULTIPLIER * (trans.overallScale || 1.0);
    const pS = trans.planetScale * master;
    const cS = trans.cloudScale * master;
    const mS = trans.cometScale * master;
    const rS = trans.ringScale * master;

    return (
        <group position={finalPos} rotation={trans.rotation}>
            <DisplacementSphere
                values={values}
                currentSection={4} // Final state
                isStatic={true}
                materialOverride={materialOverride}
                planetScale={pS}
                cloudScale={cS}
                cometScale={mS}
                ringScale={rS}
            />
        </group>
    );
};
