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
        position, index, title, previewSrc, fullSrc, category, 
        audioEnabled, globalVolume, audioZOffset = 0,
        editorMode, isGridMode,
        isFocused, isAnyFocused, 
        targetPosition, listener, 
        onPositionChange, onClick, onPointerOver, onPointerOut 
    } = props;

    const meshRef = useRef<THREE.Mesh>(null);
    const animatedGroupRef = useRef<THREE.Group>(null);
    const audioRef = useRef<THREE.PositionalAudio>(null);
    const { size } = useThree();

    // Mobile detection: narrow screen pixels
    const isMobile = useMemo(() => size.width < 768, [size.width]);

    // State for video quality swapping and activation
    const [videoQuality, setVideoQuality] = useState<'preview' | 'full'>('preview');
    const [isActive, setIsActive] = useState(false);
    const [isHovered, setIsHovered] = useState(false);

    // Mobile restriction: No video in Explorer/Grid, only in Focus
    // Synchronize with the fade-to-black cycle for a cleaner transition
    const activeSrc = useMemo(() => {
        if (isMobile) {
            // Only provide high-res source when we've actually swapped quality in Focus
            return (isFocused && videoQuality === 'full') ? fullSrc : undefined;
        }
        return videoQuality === 'full' ? fullSrc : previewSrc;
    }, [isMobile, isFocused, videoQuality, fullSrc, previewSrc]);

    // 1. Logic Hooks 
    // Optimization: only 'active' if near or focused
    const { texture, play, pause, setMuted } = useSpatialVideo(activeSrc, isActive || isFocused || !!editorMode, audioRef);
    const { syncState, update } = useMediaState({
        position, targetPosition, isFocused, isGridMode, isAnyFocused, editorMode, videoQuality, setVideoQuality
    });

    useEffect(() => {
        if (setMuted) {
            setMuted(!audioEnabled);
        }
    }, [audioEnabled, setMuted]);

    // 2. Poster / Fallback
    const posterSrc = useMemo(() => previewSrc?.replace('.mp4', '.jpg') || '', [previewSrc]);
    const posterTexture = useTexture(posterSrc);
    if (posterTexture) posterTexture.colorSpace = THREE.SRGBColorSpace;

    // 3. Setup Audio Graph
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        audio.setDistanceModel('exponential');
        audio.setRefDistance(5); // Increased for smoother fade
        audio.setRolloffFactor(isGridMode ? 0 : 1); // Less aggressive falloff for more spatial depth
        audio.setMaxDistance(100);
        
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
            // 3.5 units window matches the fading window in use-media-state
            near = Math.abs(relativeY) < 3.5;
        } else {
            // Explorer culling: check Z distance (tightened for 6-video pool)
            const relativeZ = planeZ - camZ; 
            // -30 units allows for more pre-loading/smoothing (matching the 250 mounting window)
            near = relativeZ < 1 && relativeZ > -30; 
        }
        
        if (near !== isActive) setIsActive(near);

        // Map texture to material (needs to be done here for frame-sync)
        if (meshRef.current.material) {
            const material = meshRef.current.material as THREE.MeshBasicMaterial;
            // Always show the poster as a fallback if the video texture isn't ready
            const newMap = (texture && isActive) ? texture : posterTexture;
            if (material.map !== newMap) {
                material.map = newMap;
                material.needsUpdate = true;
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
            } else if (isGridMode) {
                // In grid mode, we want 100% volume for visible items, but triggered by hover
                targetVol = (isActive && isHovered) ? 1.0 : 0;
            } else if (!isAnyFocused && (camera.position.z > audioSourceZ || audioDistZ < 2)) {
                // In Explorer, we keep the target volume high and let the spatial panner handle the falloff
                targetVol = (isActive) ? 1.0 : 0;
            }
            
            audio.setVolume(targetVol * globalVolume);

            if (near || isFocused) {
                play();
                setMuted(!audioEnabled); 
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
                    if (isGridMode) return;
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
                planeScale={syncState.scale}
                parentOpacity={syncState.opacity}
            />

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
