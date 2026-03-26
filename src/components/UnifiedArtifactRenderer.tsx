import React, { Suspense, useState, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { DisplacementSphere } from './DisplacementSphere';
import * as THREE from 'three';
import { MeshStandardMaterial } from 'three';

// --- ARTIFACT TRANSFORMS (Position, Rotation, and Scaling) ---
export const GLOBAL_POSITION_OFFSET: [number, number, number] = [0, 0, 0]; // Bulk shift for all 4 slots
export const GLOBAL_SCALE_MULTIPLIER: number = 1.0; // Global master scale for everything

// --- HALO AURA SETTINGS (EXPOSED) ---
// Detailed control objects for the 2D radial glow backdrop.
export const HALO_SETTINGS = {
    scaleMultiplier: 10.65,    // [Overall Size] Scale of the 2D plane backdrop.
    glowIntensity: 1.8,       // [Brightness] Global intensity multiplier for the whole aura.
    fresnelPower: 2.2,        // [Falloff/Blur] Sharpness of the outer rim. (Higher = thinner aura, Lower = massive blurred glow).
    fresnelBias: 1.0,         // [Core Radius] How far outward the white-hot center stretches. 
    colorBlur: 1,          // [Color Blur] How much the Red/Blue/Yellow sectors bleed into each other. (Higher = more blurred/mixed colors).
    colorIntensity: 1.0,      // [Saturate] Strength/Saturation of the 3 color sectors.
    shapeSquash: 1.0,         // [Shape] Vertical vs Horizontal stretch. (1.0 = Circle, 0.5 = Tall Oval, 2.0 = Wide Oval).
    coreWhiteFactor: 0.8      // [Inner White] Intensity of the pure white glow in the very center.
};

// --- LAMP BASE COLORS (EXPOSED) ---
// Tweak the precise physical paint shades of the Planet biomes here.
export const LAMP_BIOME_COLORS = {
    ocean: { r: 0.05, g: 0.35, b: 0.85 },   // Deep plastic blue
    volcano: { r: 0.85, g: 0.15, b: 0.05 }, // Rich plastic red
    desert: { r: 0.9, g: 0.7, b: 0.15 }     // Warm plastic yellow
};

export const ARTIFACT_TRANSFORMS: Record<string, { position: [number, number, number], rotation: [number, number, number], overallScale: number, planetScale: number, cloudScale: number, cometScale: number, ringScale: number }> = {
    digital: { position: [0, 0, 0], rotation: [-9, 70, 0], overallScale: 1.0, planetScale: 1.0, cloudScale: 1.0, cometScale: 1.0, ringScale: 1.0 },
    lamp: { position: [0, -1.4, 0], rotation: [-9, 70, 0], overallScale: 1.03, planetScale: 1.0, cloudScale: 1.0, cometScale: 1.0, ringScale: 1.0 },
    necklace: { position: [-0.75, -3, 0], rotation: [-9, 70, 0], overallScale: 0.9, planetScale: 1.0, cloudScale: 1.05, cometScale: 1.05, ringScale: 1.05 },
    bracelet: { position: [0, -4.1, 0], rotation: [-9, 70, 0], overallScale: 0.7, planetScale: 1.0, cloudScale: 1.2, cometScale: 1.15, ringScale: 1.2 }
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
varying float vIsForest, vIsRing, vIsCloud;
varying vec3 vWorldPos, vOriginalPos;
varying vec2 vCustomUv;
attribute vec3 aOriginalPos;
uniform float uSliders[7], uTime, uHasDesertMap, uHasOceanMap, uIsArtifact;
uniform float uIsForest, uIsRing, uIsLamp, uIsBaseMesh, uIsCloud;
uniform sampler2D uDesertMap, uOceanMap;
uniform vec3 uDesertColor, uOceanColor;
uniform int uIndices[8];
${noisePars}
${getGrowthAlphaLogic}
`;

const sharedFragPars = `
varying float vIsForest, vIsRing, vIsCloud;
varying vec3 vWorldPos, vOriginalPos;
varying vec2 vCustomUv;
uniform float uSliders[7], uTime, uHasDesertMap, uHasOceanMap, uIsArtifact;
uniform float uIsForest, uIsRing, uIsLamp, uIsBaseMesh, uIsCloud;
uniform sampler2D uDesertMap, uOceanMap;
uniform vec3 uDesertColor, uOceanColor;
uniform vec3 uOceanGlow, uVolcanoGlow, uDesertGlow;
uniform int uIndices[8];
${noisePars}
${getGrowthAlphaLogic}
`;

const sharedFragLogic = `
float iD = uSliders[0];
float iV = uSliders[1];
float iO = uSliders[2];
float iF = uSliders[3];

vec3 seedD = vec3(0.0, 0.4, -1.0);
vec3 seedV = vec3(1.0, 0.4, 0.0);
vec3 seedO = vec3(0.0, 0.4, 1.0);
vec3 seedF = vec3(-1.0, 0.4, 0.0);

float aD = getGrowthAlpha_planet(vOriginalPos, seedD, iD);
float aV = getGrowthAlpha_planet(vOriginalPos, seedV, iV);
float aO = getGrowthAlpha_planet(vOriginalPos, seedO, iO);
float aF = getGrowthAlpha_planet(vOriginalPos, seedF, iF);

// Mask logic: Desert -> Volcano -> Ocean -> Forest
float mD = aD * (1.0 - aV) * (1.0 - aO) * (1.0 - aF);
float mV = aV * (1.0 - aO) * (1.0 - aF);
float mO = aO * (1.0 - aF);
float mF = aF;

if (vIsForest > 0.5 && mF < 0.01) discard;
if (vIsCloud > 0.5) {
    // Clouds in artifacts should just show the base material color (silver/gold/white)
    // and skip the biome-based color mixing and discarding.
    #ifdef USE_COLOR
        diffuseColor.rgb = diffuse;
        return; 
    #endif
}

#ifdef USE_COLOR
    diffuseColor.rgb = diffuse; // Default inherited color

    // --- LAMP SOLID PLASTIC BIOMES ---
    if (uIsLamp > 0.5) {
        vec3 oceanColor = uOceanGlow;
        if (uHasOceanMap > 0.5) {
            vec3 tex = texture2D(uOceanMap, vCustomUv).rgb;
            oceanColor = mix(oceanColor, tex, 0.6); // Blend rich image textures onto the plastic!
        }

        vec3 volcanoColor = uVolcanoGlow;
        
        vec3 desertColor = uDesertGlow;
        if (uHasDesertMap > 0.5) {
            vec3 tex = texture2D(uDesertMap, vCustomUv).rgb;
            desertColor = mix(desertColor, tex, 0.7); // Apply physical sand ripples to the structure
        }
        
        // Segment the Lamp surface cleanly into 3 fixed physical regions (Top-Left, Bottom, Right)
        vec3 pos = normalize(vOriginalPos);
        float sectO = smoothstep(0.0, 1.0, clamp(dot(pos, normalize(vec3(-0.5, 1.0, 0.0))), 0.0, 1.0)); // Blue Zone
        float sectV = smoothstep(-0.2, 0.8, clamp(dot(pos, normalize(vec3(0.0, -0.6, 0.8))), 0.0, 1.0)); // Red Zone (Front-Bottom)
        float sectD = smoothstep(0.0, 1.0, clamp(dot(pos, vec3(1.0, 0.0, 0.0)), 0.0, 1.0));            // Yellow Zone
        
        // Start with the user's explicit Base PLA Color (e.g., #733f3f) and paint the 3 bright biomes over it!
        vec3 mixedColor = diffuseColor.rgb; 
        mixedColor = mix(mixedColor, oceanColor, sectO * 0.95);
        mixedColor = mix(mixedColor, volcanoColor, sectV * 0.95);
        mixedColor = mix(mixedColor, desertColor, sectD * 0.95);
        
        diffuseColor.rgb = mixedColor;
    }
#endif
`;

export const applyArtifactShader = (shader: any, uniforms: any) => {
    shader.uniforms.uSliders = uniforms.uSliders;
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uDesertMap = uniforms.uDesertMap;
    shader.uniforms.uOceanMap = uniforms.uOceanMap;
    shader.uniforms.uHasDesertMap = uniforms.uHasDesertMap;
    shader.uniforms.uHasOceanMap = uniforms.uHasOceanMap;
    shader.uniforms.uIndices = uniforms.uIndices;
    shader.uniforms.uIsLamp = uniforms.uIsLamp || { value: 0.0 };
    shader.uniforms.uIsBaseMesh = uniforms.uIsBaseMesh || { value: 0.0 };
    shader.uniforms.uIsCloud = uniforms.uIsCloud || { value: 0.0 };
    shader.uniforms.uIsForest = uniforms.uIsForest || { value: 0.0 };
    shader.uniforms.uIsRing = uniforms.uIsRing || { value: 0.0 };
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>\n${sharedVertPars}`).replace('#include <begin_vertex>', `#include <begin_vertex>\nvCustomUv = uv; vOriginalPos = position; vIsForest = uIsForest; vIsRing = uIsRing; vIsCloud = uIsCloud;`);

    const customMorphLogic = `
        float mI[8]; for (int i=0; i<8; i++) mI[i] = 0.0;
        
        if (uIsBaseMesh > 0.5) {
            float iD = uSliders[0], iV = uSliders[1], iO = uSliders[2], iF = uSliders[3];
            vec3 sD = vec3(0.0, 0.4, -1.0), sV = vec3(1.0, 0.4, 0.0), sO = vec3(0.0, 0.4, 1.0), sF = vec3(-1.0, 0.4, 0.0);
            float aD = getGrowthAlpha_planet(transformed, sD, iD), aV = getGrowthAlpha_planet(transformed, sV, iV), aO = getGrowthAlpha_planet(transformed, sO, iO), aF = getGrowthAlpha_planet(transformed, sF, iF);
            float mD = aD*(1.0-aV)*(1.0-aO)*(1.0-aF), mV = aV*(1.0-aO)*(1.0-aF), mO = aO*(1.0-aF), mF = aF;
            for (int i=0; i<8; i++) { int t = uIndices[i]; if (t==0) mI[i]=mD*1.8; else if (t==1) mI[i]=mO*1.8; else if (t==2) mI[i]=mV*1.8; else if (t==3) mI[i]=mF*1.8; }
            ${THREE.ShaderChunk['morphtarget_vertex'].replace(/morphTargetInfluences/g, 'mI')}
        } else {
            ${THREE.ShaderChunk['morphtarget_vertex']} // Pass through raw influence arrays natively
        }
        
        vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
    `;

    shader.vertexShader = shader.vertexShader.replace('#include <morphtarget_vertex>', customMorphLogic);

    const normalLogic = `
#include <normal_fragment_begin>
normal = normalize(cross(dFdx(vWorldPos), dFdy(vWorldPos)));
nonPerturbedNormal = normal;
    `;

    const emissiveLogic = `
#include <emissivemap_fragment>
    `;

    shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${sharedFragPars}`)
        .replace('#include <normal_fragment_begin>', normalLogic)
        .replace('#include <emissivemap_fragment>', emissiveLogic)
        .replace('#include <color_fragment>', `#include <color_fragment>\n{${sharedFragLogic}}`);
};

