'use client';

import React, { useRef, useMemo, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Text, useTexture, TransformControls } from '@react-three/drei';
import * as THREE from 'three';
import { useSpatialVideo } from '@/hooks/use-spatial-video';
import { MediaTag } from './MediaTag';
import { useMediaState } from '@/hooks/use-media-state';
import { useStore } from '@/store/useStore';
import { resumeAudioContext } from '@/hooks/use-spatial-audio';
import { useIsMobile } from '@/hooks/use-is-mobile';

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
    youtubeId?: string;
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
        id, position, index, title, previewSrc, fullSrc, srcDesktop, srcDesktopFallback, srcMobile, posterSrc: providedPosterSrc, category, youtubeId,
        audioEnabled, globalVolume, audioZOffset = 0,
        editorMode, isGridMode, audioDebug,
        targetPosition, listener,
        onPositionChange, onClick, onPointerOver, onPointerOut,
        isCulled, activeSpacerSpacing = 15.0,
        targetScale = 1.0
    } = props;

    const isMobile = useIsMobile();
    const meshRef = useRef<THREE.Mesh>(null);
    const animatedGroupRef = useRef<THREE.Group>(null);
    const audio = useMemo(() => new THREE.Audio(listener), [listener]);
    const debugRingRef = useRef<THREE.Mesh>(null);
    const planeOpacityRef = useRef<number>(0); // Start invisible — useFrame lerps to correct depth-based value
    const { size } = useThree();

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
        // Goal 4: Reduce resource churn.
        // Use 'isActivated' as a proxy for 'intent to focus' to start loading the high-quality asset immediately on click.
        // We use a stable check here to ensure that once we've decided to go FULL (on click), 
        // subsequent updates to 'videoQuality' (from the fade-to-black sync) don't trigger a new array object.
        const isFull = isFocused || isActivated || videoQuality === 'full';

        if (isFull) {
            if (srcDesktop || fullSrc) {
                const baseFull = srcDesktop || (fullSrc as string);
                const baseFallback = srcDesktopFallback || baseFull.replace('.mp4', '-fallback.mp4');

                const sources = [];
                if (baseFull) sources.push({ src: baseFull, type: 'video/mp4; codecs="av01.0.05M.08, opus"' });
                if (baseFallback) sources.push({ src: baseFallback, type: 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"' });

                return { cacheKey: baseFull, sources };
            }
        }

        // Use the new 5-second Preview tier for Grid and Explorer instead of the full 720p Mobile tier.
        const previewTarget = previewSrc || (fullSrc ? fullSrc.replace('.mp4', '-preview.mp4') : srcMobile?.replace('-mobile.mp4', '-preview.mp4'));
        return {
            cacheKey: previewTarget,
            sources: previewTarget ? [{ src: previewTarget, type: 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"' }] : []
        };
    }, [isFocused, isActivated, videoQuality, fullSrc, previewSrc, srcDesktop, srcDesktopFallback, srcMobile]);

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

    // If culled (far away) or if we are using the DOM overlay (static-first), skip video acquisition
    const finalShouldAcquire = false; // Always use static posters in 3D scene now

    const { texture, isAcquiring, play, pause, setMuted } = useSpatialVideo(activeMedia.cacheKey, activeMedia.sources, !!finalShouldAcquire, { current: audio } as any);
    const { syncState, update } = useMediaState({
        position, targetPosition, isFocused: !!isFocused, isGridMode: !!isGridMode, isAnyFocused: !!isAnyFocused, editorMode: !!editorMode, videoQuality, setVideoQuality
    });

    useEffect(() => {
        if (setMuted) {
            setMuted(!audioEnabled);
        }
    }, [audioEnabled, setMuted]);

    // Reset activation state when focus is lost to prevent background resource overhead
    useEffect(() => {
        if (!isFocused) setIsActivated(false);
    }, [isFocused]);

    // Desktop Auto-Play: start video immediately when focused (zoomed in)
    // 2. Playback logic (DISABLED for static-first model)
    // useEffect(() => {
    //     if (isFocused && !isMobile && play) {
    //         play();
    //     }
    // }, [isFocused, isMobile, play]);

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



    // 3. Audio Management
    useFrame((state, delta) => {
        if (!meshRef.current || !animatedGroupRef.current) return;

        // Navigation & Visual State (Extracted)
        update(state, delta, meshRef.current, animatedGroupRef.current);

        // Common Spatial Calculations
        const camPos = state.camera.position;
        const planePos = animatedGroupRef.current.position;
        const dist3D = camPos.distanceTo(planePos);
        
        const planeZ = planePos.z + audioZOffset;
        const relativeY = planePos.y - camPos.y;
        const relativeZ = planeZ - camPos.z;

        // Map texture to material (needs to be done here for frame-sync)
        if (meshRef.current.material) {
            const material = meshRef.current.material as THREE.MeshBasicMaterial;

            if (isFocused) {
                material.opacity = THREE.MathUtils.lerp(material.opacity, 1, 0.15);
                material.transparent = true;
                material.visible = true;
                material.needsUpdate = true;
                meshRef.current.visible = true;
            } else {
                // Near fade: tightened to allow getting closer to images
                const fadeStart = -9;
                const fadeEnd = -5;

                // Far fade: starts appearing at -38 and is fully visible at -32
                const farFadeStart = -32;
                const farLimit = -38;

                let targetOpacity = 1;

                if (relativeZ > fadeStart) {
                    targetOpacity = 1 - THREE.MathUtils.smoothstep(relativeZ, fadeStart, fadeEnd);
                } else if (relativeZ < farFadeStart) {
                    targetOpacity = THREE.MathUtils.smoothstep(relativeZ, farLimit, farFadeStart);
                }

                const lerpSpeed = isCulled ? 0.25 : 0.12;
                material.opacity = THREE.MathUtils.lerp(material.opacity, isCulled ? 0 : targetOpacity, lerpSpeed);
                material.transparent = true;
                material.visible = material.opacity > 0.01;
                material.needsUpdate = true;

                // mesh.visible = false removes the mesh from raycasting entirely.
                // material.visible only hides rendering — the mesh would still intercept clicks.
                meshRef.current.visible = material.opacity > 0.05;
            }

            // Sync live opacity ref so MediaTag can read it every frame without React overhead
            planeOpacityRef.current = material.opacity;

            // Always show the poster as a fallback if the video texture isn't ready
            const newMap = (texture && effectiveActive) ? texture : posterTexture;
            if (material.map !== newMap) {
                material.map = newMap;
                material.needsUpdate = true;
            }

            // If acquiring and we don't have a texture yet, gently pulse the base color
            if (isAcquiring && !texture) {
                const pulse = 0.5 + Math.sin(state.clock.elapsedTime * 5) * 0.2;
                material.color.setRGB(pulse, pulse, pulse);
            } else {
                material.color.setRGB(1, 1, 1);
            }
        }

        // Visualizer Updates (If debug rings exist)
        if (audioDebug && debugRingRef.current) {
            debugRingRef.current.visible = false;
        }

        // Audio Management
        if (audio) {
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

            // Goal 1 & 2: Prevent premature playback and sync with transition.
            // On desktop, we delay the play() trigger until the camera is sufficiently close to the fixed focal point.
            // dist3D < 6.5 is a safe threshold (optimalZOffset is 4-6).
            const isArrived = isFocused ? (dist3D < 6.5) : true;

            if (effectiveActive || isFocused) {
                // iOS strictly blocks asynchronous `.play()` if the video is unmuted.
                // On mobile, videos in Explorer mode MUST be muted to visually play without a click.
                setMuted(isMobile && !isFocused ? true : !audioEnabled);
                
                if (isArrived) {
                    play();
                } else {
                    // Stay paused during the camera transition to focus
                    pause();
                }
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
                    // Reject clicks on invisible planes — prevents hitting culled planes behind visible ones
                    if (planeOpacityRef.current < 0.1) return;
                    // Critical for iOS: Resume AudioContext inside user gesture
                    resumeAudioContext();
                    setIsActivated(true);
                    onClick?.(e);
                }}
                onPointerOver={(e) => {
                    if (planeOpacityRef.current < 0.1) return;
                    setIsHovered(true);
                    if (isGridMode) {
                        setHasBeenHovered(true);
                        return;
                    }
                    onPointerOver?.(e);
                }}
                onPointerOut={(e) => {
                    if (planeOpacityRef.current < 0.1) return;
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
            </mesh>

            <MediaTag
                category={category}
                isGridMode={!!isGridMode}
                isFocused={!!isFocused}
                planeScale={syncState.scale}
                opacityRef={planeOpacityRef}
            />

            {/* Audio Debug Visualizers */}
            {audioDebug && !isCulled && (
                <group position={[0, 0, audioZOffset]}>
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
