'use client';

import React, { useRef, useMemo, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Text, useTexture, TransformControls } from '@react-three/drei';
import * as THREE from 'three';
import { useSpatialVideo } from '@/hooks/use-spatial-video';
import { MediaTag } from './MediaTag';
import { useMediaState } from '@/hooks/use-media-state';
import { useStore } from '@/store/useStore';

interface MediaPlaneProps {
    id: number;
    position: [number, number, number];
    index: number;
    title: string;
    previewSrc?: string;
    fullSrc?: string;
    srcDesktop?: string;
    srcDesktopFallback?: string;
    srcMobile?: string;
    posterSrc?: string;
    category: 'video' | '3d' | 'ai';
    isActiveJourney?: boolean;
    audioEnabled: boolean;
    globalVolume: number;
    audioDebug?: boolean;
    editorMode?: boolean;
    isGeneratorActive?: boolean;
    isGridMode?: boolean;
    targetPosition?: [number, number, number];
    onPositionChange?: (newPos: [number, number, number]) => void;
    onOpenInfo?: () => void;
    onClick?: (e: any) => void;
    onPointerOver?: (e: any) => void;
    onPointerOut?: () => void;
    listener: THREE.AudioListener;
    audioZOffset?: number;
    isCulled?: boolean;
    activeSpacerSpacing?: number;
    targetScale?: number;
}

