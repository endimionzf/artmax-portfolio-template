'use client';

import React, { useRef, useMemo, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Text, useTexture, TransformControls } from '@react-three/drei';
import * as THREE from 'three';
import { useSpatialVideo } from '@/hooks/use-spatial-video';
import { MediaTag } from './MediaTag';
import { useMediaState } from '@/hooks/use-media-state';

interface MediaPlaneProps {
    position: [number, number, number];
    index: number;
    title: string;
    previewSrc?: string;
    fullSrc?: string;
    posterSrc?: string;
    category: 'video' | '3d' | 'ai';
    isActiveJourney?: boolean;
    audioEnabled: boolean;
    globalVolume: number;
    audioDebug?: boolean;
    editorMode?: boolean;
    isGeneratorActive?: boolean;
    isFocused?: boolean;
    isAnyFocused?: boolean;
    isGridMode?: boolean;
    targetPosition?: [number, number, number];
    onPositionChange?: (newPos: [number, number, number]) => void;
    onOpenInfo?: () => void;
    onClick?: (e: any) => void;
    onPointerOver?: (e: any) => void;
    onPointerOut?: () => void;
    listener: THREE.AudioListener;
    audioZOffset?: number;
}

export const MediaPlane: React.FC<MediaPlaneProps> = (props) => {
    const { 
        position, index, title, previewSrc, fullSrc, posterSrc: providedPosterSrc, category, 
        audioEnabled, globalVolume, audioZOffset = 0,
        editorMode, isGridMode, audioDebug,
        isFocused, isAnyFocused, 
        targetPosition, listener, 
        onPositionChange, onClick, onPointerOver, onPointerOut 
    } = props;

    const meshRef = useRef<THREE.Mesh>(null);
    const animatedGroupRef = useRef<THREE.Group>(null);
    const audioRef = useRef<THREE.PositionalAudio>(null);
    const filterRef = useRef<BiquadFilterNode | null>(null);
    const debugRingRef = useRef<THREE.Mesh>(null);
    const muffleRingRef = useRef<THREE.Mesh>(null);
    const { size } = useThree();

    // Mobile detection: narrow screen pixels
    const isMobile = useMemo(() => size.width < 768, [size.width]);

    // State for video quality swapping and activation
    const [videoQuality, setVideoQuality] = useState<'preview' | 'full'>('preview');
    const [isActive, setIsActive] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    
    // Grid mode performance: defer loading until the user interacts IF returning from focus
    const [hasBeenHovered, setHasBeenHovered] = useState(false);
    const wasAnyFocusedRef = useRef(false);

    // Track if any plane was recently focused
    useEffect(() => {
        if (isAnyFocused) {
            wasAnyFocusedRef.current = true;
        }
    }, [isAnyFocused]);

    // Reset hover memory when entering Grid Mode
    useEffect(() => {
        if (isGridMode && !isAnyFocused) {
            // We entered Grid mode and nothing is currently focused.
            // Did we just return from a focus state?
            if (wasAnyFocusedRef.current) {
                 // We returned from focus mode. Require hover for all planes to prevent stutter.
                 setHasBeenHovered(false);
                 // Reset the ref since we've handled the transition
                 wasAnyFocusedRef.current = false;
            } else {
                 // We entered from Explorer or cold start (no recent focus). Auto-play them.
                 setHasBeenHovered(true);
            }
        }
    }, [isGridMode, isAnyFocused]);

    const activeSrc = useMemo(() => {
        // Both Mobile and Desktop use `-mobile.mp4` (720p w/ audio) for grid/explorer, and `fullSrc` for focus.
        if (isFocused || videoQuality === 'full') return fullSrc;
        return fullSrc ? fullSrc.replace('.mp4', '-mobile.mp4') : previewSrc;
    }, [isFocused, videoQuality, fullSrc, previewSrc]);

    // 1. Logic Hooks 
    // Optimization: only 'active' if near or focused
    // Focus Isolation: If anyone is focused, ONLY the focused one is "active"
    const isIsolated = isAnyFocused && !isFocused;
    
    // In grid mode, we wait for a hover before loading the video to prevent stutter.
    const gridActive = isGridMode ? hasBeenHovered : true;
    
    // On mobile, bypass culling distance limits if actively focused
    const effectiveActive = ((isActive || !!editorMode) && !isIsolated && gridActive) || (isMobile && isFocused);

    const { texture, isAcquiring, play, pause, setMuted } = useSpatialVideo(activeSrc, !!(effectiveActive || isFocused), audioRef);
    const { syncState, update } = useMediaState({
        position, targetPosition, isFocused: !!isFocused, isGridMode: !!isGridMode, isAnyFocused: !!isAnyFocused, editorMode: !!editorMode, videoQuality, setVideoQuality
    });

    useEffect(() => {
        if (setMuted) {
            setMuted(!audioEnabled);
        }
    }, [audioEnabled, setMuted]);

    // 2. Poster / Fallback
    const posterSrc = useMemo(() => providedPosterSrc || previewSrc?.replace('.mp4', '.jpg') || null, [providedPosterSrc, previewSrc]);
    const posterTexture = useTexture(posterSrc || '/fallback.jpg'); // Fallback to a valid path or handle null
    if (posterTexture) posterTexture.colorSpace = THREE.SRGBColorSpace;

    // 3. Setup Audio Graph & Filters
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        // Tighter culling to prevent chaotic overlap
        audio.setDistanceModel('linear');
        audio.setRefDistance(2); // Start dropping volume gracefully immediately after 2 units
        audio.setMaxDistance(10); // Absolute silence past 10 units
        audio.setRolloffFactor(1); 
        
        // Set up the dynamic Muffle filter (LowPass)
        if (!filterRef.current && listener.context && listener.context.state !== 'closed') {
            const filter = listener.context.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 24000; // Start fully open (clear)
            filter.Q.value = 0.5; // Gentle slope
            filterRef.current = filter;
            audio.setFilter(filter);
        }

        // Disable spatial effects (panning) in Grid Mode
        if (isGridMode && audio.panner) {
            audio.panner.panningModel = 'equalpower';
        } else if (audio.panner) {
            audio.panner.panningModel = 'HRTF';
        }
    }, [listener, isGridMode]);

    // 3. Audio Management
    useFrame((state, delta) => {
        if (!meshRef.current || !animatedGroupRef.current) return;
        
        // Navigation & Visual State (Extracted)
        update(state, delta, meshRef.current, animatedGroupRef.current);

        // Distance-based culling logic (Asymmetric/Mode-Aware)
        const camY = state.camera.position.y;
        const camZ = state.camera.position.z;
        const planePos = animatedGroupRef.current.position;
        const planeZ = planePos.z + audioZOffset;
        
        let near = false;
        if (isGridMode) {
            // Grid culling: check Y distance (vertical viewport)
            const relativeY = planePos.y - camY;
            near = Math.abs(relativeY) < 4.5; // Loosened slightly to prevent popping
        } else {
            // Explorer culling: Tightened to ~5 items to match pool size (6)
            const relativeZ = planeZ - camZ; 
            // Cull strictly when passing the camera (relativeZ > 0.2) to free up the pool
            near = relativeZ <= 0.2 && relativeZ > -25; 
        }
        
        if (near !== isActive) setIsActive(near);

        // Map texture to material (needs to be done here for frame-sync)
        if (meshRef.current.material) {
            const material = meshRef.current.material as THREE.MeshBasicMaterial;
            // Always show the poster as a fallback if the video texture isn't ready
            const newMap = (texture && effectiveActive) ? texture : posterTexture;
            if (material.map !== newMap) {
                material.map = newMap;
                material.needsUpdate = true;
            }

            // If acquiring, gently pulse the base color
            if (isAcquiring) {
                 const pulse = 0.5 + Math.sin(state.clock.elapsedTime * 5) * 0.2;
                 material.color.setRGB(pulse, pulse, pulse);
            }
        }

        // Dynamic Muffle Effect
        if (filterRef.current && listener.context) {
            // Project plane position to NDC (Viewport space)
            const ndcPos = new THREE.Vector3().copy(planePos);
            ndcPos.project(state.camera);
            
            // Check if center of video is roughly rendering on the screen
            // Z > 1 means it's behind the camera. X/Y roughly [-1.2, 1.2] allows a bit of leeway at the edges
            const inViewport = ndcPos.z < 1 && ndcPos.x >= -1.2 && ndcPos.x <= 1.2 && ndcPos.y >= -1.2 && ndcPos.y <= 1.2;
            const dist3D = state.camera.position.distanceTo(planePos);

            let targetFreq = 24000;

            if (isFocused || isGridMode) {
                targetFreq = 24000; // Never muffle in Focus or Grid mode
            } else {
                if (inViewport && dist3D < 5) { // Safe space tightened to 5 units
                    targetFreq = 24000; // Safe space: clear audio
                } else if (inViewport) {
                    // Visible, but further than 5 units. Gradually drop to 300Hz by 12 units.
                    const t = Math.max(0, Math.min(1, (dist3D - 5) / 7));
                    targetFreq = THREE.MathUtils.lerp(24000, 300, t);
                } else {
                    // Not visible. It should be muffled, but STILL scale with spatial distance.
                    // Start at a moderately muffled 2000Hz (when close) down to 300Hz (at max bounds)
                    const t = Math.max(0, Math.min(1, dist3D / 12));
                    targetFreq = THREE.MathUtils.lerp(2000, 300, t);
                }
            }

            // Ramp frequency smoothly to prevent popping
            const currentTime = listener.context.currentTime;
            filterRef.current.frequency.setTargetAtTime(targetFreq, currentTime, 0.15);
            
            // Visualizer Updates (If debug rings exist)
            if (audioDebug && debugRingRef.current && muffleRingRef.current) {
                // Outer red ring shows Muffle intensity (large = clear 24000hz, small = muffled 300hz)
                const muffleScale = THREE.MathUtils.mapLinear(targetFreq, 300, 24000, 0.2, 2.5);
                muffleRingRef.current.scale.setScalar(muffleScale);
                (muffleRingRef.current.material as THREE.MeshBasicMaterial).opacity = 0.5;

                // Inner green ring shows Volume/Presence intensity
                let baseVolScale = 0;
                if (!isGridMode && !isFocused && !isIsolated) {
                    // Linear falloff between refDistance(2) and maxDistance(10)
                    baseVolScale = Math.max(0, Math.min(1, 1 - ((dist3D - 2) / 8)));
                } else if (isFocused || (isGridMode && isHovered)) {
                    baseVolScale = 1;
                }
                
                debugRingRef.current.scale.setScalar(0.5 + baseVolScale * 1.5);
                (debugRingRef.current.material as THREE.MeshBasicMaterial).opacity = baseVolScale * 0.8;
            }
        }

        // Audio Management
        if (audioRef.current) {
            const audio = audioRef.current;
            const group = animatedGroupRef.current;
            const camera = state.camera;

            const audioSourceZ = group.position.z + audioZOffset;
            const audioDistZ = Math.abs(camera.position.z - audioSourceZ);

            let targetVol = 0;
            if (isFocused) {
                targetVol = 1.0;
            } else if (isIsolated) {
                // FORCE SILENCE for background items when focused (isolation mode)
                targetVol = 0;
            } else if (isGridMode) {
                // In grid mode, we want 100% volume for visible items, but triggered by hover only
                targetVol = (isActive && isHovered) ? 1.0 : 0;
            } else {
                // In Explorer, we keep the target volume high and let the spatial panner handle the falloff
                targetVol = (isActive) ? 1.0 : 0;
            }
            
            audio.setVolume(targetVol * globalVolume);

            if (effectiveActive || isFocused) {
                // iOS strictly blocks asynchronous `.play()` if the video is unmuted.
                // On mobile, videos in Explorer mode MUST be muted to visually play without a click.
                setMuted(isMobile && !isFocused ? true : !audioEnabled);
                play();
            } else {
                pause();
            }
        }
    });

    const content = (
        <group ref={animatedGroupRef} position={targetPosition || position}>
            <mesh 
                ref={meshRef} 
                onClick={onClick}
                onPointerOver={(e) => {
                    setIsHovered(true);
                    if (isGridMode) {
                        setHasBeenHovered(true);
                        return;
                    }
                    onPointerOver?.(e);
                }}
                onPointerOut={(e) => {
                    setIsHovered(false);
                    if (isGridMode) return;
                    onPointerOut?.();
                }}
                userData={{ isPlane: true }}
            >
                <planeGeometry args={[4.8, 2.7]} />
                <meshBasicMaterial 
                    transparent={true}
                    opacity={0}
                    toneMapped={false}
                    side={THREE.DoubleSide}
                />

                <positionalAudio ref={audioRef} args={[listener]} />
            </mesh>

            <MediaTag 
                category={category}
                isGridMode={!!isGridMode}
                isFocused={!!isFocused}
                planeScale={syncState.scale}
                parentOpacity={syncState.opacity}
            />

            {/* Audio Debug Visualizers */}
            {audioDebug && (
                <group position={[0, 0, audioZOffset]}>
                    <mesh ref={muffleRingRef} position={[0, 0, -0.1]}>
                        <torusGeometry args={[3, 0.05, 16, 64]} />
                        <meshBasicMaterial color="#ff3333" transparent opacity={0.5} depthTest={false} />
                    </mesh>
                    <mesh ref={debugRingRef} position={[0, 0, -0.05]}>
                        <torusGeometry args={[2.8, 0.08, 16, 64]} />
                        <meshBasicMaterial color="#33ff33" transparent opacity={0.8} depthTest={false} />
                    </mesh>
                </group>
            )}

        </group>
    );

    if (editorMode) {
        return (
            <TransformControls 
                object={animatedGroupRef.current || undefined} 
                mode="translate"
                onMouseUp={() => {
                    if (animatedGroupRef.current) {
                        const { x, y, z } = animatedGroupRef.current.position;
                        onPositionChange?.([x, y, z]);
                    }
                }}
            >
                {content}
            </TransformControls>
        );
    }

    return content;
};