// --- MATERIAL REGISTRY (EXPOSED) ---
// IMPORTANT: You MUST Hard Refresh (F5 / Cmd+R) after tweaking these hex codes, as Next.js perfectly caches WebGL bindings!
export const ARTIFACT_MATERIALS = {
    lamp: new THREE.MeshStandardMaterial({ color: '#f8f8f8', roughness: 1.65, metalness: 0.1, transparent: true, opacity: 0.5 }), // Warm matte PLA print (Base)
    necklace: new THREE.MeshStandardMaterial({ color: '#4a4a4b', roughness: 0.15, metalness: 0.95, transparent: true, opacity: 1.0 }), // Dark silver
    bracelet: new THREE.MeshStandardMaterial({ color: '#b76e79', roughness: 0.15, metalness: 1.0, transparent: true, opacity: 1.0 }), // Rose Gold
    digital: new THREE.MeshStandardMaterial({ color: '#1a1a1c', roughness: 0.9, metalness: 0.0, transparent: true, opacity: 1.0 })
};

interface ArtifactProps { values: number[]; materialOverride: string; }

export const UnifiedArtifactRenderer: React.FC<ArtifactProps> = ({ values, materialOverride }) => {
    const [loading, setLoading] = useState(true);

    return (
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            {loading && (
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, background: 'rgba(0,0,0,0.15)' }}>
                    <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: '11px', fontFamily: 'monospace', letterSpacing: '2px', textTransform: 'uppercase' }}>
                        Loading 3D...
                    </div>
                </div>
            )}
            <Canvas
                camera={{ position: [0, 0, 18], fov: 45 }}
                frameloop="demand"
            >
                <Suspense fallback={null}>
                    <InnerArtifact values={values} materialOverride={materialOverride} onLoaded={() => setLoading(false)} />
                </Suspense>
            </Canvas>
        </div>
    );
};

