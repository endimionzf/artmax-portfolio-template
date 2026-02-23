import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';

import { videoPool } from './use-video-pool';

interface SpatialVideoResult {
    texture: THREE.VideoTexture | null;
    videoElement: HTMLVideoElement | null;
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
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
    const playbackLockRef = useRef<Promise<void> | null>(null);
    const currentSrcRef = useRef<string | undefined>(src);

    // 1. Lifecycle: Acquire/Release Video
    useEffect(() => {
        currentSrcRef.current = src;
        
        if (!active || !src) {
            if (videoRef.current) {
                videoRef.current.pause();
                videoPool.release(src || '');
                videoRef.current = null;
                sourceNodeRef.current = null; 
                setTexture(null);
            }
            return;
        }

        const startTime = performance.now();
        console.log(`[useSpatialVideo] Acquiring src: ${src}`);
        const video = videoPool.acquire(src);
        
        if (video) {
            videoRef.current = video;
            
            // Force immediate reload if src changed to ensure buffer is fresh
            video.load(); 
            
            const onLoaded = () => {
                const delta = performance.now() - startTime;
                console.log(`[useSpatialVideo] Loaded src: ${src} in ${Math.round(delta)}ms`);
                videoPool.reportLoadTime(src, Math.round(delta));
                video.removeEventListener('loadeddata', onLoaded);
            };
            
            if (video.readyState >= 2) {
                onLoaded();
            } else {
                video.addEventListener('loadeddata', onLoaded);
            }

            const tex = new THREE.VideoTexture(video);
            tex.colorSpace = THREE.SRGBColorSpace;
            setTexture(tex);
        }

        return () => {
            if (src) {
                videoPool.release(src);
                currentSrcRef.current = undefined;
            }
        };
    }, [src, active]);

    // 2. Audio Bridging
    useEffect(() => {
        const audio = positionalAudioRef.current;
        const video = videoRef.current;
        
        if (!audio || !video || !active) return;

        try {
            if (audio.source && audio.source instanceof MediaElementAudioSourceNode) {
                // Already bridged
            } else {
                const context = audio.context;
                let sourceNode = sourceNodeCache.get(video);
                
                if (!sourceNode || sourceNode.context !== context) {
                    sourceNode = context.createMediaElementSource(video);
                    sourceNodeCache.set(video, sourceNode);
                }

                audio.setNodeSource(sourceNode as any);
                sourceNodeRef.current = sourceNode;
            }
        } catch (e) {
            console.warn("[useSpatialVideo] Audio bridge failed:", e);
        }
    }, [texture, active, positionalAudioRef]);

    // 3. Playback Controls (Promise-aware)
    const play = useCallback(async () => {
        const video = videoRef.current;
        if (!video || !active) return;

        // If a play is already in progress, return it
        if (playbackLockRef.current) return playbackLockRef.current;

        try {
            playbackLockRef.current = video.play();
            await playbackLockRef.current;
            console.log(`[useSpatialVideo] Play SUCCESS for src: ${video.src}`);
        } catch (e: any) {
            if (e.name !== 'AbortError') {
                console.error(`[useSpatialVideo] Play FAILED for src: ${video.src}`, e);
                throw e;
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
        play,
        pause,
        setMuted
    };
}
