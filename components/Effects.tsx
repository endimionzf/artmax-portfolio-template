import { EffectComposer, Vignette, Autofocus, Noise } from '@react-three/postprocessing';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useRef, useMemo, useState } from 'react';
import { useControls, folder } from 'leva';

export function Effects({ isFocused, focusTarget, isGridMode }: { isFocused: boolean, focusTarget?: [number, number, number] | null, isGridMode?: boolean }) {
    const { camera, scene } = useThree();
    
    const { 
        focalLength, focusRange, bokehScale, focusOffset,
    } = useControls('Effects', {
        'Depth of Field': folder({
            focusOffset: { value: 20, min: 1, max: 100, step: 0.5, label: 'Focus Dist Fallback' },
            focalLength: { value: 0.05, min: 0.01, max: 0.5, step: 0.005 },
            focusRange: { value: 15, min: 0.001, max: 15, step: 0.001 },
            bokehScale: { value: 1, min: 0, max: 20, step: 0.5 }
        })
    });

    // Hardcoded visual settings
    const vignetteOffset = 0.4;
    const vignetteDarknessRatio = 1.1;
    const eskil = false;
    const noiseOpacity = 0.06;
    const noisePremultiply = false;

    const targetVignetteDarkness = isFocused ? (0.8 * vignetteDarknessRatio) : (0.3 * vignetteDarknessRatio); 
    const [animatedDarkness, setAnimatedDarkness] = useState(0.3);
    
    // The target coordinate for the Autofocus component
    const targetRef = useRef(new THREE.Vector3(0, 0, -20));
    const raycaster = useMemo(() => new THREE.Raycaster(), []);
    const hitPointRef = useRef(new THREE.Vector3(0, 0, -20));

    useFrame((state, delta) => {
        if (isGridMode) {
            hitPointRef.current.set(0, 0, 0);
            targetRef.current.copy(hitPointRef.current);
        } else if (isFocused && focusTarget) {
            hitPointRef.current.set(...focusTarget);
            targetRef.current.copy(hitPointRef.current);
        } else {
            raycaster.setFromCamera(state.pointer, camera);
            const intersects = raycaster.intersectObjects(scene.children, true);
            
            let hitPoint = new THREE.Vector3(camera.position.x, camera.position.y, camera.position.z - focusOffset);
            
            for (const hit of intersects) {
                if (hit.object.userData?.isPlane) {
                    hitPoint = hit.point;
                    break; 
                }
            }
            hitPointRef.current.copy(hitPoint);
            targetRef.current.copy(hitPoint);
        }

        const step = delta * 5;
        if (Math.abs(animatedDarkness - targetVignetteDarkness) > 0.001) {
            setAnimatedDarkness(prev => THREE.MathUtils.lerp(prev, targetVignetteDarkness, step));
        }
    });

    return (
        <EffectComposer multisampling={4}>
            <Autofocus
                target={targetRef.current}
                smoothTime={0.4}
                focalLength={focalLength} 
                focusRange={focusRange}
                bokehScale={(isGridMode || isFocused) ? 0 : bokehScale} 
            />
            <Vignette eskil={eskil} offset={vignetteOffset} darkness={animatedDarkness} />
            <Noise opacity={noiseOpacity} premultiply={noisePremultiply} />
        </EffectComposer>
    );
}