interface InnerArtifactProps extends ArtifactProps { onLoaded?: () => void; }

const InnerArtifact: React.FC<InnerArtifactProps> = ({ values, materialOverride, onLoaded }) => {
    const trans = ARTIFACT_TRANSFORMS[materialOverride] || ARTIFACT_TRANSFORMS.digital;
    const { gl, scene, camera } = useThree();

    useEffect(() => {
        // Once the FBX Suspense resolves, the component mounts.
        // Force WebGL to compile the shader materials synchronously BEFORE showing the canvas.
        gl.compile(scene, camera);

        // Let the GPU flush the compiled programs and paint the first frame.
        requestAnimationFrame(() => {
            setTimeout(() => {
                if (onLoaded) onLoaded();
            }, 100);
        });
    }, [gl, scene, camera, onLoaded]);

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

    const isLamp = materialOverride === 'lamp';

    return (
        <group position={finalPos}>
            {/* --- THE HALO: A 2D flat radial glow-board placed statically behind the 3D planet --- */}
            {isLamp && (
                <mesh scale={pS * HALO_SETTINGS.scaleMultiplier} position={[0, 0, -2]}>
                    <planeGeometry args={[2, 2]} />
                    <shaderMaterial
                        key={`${HALO_SETTINGS.scaleMultiplier}-${HALO_SETTINGS.glowIntensity}-${HALO_SETTINGS.fresnelPower}-${HALO_SETTINGS.fresnelBias}-${HALO_SETTINGS.colorBlur}-${HALO_SETTINGS.colorIntensity}-${HALO_SETTINGS.shapeSquash}-${HALO_SETTINGS.coreWhiteFactor}`}
                        transparent
                        depthWrite={false}
                        uniforms={{
                            c: { value: HALO_SETTINGS.fresnelBias },
                            p: { value: HALO_SETTINGS.fresnelPower },
                            intensityMult: { value: HALO_SETTINGS.glowIntensity },
                            colorBlur: { value: HALO_SETTINGS.colorBlur },
                            colorStrength: { value: HALO_SETTINGS.colorIntensity },
                            squash: { value: HALO_SETTINGS.shapeSquash },
                            whiteFactor: { value: HALO_SETTINGS.coreWhiteFactor }
                        }}
                        vertexShader={`
                            varying vec2 vUv;
                            void main() {
                                vUv = uv;
                                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                            }
                        `}
                        fragmentShader={`
                             uniform float c;
                            uniform float p;
                            uniform float intensityMult;
                            uniform float colorBlur;
                            uniform float colorStrength;
                            uniform float squash;
                            uniform float whiteFactor;
                            varying vec2 vUv;
                            
                            void main() {
                                // Screen Space Math: Map 0.0->1.0 to -1.0->1.0
                                vec2 st = vUv * 2.0 - 1.0;
                                
                                // Apply Shape Deformation (Squash/Stretch)
                                st.x *= 1.0 / max(squash, 0.01); 
                                
                                // Radial Distance out from the center coordinate
                                float dist = length(st);
                                
                                // Prevent drawing literal hard-square corners
                                if (dist > 1.0) discard;
                                
                                // Safe Directional Vector for color segmentation (Add epsilon to avoid center artifacts)
                                vec2 dir = st / (dist + 0.0001);
                                
                                // Calculate core radiant glow fading toward the edges. 'c' expands the inner core.
                                float coreGlow = smoothstep(1.0, 0.0, dist / max(c, 0.01));
                                
                                // Generate Red/Blue/Yellow sectors with dynamically blurred transitions
                                float blurWidth = 1.0 - colorBlur; 
                                float aO = smoothstep(-1.0 + blurWidth, 0.8, clamp(dot(dir, normalize(vec2(-0.5, 1.0))), 0.0, 1.0)); // Blue Top-Left
                                float aV = smoothstep(-1.0 + blurWidth, 0.8, clamp(dot(dir, normalize(vec2(0.0, -0.8))), 0.0, 1.0)); // Red Bottom
                                float aD = smoothstep(-1.0 + blurWidth, 0.8, clamp(dot(dir, vec2(1.0, 0.0)), 0.0, 1.0));            // Yellow Right
                                
                                vec3 color = vec3(0.1, 0.1, 0.1); // Base ambient aura
                                color = mix(color, vec3(0.0, 0.45, 1.0), aO * colorStrength);
                                color = mix(color, vec3(1.0, 0.05, 0.0), aV * colorStrength); 
                                color = mix(color, vec3(1.0, 0.8, 0.0), aD * colorStrength);
                                
                                // Mix the tri-color directly into pure white in the center
                                vec3 finalColor = mix(color, vec3(1.0, 1.0, 1.0), coreGlow * c * whiteFactor);
                                
                                // Multiply intensity by coreGlow radius and apply global intensity
                                float intensity = pow(coreGlow, max(p, 0.1)); 
                                float finalAlpha = clamp(intensity * intensityMult, 0.0, 1.0);
                                
                                gl_FragColor = vec4(finalColor, finalAlpha);
                            }
                        `}
                    />
                </mesh>
            )}

            {/* --- THE PLANET: Actively rotated and spatially manipulated by ARTIFACT_TRANSFORMS --- */}
            <group rotation={trans.rotation}>
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
        </group>
    );
};
