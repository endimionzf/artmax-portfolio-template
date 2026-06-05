import { useState, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface MediaStateProps {
    position: [number, number, number];
    targetPosition?: [number, number, number];
    isFocused?: boolean;
    isGridMode?: boolean;
    isAnyFocused?: boolean;
    editorMode?: boolean;
    videoQuality: 'preview' | 'full';
    setVideoQuality: (q: 'preview' | 'full') => void;
    targetScale?: number;
}

export function useMediaState({
    position,
    targetPosition,
    isFocused,
    isGridMode,
    isAnyFocused,
    editorMode,
    videoQuality,
    setVideoQuality,
    targetScale: propTargetScale = 1.0
}: MediaStateProps) {
    const stateRef = useRef({
        opacity: 0,
        fadeToBlack: 0,
        transitioning: false,
    });

    const [syncState, setSyncState] = useState({ opacity: 0, scale: 1 });

    const update = (state: any, delta: number, mesh: THREE.Mesh, group: THREE.Group) => {
        const s = stateRef.current;

        // 1. Smooth Positioning
        const targetVec = targetPosition ? new THREE.Vector3(...targetPosition) : new THREE.Vector3(...position);
        group.position.lerp(targetVec, delta * 3.5);

        const camera = state.camera;
        const planeDistZ = Math.abs(camera.position.z - group.position.z);

        // 2. Visibility & Culling
        let targetOpacity = 0;
        let targetScale = 1;

        if (editorMode) {
            targetOpacity = 1;
        } else if (isFocused || isGridMode) {
            targetOpacity = 1;
            const baseScale = isFocused ? 1.0 : (isGridMode ? propTargetScale : 1.0);
            const focusScale = (isFocused && !isGridMode) ? 1.25 : 1.0;
            targetScale = baseScale * focusScale;

            if (isGridMode && !isFocused) {
                // Smooth Grid visibility
                const camY = state.camera.position.y;
                const planeY = group.position.y;
                const distY = Math.abs(planeY - camY);

                // Start fading at 20, fully gone by 50 (wide enough for the 50-unit culling)
                const gridFade = 1.0 - THREE.MathUtils.smoothstep(distY, 20, 50);
                targetOpacity = gridFade;
            }
        } else {
            // When something is focused, keep others visible but dimmed (e.g. 0.4)
            const baseVisibility = isAnyFocused ? 0.4 : 1;

            // More permissive fading: visible from far away, fades out matching culling dist
            let proximityFading = (planeDistZ > 8)
                ? (1 - THREE.MathUtils.smoothstep(planeDistZ, 200, 250)) // Fade out matching 250-unit mounting culling
                : THREE.MathUtils.smoothstep(planeDistZ, 0, 5); // Fade out when camera passes through
            targetOpacity = baseVisibility * proximityFading;
        }

        // 3. Texture Quality Swapping (Fade to black logic)
        const targetQuality = isFocused ? 'full' : 'preview';
        const needsQualitySwap = targetQuality !== videoQuality;

        if (needsQualitySwap && !s.transitioning) {
            s.transitioning = true;
        }

        if (s.transitioning) {
            s.fadeToBlack = THREE.MathUtils.lerp(s.fadeToBlack, 1.2, delta * 6); // Snappier transition (was 4)
            if (s.fadeToBlack >= 1.0) {
                setVideoQuality(targetQuality);
                s.fadeToBlack = 1.0;
            }
        } else {
            s.fadeToBlack = THREE.MathUtils.lerp(s.fadeToBlack, 0.0, delta * 4); // Snappier recovery (was 3)
        }

        // Final guard: stop transitioning only when quality matches
        if (!needsQualitySwap) s.transitioning = false;

        // 4. Material Updates
        const material = mesh.material as THREE.MeshBasicMaterial;
        if (material) {
            const b = 1.0 - Math.min(1, s.fadeToBlack);
            material.color.setRGB(b, b, b);

            // Only drive opacity in Grid and Focus modes.
            // In Explorer mode, the atmospheric depth-fade system in MediaPlane.useFrame owns opacity.
            if (editorMode || isFocused || isGridMode) {
                material.opacity = THREE.MathUtils.lerp(material.opacity, targetOpacity, delta * 8);
                material.transparent = true;
            }
            // Explorer mode: opacity is NOT touched here — MediaPlane useFrame controls it.
        }

        mesh.scale.lerp(new THREE.Vector3(targetScale, targetScale, 1), delta * 5);

        // 5. Sync state for children (Text, Tag)
        if (Math.abs(syncState.opacity - targetOpacity) > 0.05 || Math.abs(syncState.scale - targetScale) > 0.05) {
            setSyncState({ opacity: targetOpacity, scale: targetScale });
        }

        return { targetOpacity, targetScale, fadeToBlack: s.fadeToBlack };
    };

    return {
        syncState,
        update
    };
}
