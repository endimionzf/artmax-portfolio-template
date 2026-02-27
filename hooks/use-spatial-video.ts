import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';

import { videoPool } from './use-video-pool';

interface SpatialVideoResult {
    texture: THREE.VideoTexture | null;
    videoElement: HTMLVideoElement | null;
    isAcquiring: boolean;
    play: () => Promise<void>;
    pause: () => void;
    setMuted: (muted: boolean) => void;
}

const sourceNodeCache = new WeakMap<HTMLVideoElement, MediaElementAudioSourceNode>();

/**
 * useSpatialVideo
 * Best-practices hook for bridging pooled HTMLVideoElements to Three.js audio/textures.
 */
export function useSpatialVideo(
    src: string | undefined, 
    active: boolean, 
    positionalAudioRef: React.RefObject<THREE.PositionalAudio | null>
): SpatialVideoResult {
    const [texture, setTexture] = useState<THREE.VideoTexture | null>(null);
    const textureRef = useRef<THREE.VideoTexture | null>(null);
    const [isAcquiring, setIsAcquiring] = useState<boolean>(false);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
    const playbackLockRef = useRef<Promise<void> | null>(null);
    const currentSrcRef = useRef<string | undefined>(src);
    const abortControllerRef = useRef<AbortController | null>(null);

    // 1. Lifecycle: Acquire/Release Video
    useEffect(() => {
        if (!active || !src) {
            if (abortControllerRef.current) abortControllerRef.current.abort();
            
            if (videoRef.current) {
                videoRef.current.pause();
                videoPool.release(videoRef.current.src);
                videoRef.current = null;
                sourceNodeRef.current = null; 
                if (textureRef.current) {
                    textureRef.current.dispose();
                    textureRef.current = null;
                }
                setTexture(null);
                setIsAcquiring(false);
            }
            return;
        }

        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;

        // Determine the best source version based on device
        const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
        let resolvedSrc = src;
        
        if (src.endsWith('.mp4') && !src.includes('-preview') && !src.includes('-mobile') && !src.includes('-desktop')) {
            const base = src.replace('.mp4', '');
            resolvedSrc = isMobile ? `${base}-mobile.mp4` : `${base}-desktop.mp4`;
        }

        currentSrcRef.current = resolvedSrc;
        const startTime = performance.now();
        setIsAcquiring(true);
        
        // Execute the async queue acquisition
        videoPool.acquireAsync(resolvedSrc).then((video) => {
            if (signal.aborted) {
                // We got it but the component unmounted / changed active state. Throw it back!
                if (video) videoPool.release(video.src);
                return;
            }

            setIsAcquiring(false);

            if (video) {
                videoRef.current = video;
                
                // Pool now handles intelligent loading. 
                // We just ensure it's not paused if it was already on the same src.
                
                const onLoaded = () => {
                    const delta = performance.now() - startTime;
                    video.removeEventListener('loadeddata', onLoaded);
                };
                
                if (video.readyState >= 2) {
                    onLoaded();
                } else {
                    video.addEventListener('loadeddata', onLoaded);
                }

                const tex = new THREE.VideoTexture(video);
                tex.colorSpace = THREE.SRGBColorSpace;
                textureRef.current = tex;
                setTexture(tex);
            }
        });

        return () => {
            if (abortControllerRef.current) abortControllerRef.current.abort();
            
            if (videoRef.current) {
                videoPool.release(videoRef.current.src);
                videoRef.current = null;
                if (textureRef.current) {
                    textureRef.current.dispose();
                    textureRef.current = null;
                }
                setIsAcquiring(false);
            } else if (isAcquiring) {
                 // Cancel the pending queue resolution via release
                 videoPool.release(resolvedSrc);
                 setIsAcquiring(false);
            }
        };
    }, [src, active]);

    // 2. Audio Bridging
    useEffect(() => {
        const audio = positionalAudioRef.current;
        const video = videoRef.current;
        
        // Ensure everything is ready to bridge
        if (!audio || !video || !active) {
            // Cleanup previous connection if it exists
            if (audio?.source) {
                audio.disconnect();
                (audio as any).source = null;
            }
            return;
        }

        let sourceNode: MediaElementAudioSourceNode | null = null;

        try {
            const context = audio.context;
            sourceNode = sourceNodeCache.get(video) || null;
            
            if (!sourceNode || sourceNode.context !== context) {
                sourceNode = context.createMediaElementSource(video);
                sourceNodeCache.set(video, sourceNode);
            }

            // Ensure previous source is disconnected
            if (audio.source && audio.source !== sourceNode) {
                audio.disconnect();
            }
            
            audio.setNodeSource(sourceNode as any);
            sourceNodeRef.current = sourceNode;
        } catch (e) {
            console.warn("[useSpatialVideo] Audio bridge failed:", e);
        }

        return () => {
            if (audio && sourceNode) {
                try {
                    // Sever the connection between the persistent source node
                    // and the Three.js gain node. This prevents "Audio Bleed".
                    sourceNode.disconnect();
                    
                    // We DO NOT call audio.disconnect() here because in Three.js 
                    // that disconnects the gain node from the listener, silencing 
                    // the object permanently until reconnected.
                    if (audio.source === sourceNode) {
                        (audio as any).source = null;
                    }
                } catch (e) {
                    // Ignore disconnection errors during unmount or state change
                }
            }
        };
    }, [texture, active, positionalAudioRef, src]);

    // 3. Playback Controls (Promise-aware)
    const play = useCallback(async () => {
        const video = videoRef.current;
        if (!video || !active || video.paused === false) return;

        // If a play is already in progress, return it
        if (playbackLockRef.current) return playbackLockRef.current;

        try {
            playbackLockRef.current = video.play();
            await playbackLockRef.current;
        } catch (e: any) {
            if (e.name !== 'AbortError' && e.name !== 'NotSupportedError') {
                console.error(`[useSpatialVideo] Play FAILED for src: ${video.src}`, e);
            }
        } finally {
            playbackLockRef.current = null;
        }
    }, [active]);

    const pause = useCallback(() => {
        if (videoRef.current) videoRef.current.pause();
    }, []);

    const setMuted = useCallback((muted: boolean) => {
        if (videoRef.current) videoRef.current.muted = muted;
    }, []);

    return {
        texture,
        videoElement: videoRef.current,
        isAcquiring,
        play,
        pause,
        setMuted
    };
}
