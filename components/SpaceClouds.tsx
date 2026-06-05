'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Cloud, Clouds } from '@react-three/drei';
import * as THREE from 'three';

interface SpaceCloudsProps {
    isExplorer?: boolean;
}

// Seeded PRNG for deterministic cloud placement
function seededRandom(seed: number) {
    let s = seed;
    return () => {
        s = (s * 16807 + 0) % 2147483647;
        return (s - 1) / 2147483646;
    };
}

// Same depth-fade math as MediaPlane — keeps clouds perfectly in sync
function computeCloudOpacity(relativeZ: number, baseOpacity: number): number {
    const fadeStart = -9;  // Synchronized with MediaPlane
    const fadeEnd = -5;
    const farFadeStart = -32;
    const farLimit = -38;

    if (relativeZ > fadeStart) {
        return baseOpacity * (1 - THREE.MathUtils.smoothstep(relativeZ, fadeStart, fadeEnd));
    } else if (relativeZ < farFadeStart) {
        return baseOpacity * THREE.MathUtils.smoothstep(relativeZ, farLimit, farFadeStart);
    }
    return baseOpacity;
}

// One layer group — handles traversal + opacity update for its clouds
function CloudLayer({
    clouds,
    layerZ,
    baseOpacity,
}: {
    clouds: ReturnType<typeof buildClouds>;
    layerZ: number;
    baseOpacity: number;
}) {
    const groupRef = useRef<THREE.Group>(null);

    useFrame((state) => {
        if (!groupRef.current) return;
        const camZ = state.camera.position.z;
        const relativeZ = layerZ - camZ;
        const target = computeCloudOpacity(relativeZ, baseOpacity);

        groupRef.current.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                const mat = child.material as THREE.MeshBasicMaterial;
                if (mat?.transparent !== undefined) {
                    mat.opacity = THREE.MathUtils.lerp(mat.opacity, target, 0.08);
                    mat.needsUpdate = true;
                }
            }
        });
    });

    return (
        <group ref={groupRef}>
            <Clouds material={THREE.MeshBasicMaterial}>
                {clouds.map((cloud, i) => (
                    <Cloud
                        key={i}
                        position={cloud.position}
                        seed={cloud.seed}
                        bounds={cloud.bounds}
                        volume={cloud.volume}
                        color={cloud.color}
                        opacity={cloud.opacity}
                        segments={cloud.segments}
                        fade={cloud.fade}
                    />
                ))}
            </Clouds>
        </group>
    );
}

function buildClouds(rng: () => number, layerIndex: number, baseZ: number) {
    const result = [];
    const cloudsPerLayer = 8;

    for (let i = 0; i < cloudsPerLayer; i++) {
        const x = (rng() - 0.5) * 80;
        const y = (rng() - 0.5) * 50;
        const z = baseZ + (rng() - 0.5) * 20;

        const baseOpacity = 0.08 + rng() * 0.08 + layerIndex * 0.03;

        result.push({
            position: [x, y, z] as [number, number, number],
            seed: Math.floor(rng() * 1000),
            bounds: [8 + rng() * 12, 2 + rng() * 3, 2 + rng() * 2] as [number, number, number],
            opacity: baseOpacity,
            color: new THREE.Color().setHSL(0, 0, 0.54 + rng() * 0.06),
            volume: 4 + rng() * 6,
            segments: 12,
            fade: 80,
        });
    }
    return result;
}

export function SpaceClouds({ isExplorer = true }: SpaceCloudsProps) {
    const driftRef = useRef<THREE.Group>(null);

    // Z layers match spacerSpacing=12
    const zLayers = [0, -12, -24];

    const layerClouds = useMemo(() => {
        const rng = seededRandom(42);
        return zLayers.map((z, i) => buildClouds(rng, i, z));
    }, []);

    // Very slow XY drift for the whole cloud field
    useFrame((state) => {
        if (!driftRef.current || !isExplorer) return;
        const t = state.clock.elapsedTime * 0.008;
        driftRef.current.position.x = Math.sin(t) * 0.3;
        driftRef.current.position.y = Math.cos(t * 0.7) * 0.2;
    });

    if (!isExplorer) return null;

    return (
        <group ref={driftRef}>
            {zLayers.map((z, i) => (
                <CloudLayer
                    key={i}
                    clouds={layerClouds[i]}
                    layerZ={z}
                    baseOpacity={0.1 + i * 0.03}
                />
            ))}
        </group>
    );
}
