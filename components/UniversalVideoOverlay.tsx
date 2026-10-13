'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { useIsMobile } from '@/hooks/use-is-mobile';

interface UniversalVideoOverlayProps {
    activePlane: any | null;
    audioEnabled: boolean;
    isInfoOpen: boolean;
    onClose: () => void;
    onOpenInfo: () => void;
}

/**
 * UniversalVideoOverlay (v2.0)
 * A unified high-performance player for both YouTube-hosted and locally-hosted portfolio content.
 * 
 * Logic:
 * 1. If youtubeId exists -> Prioritize YouTube (zero storage cost, 4K quality).
 * 2. If no youtubeId -> Fallback to optimized local tiers (mobile/desktop).
 * 3. Static-First: Previews are skipped to maximize performance.
 */
export function UniversalVideoOverlay({ activePlane, audioEnabled, isInfoOpen, onClose, onOpenInfo }: UniversalVideoOverlayProps) {
    const isMobile = useIsMobile();
    const [isLoaded, setIsLoaded] = useState(false);
    
    // Diagnostic logging
    useEffect(() => {
        if (activePlane) {
            console.log(`[UniversalVideoOverlay] Active: ${activePlane.title} | YouTubeID: "${activePlane.youtubeId || 'none'}"`);
        }
    }, [activePlane?.id]);

    // Local Player State
    const videoRef = useRef<HTMLVideoElement>(null);
    const [errorCount, setErrorCount] = useState(0);
    const [isLoadingLocal, setIsLoadingLocal] = useState(true);
    const [internalMuted, setInternalMuted] = useState(true);
    const [isUIVisible, setIsUIVisible] = useState(true);
    const hideTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Audio Filter Refs (For local video muffling)
    const audioContextRef = useRef<AudioContext | null>(null);
    const filterRef = useRef<BiquadFilterNode | null>(null);
    const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
    const isAudioConnected = useRef(false);
    const playerRef = useRef<any>(null);
    const ytContainerRef = useRef<HTMLDivElement>(null);

    const youtubeId = activePlane?.youtubeId;
    const isImage = activePlane?.mediaType === 'image' || (!youtubeId && !activePlane?.srcDesktop && !activePlane?.fullSrc && !!activePlane?.posterSrc);

    // Local source resolution
    const localSources = useMemo(() => {
        if (!activePlane || youtubeId || isImage) return [];
        return [
            activePlane.srcMobile,
            activePlane.srcDesktop || activePlane.fullSrc,
            activePlane.previewSrc
        ].filter((val, index, self) => val && self.indexOf(val) === index);
    }, [activePlane?.id, youtubeId, isImage]);

    const videoSrc = localSources[errorCount] || null;

    // Reset logic on project change
    useEffect(() => {
        setIsLoaded(!!activePlane);
        setErrorCount(0);
        setIsLoadingLocal(true);
        setInternalMuted(!audioEnabled);
        setIsUIVisible(true);
        
        if (!youtubeId && videoRef.current) {
            videoRef.current.load();
        }
    }, [activePlane?.id]);

    // YouTube API Initialization
    useEffect(() => {
        if (!youtubeId || !isLoaded) {
            if (playerRef.current) {
                playerRef.current.destroy();
                playerRef.current = null;
            }
            return;
        }

        // 1. Load Script
        if (!(window as any).YT) {
            const tag = document.createElement('script');
            tag.src = "https://www.youtube.com/iframe_api";
            const firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
        }

        const initPlayer = () => {
            if (!ytContainerRef.current) return;
            if (playerRef.current) {
                try { playerRef.current.destroy(); } catch(e) {}
                playerRef.current = null;
            }
            
            playerRef.current = new (window as any).YT.Player(ytContainerRef.current, {
                width: '100%',
                height: '100%',
                videoId: youtubeId,
                playerVars: { 
                    autoplay: 1, 
                    controls: 1, 
                    rel: 0, 
                    modestbranding: 1,
                    origin: typeof window !== 'undefined' ? window.location.origin : ''
                },
                events: {
                    onReady: (event: any) => {
                        if (!playerRef.current) return;
                        // Initial sync
                        if (!audioEnabled) event.target.mute();
                        event.target.setVolume(isInfoOpen ? 20 : 100);
                    }
                }
            });
        };

        if ((window as any).YT && (window as any).YT.Player) {
            initPlayer();
        } else {
            (window as any).onYouTubeIframeAPIReady = initPlayer;
        }

        return () => {
            if (playerRef.current) {
                try {
                    playerRef.current.destroy();
                } catch (e) {
                    console.warn("[YouTube] Destroy failed:", e);
                }
                playerRef.current = null;
            }
        };
    }, [youtubeId, isLoaded]);

    // YouTube Sync Effect (Volume & Mute)
    useEffect(() => {
        if (playerRef.current && typeof playerRef.current.setVolume === 'function') {
            if (audioEnabled) {
                playerRef.current.unMute();
                playerRef.current.setVolume(isInfoOpen ? 20 : 100);
            } else {
                playerRef.current.mute();
            }
        }
    }, [isInfoOpen, audioEnabled]);

    // Visibility Timer
    const showUI = () => {
        setIsUIVisible(true);
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        hideTimerRef.current = setTimeout(() => {
            if (activePlane && !isInfoOpen) {
                setIsUIVisible(false);
            }
        }, 5000);
    };

    // Autoplay logic for local videos
    useEffect(() => {
        if (!youtubeId && !isImage && videoRef.current && isLoaded) {
            if (audioEnabled) {
                videoRef.current.muted = false;
                setInternalMuted(false);
                setupAudioNodes();
            }
            videoRef.current.play().catch(e => console.log("[VideoOverlay] Autoplay effect blocked:", e));
        }
    }, [youtubeId, isImage, isLoaded, videoSrc, audioEnabled]);

    // Sync muted state with global audioEnabled
    useEffect(() => {
        if (videoRef.current && !youtubeId && !isImage) {
            videoRef.current.muted = !audioEnabled;
            setInternalMuted(!audioEnabled);
            if (audioEnabled) setupAudioNodes();
        }
    }, [audioEnabled, youtubeId]);

    const handleManualPlayLocal = (e: React.MouseEvent) => {
        if (videoRef.current) {
            if (audioEnabled) {
                videoRef.current.muted = false;
                setInternalMuted(false);
                setupAudioNodes();
            }
            videoRef.current.play().catch(console.error);
            setIsLoadingLocal(false);
        }
    };

    const setupAudioNodes = () => {
        try {
            let ctx = audioContextRef.current;
            if (!ctx || ctx.state === 'closed') {
                const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
                ctx = new AudioContextClass();
                audioContextRef.current = ctx;
            }
            if (ctx && ctx.state === 'suspended') ctx.resume();

            if (!filterRef.current && ctx) {
                const filter = ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.value = 20000;
                filter.connect(ctx.destination);
                filterRef.current = filter;
            }

            if (!isAudioConnected.current && ctx && filterRef.current && videoRef.current) {
                if (!sourceRef.current) sourceRef.current = ctx.createMediaElementSource(videoRef.current);
                sourceRef.current.connect(filterRef.current);
                isAudioConnected.current = true;
            }
        } catch (err) { console.warn("Audio Context init failed", err); }
    };

    // Muffling Transition
    useEffect(() => {
        if (filterRef.current && audioContextRef.current) {
            const targetFreq = isInfoOpen ? 450 : 20000;
            filterRef.current.frequency.setTargetAtTime(targetFreq, audioContextRef.current.currentTime, 0.1);
        }
    }, [isInfoOpen]);

    if (!activePlane) return null;

    return (
        <div 
            className="fixed inset-0 z-[50] w-full h-[100dvh] bg-black flex flex-col pointer-events-auto transition-opacity duration-500 ease-out"
            style={{ opacity: isLoaded ? 1 : 0 }}
            onClick={showUI}
        >
            {/* Top Bar */}
            <div className={`absolute top-0 right-0 p-6 z-[60] transition-opacity duration-700 ${isUIVisible ? 'opacity-100' : 'opacity-0'}`}>
                <button
                    onClick={(e) => { e.stopPropagation(); onClose(); }}
                    className="flex items-center justify-center w-12 h-12 bg-white/5 hover:bg-white/10 text-white border border-white/20 rounded-full backdrop-blur-xl transition-all"
                >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                </button>
            </div>

            {/* Main Player Area */}
            <div className="flex-1 flex items-center justify-center p-4 md:p-12 z-[55]">
                {isImage ? (
                    /* UNIVERSAL IMAGE / SCREENSHOT VIEWER */
                    <div className={`relative flex flex-col items-center justify-center max-w-[90vw] max-h-[85vh] transition-all duration-700 ${isLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={activePlane.posterSrc || activePlane.fullSrc}
                            alt={activePlane.title || 'Portfolio Project'}
                            className="max-w-[90vw] max-h-[75vh] object-contain rounded-2xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] border border-white/10 select-none"
                            onClick={(e) => e.stopPropagation()}
                        />
                        {/* Action Bar */}
                        <div className={`mt-6 flex items-center gap-4 transition-opacity duration-500 ${isUIVisible ? 'opacity-100' : 'opacity-0'}`}>
                            <button
                                onClick={(e) => { e.stopPropagation(); onOpenInfo(); }}
                                className="px-6 py-2.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white font-mono text-xs uppercase tracking-[0.2em] backdrop-blur-md transition-all shadow-lg hover:scale-105 active:scale-95"
                            >
                                INFO
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); onClose(); }}
                                className="px-6 py-2.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white font-mono text-xs uppercase tracking-[0.2em] backdrop-blur-md transition-all hover:scale-105 active:scale-95"
                            >
                                CLOSE
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className={`relative w-full max-w-[1440px] aspect-video bg-black/40 shadow-2xl rounded-2xl overflow-hidden border border-white/5 transition-all duration-1000 ${isLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
                        
                        {/* YOUTUBE PLAYER */}
                        {youtubeId ? (
                            <div className="absolute inset-0 w-full h-full">
                                <div ref={ytContainerRef} />
                            </div>
                        ) : (
                            /* LOCAL FALLBACK PLAYER */
                            videoSrc ? (
                                <>
                                    <video
                                        ref={videoRef}
                                        key={videoSrc}
                                        src={videoSrc}
                                        autoPlay
                                        muted={internalMuted}
                                        playsInline
                                        loop
                                        className={`w-full h-full object-contain transition-opacity duration-1000 ${isLoadingLocal ? 'opacity-0' : 'opacity-100'}`}
                                        onLoadedMetadata={() => {
                                            setIsLoadingLocal(false);
                                            videoRef.current?.play().catch(e => console.log("[VideoOverlay] Autoplay blocked:", e));
                                        }}
                                        onPlaying={() => setIsLoadingLocal(false)}
                                        onError={() => setErrorCount(prev => prev + 1)}
                                    />
                                    {isLoadingLocal && (
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <div className="w-10 h-10 border-2 border-white/10 border-t-white/80 rounded-full animate-spin" />
                                        </div>
                                    )}
                                    {!isLoadingLocal && videoRef.current?.paused && (
                                        <div 
                                            className="absolute inset-0 flex items-center justify-center bg-black/20 cursor-pointer"
                                            onClick={handleManualPlayLocal}
                                        >
                                            <div className="w-20 h-20 rounded-full bg-white/10 border border-white/20 flex items-center justify-center hover:bg-white/20 transition-all">
                                                <div className="w-0 h-0 border-t-[15px] border-t-transparent border-l-[25px] border-l-white border-b-[15px] border-b-transparent ml-2" />
                                            </div>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center text-white/20 uppercase tracking-widest text-xs">
                                    No Video Content Available
                                </div>
                            )
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
