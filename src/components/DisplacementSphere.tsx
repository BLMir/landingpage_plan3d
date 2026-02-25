import React, { useMemo, useRef, useEffect, memo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useFBX, useGLTF, Environment, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { Mesh, Color, MeshStandardMaterial, Group } from 'three';
import { getAssetPath } from '@/utils/paths';

// Preload to avoid waterfalls
useGLTF.preload(getAssetPath('/models/forest.glb'));
useGLTF.preload(getAssetPath('/models/comet_single.glb'));

// --- SHADER HELPERS ---
const noisePars = `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
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
        p0 *= norm.x;
        p1 *= norm.y;
        p2 *= norm.z;
        p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
        m = m * m;
        return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1),
            dot(p2, x2), dot(p3, x3)));
    }
    `;

const growthLogic = `
float getGrowthAlpha(vec3 pos, vec3 seedPoint, float intensity) {
    vec3 posNorm = normalize(pos);
    if (intensity < 0.001) return 0.0;
    if (intensity >= 1.0) return 1.0;
    
    float align = dot(posNorm, normalize(seedPoint));
    float grad = align * 0.5 + 0.5; 
    
    float n = snoise(posNorm * 4.2) * 0.5 + 0.5;
    float growthMap = mix(grad, n, 0.25); 
    
    float threshold = 1.15 - (intensity * 1.35);
    return smoothstep(threshold, threshold + 0.03, growthMap);
}
`;

// Preload to avoid waterfalls
useGLTF.preload(getAssetPath('/models/forest.glb'));

interface DisplacementSphereProps {
    values: number[];
    currentSection: number;
    tintColor?: string;
    tintOpacity?: number;
}

// --- BUTTERFLY PARTICLES ---
// --- BUTTERFLY/FIREFLY SHADERS ---
const butterflyVertexShader = `
    uniform float uTime;
    uniform float uSpeed;
    uniform float uIntensity;
    uniform vec3 uSeedPoint;
    attribute float pSize;
    attribute vec3 pColor;
    attribute vec3 pSeed;
    varying vec3 vColor;
    varying float vAlpha;

    ${noisePars}

    float getGrowth(vec3 pos, vec3 seedPoint, float intensity) {
        if (intensity < 0.005) return 0.0;
        
        // Use normalized position for growth mapping (sphere-independent)
        vec3 posNorm = normalize(pos);
        float align = dot(posNorm, normalize(seedPoint));
        
        // Gradient and noise for reveal
        float grad = align * 0.5 + 0.5; 
        float n = snoise(posNorm * 3.5) * 0.5 + 0.5;
        float growthMap = mix(grad, n, 0.2); 
        
        // Sharper reveal threshold
        float threshold = 1.05 - (intensity * 1.1);
        return smoothstep(threshold, threshold + 0.02, growthMap);
    }

    void main() {
        vColor = pColor;
        
        float growth = getGrowth(position, uSeedPoint, uIntensity);
        vAlpha = growth;

        // DRASTIC MOVEMENT (Scaled for radius 1.25)
        vec3 pos = position;
        float t = uTime * uSpeed * (1.5 + pSeed.z * 1.0);
        pos.x += sin(t + pSeed.x * 10.0) * 1.5 * growth;
        pos.y += cos(t * 0.8 + pSeed.y * 10.0) * 1.5 * growth;
        pos.z += sin(t * 1.3 + pSeed.x * 10.0) * 1.5 * growth;

        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        
        // Balanced pixel size for the distance
        gl_PointSize = pSize * (60.0 / -mvPosition.z) * growth;
        gl_Position = projectionMatrix * mvPosition;
    }
`;

const cometFragmentShader = `
    uniform float uTime;
    varying vec2 vUv;
    varying vec3 vPos;
    
    ${noisePars}
    
    void main() {
        // Palette v3 (Lighter Blue Rock, Blue/Cyan Energy, NO WHITE)
        vec3 lightBlueRock = vec3(0.1, 0.25, 0.45); // Lighter blue crust
        vec3 energyBlue = vec3(0.0, 0.6, 2.0);      // High-intensity Blue
        vec3 heartCyan = vec3(0.0, 1.2, 1.8);       // High-intensity Cyan
        
        // Magma Logic adapted for Comets
        vec2 uv = vUv * 3.5; 
        float speed = uTime * 0.2;
        
        // Procedural rivers and ridges
        float noiseFlow = snoise(vec3(uv * 1.0, speed));
        float ridges = 1.0 - abs(noiseFlow); 
        float river = smoothstep(0.65, 0.9, ridges);
        
        // Rocky noise for crust texture
        float rockyNoise = snoise(vec3(uv * 4.0, uTime * 0.05)) * 0.5 + 0.5;
        rockyNoise = pow(rockyNoise, 2.0);
        
        // Pulsing core effect
        float pulse = snoise(vPos * 0.5 + vec3(uTime * 1.2)) * 0.5 + 0.5;
        
        // Mix colors based on procedural features
        vec3 crust = lightBlueRock * (0.5 + 0.5 * rockyNoise);
        vec3 finalColor = mix(crust, energyBlue, river);
        finalColor = mix(finalColor, heartCyan, smoothstep(0.85, 1.0, ridges) * pulse);
        
        // Intensify glow in rivers (Strictly capped to avoid white)
        finalColor *= (1.0 + river * 0.6);
        
        // Subtle breathing effect
        float breathing = 0.95 + 0.05 * sin(uTime * 2.0 + vUv.x * 10.0);
        gl_FragColor = vec4(finalColor * breathing, 1.0);
    }
`;

const cloudVertexShader = `
    uniform float uTime;
    uniform float uStorm;
    #include <morphtarget_pars_vertex>
    varying vec2 vUv;
    varying vec3 vPos;

    ${noisePars}

    void main() {
        vUv = uv;
        #include <begin_vertex>
        #include <morphtarget_vertex>
        
        // Stormy shaking effect
        if (uStorm > 0.0) {
            float noise = snoise(vec3(transformed.xy * 25.0, uTime * 20.0));
            transformed += normal * noise * 0.12 * uStorm;
            
            // Randomized jitter (Faster and stronger)
            transformed.x += sin(uTime * 40.0 + transformed.y) * 0.05 * uStorm;
            transformed.y += cos(uTime * 35.0 + transformed.x) * 0.05 * uStorm;
        }

        #include <project_vertex>
        vPos = transformed;
    }
`;

const cloudFragmentShader = `
    uniform float uStorm;
    varying vec2 vUv;
    void main() {
        // Transition from Stormy Grey (0.4) to Clean White (1.0)
        float brightness = mix(1.0, 0.45, uStorm);
        vec3 color = vec3(brightness);
        
        float alpha = mix(0.8, 0.9, uStorm); // Slightly more opaque when stormy
        gl_FragColor = vec4(color, alpha);
    }
`;

const butterflyFragmentShader = `
    varying vec3 vColor;
    varying float vAlpha;
    
    void main() {
        // Round particle shape with soft edges
        float d = distance(gl_PointCoord, vec2(0.5));
        if (d > 0.5) discard;
        
        float glow = pow(1.0 - d * 2.0, 2.0);
        float core = pow(1.0 - d * 2.0, 8.0);
        
        vec3 finalColor = mix(vColor, vec3(1.0), core * 0.5);
        gl_FragColor = vec4(finalColor, (glow * 0.6 + core * 0.4) * vAlpha * 0.9);
    }
`;

// --- WIND PARTICLES (LINES) ---
const windVertexShader = `
    uniform float uTime;
    uniform float uSpeed;
    uniform float uIntensity;
    uniform vec3 uSeedPoint;
    attribute vec3 pSeed;
    attribute float vRatio; // 0 to 1 along streak
    attribute float vSide;  // -1 or 1 for width
    varying float vAlpha;

    ${noisePars}

    float getGrowth(vec3 pos, vec3 seedPoint, float intensity) {
        if (intensity < 0.005) return 0.0;
        vec3 posNorm = normalize(pos);
        float align = dot(posNorm, normalize(seedPoint));
        float grad = align * 0.5 + 0.5; 
        float n = snoise(posNorm * 3.5) * 0.5 + 0.5;
        float growthMap = mix(grad, n, 0.15); 
        float threshold = 1.05 - (intensity * 1.10);
        return smoothstep(threshold, threshold + 0.15, growthMap);
    }

    // Rotation helper
    vec3 rotateY(vec3 p, float a) {
        float c = cos(a), s = sin(a);
        return vec3(p.x * c - p.z * s, p.y, p.x * s + p.z * c);
    }

    void main() {
        float stateGrowth = getGrowth(position, uSeedPoint, uIntensity);
        
        // 1. Initial Position (Seed)
        vec3 pos = normalize(position); 
        float radius = length(position); // ~2.25
        
        // 2. Horizontal Rotation (Tangent sweep)
        float t = uTime * uSpeed * (0.6 + pSeed.z * 0.4);
        float sweepAngle = t + pSeed.x;
        // Apply individual longitudinal shift along the streak
        sweepAngle -= vRatio * 0.45 * stateGrowth; 
        
        pos = rotateY(pos, sweepAngle);
        
        // 3. Hugging the Planet (Constant Radius)
        // We force it back to a sphere after rotation
        pos = normalize(pos) * (radius + sin(t*2.0 + pSeed.y)*0.05);

        // 4. Dynamic Visibility (Fade in/out based on final location)
        // This ensures wind is only visible OVER the desert area
        float locationMask = getGrowth(pos, uSeedPoint, 1.0); 
        vAlpha = stateGrowth * locationMask * 0.4;

        // 4. Thickness Expansion
        // Calculate tangent/bitangent for surface expansion
        vec3 normal = normalize(pos);
        vec3 tangent = normalize(cross(normal, vec3(0.0, 1.0, 0.0)));
        
        float width = 0.15 * stateGrowth; // "Much thicker"
        pos += tangent * vSide * width;

        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * mvPosition;
    }
`;

const windFragmentShader = `
    varying float vAlpha;
    void main() {
        gl_FragColor = vec4(1.0, 1.0, 1.0, vAlpha);
    }
`;

const ButterflyParticles: React.FC<{ intensity: number, radius?: number, speed?: number, rotation?: [number, number, number] }> = ({
    intensity,
    radius = 2.15,
    speed = 1.0,
    rotation = [0, 0, 0]
}) => {
    const count = 400; // Slightly reduced from 600 to avoid clutter
    const meshRef = useRef<THREE.Points>(null);
    const materialRef = useRef<THREE.ShaderMaterial>(null);

    const [positions, colors, sizes, seeds] = useMemo(() => {
        const pos = new Float32Array(count * 3);
        const col = new Float32Array(count * 3);
        const siz = new Float32Array(count);
        const sds = new Float32Array(count * 3);

        const possibleColors = [
            new THREE.Color('#22c55e'), // Green
            new THREE.Color('#3b82f6'), // Blue
            new THREE.Color('#d8b4fe'), // Lilac
            new THREE.Color('#8b5cf6'), // Violet
        ];

        // Spawn around the forest seed point in WORLD space coordinates (normalized planet)
        const seedPoint = new THREE.Vector3(0.8, -0.5, 0.3).normalize();

        for (let i = 0; i < count; i++) {
            // WIDER RANDOM SPREAD to ensure they don't clump at the center
            const randomOffset = new THREE.Vector3(
                (Math.random() - 0.5) * 5.0,
                (Math.random() - 0.5) * 5.0,
                (Math.random() - 0.5) * 5.0
            );
            const dir = seedPoint.clone().add(randomOffset).normalize();

            // WORLD RADIUS: 1.2 to 1.6 ensures they are clearly outside base (1.0) and foliage
            const currentRadius = radius + Math.random() * 0.5;

            pos[i * 3] = dir.x * currentRadius;
            pos[i * 3 + 1] = dir.y * currentRadius;
            pos[i * 3 + 2] = dir.z * currentRadius;

            const c = possibleColors[Math.floor(Math.random() * possibleColors.length)];
            col[i * 3] = c.r;
            col[i * 3 + 1] = c.g;
            col[i * 3 + 2] = c.b;

            // Twinkling points
            siz[i] = 1.0 + Math.random() * 5.0;
            sds[i * 3] = Math.random() * 1000.0;
            sds[i * 3 + 1] = Math.random() * 1000.0;
            sds[i * 3 + 2] = Math.random() * 1.0;
        }
        return [pos, col, siz, sds];
    }, [count, radius]);

    const uniforms = useMemo(() => ({
        uTime: { value: 0 },
        uIntensity: { value: 0 },
        uSpeed: { value: speed },
        uSeedPoint: { value: new THREE.Vector3(0.8, -0.5, 0.3) }
    }), [speed]);

    useFrame((state) => {
        if (materialRef.current) {
            materialRef.current.uniforms.uTime.value = state.clock.getElapsedTime();
            materialRef.current.uniforms.uIntensity.value = intensity;
            materialRef.current.uniforms.uSpeed.value = speed;
        }
    });

    return (
        <points ref={meshRef} frustumCulled={false} rotation={rotation} name="exclusion_butterflies">
            <bufferGeometry>
                <bufferAttribute
                    attach="attributes-position"
                    args={[positions, 3]}
                />
                <bufferAttribute
                    attach="attributes-pColor"
                    args={[colors, 3]}
                />
                <bufferAttribute
                    attach="attributes-pSize"
                    args={[sizes, 1]}
                />
                <bufferAttribute
                    attach="attributes-pSeed"
                    args={[seeds, 3]}
                />
            </bufferGeometry>
            <shaderMaterial
                ref={materialRef}
                key={count} // Force rebuild if count changes
                uniforms={uniforms}
                vertexShader={butterflyVertexShader}
                fragmentShader={butterflyFragmentShader}
                transparent={true}
                depthWrite={false}
                depthTest={true}
                blending={THREE.AdditiveBlending}
            />
        </points>
    );
};

const WindParticles: React.FC<{ intensity: number, radius?: number, speed?: number, rotation?: [number, number, number] }> = ({
    intensity,
    radius = 3.5,
    speed = 1.0,
    rotation = [0, 0, 0]
}) => {
    const streakCount = 60; // Fewer but thicker
    const segmentsPerStreak = 8; // Smooth curving

    const countPerStreak = (segmentsPerStreak + 1) * 2;
    const totalCount = streakCount * countPerStreak;
    const indexCountPerStreak = segmentsPerStreak * 6;
    const totalIndexCount = streakCount * indexCountPerStreak;

    const meshRef = useRef<THREE.Mesh>(null);
    const materialRef = useRef<THREE.ShaderMaterial>(null);

    const [positions, seeds, ratios, sides, indices] = useMemo(() => {
        const pos = new Float32Array(totalCount * 3);
        const sds = new Float32Array(totalCount * 3);
        const rats = new Float32Array(totalCount);
        const sdes = new Float32Array(totalCount);
        const idxs = new Uint16Array(totalIndexCount);

        const seedPoint = new THREE.Vector3(0.8, -0.5, 0.3).normalize();

        for (let i = 0; i < streakCount; i++) {
            const randomOffset = new THREE.Vector3(
                (Math.random() - 0.5) * 5.5,
                (Math.random() - 0.5) * 5.5,
                (Math.random() - 0.5) * 5.5
            );
            const dir = seedPoint.clone().add(randomOffset).normalize();
            const currentRadius = radius + Math.random() * 0.5;

            const baseP = dir.multiplyScalar(currentRadius);
            const sx = Math.random() * 1000.0;
            const sy = Math.random() * 1000.0;
            const sz = Math.random() * 1.0;

            const vertexOffset = i * countPerStreak;

            for (let s = 0; s <= segmentsPerStreak; s++) {
                const r = s / segmentsPerStreak;

                // Left vertex
                const vL = vertexOffset + s * 2;
                pos[vL * 3] = baseP.x; pos[vL * 3 + 1] = baseP.y; pos[vL * 3 + 2] = baseP.z;
                sds[vL * 3] = sx; sds[vL * 3 + 1] = sy; sds[vL * 3 + 2] = sz;
                rats[vL] = r;
                sdes[vL] = -1.0;

                // Right vertex
                const vR = vertexOffset + s * 2 + 1;
                pos[vR * 3] = baseP.x; pos[vR * 3 + 1] = baseP.y; pos[vR * 3 + 2] = baseP.z;
                sds[vR * 3] = sx; sds[vR * 3 + 1] = sy; sds[vR * 3 + 2] = sz;
                rats[vR] = r;
                sdes[vR] = 1.0;

                if (s < segmentsPerStreak) {
                    const iOff = i * indexCountPerStreak + s * 6;
                    const a = vertexOffset + s * 2;
                    const b = vertexOffset + s * 2 + 1;
                    const c = vertexOffset + (s + 1) * 2;
                    const d = vertexOffset + (s + 1) * 2 + 1;

                    idxs[iOff] = a; idxs[iOff + 1] = b; idxs[iOff + 2] = c;
                    idxs[iOff + 3] = b; idxs[iOff + 4] = d; idxs[iOff + 5] = c;
                }
            }
        }
        return [pos, sds, rats, sdes, idxs];
    }, [streakCount, radius]);

    const posAttr = useMemo(() => new THREE.BufferAttribute(positions, 3), [positions]);
    const sdsAttr = useMemo(() => new THREE.BufferAttribute(seeds, 3), [seeds]);
    const ratAttr = useMemo(() => new THREE.BufferAttribute(ratios, 1), [ratios]);
    const sideAttr = useMemo(() => new THREE.BufferAttribute(sides, 1), [sides]);
    const idxAttr = useMemo(() => new THREE.BufferAttribute(indices, 1), [indices]);

    const uniforms = useMemo(() => ({
        uTime: { value: 0 },
        uIntensity: { value: 0 },
        uSpeed: { value: speed },
        uSeedPoint: { value: new THREE.Vector3(0.8, -0.5, 0.3) }
    }), [speed]);

    useFrame((state) => {
        if (materialRef.current) {
            materialRef.current.uniforms.uTime.value = state.clock.getElapsedTime();
            materialRef.current.uniforms.uIntensity.value = intensity;
            materialRef.current.uniforms.uSpeed.value = speed;
        }
    });

    return (
        <mesh ref={meshRef} frustumCulled={false} rotation={rotation} name="exclusion_wind">
            <bufferGeometry>
                <primitive object={posAttr} attach="attributes-position" />
                <primitive object={sdsAttr} attach="attributes-pSeed" />
                <primitive object={ratAttr} attach="attributes-vRatio" />
                <primitive object={sideAttr} attach="attributes-vSide" />
                <primitive object={idxAttr} attach="index" />
            </bufferGeometry>
            <shaderMaterial
                ref={materialRef}
                uniforms={uniforms}
                vertexShader={windVertexShader}
                fragmentShader={windFragmentShader}
                transparent={true}
                side={THREE.DoubleSide}
                depthWrite={false}
                depthTest={true}
                blending={THREE.AdditiveBlending}
            />
        </mesh>
    );
};

// --- STYLIZED SHADERS REMOVED DUPLICATES ---

const DisplacementSphereBase: React.FC<DisplacementSphereProps> = ({
    values,
    currentSection,
    tintColor,
    tintOpacity
}) => {
    const base = useFBX(getAssetPath('/models/base.fbx'));
    const { scene: cometTemplateScene } = useGLTF(getAssetPath('/models/comet_single.glb'));
    // FOREST GLTF (Keep loading it to avoid errors, but don't use it yet)
    useGLTF.preload(getAssetPath('/models/forest.glb'));
    const forestGLTF = useGLTF(getAssetPath('/models/forest.glb'));
    const ringFBX = useFBX(getAssetPath('/models/Ring.fbx'));
    const cloudsFBX = useFBX(getAssetPath('/models/Clouds.fbx'));

    // Load textures for rings
    const [moonTex, martianTex, stripesTex, magmaTex, rockyMarsTex, ring0Tex] = useTexture([
        getAssetPath('/textures/rings/moon.png'),
        getAssetPath('/textures/rings/martian.png'),
        getAssetPath('/textures/rings/stripes.png'),
        getAssetPath('/textures/rings/magma.png'),
        getAssetPath('/textures/rings/mars_rocky.png'),
        getAssetPath('/textures/rings/ring0_ochre.png')
    ]);

    // Setup planetary textures for full wrapping
    useEffect(() => {
        if (stripesTex) {
            stripesTex.wrapS = stripesTex.wrapT = THREE.RepeatWrapping;
            stripesTex.repeat.set(4, 4);
        }
        if (ring0Tex) {
            ring0Tex.wrapS = ring0Tex.wrapT = THREE.RepeatWrapping;
            // "Zoom in" logic: smaller repeat value covers the mesh with a larger segment of the texture
            ring0Tex.repeat.set(0.5, 0.5);
            ring0Tex.offset.set(0.25, 0.25); // Recenter the zoom
        }
    }, [stripesTex, ring0Tex]);

    // Setup stable materials for rings to avoid recreating them every frame
    const ringMaterials = useMemo(() => {
        return {
            planetary: new THREE.MeshStandardMaterial({
                map: ring0Tex,
                side: THREE.DoubleSide,
                transparent: false,
                roughness: 0.6,
                metalness: 0.2,
                depthTest: true,
                depthWrite: true
            }),
            magma: new THREE.ShaderMaterial({
                uniforms: {
                    uTime: { value: 0 },
                    uMagmaTex: { value: magmaTex }
                },
                vertexShader: `
                    #include <morphtarget_pars_vertex>
                    varying vec2 vUv;
                    varying vec3 vPos;
                    void main() {
                        vUv = uv;
                        #include <begin_vertex>
                        #include <morphtarget_vertex>
                        #include <project_vertex>
                        vPos = transformed;
                    }
                `,
                fragmentShader: `
                    precision highp float;
                    uniform float uTime;
                    varying vec2 vUv;
                    varying vec3 vPos;
                    
                    ${noisePars}
                    
                    void main() {
                        // Large Scale Texture (Lower Tiling for zoom effect)
                        vec2 tiledUv = vUv * 3.0; 
                        
                        // Broader volcan-style ridges for smoother rivers
                        float noiseFlow = snoise(vec3(tiledUv * 1.0, uTime * 0.15));
                        float ridges = 1.0 - abs(noiseFlow); 
                        float river = smoothstep(0.7, 0.9, ridges);
                        
                        // Rocky logic: adjusted frequency for larger scale
                        float rockyNoise = snoise(vec3(tiledUv * 3.0, uTime * 0.05)) * 0.5 + 0.5;
                        rockyNoise = pow(rockyNoise, 2.5); 
                        
                        // Pulse logic
                        float pulseN = snoise(vPos * 0.3 + vec3(uTime * 1.5)) * 0.5 + 0.5;
                        
                        // Vibrant Orange/Gold Palette
                        vec3 crustOrange = vec3(0.65, 0.2, 0.0) * (0.3 + 0.7 * rockyNoise);
                        vec3 vibrantOrange = vec3(1.8, 0.45, 0.0); // Hot orange
                        vec3 goldenOrange = vec3(2.5, 1.5, 0.1);  // Emissive gold/orange
                        
                        vec3 magmaMix = mix(crustOrange, vibrantOrange, river);
                        magmaMix = mix(magmaMix, goldenOrange, smoothstep(0.85, 1.0, ridges) * pulseN);
                        
                        // Final Intensity Boost
                        magmaMix *= (1.0 + river * 0.8); 
                        
                        // Breathing glow
                        float breathing = 0.9 + 0.1 * sin(uTime * 3.0 + vUv.x * 20.0);
                        gl_FragColor = vec4(magmaMix * breathing, 1.0);
                    }
                `,
                transparent: true,
                side: THREE.DoubleSide,
                depthTest: true,
                depthWrite: true,
                // @ts-ignore
                morphTargets: true
            }),
            moon: new THREE.MeshStandardMaterial({
                map: moonTex,
                color: '#666666',
                side: THREE.DoubleSide,
                transparent: true,
                roughness: 0.9,
                depthTest: true,
                depthWrite: true
            }),
            martian: new THREE.MeshStandardMaterial({
                map: rockyMarsTex,
                color: '#aaaaaa', // Grittier, less red
                side: THREE.DoubleSide,
                transparent: true,
                roughness: 0.9,
                metalness: 0.0,
                depthTest: true,
                depthWrite: true
            }),
            Comet_optimized_1: new THREE.ShaderMaterial({
                uniforms: {
                    uTime: { value: 0 }
                },
                vertexShader: `
                    #include <morphtarget_pars_vertex>
                    varying vec2 vUv;
                    varying vec3 vPos;
                    void main() {
                        vUv = uv;
                        #include <begin_vertex>
                        #include <morphtarget_vertex>
                        #include <project_vertex>
                        vPos = transformed;
                    }
                `,
                fragmentShader: cometFragmentShader,
                transparent: true,
                side: THREE.DoubleSide,
                depthTest: true,
                depthWrite: true,
                // @ts-ignore
                morphTargets: true
            }),
            Comet_optimized_2: new THREE.ShaderMaterial({
                uniforms: {
                    uTime: { value: 0 },
                    uMagmaTex: { value: magmaTex }
                },
                vertexShader: `
                    #include <morphtarget_pars_vertex>
                    varying vec2 vUv;
                    varying vec3 vPos;
                    void main() {
                        vUv = uv;
                        #include <begin_vertex>
                        #include <morphtarget_vertex>
                        #include <project_vertex>
                        vPos = transformed;
                    }
                `,
                fragmentShader: `
                    precision highp float;
                    uniform float uTime;
                    varying vec2 vUv;
                    varying vec3 vPos;
                    
                    ${noisePars}
                    
                    void main() {
                        // Large Scale Texture (Lower Tiling for zoom effect)
                        vec2 tiledUv = vUv * 3.0; 
                        
                        // Broader volcan-style ridges for smoother rivers
                        float noiseFlow = snoise(vec3(tiledUv * 1.0, uTime * 0.15));
                        float ridges = 1.0 - abs(noiseFlow); 
                        float river = smoothstep(0.7, 0.9, ridges);
                        
                        // Rocky logic: adjusted frequency for larger scale
                        float rockyNoise = snoise(vec3(tiledUv * 3.0, uTime * 0.05)) * 0.5 + 0.5;
                        rockyNoise = pow(rockyNoise, 2.5); 
                        
                        // Pulse logic
                        float pulseN = snoise(vPos * 0.3 + vec3(uTime * 1.5)) * 0.5 + 0.5;
                        
                        // Vibrant Orange/Gold Palette
                        vec3 crustOrange = vec3(0.65, 0.2, 0.0) * (0.3 + 0.7 * rockyNoise);
                        vec3 vibrantOrange = vec3(1.8, 0.45, 0.0); // Hot orange
                        vec3 goldenOrange = vec3(2.5, 1.5, 0.1);  // Emissive gold/orange
                        
                        vec3 magmaMix = mix(crustOrange, vibrantOrange, river);
                        magmaMix = mix(magmaMix, goldenOrange, smoothstep(0.85, 1.0, ridges) * pulseN);
                        
                        // Final Intensity Boost
                        magmaMix *= (1.0 + river * 0.8); 
                        
                        // Breathing glow
                        float breathing = 0.9 + 0.1 * sin(uTime * 3.0 + vUv.x * 20.0);
                        gl_FragColor = vec4(magmaMix * breathing, 1.0);
                    }
                `,
                transparent: true,
                side: THREE.DoubleSide,
                depthTest: true,
                depthWrite: true,
                // @ts-ignore
                morphTargets: true
            }),
            cloud: new THREE.ShaderMaterial({
                uniforms: {
                    uTime: { value: 0 },
                    uStorm: { value: 0 }
                },
                vertexShader: cloudVertexShader,
                fragmentShader: cloudFragmentShader,
                transparent: true,
                side: THREE.DoubleSide,
                depthTest: true,
                depthWrite: false
            })
        };
    }, [moonTex, martianTex, stripesTex, magmaTex, rockyMarsTex, ring0Tex]);
    // const forest = forestGLTF.scene; // Unused for now

    // Create clones for overlays
    const materialRef = useRef<MeshStandardMaterial>(null);
    const forestMaterialRef = useRef<MeshStandardMaterial>(null);
    const ringRef = useRef<THREE.Group>(null);
    const cometRef = useRef<THREE.Group>(null);
    const cloudsRef = useRef<THREE.Group>(null);
    const planetAssemblyRef = useRef<THREE.Group>(null);

    const forestMesh = useMemo(() => {
        return forestGLTF.scene.clone();
    }, [forestGLTF]);

    const cometInstances = useMemo(() => {
        const templates: THREE.Mesh[] = [];
        cometTemplateScene.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                templates.push(child as THREE.Mesh);
            }
        });

        // Error handling if meshes not found
        if (templates.length === 0) return [];

        const instances: THREE.Mesh[] = [];
        const count = 8;
        const radius = 220; // Maintain FBX-relative distance

        for (let i = 0; i < count; i++) {
            // Pick one of the 2 meshes from the GLB
            const template = templates[i % templates.length];
            const mesh = template.clone();

            // Random distribution around the sphere
            const theta = Math.acos((Math.random() * 2) - 1);
            const phi = Math.random() * Math.PI * 2;

            mesh.position.set(
                radius * Math.sin(theta) * Math.cos(phi),
                radius * Math.sin(theta) * Math.sin(phi),
                radius * Math.cos(theta)
            );

            // Make them look at center
            mesh.lookAt(0, 0, 0);

            // Name them for sequential reveal logic
            mesh.name = `OpenToExp_${i + 1}`;

            instances.push(mesh);
        }
        return instances;
    }, [cometTemplateScene]);



    useEffect(() => {
        if (cometRef.current) {
            cometRef.current.clear();
            cometInstances.forEach(inst => cometRef.current?.add(inst));
        }
    }, [cometInstances]);

    const ringGroup = useMemo(() => {
        const group = ringFBX.clone();
        group.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                // 1. Morph enforcement - Force all to 1.0 for expanded state
                if (mesh.morphTargetInfluences) {
                    for (let i = 0; i < mesh.morphTargetInfluences.length; i++) {
                        mesh.morphTargetInfluences[i] = 1.0;
                    }
                }
                // (Geometry translation removed as it breaks morph attribute sync)
            }
        });
        return group;
    }, [ringFBX]);

    useEffect(() => {
        // Optional: Keep a simple log to confirm load if needed, or remove completely
        console.log("Rings synchronized with standard scale 100 and active morphs.");
    }, [ringGroup]);

    const customUniforms = useRef({
        uSliders: { value: [0.5, 0.5, 0.5, 0.5, 0.5] },
        uTime: { value: 0 },
        uDesertMap: { value: null as THREE.Texture | null },
        uOceanMap: { value: null as THREE.Texture | null },
        uHasDesertMap: { value: false },
        uHasOceanMap: { value: false },
        uDesertColor: { value: new Color(0.4, 0.25, 0.15) },
        uOceanColor: { value: new Color(0.01, 0.06, 0.22) },
        uIndices: { value: new Int32Array(8).fill(-1) },
    });

    // --- CLONES & GEOMETRY HANDLING ---
    const [baseMesh] = useMemo(() => {
        // Clone the entire scene structure (Group -> Mesh)
        const b = base.clone();
        return [b];
    }, [base]);

    // CACHE MESHES FOR PERFORMANCE (Avoid traverses in useFrame)
    const baseMeshCache = useMemo(() => {
        const meshes: any[] = [];
        baseMesh.traverse((child: any) => {
            if (child.isMesh && child.morphTargetInfluences) {
                meshes.push(child);
            }
        });
        return meshes;
    }, [baseMesh]);

    const ringMeshCache = useMemo(() => {
        const meshes: THREE.Mesh[] = [];
        ringGroup.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                meshes.push(child as THREE.Mesh);
            }
        });
        return meshes;
    }, [ringGroup]);

    const cloudMeshCache = useMemo(() => {
        const meshes: THREE.Mesh[] = [];
        cloudsFBX.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                meshes.push(child as THREE.Mesh);
            }
        });
        return meshes;
    }, [cloudsFBX]);

    const cometMeshCache = useMemo(() => {
        const meshes: THREE.Mesh[] = [];
        cometInstances.forEach(inst => {
            inst.traverse(child => {
                if ((child as THREE.Mesh).isMesh) meshes.push(child as THREE.Mesh);
            });
        });
        return meshes;
    }, [cometInstances]);

    // Removed useEffect for Forest Geometry

    // Maps removed for performance optimization
    const desertMaps = null;
    const oceanMaps = null;

    // Apply uniforms updates
    useEffect(() => {
        if (customUniforms.current) {
            customUniforms.current.uDesertMap.value = desertMaps;
            customUniforms.current.uHasDesertMap.value = !!desertMaps;
            customUniforms.current.uOceanMap.value = oceanMaps;
            customUniforms.current.uHasOceanMap.value = !!oceanMaps;
        }
    }, [desertMaps, oceanMaps]);


    // --- BASE MATERIAL (Ocean / Desert) ---
    useMemo(() => {
        const mat = new MeshStandardMaterial({
            color: new Color(0.12, 0.12, 0.15),
            roughness: 0.95,
            metalness: 0.0,
            side: THREE.FrontSide,
        });
        // FORCE DEFINES to ensure shader compiles with Morph logic
        mat.defines = {
            'USE_UV': '',
            'USE_MORPHTARGETS': '',
            'USE_MORPHNORMALS': ''
        };

        // @ts-ignore
        mat.morphTargets = true;
        // @ts-ignore
        mat.morphNormals = true;

        mat.onBeforeCompile = (shader) => {
            shader.uniforms.uSliders = customUniforms.current.uSliders;
            shader.uniforms.uTime = customUniforms.current.uTime;
            shader.uniforms.uDesertMap = customUniforms.current.uDesertMap;
            shader.uniforms.uOceanMap = customUniforms.current.uOceanMap;
            shader.uniforms.uHasDesertMap = customUniforms.current.uHasDesertMap;
            shader.uniforms.uHasOceanMap = customUniforms.current.uHasOceanMap;
            shader.uniforms.uDesertColor = customUniforms.current.uDesertColor;
            shader.uniforms.uOceanColor = customUniforms.current.uOceanColor;
            shader.uniforms.uIndices = customUniforms.current.uIndices;

            // --- 3-POINT SYSTEM CONSTANTS ---
            // P1 (Top): vec3(0.0, 1.0, 0.0) -> Ocean/Desert
            // P2 (Bottom Right): vec3(0.8, -0.5, 0.3) -> Volcan
            // P3 (Bottom Left): vec3(-0.8, -0.5, 0.3) -> Forest (Future)

            shader.vertexShader = `
                uniform float uSliders[5];
                uniform float uTime;
                varying vec3 vWorldPos;
                varying vec3 vOriginalPos; 
                varying vec2 vCustomUv;
                uniform int uIndices[8];
                ${noisePars}

                // Helper to get Growth Alpha based on specific point
                float getGrowthAlpha(vec3 pos, vec3 seedPoint, float intensity) {
                    vec3 posNorm = normalize(pos);
                    if (intensity <= 0.0) return 0.0;
                    if (intensity >= 1.0) return 1.0;
                    
                    float align = dot(posNorm, normalize(seedPoint));
                    float grad = align * 0.5 + 0.5; 
                    
                    float n = snoise(posNorm * 3.5) * 0.5 + 0.5;
                    float growthMap = mix(grad, n, 0.15); 
                    
                    float threshold = 1.05 - (intensity * 1.10);
                    return smoothstep(threshold, threshold + 0.15, growthMap);
                }
` + shader.vertexShader;

            const maskedMorphLogic = `
vCustomUv = uv;
vOriginalPos = position;

    // --- CALCULATE PER-VERTEX MASKS ---
    float s1 = uSliders[0];
    float s2 = uSliders[1];
    float intenVolcano = (s1 < 0.5) ? (0.5 - s1) * 2.0 : 0.0;
    float intenOcean = (s1 > 0.5) ? (s1 - 0.5) * 2.0 : 0.0;
    float intenDesert = (s2 < 0.5) ? (0.5 - s2) * 2.0 : 0.0;
    float intenForest = (s2 > 0.5) ? (s2 - 0.5) * 2.0 : 0.0;
    
    vec3 p1 = vec3(0.0, 1.0, 0.0); // Q1 Top (Volcano / Ocean)
    vec3 p2 = vec3(0.8, -0.5, 0.3); // Q2 Unified Reveal (Right)
    float aV = getGrowthAlpha(transformed, p1, intenVolcano);
    float aO = getGrowthAlpha(transformed, p1, intenOcean);
    float aD = getGrowthAlpha(transformed, p2, intenDesert);
    float aF = getGrowthAlpha(transformed, p2, intenForest);

    // --- REPLACEMENT LOGIC ---
    // S2 (Desert/Forest) overrides S1 (Volcano/Ocean)
    float maskD = aD * (1.0 - aF);
    float maskO = aO * (1.0 - aV) * (1.0 - aD) * (1.0 - aF);
    float maskV = aV * (1.0 - aO) * (1.0 - aD) * (1.0 - aF);
// Forest (maskF) doesn't have a morph target, it just suppresses others via (1.0 - aF).

#include <morphtarget_vertex>

vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
`;

            // --- ROBUST VARIABLE HIJACK ---
            // We replace all occurrences of 'morphTargetInfluences' with 'maskedInfluences'
            // in the vertex shader, and then declare 'maskedInfluences' locally in our block.
            // This ensures we don't rely on unreliable variable shadowing.

            // 1. Get the original morph target chunk
            let morphChunk = THREE.ShaderChunk['morphtarget_vertex'];

            // 2. Wrap it with our masking logic
            const hijackedMorphLogic = `
                // Local masked influences array
                float maskedInfluences[8];
for (int i = 0; i < 8; i++) maskedInfluences[i] = 0.0;

// Populate with our per-vertex masks and 1.8x boost
// type 0=Desert, 1=Ocean, 2=Volcan
for (int i = 0; i < 8; i++) {
                    int type = uIndices[i];
    if (type == 0) maskedInfluences[i] = maskD * 1.8;
    else if (type == 1) maskedInfluences[i] = maskO * 1.8;
    else if (type == 2) maskedInfluences[i] = maskV * 1.8;
    else if (type == 3) maskedInfluences[i] = aF * 1.8;
}

                // Injected Chunk logic where we rename the influence access
                ${morphChunk.replace(/morphTargetInfluences/g, 'maskedInfluences')}
`;

            // Integrate into the maskedMorphLogic (which already has masks calculated)
            const finalLogic = maskedMorphLogic.replace('#include <morphtarget_vertex>', hijackedMorphLogic);

            shader.vertexShader = shader.vertexShader.replace('#include <morphtarget_vertex>', finalLogic);

            shader.fragmentShader = `
                uniform float uSliders[5];
                uniform float uTime;
                uniform sampler2D uDesertMap;
                uniform sampler2D uOceanMap;
                uniform vec3 uDesertColor;
                uniform vec3 uOceanColor;
                uniform bool uHasDesertMap;
                uniform bool uHasOceanMap;
                varying vec3 vWorldPos;
                varying vec3 vOriginalPos;
                varying vec2 vCustomUv;
                ${noisePars}
                
                float getGrowthAlpha(vec3 pos, vec3 seedPoint, float intensity) {
                    vec3 posNorm = normalize(pos);
                    if (intensity <= 0.0) return 0.0;
                    if (intensity >= 1.0) return 1.0;
                    float align = dot(posNorm, normalize(seedPoint));

                    // LINEAR GRADIENT
                    float grad = align * 0.5 + 0.5; 
                    
                    float n = snoise(posNorm * 3.5) * 0.5 + 0.5;
                    float growthMap = mix(grad, n, 0.15); 
                    
                    float threshold = 1.05 - (intensity * 1.10);
                    return smoothstep(threshold, threshold + 0.15, growthMap);
                }
` + shader.fragmentShader;

            const normalLogic = `
#include <normal_fragment_begin>
// Recalculate normal for Base Mesh too, to catch the morphed topology properly
normal = normalize(cross(dFdx(vWorldPos), dFdy(vWorldPos)));
nonPerturbedNormal = normal;
`;
            shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>', normalLogic);

            const colorMixLogic = `
                vec3 mixedDiffuse = diffuseColor.rgb;


                float s1 = uSliders[0];
                float s2 = uSliders[1];
                float intenVolcano = (s1 < 0.5) ? (0.5 - s1) * 2.0 : 0.0;
                float intenOcean = (s1 > 0.5) ? (s1 - 0.5) * 2.0 : 0.0;
                float intenDesert = (s2 < 0.5) ? (0.5 - s2) * 2.0 : 0.0;
                float intenForest = (s2 > 0.5) ? (s2 - 0.5) * 2.0 : 0.0;
                
                vec3 seedQ1 = vec3(0.0, 1.0, 0.0);
                vec3 seedQ2 = vec3(0.8, -0.5, 0.3);
                float alphaVolcan = getGrowthAlpha(vOriginalPos, seedQ1, intenVolcano);
                float alphaOcean = getGrowthAlpha(vOriginalPos, seedQ1, intenOcean);
                float alphaDesert = getGrowthAlpha(vOriginalPos, seedQ2, intenDesert);
                float alphaForest = getGrowthAlpha(vOriginalPos, seedQ2, intenForest);

                // --- Q1: VOLCANO ---
if (alphaVolcan > 0.05) {
                    float rockNoise = snoise(vOriginalPos * 10.0 + vec3(10.0)); 
                    vec3 rockDark = vec3(0.03, 0.03, 0.03);
                    vec3 rockBrown = vec3(0.08, 0.06, 0.04);
                    vec3 finalRock = mix(rockDark, rockBrown, rockNoise * 0.5 + 0.5);

                    float noiseFlow = snoise(vOriginalPos * 0.3 + vec3(0.0, uTime * 0.1, 0.0));
                    float ridges = 1.0 - abs(noiseFlow); 
                    float river = smoothstep(0.85, 0.98, ridges);

                    vec3 magmaRed = vec3(0.8, 0.0, 0.0);
                    vec3 magmaBright = vec3(1.5, 0.1, 0.0);
                    float pulse = snoise(vOriginalPos * 3.0 + vec3(uTime * 2.0)) * 0.5 + 0.5;
                    vec3 mixedMagma = mix(magmaRed, magmaBright, pulse);
                    
                    vec3 volcanoBase = mix(finalRock, mixedMagma, river);
    mixedDiffuse = mix(mixedDiffuse, volcanoBase, alphaVolcan);
}

// --- Q1: OCEAN ---
if (alphaOcean > 0.001) {
                    vec3 oBase = uOceanColor;
    if (uHasOceanMap) oBase *= texture2D(uOceanMap, vCustomUv).rgb;

                    // MULTI-TONE COLOR MIXING
                    vec3 oceanCyan = vec3(0.01, 0.42, 0.55);
                    vec3 oceanTurquoise = vec3(0.02, 0.65, 0.58);
                    float colorMixNoise = snoise(vOriginalPos * 0.8 + 12.3) * 0.5 + 0.5;
                    float colorMixNoise2 = snoise(vOriginalPos * 0.4 - 5.0 + uTime * 0.02) * 0.5 + 0.5;
    oBase = mix(oBase, oceanCyan, colorMixNoise * 0.6);
    oBase = mix(oBase, oceanTurquoise, colorMixNoise2 * 0.3);

                    // --- WATER WAVE PATTERN (Refined: Magma style) ---
                    float waveNoise = snoise(vOriginalPos * 0.25 + vec3(0.0, uTime * 0.12, 0.0));
                    float waveRidges = 1.0 - abs(waveNoise);
                    float waveLines = smoothstep(0.88, 0.99, waveRidges);
                    
                    vec3 foamColor = vec3(0.95, 1.0, 1.0);
    oBase = mix(oBase, foamColor, waveLines * 0.6);

    mixedDiffuse = mix(mixedDiffuse, oBase, alphaOcean);
}

// --- Q2: DESERT ---
if (alphaDesert > 0.001) {
                    vec3 dBase = uDesertColor;
    if (uHasDesertMap) dBase *= texture2D(uDesertMap, vCustomUv).rgb;
                    
                    float sandGrains = snoise(vOriginalPos * 250.0) * 0.04;
                    float ripples = snoise(vOriginalPos * 15.0) * 0.03;
    dBase += sandGrains + ripples;
    mixedDiffuse = mix(mixedDiffuse, dBase, alphaDesert);
}

// --- Q2: FOREST ---
if (alphaForest > 0.001) {
    // Shared palette with leaves
    vec3 deepForest  = vec3(0.01, 0.12, 0.08);   // Dark shadows
    vec3 healthyLeaf = vec3(0.05, 0.35, 0.12);   // Mid green
    vec3 pineBlue    = vec3(0.05, 0.25, 0.30);   // Bluish green
    vec3 dirtColor   = vec3(0.12, 0.08, 0.05);   // Dark brown for ground gaps
    
    // Pattern logic
    float groundN = snoise(vOriginalPos * 12.0) * 0.5 + 0.5; // Reduced from 25.0
    float patches = snoise(vOriginalPos * 4.0) * 0.5 + 0.5;  // Reduced from 6.0
    float mossN = snoise(vOriginalPos * 25.0) * 0.5 + 0.5;   // Reduced from 80.0
    
    // Mix the ground colors
    vec3 baseFloor = mix(deepForest, healthyLeaf, groundN);
    baseFloor = mix(baseFloor, pineBlue, patches * 0.4);
    
    // Add "dirt" or shadowed gaps between mossy patches
    float dirtMask = smoothstep(0.3, 0.1, groundN * patches);
    baseFloor = mix(baseFloor, dirtColor, dirtMask * 0.6);
    
    // Micro-moss detail
    baseFloor = mix(baseFloor, baseFloor * 1.2, mossN * 0.2);
    
    mixedDiffuse = mix(mixedDiffuse, baseFloor, alphaForest);
}

diffuseColor.rgb = mixedDiffuse;
`;
            shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', colorMixLogic);

            const metalnessLogic = `
#include <metalnessmap_fragment>
                float s1_m = uSliders[0];
                float s2_m = uSliders[1];
                float intenVolcano_m = (s1_m < 0.5) ? (0.5 - s1_m) * 2.0 : 0.0;
                float intenOcean_m = (s1_m > 0.5) ? (s1_m - 0.5) * 2.0 : 0.0;
                float intenDesert_m = (s2_m < 0.5) ? (0.5 - s2_m) * 2.0 : 0.0;
                float intenForest_m = (s2_m > 0.5) ? (s2_m - 0.5) * 2.0 : 0.0;
                vec3 seedQ1_m = vec3(0.0, 1.0, 0.0);
                vec3 seedQ2_m = vec3(0.8, -0.5, 0.3);
                float alphaVolcan_m = getGrowthAlpha(vOriginalPos, seedQ1_m, intenVolcano_m);
                float alphaOcean_m = getGrowthAlpha(vOriginalPos, seedQ1_m, intenOcean_m);
                float alphaDesert_m = getGrowthAlpha(vOriginalPos, seedQ2_m, intenDesert_m);
                float alphaForest_m = getGrowthAlpha(vOriginalPos, seedQ2_m, intenForest_m);

if (alphaVolcan_m > 0.01) metalnessFactor = mix(metalnessFactor, 0.0, alphaVolcan_m);
if (alphaOcean_m > 0.01) metalnessFactor = mix(metalnessFactor, 0.1, alphaOcean_m);
if (alphaDesert_m > 0.01) metalnessFactor = mix(metalnessFactor, 0.0, alphaDesert_m);
if (alphaForest_m > 0.01) metalnessFactor = mix(metalnessFactor, 0.0, alphaForest_m);
`;
            shader.fragmentShader = shader.fragmentShader.replace('#include <metalnessmap_fragment>', metalnessLogic);

            const roughnessLogic = `
#include <roughnessmap_fragment>
                float s1_r = uSliders[0];
                float s2_r = uSliders[1];
                float intenVolcano_r = (s1_r < 0.5) ? (0.5 - s1_r) * 2.0 : 0.0;
                float intenOcean_r = (s1_r > 0.5) ? (s1_r - 0.5) * 2.0 : 0.0;
                float intenDesert_r = (s2_r < 0.5) ? (0.5 - s2_r) * 2.0 : 0.0;
                float intenForest_r = (s2_r > 0.5) ? (s2_r - 0.5) * 2.0 : 0.0;
                vec3 seedQ1_r = vec3(0.0, 1.0, 0.0);
                vec3 seedQ2_r = vec3(0.8, -0.5, 0.3);
                float alphaVolcan_r = getGrowthAlpha(vOriginalPos, seedQ1_r, intenVolcano_r);
                float alphaOcean_r = getGrowthAlpha(vOriginalPos, seedQ1_r, intenOcean_r);
                float alphaDesert_r = getGrowthAlpha(vOriginalPos, seedQ2_r, intenDesert_r);
                float alphaForest_r = getGrowthAlpha(vOriginalPos, seedQ2_r, intenForest_r);

if (alphaVolcan_r > 0.01) roughnessFactor = mix(roughnessFactor, 1.0, alphaVolcan_r);
if (alphaOcean_r > 0.01) {
                    // Streaky reflections via noise-distorted roughness
                    float rNoise = snoise(vOriginalPos * 4.0 + vec3(uTime * 0.05, 0.0, 0.0)) * 0.5 + 0.5;
                    float finalR = mix(0.01, 0.12, rNoise);
    roughnessFactor = mix(roughnessFactor, finalR, alphaOcean_r);
}
if (alphaDesert_r > 0.01) roughnessFactor = mix(roughnessFactor, 1.0, alphaDesert_r);
if (alphaForest_r > 0.01) roughnessFactor = mix(roughnessFactor, 0.8, alphaForest_r);
`;
            shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', roughnessLogic);

            // @ts-ignore
            mat.userData.shader = shader;
        };

        const setupMesh = (obj: any) => {
            obj.name = 'planet_base';
            obj.traverse((child: any) => {
                if (child.isMesh) {
                    child.name = 'planet_base_mesh';
                    child.material = mat;
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
        };
        // APPLY TO CLONE
        setupMesh(baseMesh);

        // @ts-ignore
        materialRef.current = mat;

        // --- FOREST MATERIAL ---
        const fMat = new MeshStandardMaterial({
            color: new Color(1, 1, 1), // Multi-tone applied in shader
            roughness: 0.8,
            metalness: 0.0,
            side: THREE.FrontSide,
        });

        fMat.onBeforeCompile = (shader) => {
            shader.uniforms.uSliders = customUniforms.current.uSliders;
            shader.uniforms.uTime = customUniforms.current.uTime;

            shader.vertexShader = `
                uniform float uSliders[5];
                varying vec3 vOriginalPos;
                varying vec3 vWorldPos;
                ${noisePars}
                
                float getGrowthAlpha(vec3 pos, vec3 seedPoint, float intensity) {
                    vec3 posNorm = normalize(pos);
                    if (intensity <= 0.0) return 0.0;
                    if (intensity >= 1.0) return 1.0;
                    float align = dot(posNorm, normalize(seedPoint));
                    float grad = align * 0.5 + 0.5; 
                    float n = snoise(posNorm * 3.5) * 0.5 + 0.5;
                    float growthMap = mix(grad, n, 0.15); 
                    float threshold = 1.05 - (intensity * 1.10);
                    return smoothstep(threshold, threshold + 0.15, growthMap);
                }
` + shader.vertexShader;

            shader.vertexShader = shader.vertexShader.replace(
                '#include <begin_vertex>',
                `
#include <begin_vertex>
vOriginalPos = position;
vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
                float intenForest_v = (uSliders[1] > 0.5) ? (uSliders[1] - 0.5) * 2.0 : 0.0;
                float maskF_v = getGrowthAlpha(transformed, vec3(0.8, -0.5, 0.3), intenForest_v);
                transformed *= mix(0.0001, 1.0, maskF_v);
`
            );

            shader.fragmentShader = `
                uniform float uSliders[5];
                uniform float uTime;
                varying vec3 vOriginalPos;
                varying vec3 vWorldPos;
                ${noisePars}
                
                float getGrowthAlpha(vec3 pos, vec3 seedPoint, float intensity) {
                    vec3 posNorm = normalize(pos);
                    if (intensity <= 0.0) return 0.0;
                    if (intensity >= 1.0) return 1.0;
                    float align = dot(posNorm, normalize(seedPoint));
                    float grad = align * 0.5 + 0.5; 
                    float n = snoise(posNorm * 3.5) * 0.5 + 0.5;
                    float growthMap = mix(grad, n, 0.15); 
                    float threshold = 1.05 - (intensity * 1.10);
                    return smoothstep(threshold, threshold + 0.15, growthMap);
                }
` + shader.fragmentShader;

            const leafRoughnessLogic = `
                #include <roughnessmap_fragment>
                float leafRoughN = snoise(vOriginalPos * 60.0) * 0.5 + 0.5;
                roughnessFactor = mix(0.75, 1.0, leafRoughN);
            `;
            shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', leafRoughnessLogic);

            const forestColorLogic = `
                float s2_f = uSliders[1];
                float intenForest_f = (s2_f > 0.5) ? (s2_f - 0.5) * 2.0 : 0.0;
                vec3 seedQ2_f = vec3(0.8, -0.5, 0.3); 
                float maskF = getGrowthAlpha(vOriginalPos, seedQ2_f, intenForest_f);

                if (maskF < 0.001) discard; 

                // --- Stylized Leaf Color System (Enhanced) ---
                
                // 1. Per-Tree/Cluster Variation (Mid Frequency)
                float treeNoise = snoise(vOriginalPos * 12.0) * 0.5 + 0.5; // Reduced from 18.0
                
                // 2. Large Scale "Clumping" (Low Frequency)
                float clumpNoise = snoise(vOriginalPos * 3.0) * 0.5 + 0.5; // Reduced from 4.0
                
                // 3. Micro-detail / Texture (High Frequency)
                float leafDetail = snoise(vOriginalPos * 25.0) * 0.5 + 0.5; // Reduced from 120.0 (Huge reduction for blur effect)
                
                // 4. Subtle Time-based "Shifting"
                float breeze = snoise(vOriginalPos * 10.0 + vec3(uTime * 0.05)) * 0.1;

                // Color Palette
                vec3 deepGreen   = vec3(0.01, 0.12, 0.08);   // Very dark forest shadow
                vec3 healthyLeaf = vec3(0.05, 0.35, 0.12);   // Standard emerald green
                vec3 vibrantLeaf = vec3(0.12, 0.55, 0.15);   // Bright, sun-lit green
                vec3 limeTips    = vec3(0.35, 0.65, 0.20);   // Yellow-green highlights
                vec3 autumnHint  = vec3(0.45, 0.35, 0.10);   // Subtle orange/brown for variety
                vec3 pineBlue    = vec3(0.05, 0.25, 0.30);   // Slightly bluish-green

                // Mix logic
                // Base forest mix
                vec3 baseColor = mix(deepGreen, healthyLeaf, treeNoise);
                
                // Apply clumping for variety (some patches are more vibrant, some more bluish)
                vec3 clusterColor = mix(pineBlue, vibrantLeaf, clumpNoise);
                vec3 finalLeafColor = mix(baseColor, clusterColor, 0.45);
                
                // Add autumn hints in specific patches
                float autumnIntensity = smoothstep(0.7, 0.95, clumpNoise * treeNoise);
                finalLeafColor = mix(finalLeafColor, autumnHint, autumnIntensity * 0.3);

                // Add highlight/moss tips based on height and micro-detail
                float highlightMask = pow(treeNoise, 3.0) * leafDetail;
                finalLeafColor = mix(finalLeafColor, limeTips, highlightMask * 0.4);

                // Micro-detail texture variation
                finalLeafColor *= (0.9 + leafDetail * 0.2);

                // --- Stylized Shading & Translucency ---
                vec3 viewDir = normalize(cameraPosition - vWorldPos);
                float fresnel = pow(1.0 - max(0.0, dot(viewDir, vNormal)), 3.0);
                
                // Backlight effect (Rim lighting)
                // Using limeTips for the glow to simulate translucency
                vec3 rimColor = limeTips * 1.5;
                finalLeafColor = mix(finalLeafColor, rimColor, fresnel * 0.5 * maskF);
                
                // Subtle global variation across the sphere
                float globalVar = snoise(vOriginalPos * 0.5) * 0.1;
                finalLeafColor += globalVar;

                diffuseColor.rgb = finalLeafColor;
`;
            shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', forestColorLogic);

            // @ts-ignore
            fMat.userData.shader = shader; // Shared logic for update
        };

        const setupForestMesh = (obj: any) => {
            obj.name = 'planet_forest';
            obj.traverse((child: any) => {
                if (child.isMesh) {
                    child.name = 'planet_forest_mesh';
                    child.material = fMat;
                    child.castShadow = true;
                    child.receiveShadow = true;
                    // Ensure forest mesh is slightly offset or handled to prevent Z-fighting if needed, 
                    // though glb should be above surface.
                }
            });
        };
        setupForestMesh(forestMesh);

        // @ts-ignore
        forestMaterialRef.current = fMat;
    }, [baseMesh, forestMesh, desertMaps, oceanMaps]);

    useFrame((state) => {
        const time = state.clock.getElapsedTime();

        // Update Base Uniforms
        if (materialRef.current && materialRef.current?.userData?.shader) {
            const sh = materialRef.current.userData.shader;
            if (sh.uniforms.uSliders) sh.uniforms.uSliders.value = values.map(v => v / 100);
            if (sh.uniforms.uTime) sh.uniforms.uTime.value = time;
        }
        if (forestMaterialRef.current && forestMaterialRef.current?.userData?.shader) {
            const sh = forestMaterialRef.current.userData.shader;
            if (sh.uniforms.uSliders) sh.uniforms.uSliders.value = values.map(v => v / 100);
            if (sh.uniforms.uTime) sh.uniforms.uTime.value = time;
        }

        const s1_frame = values[0] / 100;
        const s2_frame = values[1] / 100;

        const activeVolcan = (s1_frame < 0.5) ? 1.0 : 0.0;
        const activeOcean = (s1_frame > 0.5) ? 1.0 : 0.0;
        const activeDesert = (s2_frame < 0.5) ? 1.0 : 0.0;
        const activeForest = (s2_frame > 0.5) ? 1.0 : 0.0;

        // Unified Mesh control using cached references
        baseMeshCache.forEach((child) => {
            const dict = child.morphTargetDictionary || {};
            const indices = new Int32Array(8).fill(-1);

            for (const key in dict) {
                const k = key.toLowerCase();
                const idx = dict[key];
                if (k.includes('ocean')) {
                    child.morphTargetInfluences[idx] = activeOcean;
                    if (idx < 8) indices[idx] = 1;
                } else if (k.includes('desert')) {
                    child.morphTargetInfluences[idx] = activeDesert;
                    if (idx < 8) indices[idx] = 0;
                } else if (k.includes('volcan')) {
                    child.morphTargetInfluences[idx] = activeVolcan;
                    if (idx < 8) indices[idx] = 2;
                } else if (k.includes('forest')) {
                    child.morphTargetInfluences[idx] = activeForest;
                    if (idx < 8) indices[idx] = 3;
                }
            }

            // Update Indices for the shader
            const sh = materialRef.current?.userData?.shader;
            if (sh && sh.uniforms.uIndices) {
                sh.uniforms.uIndices.value = indices;
            }
        });
    });

    useFrame((state) => {
        if (ringRef.current) {
            // Determine ring morph values based on currentSection and slider (Question 3 logic)
            // Questions: 0: empathy, 1: sociable, 2: persistent (Q3), 3: curious, 4: relaxed

            // Visibility logic: hide until Q3 or later
            const ringsVisible = currentSection >= 2;

            // Initial Q3 state (slider 50): ring_0 = 0.5, others = 0
            let r0_val = 0.5;
            let r1_val = 0;
            let r2_val = 0;
            let r3_val = 0;

            if (currentSection === 2) {
                const s = values[2] || 0; // 0 to 100
                // Ring 0: Linear mapping from 0% (0.0) -> 50% (0.5) -> 100% (1.0)
                r0_val = s / 100;

                // Ring 1: 50% to 65% (0 -> 1)
                if (s > 50) r1_val = Math.min(1.0, (s - 50) / (65 - 50));

                // Ring 2: 65% to 85% (0 -> 1)
                if (s > 65) r2_val = Math.min(1.0, (s - 65) / (85 - 65));

                // Ring 3: 85% to 100% (0 -> 1)
                if (s > 85) r3_val = Math.min(1.0, (s - 85) / (100 - 85));
            } else if (currentSection > 2) {
                // If past Q3, use the final answer for Q3 to keep them static but visible
                const fs = values[2] || 0;
                r0_val = fs / 100;
                r1_val = fs > 50 ? Math.min(1.0, (fs - 50) / (65 - 50)) : 0;
                r2_val = fs > 65 ? Math.min(1.0, (fs - 65) / (85 - 65)) : 0;
                r3_val = fs > 85 ? Math.min(1.0, (fs - 85) / (100 - 85)) : 0;
            }

            ringMeshCache.forEach((mesh) => {
                mesh.visible = ringsVisible;
                mesh.frustumCulled = false;

                const lowerName = mesh.name.toLowerCase();

                // 1. Update Time Uniform
                if (mesh.material && (mesh.material as any).uniforms && (mesh.material as any).uniforms.uTime) {
                    (mesh.material as any).uniforms.uTime.value = state.clock.elapsedTime;
                }

                // 2. Assign specific materials and handle scales 
                let activeMorph = 0;
                if (lowerName === 'ring' || lowerName === 'ring_0') {
                    mesh.material = ringMaterials.planetary;
                    mesh.scale.set(100, 100, 100);
                    activeMorph = r0_val;
                } else if (lowerName === 'ring_1') {
                    mesh.material = ringMaterials.magma;
                    mesh.scale.set(100, 100, 100);
                    activeMorph = r1_val;
                } else if (lowerName === 'ring_2') {
                    mesh.material = ringMaterials.moon;
                    mesh.scale.set(100, 100, 100);
                    activeMorph = r2_val;
                } else if (lowerName === 'ring_3') {
                    mesh.material = ringMaterials.martian;
                    mesh.scale.set(100, 100, 100);
                    activeMorph = r3_val;
                }

                // 3. Dynamic Morph Target Enforcement (high state)
                if (mesh.morphTargetInfluences) {
                    for (let i = 0; i < mesh.morphTargetInfluences.length; i++) {
                        mesh.morphTargetInfluences[i] = activeMorph;
                    }
                }
            });
        }
    });

    useFrame((state) => {
        if (cometRef.current) {
            const time = state.clock.elapsedTime;

            // Visibility logic: Show comets starting from Q4 and keep them visible
            const cometsVisible = currentSection >= 3;

            cometMeshCache.forEach((mesh) => {
                mesh.visible = cometsVisible;

                // Assign material distribution: 1-4 Bluish, 5-8 Magma
                const cometMatch = mesh.name.match(/OpenToExp_(\d+)/);
                if (cometMatch) {
                    const idxNum = parseInt(cometMatch[1]);
                    mesh.material = idxNum <= 4 ? ringMaterials.Comet_optimized_1 : ringMaterials.Comet_optimized_2;
                }
                mesh.scale.set(80, 80, 80);

                // Time animation
                if (mesh.material && (mesh.material as any).uniforms?.uTime) {
                    (mesh.material as any).uniforms.uTime.value = time;
                }

                // Morph target sequential logic
                if (mesh.visible && mesh.morphTargetInfluences && mesh.morphTargetDictionary) {
                    const idx = mesh.morphTargetDictionary['high'];
                    if (idx !== undefined) {
                        let targetValue = 0;
                        const p = values[3] / 100;

                        const cometMatchInner = mesh.name.match(/OpenToExp_(\d+)/);
                        if (cometMatchInner) {
                            const cometIndex = parseInt(cometMatchInner[1]);
                            if (cometIndex >= 1 && cometIndex <= 8) {
                                const startThreshold = (cometIndex - 1) * 0.1;
                                targetValue = Math.max(0.0, Math.min(1.0, (p - startThreshold) / 0.1));
                            }
                        }

                        mesh.morphTargetInfluences[idx] = targetValue;
                    }
                }
            });
        }
    });

    const cloudMapping = useMemo(() => {
        const intervals = [
            [0.00, 0.15],
            [0.10, 0.30],
            [0.20, 0.40],
            [0.35, 0.55],
            [0.50, 0.70],
            [0.65, 0.85],
            [0.75, 0.95],
            [0.85, 1.00]
        ];

        // Shuffle intervals to randomize which cloud disappears when
        const shuffled = [...intervals].sort(() => Math.random() - 0.5);

        const mapping: Record<string, number[]> = {};
        for (let i = 1; i <= 8; i++) {
            mapping[`Cloud_${i}`] = shuffled[i - 1];
        }
        return mapping;
    }, []);

    useFrame((state) => {
        if (cloudsRef.current) {
            // Visibility logic: Show clouds ONLY in Q5
            const cloudsVisible = currentSection === 4;
            const p = (values[4] || 0) / 100;
            const stormIntensity = Math.max(0.0, 1.0 - (p / 0.49)); // 1.0 at 0%, 0.0 at 49%

            cloudsRef.current.traverse((child) => {
                if ((child as any).isMesh) {
                    const mesh = child as THREE.Mesh;
                    mesh.visible = cloudsVisible;
                    mesh.scale.set(100, 100, 100);
                    mesh.material = ringMaterials.cloud;

                    // Update uniforms
                    if (mesh.material instanceof THREE.ShaderMaterial) {
                        mesh.material.uniforms.uTime.value = state.clock.elapsedTime;
                        mesh.material.uniforms.uStorm.value = stormIntensity;
                    }

                    const name = mesh.name;
                    let targetVal = 1.0;

                    // Apply randomized mapping logic
                    const interval = cloudMapping[name];
                    if (interval) {
                        const [start, end] = interval;
                        targetVal = 1.0 - Math.min(1.0, Math.max(0.0, (p - start) / (end - start)));
                    }

                    if (mesh.morphTargetInfluences && mesh.morphTargetDictionary) {
                        const idx = mesh.morphTargetDictionary['high'];
                        if (idx !== undefined) {
                            mesh.morphTargetInfluences[idx] = targetVal;
                        }
                    }

                    // Hide mesh completely if morph is 0 to save performance
                    if (targetVal <= 0.001) mesh.visible = false;
                }
            });
        }

        // Constant slow rotation for the whole planet
        if (planetAssemblyRef.current) {
            planetAssemblyRef.current.rotation.y += 0.002; // Very slow and steady
        }
    });

    const blueLightInt = (values[0] > 50) ? (values[0] / 100 - 0.5) * 2.0 * 0.8 : 0.0;
    const warmLightInt = (values[0] < 50) ? 0.5 + ((0.5 - values[0] / 100) * 2.0 * 0.5) : 0.5;

    return (
        <group>
            {/* Environment with night preset for better dark blue contrast */}
            <Environment files={getAssetPath('/env_map.hdr')} />
            <directionalLight position={[10, 10, 10]} intensity={1.2} castShadow />
            <directionalLight position={[0, -10, 0]} intensity={blueLightInt * 1.5} color="#0044ff" />
            <directionalLight position={[-10, 5, 10]} intensity={warmLightInt} color={(values[0] < 50) ? "#ffaa00" : "#ffffff"} />
            <directionalLight position={[-10, -5, -10]} intensity={0.3} color="#000033" />
            <ambientLight intensity={0.1} />

            <ambientLight intensity={0.15} />

            <group ref={planetAssemblyRef}>
                <primitive object={baseMesh} material={materialRef.current} scale={0.004} name="planet_base" />
                <primitive
                    object={forestMesh}
                    material={forestMaterialRef.current}
                    scale={0.395}
                    position={[0, 0, 0]}
                    rotation={[-1.5, 0, 0.05]}
                    name="planet_forest"
                />
                {/* Butterflies appear when Forest slider > 50% */}
                {/* Q3 Rings */}
                <primitive object={ringGroup} ref={ringRef} scale={[0.004, 0.004, 0.004]} position={[0, 0, 0]} name="ring_group" />

                {/* Comets */}
                <group ref={cometRef} scale={[0.004, 0.004, 0.004]} position={[0, 0, 0]} name="comet_group" />

                {/* Clouds */}
                <primitive object={cloudsFBX} ref={cloudsRef} scale={[0.004, 0.004, 0.004]} position={[0, 0, 0]} name="clouds_group" />

                <ButterflyParticles
                    intensity={(values[1] > 50) ? (values[1] - 50) / 50 : 0}
                    radius={2.15}
                    speed={1.0}
                />

                {/* Wind appears when Forest slider < 50% - Removed per user request */}
                {/* <WindParticles
                    intensity={(values[1] < 50) ? (50 - values[1]) / 50 : 0}
                    radius={4.5}
                    speed={1.0}
                /> */}
            </group>
        </group>
    );
};

export const DisplacementSphere = memo(DisplacementSphereBase);
