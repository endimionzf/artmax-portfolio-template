import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface MediaTagProps {
    category: 'video' | '3d' | 'ai';
    isGridMode: boolean;
    isFocused: boolean;
    opacityRef: React.RefObject<number>;
    planeScale: number;
}

export const MediaTag = ({ category, isGridMode, isFocused, opacityRef, planeScale }: MediaTagProps) => {
    const meshRef = useRef<THREE.Mesh>(null);
    const materialRef = useRef<THREE.MeshBasicMaterial>(null);
    const iconMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
    const iconMaterialRef2 = useRef<THREE.MeshBasicMaterial>(null);

    useFrame((state, delta) => {
        if (!materialRef.current || !meshRef.current) return;

        // Read the live opacity directly from the plane's ref — frame-perfect sync, no React overhead
        const parentOpacity = opacityRef.current ?? 1;
        const targetOpacity = isFocused ? 0 : parentOpacity * 0.95;
        materialRef.current.opacity = THREE.MathUtils.lerp(materialRef.current.opacity, targetOpacity, delta * 8);
        if (iconMaterialRef.current) iconMaterialRef.current.opacity = materialRef.current.opacity;
        if (iconMaterialRef2.current) iconMaterialRef2.current.opacity = materialRef.current.opacity;

        // 2. Counter-Scaling & Dynamic Positioning
        // We want the tag to stay a fixed visual size (e.g. 0.18) regardless of planeScale.
        // Since we are a child of the plane, our local scale is multiplied by planeScale.
        const targetVisualSize = isGridMode ? 0.1 : 0.16; // Made even smaller as per user request
        const targetLocalScale = targetVisualSize / planeScale;
        
        // Smoothly lerp our own local scale to avoid pops
        meshRef.current.scale.lerp(new THREE.Vector3(targetLocalScale, targetLocalScale, 1), delta * 5);
        
        // Pin to top-left corner [-2.4, 1.35]
        const gap = 0.02; // Small fixed gap from the edge
        const currentLocalScale = meshRef.current.scale.x;
        const x = -(2.4 + (gap / planeScale) + (currentLocalScale / 2));
        const y = (1.35 - (currentLocalScale / 2));
        
        meshRef.current.position.set(x, y, 0.01);
    });

    return (
        <mesh ref={meshRef}>
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial 
                ref={materialRef}
                color={category === 'video' ? '#ff003c' : (category === '3d' ? '#00ff41' : '#0066ff')} 
                transparent 
                opacity={0} 
                toneMapped={false}
            />
            
            <group position={[0, 0, 0.01]}>
                {category === 'video' && (
                    <mesh rotation={[0, 0, -Math.PI / 2]}>
                        <circleGeometry args={[0.22, 3]} />
                        <meshBasicMaterial ref={iconMaterialRef} color="white" transparent opacity={0} />
                    </mesh>
                )}
                {category === '3d' && (
                    <mesh rotation={[0, 0, Math.PI / 4]}>
                        <planeGeometry args={[0.32, 0.32]} />
                        <meshBasicMaterial ref={iconMaterialRef} color="white" transparent opacity={0} />
                        <mesh position={[0, 0, 0.001]}>
                            <planeGeometry args={[0.2, 0.2]} />
                            <meshBasicMaterial ref={iconMaterialRef2} color="#00ff41" transparent opacity={0} />
                        </mesh>
                    </mesh>
                )}
                {category === 'ai' && (
                    <mesh>
                        <circleGeometry args={[0.2, 32]} />
                        <meshBasicMaterial ref={iconMaterialRef} color="white" transparent opacity={0} />
                        <mesh position={[0, 0, 0.001]}>
                            <circleGeometry args={[0.1, 32]} />
                            <meshBasicMaterial ref={iconMaterialRef2} color="#0066ff" transparent opacity={0} />
                        </mesh>
                    </mesh>
                )}
            </group>
        </mesh>
    );
};
