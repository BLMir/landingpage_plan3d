import React, { useMemo, useRef, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useFBX, useGLTF, Environment, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { Color, MeshStandardMaterial } from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { getAssetPath } from '@/utils/paths';

// --- ARTIFACT TRANSFORMS (Position, Rotation, and Scaling) ---
export const ARTIFACT_TRANSFORMS: Record<string, { position: [number, number, number], rotation: [number, number, number], planetScale: number, cloudScale: number, cometScale: number, ringScale: number }> = {
    digital: { position: [0, 0, 0], rotation: [0, 0, 0], planetScale: 1.0, cloudScale: 1.0, cometScale: 1.0, ringScale: 1.0 },
    lamp: { position: [0, -2, 0], rotation: [0, 0, 0], planetScale: 1.2, cloudScale: 1.0, cometScale: 1.9, ringScale: 1.5 },
    silver: { position: [-0.25, -3, 0], rotation: [0, 0, 0], planetScale: 1.0, cloudScale: 1.1, cometScale: 1.4, ringScale: 1.3 },
    darkWood: { position: [0, -4.1, 0], rotation: [0, 0, 0], planetScale: 1.3, cloudScale: 1.3, cometScale: 1.3, ringScale: 1.15 }
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
attribute float aIsForest, aIsRing;
uniform float uSliders[5], uTime, uHasDesertMap, uHasOceanMap, uIsArtifact;
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

const applyArtifactShader = (shader: any, uniforms: any) => {
    shader.uniforms.uSliders = uniforms.uSliders;
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uDesertMap = uniforms.uDesertMap;
    shader.uniforms.uOceanMap = uniforms.uOceanMap;
    shader.uniforms.uHasDesertMap = uniforms.uHasDesertMap;
    shader.uniforms.uHasOceanMap = uniforms.uHasOceanMap;
    shader.uniforms.uIndices = uniforms.uIndices;
    shader.uniforms.uIsArtifact = { value: 1.0 };
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>\n${sharedVertPars}`).replace('#include <begin_vertex>', `#include <begin_vertex>\nvCustomUv = uv; vOriginalPos = aOriginalPos; vIsForest = aIsForest; vIsRing = aIsRing;
        float s1 = uSliders[0], s2 = uSliders[1];
        float iV = (s1 < 0.5) ? (0.5 - s1) * 2.0 : 0.0, iO = (s1 > 0.5) ? (s1 - 0.5) * 2.0 : 0.0, iD = (s2 < 0.5) ? (0.5 - s2) * 2.0 : 0.0, iF = (s2 > 0.5) ? (s2 - 0.5) * 2.0 : 0.0;
        vec3 p1 = vec3(0.0, 1.0, 0.0), p2 = vec3(0.8, -0.5, 0.3);
        float aV = getGrowthAlpha_planet(transformed, p1, iV), aO = getGrowthAlpha_planet(transformed, p1, iO), aD = getGrowthAlpha_planet(transformed, p2, iD), aF = getGrowthAlpha_planet(transformed, p2, iF);
        float maskD = aD*(1.0-aF), maskO = aO*(1.0-aV)*(1.0-aD)*(1.0-aF), maskV = aV*(1.0-aO)*(1.0-aD)*(1.0-aF);
        float mI[8]; for (int i=0; i<8; i++) mI[i] = 0.0;
        for (int i=0; i<8; i++) { int t = uIndices[i]; if (t==0) mI[i]=maskD*1.8; else if (t==1) mI[i]=maskO*1.8; else if (t==2) mI[i]=maskV*1.8; else if (t==3) mI[i]=aF*1.8; }
        ${THREE.ShaderChunk['morphtarget_vertex'].replace(/morphTargetInfluences/g, 'mI')}
        vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>\n${sharedFragPars}`).replace('#include <color_fragment>', `#include <color_fragment>\n{${sharedFragLogic}}`);
};

// --- MATERIAL REGISTRY (EXPOSED) ---
export const ARTIFACT_MATERIALS = {
    lamp: new MeshStandardMaterial({ color: '#ffffff', roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.8 }),
    silver: new MeshStandardMaterial({ color: '#4a4a4b', roughness: 0.15, metalness: 0.95 }),
    darkWood: new MeshStandardMaterial({ color: '#3d2b1f', roughness: 0.7, metalness: 0.0 }),
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
    const base = useFBX(getAssetPath('/models/base.fbx'));
    const { scene: cometTemplate } = useGLTF(getAssetPath('/models/comet_single.glb'));
    const forestGLTF = useGLTF(getAssetPath('/models/forest.glb'));
    const ringFBX = useFBX(getAssetPath('/models/Ring.fbx'));
    const cloudsFBX = useFBX(getAssetPath('/models/Clouds.fbx'));
    const [desertTex, oceanTex] = useTexture([getAssetPath('/1_Quiz Planet Images/each_element/desert.png'), getAssetPath('/1_Quiz Planet Images/each_element/oceans.png')]);

    const uniforms = useRef({
        uSliders: { value: values.map(v => v / 100) },
        uTime: { value: 0 },
        uIndices: { value: new Int32Array(8).fill(-1) },
        uDesertMap: { value: desertTex },
        uOceanMap: { value: oceanTex },
        uHasDesertMap: { value: !!desertTex ? 1.0 : 0.0 },
        uHasOceanMap: { value: !!oceanTex ? 1.0 : 0.0 }
    });

    const getGrowthAlphaJS = (pos: THREE.Vector3, seedPoint: THREE.Vector3, intensity: number) => {
        if (intensity <= 1e-4) return 0;
        if (intensity >= 0.999) return 1.0;
        const posNorm = pos.clone().normalize();
        const seedNorm = seedPoint.clone().normalize();
        const grad = posNorm.dot(seedNorm) * 0.5 + 0.5;
        const threshold = 1.05 - (intensity * 1.10);
        return Math.max(0, Math.min(1.0, (grad - threshold) / 0.15));
    };

    const bakeMesh = (mesh: THREE.Mesh, isForest: boolean, isRing: boolean, s1: number, s2: number) => {
        const geom = mesh.geometry.clone(); const pos = geom.attributes.position; const morphs = geom.morphAttributes.position; const ms = mesh.morphTargetInfluences;
        const count = pos.count;

        if (ms && morphs && !isRing && !isForest) {
            const iV = (s1 < 0.5) ? (0.5 - s1) * 2.0 : 0.0;
            const iO = (s1 > 0.5) ? (s1 - 0.5) * 2.0 : 0.0;
            const iD = (s2 < 0.5) ? (0.5 - s2) * 2.0 : 0.0;
            const iF = (s2 > 0.5) ? (s2 - 0.5) * 2.0 : 0.0;
            const p1 = new THREE.Vector3(0, 1, 0), p2 = new THREE.Vector3(0.8, -0.5, 0.3);

            const dict = mesh.morphTargetDictionary || {};
            const oceanIdx: number[] = [], desertIdx: number[] = [], volcanIdx: number[] = [];
            for (const k in dict) {
                const low = k.toLowerCase();
                if (low.includes('ocean')) oceanIdx.push(dict[k]);
                else if (low.includes('desert')) desertIdx.push(dict[k]);
                else if (low.includes('volcan')) volcanIdx.push(dict[k]);
            }

            for (let i = 0; i < count; i++) {
                const v = new THREE.Vector3().fromBufferAttribute(pos, i);
                const aV = getGrowthAlphaJS(v, p1, iV), aO = getGrowthAlphaJS(v, p1, iO), aD = getGrowthAlphaJS(v, p2, iD), aF = getGrowthAlphaJS(v, p2, iF);
                const maskD = aD * (1.0 - aF), maskO = aO * (1.0 - aV) * (1.0 - aD) * (1.0 - aF), maskV = aV * (1.0 - aO) * (1.0 - aD) * (1.0 - aF);

                let dx = 0, dy = 0, dz = 0;
                oceanIdx.forEach(idx => { const mor = morphs[idx]; dx += (mor.getX(i) - pos.getX(i)) * maskO * 1.8; dy += (mor.getY(i) - pos.getY(i)) * maskO * 1.8; dz += (mor.getZ(i) - pos.getZ(i)) * maskO * 1.8; });
                desertIdx.forEach(idx => { const mor = morphs[idx]; dx += (mor.getX(i) - pos.getX(i)) * maskD * 1.8; dy += (mor.getY(i) - pos.getY(i)) * maskD * 1.8; dz += (mor.getZ(i) - pos.getZ(i)) * maskD * 1.8; });
                volcanIdx.forEach(idx => { const mor = morphs[idx]; dx += (mor.getX(i) - pos.getX(i)) * maskV * 1.8; dy += (mor.getY(i) - pos.getY(i)) * maskV * 1.8; dz += (mor.getZ(i) - pos.getZ(i)) * maskV * 1.8; });
                pos.setXYZ(i, pos.getX(i) + dx, pos.getY(i) + dy, pos.getZ(i) + dz);
            }
        } else if (ms && morphs) {
            // Global baking for objects that don't need masking (Forest, Ring, Clouds)
            for (let j = 0; j < morphs.length; j++) {
                if (ms[j] < 1e-3) continue;
                for (let i = 0; i < count; i++) {
                    pos.setXYZ(i, pos.getX(i) + (morphs[j].getX(i) - pos.getX(i)) * ms[j], pos.getY(i) + (morphs[j].getY(i) - pos.getY(i)) * ms[j], pos.getZ(i) + (morphs[j].getZ(i) - pos.getZ(i)) * ms[j]);
                }
            }
        }

        geom.morphAttributes = {}; if ((geom as any).morphTargetInfluences) (geom as any).morphTargetInfluences = [];
        geom.setAttribute('aOriginalPos', mesh.geometry.attributes.position.clone());
        const final = geom.toNonIndexed(); mesh.updateMatrixWorld(); final.applyMatrix4(mesh.matrixWorld);

        const keep = ['position', 'normal', 'uv', 'aOriginalPos'];
        const current = Object.keys(final.attributes);
        for (const attr of current) { if (!keep.includes(attr)) final.deleteAttribute(attr); }

        const fCount = final.attributes.position.count;
        if (!final.attributes.uv) final.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(fCount * 2).fill(0), 2));

        const oP = final.getAttribute('aOriginalPos'); const ns = new THREE.Matrix4().extractRotation(mesh.matrixWorld).copyPosition(mesh.matrixWorld);
        for (let i = 0; i < oP.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(oP, i).applyMatrix4(ns); oP.setXYZ(i, v.x, v.y, v.z); }
        final.setAttribute('aIsForest', new THREE.BufferAttribute(new Float32Array(fCount).fill(isForest ? 1 : 0), 1));
        final.setAttribute('aIsRing', new THREE.BufferAttribute(new Float32Array(fCount).fill(isRing ? 1 : 0), 1));
        return final;
    };

    const geom = useMemo(() => {
        const geoms: any[] = [];
        const trans = ARTIFACT_TRANSFORMS[materialOverride] || ARTIFACT_TRANSFORMS.digital;
        const s1 = values[0] / 100, s2 = values[1] / 100, rVal = (values[2] || 0) / 100;
        const aO = (s1 > 0.5) ? (s1 - 0.5) * 2.0 : 0.0, aD = (s2 < 0.5) ? (0.5 - s2) * 2.0 : 0.0, aV = (s1 < 0.5) ? (0.5 - s1) * 2.0 : 0.0;

        // Base
        const b = base.clone(); b.scale.set(0.004 * trans.planetScale, 0.004 * trans.planetScale, 0.004 * trans.planetScale);
        b.updateMatrixWorld(true); b.traverse((c: any) => { if (c.isMesh) geoms.push(bakeMesh(c, false, false, s1, s2)); });

        // Forest
        if (s2 > 0.5) {
            const f = forestGLTF.scene.clone(); f.scale.set(0.395 * trans.planetScale, 0.395 * trans.planetScale, 0.395 * trans.planetScale); f.rotation.set(-1.5, 0, 0.05); f.scale.multiplyScalar((s2 - 0.5) * 2.0 * 1.8); f.updateMatrixWorld(true);
            f.traverse((c: any) => { if (c.isMesh) geoms.push(bakeMesh(c, true, false, s1, s2)); });
        }
        // Ring
        const ring = ringFBX.clone(); ring.scale.set(0.004 * trans.ringScale, 0.004 * trans.ringScale, 0.004 * trans.ringScale);
        ring.traverse((m: any) => { if (m.isMesh && m.morphTargetInfluences) m.morphTargetInfluences.fill(rVal); });
        ring.updateMatrixWorld(true); ring.traverse((c: any) => { if (c.isMesh) geoms.push(bakeMesh(c, false, true, s1, s2)); });

        // Clouds
        const clouds = cloudsFBX.clone(); clouds.scale.set(0.004 * trans.cloudScale, 0.004 * trans.cloudScale, 0.004 * trans.cloudScale);
        clouds.updateMatrixWorld(true); clouds.traverse((c: any) => { if (c.isMesh) geoms.push(bakeMesh(c, false, false, s1, s2)); });

        // Comets
        for (let i = 0; i < 6; i++) {
            const cm = cometTemplate.clone(); const angle = (i / 6) * Math.PI * 2; const dist = 5.5 * trans.cometScale;
            cm.position.set(Math.cos(angle) * dist, (i % 2 === 0 ? 1 : -1) * 2, Math.sin(angle) * dist); cm.scale.set(0.01 * trans.cometScale, 0.01 * trans.cometScale, 0.01 * trans.cometScale); cm.updateMatrixWorld(true);
            cm.traverse((c: any) => { if (c.isMesh) geoms.push(bakeMesh(c, false, false, s1, s2)); });
        }

        if (geoms.length === 0) return null;
        return BufferGeometryUtils.mergeGeometries(geoms, false);
    }, [values, materialOverride]);

    const finalMat = useMemo(() => {
        const base = (ARTIFACT_MATERIALS as any)[materialOverride] || ARTIFACT_MATERIALS.digital;
        const m = base.clone();
        m.onBeforeCompile = (sh: any) => applyArtifactShader(sh, uniforms.current);
        return m;
    }, [materialOverride]);

    const trans = ARTIFACT_TRANSFORMS[materialOverride] || ARTIFACT_TRANSFORMS.digital;

    if (!geom) return null;
    return (
        <group>
            <Environment files={getAssetPath('/env_map.hdr')} />
            <mesh geometry={geom} material={finalMat} position={trans.position} rotation={trans.rotation} />
        </group>
    );
};
