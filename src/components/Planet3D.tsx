import React, { Suspense, forwardRef, useImperativeHandle, useRef, memo } from 'react';
import { Canvas } from '@react-three/fiber';
import { DisplacementSphere } from './DisplacementSphere';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

interface Planet3DProps {
    values: number[];
    currentSection: number;
    tintColor?: string;
    tintOpacity?: number;
}

export interface Planet3DHandle {
    getScene: () => THREE.Scene | null;
    getCanvas: () => HTMLCanvasElement | null;
}

const Planet3DInner = forwardRef<Planet3DHandle, Planet3DProps>((props, ref) => {
    const sceneRef = useRef<THREE.Scene>(null);

    useImperativeHandle(ref, () => ({
        getScene: () => sceneRef.current,
        getCanvas: () => sceneRef.current?.userData?.canvas // Alternative: pass it via context or just use ref below
    }));

    // Better way: Expose a direct ref to the canvas or a function to capture it
    useImperativeHandle(ref, () => ({
        getScene: () => sceneRef.current,
        getCanvas: () => {
            const canvas = sceneRef.current?.parent;
            // In R3F, the canvas is up the tree. We can also just query the container.
            return document.querySelector('#planet-canvas-container canvas') as HTMLCanvasElement;
        }
    }));

    return (
        <div id="planet-canvas-container" style={{ width: '100%', height: '100%' }}>
            <Canvas camera={{ position: [0, 0, 18], fov: 45 }}>
                <scene ref={sceneRef}>
                    <ambientLight intensity={0.5} />
                    <pointLight position={[10, 10, 10]} />
                    <Suspense fallback={null}>
                        <DisplacementSphere
                            values={props.values}
                            currentSection={props.currentSection}
                            tintColor={props.tintColor}
                            tintOpacity={props.tintOpacity}
                        />
                    </Suspense>
                </scene>
                <OrbitControls enableZoom={false} enablePan={false} />
            </Canvas>
        </div>
    );
});

Planet3DInner.displayName = 'Planet3D';

export const Planet3D = memo(Planet3DInner);