export const MediaPlane: React.FC<MediaPlaneProps> = (props) => {
    const {
        id, position, index, title, previewSrc, fullSrc, srcDesktop, srcDesktopFallback, srcMobile, posterSrc: providedPosterSrc, category,
        audioEnabled, globalVolume, audioZOffset = 0,
        editorMode, isGridMode, audioDebug,
        targetPosition, listener,
        onPositionChange, onClick, onPointerOver, onPointerOut,
        isCulled, activeSpacerSpacing = 15.0,
        targetScale = 1.0
    } = props;

    const meshRef = useRef<THREE.Mesh>(null);
    const animatedGroupRef = useRef<THREE.Group>(null);
    const audioRef = useRef<THREE.PositionalAudio>(null);
    const filterRef = useRef<BiquadFilterNode | null>(null);
    const debugRingRef = useRef<THREE.Mesh>(null);
    const muffleRingRef = useRef<THREE.Mesh>(null);
    const { size } = useThree();

    // Mobile detection: robust touch + size + UA detection
    const isMobile = useMemo(() => {
        if (typeof window === 'undefined') return false;
        const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
        const isSmall = window.innerWidth < 1024; // Expanded for landscape phones
        const isUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        return isUA || (isTouch && isSmall);
    }, [size.width, size.height]);

    // State for video quality swapping and activation
    const [videoQuality, setVideoQuality] = useState<'preview' | 'full'>('preview');
    const { activeVideoId } = useStore();
    const isActive = activeVideoId === id;
    const isFocused = isActive;
    const isAnyFocused = activeVideoId !== null;
    const [isHovered, setIsHovered] = useState(false);
    const [isActivated, setIsActivated] = useState(false);

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

    const activeMedia = useMemo(() => {
        // Both Mobile and Desktop use `-mobile.mp4` (720p w/ audio) for grid/explorer, and `fullSrc/srcDesktop` for focus.
        if (isFocused || videoQuality === 'full') {
            if (srcDesktop || fullSrc) {
                const baseFull = srcDesktop || (fullSrc as string);
                // If the API hasn't generated the fallback yet, we just append -fallback manually
                const baseFallback = srcDesktopFallback || baseFull.replace('.mp4', '-fallback.mp4');

                const sources = [];
                // Order matters! The browser picks the first one it supports.
                // We supply AV1 first as the hyper-optimized choice, then H.264 as safety.
                if (baseFull) sources.push({ src: baseFull, type: 'video/mp4; codecs="av01.0.05M.08, opus"' });
                if (baseFallback) sources.push({ src: baseFallback, type: 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"' });

                return { cacheKey: baseFull, sources };
            }
        }

        // Use the new 5-second Preview tier for Grid and Explorer instead of the full 720p Mobile tier.
        // It provides the same H.264 broad compatibility but heavily cuts bandwidth.
        const previewTarget = previewSrc || (fullSrc ? fullSrc.replace('.mp4', '-preview.mp4') : srcMobile?.replace('-mobile.mp4', '-preview.mp4'));
        return {
            cacheKey: previewTarget,
            sources: previewTarget ? [{ src: previewTarget, type: 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"' }] : []
        };
    }, [isFocused, videoQuality, fullSrc, previewSrc, srcDesktop, srcDesktopFallback, srcMobile]);

    // 1. Logic Hooks 
    // Optimization: only 'active' if near or focused
    // Focus Isolation: If anyone is focused, ONLY the focused one is "active"
    const isIsolated = isAnyFocused && !isFocused;

    // In grid mode, we wait for a hover before loading the video to prevent stutter.
    const gridActive = isGridMode ? hasBeenHovered : true;

    // CRITICAL DOM OVERLAY FIX:
    // Mobile WebGL video textures are inherently unstable on Safari due to strict hardware limits.
    // We strictly use `.jpg` posters in 3D space on mobile. When focused, `MobileVideoOverlay.tsx` plays an HTML video over top!
    const effectiveActive = isMobile
        ? (!!editorMode)
        : ((isActive || !!editorMode) && !isIsolated && gridActive);

    // On mobile, we NEVER want the WebGL plane to acquire a video channel if we are using the DOM overlay.
    // This prevents "Double Decoding" which crashes iPhone Safari.
    const shouldAcquire = isMobile ? (!!editorMode) : ((effectiveActive && isActivated) || isFocused);

    // If culled (far away), skip video acquisition entirely to save GPU/Bandwidth
    const finalShouldAcquire = isCulled ? false : shouldAcquire;

    const { texture, isAcquiring, play, pause, setMuted } = useSpatialVideo(activeMedia.cacheKey, activeMedia.sources, !!finalShouldAcquire, audioRef);
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
    const [posterTexture, setPosterTexture] = useState<THREE.Texture | null>(null);

    useEffect(() => {
        const url = posterSrc || '/fallback.jpg';
        const loader = new THREE.TextureLoader();
        let isMounted = true;
        let loadedTex: THREE.Texture | null = null;

        loader.load(
            url,
            (tex) => {
                if (!isMounted) {
                    tex.dispose();
                    return;
                }
                tex.colorSpace = THREE.SRGBColorSpace;
                loadedTex = tex;
                setPosterTexture(tex);
            },
            undefined,
            (err) => {
                console.warn(`[MediaPlane] Missing Poster Image: ${url}`);
                // Safely ignore, component will render without a poster mask
            }
        );

        return () => {
            isMounted = false;
            if (loadedTex) loadedTex.dispose();
        };
    }, [posterSrc]);

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
            // Defensive check: ensure audio object is still valid and connected
            if (audio && typeof audio.setFilter === 'function') {
                audio.setFilter(filter);
            }
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

        const relativeY = planePos.y - camY;
        const relativeZ = planeZ - camZ;

        // Map texture to material (needs to be done here for frame-sync)
        if (meshRef.current.material) {
            const material = meshRef.current.material as THREE.MeshBasicMaterial;

            // --- Atmospheric Culling (Smooth Transparency Fade) ---
            // 1. Fade out as it passes the camera (relativeZ goes positive)
            // 2. Fade out as it recedes into the distance
            const fadeStart = -0.5; // Starts fading out just before it hits the camera
            const fadeEnd = 0.5;    // Fully out at camera plane

            // Dynamic 2-Layer Fog:
            // We want Layer 0 and Layer 1 visible. Layer 2 should be ghosts/gone.
            // Layer 2 is at dist = activeSpacerSpacing * 2.
            const farFadeStart = -activeSpacerSpacing * 1.2;
            const farLimit = -activeSpacerSpacing * 2.1;

            let targetOpacity = 1;

            if (relativeZ > fadeStart) {
                // Exit Fade (passing camera)
                targetOpacity = 1 - THREE.MathUtils.smoothstep(relativeZ, fadeStart, fadeEnd);
            } else if (relativeZ < farFadeStart) {
                // Entrance Fade (coming from distance)
                targetOpacity = THREE.MathUtils.smoothstep(relativeZ, farLimit, farFadeStart);
            }

            // Lerp opacity for silky smooth transitions
            material.opacity = THREE.MathUtils.lerp(material.opacity, targetOpacity, 0.1);
            material.transparent = true;

            // Visibility Culling: Toggle off if opacity is negligible
            // This saves GPU and prevents Raycasting (clicks/hover) on hidden planes
            material.visible = material.opacity > 0.01;
            material.needsUpdate = true;

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
                onClick={(e) => {
                    setIsActivated(true);
                    onClick?.(e);
                }}
                onPointerOver={(e) => {
                    if (isCulled) return;
                    setIsHovered(true);
                    if (isGridMode) {
                        setHasBeenHovered(true);
                        return;
                    }
                    onPointerOver?.(e);
                }}
                onPointerOut={(e) => {
                    if (isCulled) return;
                    setIsHovered(false);
                    if (isGridMode) return;
                    onPointerOut?.();
                }}
                userData={{ isPlane: true }}
            >
                <planeGeometry args={[4.8, 2.7]} />
                <meshBasicMaterial
                    transparent={true}
                    opacity={isCulled ? 0 : 1}
                    visible={true} // Keep visible=true so raycasting (onClick) still works at a distance
                    toneMapped={false}
                    side={THREE.DoubleSide}
                />

                {!isCulled && <positionalAudio ref={audioRef} args={[listener]} />}
            </mesh>

            {!isCulled && (
                <MediaTag
                    category={category}
                    isGridMode={!!isGridMode}
                    isFocused={!!isFocused}
                    planeScale={syncState.scale}
                    parentOpacity={syncState.opacity}
                />
            )}

            {/* Audio Debug Visualizers */}
            {audioDebug && !isCulled && (
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
