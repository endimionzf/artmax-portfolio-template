'use client';

import { useEffect, useRef, useState, useMemo } from 'react';

interface MobileVideoOverlayProps {
    activePlane: any | null;
    audioEnabled: boolean;
    isInfoOpen: boolean;
    onClose: () => void;
    onOpenInfo: () => void;
}

import { useIsMobile } from '@/hooks/use-is-mobile';

export function MobileVideoOverlay({ activePlane, audioEnabled, isInfoOpen, onClose, onOpenInfo }: MobileVideoOverlayProps) {
    const isMobile = useIsMobile();
    const [errorCount, setErrorCount] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const videoRef = useRef<HTMLVideoElement>(null);
    const [statusText, setStatusText] = useState("Connecting...");
    const [errorLog, setErrorLog] = useState<string[]>([]);
    const [isRetrying, setIsRetrying] = useState(false);
    const [internalMuted, setInternalMuted] = useState(true);
    const [isUIVisible, setIsUIVisible] = useState(true);

    // Audio Filter Refs
    const audioContextRef = useRef<AudioContext | null>(null);
    const filterRef = useRef<BiquadFilterNode | null>(null);
    const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
    const isAudioConnected = useRef(false);
    const hideTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Source Fallback Strategy - Stabilized by ID
    const sources = useMemo(() => {
        if (!activePlane || !isMobile) return [];
        const mobile = activePlane.srcMobile;
        const desktop = activePlane.srcDesktop || activePlane.fullSrc;
        const preview = activePlane.previewSrc;

        return [
            mobile,
            preview,
            desktop
        ].filter((val, index, self) => val && self.indexOf(val) === index);
    }, [activePlane?.id, isMobile]);

    const videoSrc = sources[errorCount] || null;

    const lastPlaneIdRef = useRef<number | string | null>(null);

    // Reset state when plane changes
    useEffect(() => {
        if (!isMobile) return;

        // Skip reset if it's the same project (prevents resets when toggling info/audio)
        const currentId = activePlane?.id;
        if (currentId !== undefined && currentId === lastPlaneIdRef.current) return;
        lastPlaneIdRef.current = currentId || null;

        setErrorCount(0);
        setIsLoading(true);
        setStatusText("Connecting...");
        setErrorLog([]);
        setIsRetrying(false);
        setInternalMuted(true);

        if (activePlane) {
            console.log(`[MobileVideoOverlay] Loading: ${activePlane.title}`, sources);
        }

        // Reset audio nodes/state if source changes
        isAudioConnected.current = false;
        if (sourceRef.current) {
            sourceRef.current.disconnect();
            sourceRef.current = null;
        }
        if (filterRef.current) {
            filterRef.current.frequency.value = 20000;
        }
    }, [activePlane?.id, audioEnabled, isMobile]);

    // Synchronize mute state with the video element
    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.muted = internalMuted;
        }
    }, [internalMuted]);

    const toggleMute = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (videoRef.current) {
            const newMuted = !internalMuted;
            videoRef.current.muted = newMuted;
            setInternalMuted(newMuted);
        }
    };

    const handleError = (e: any) => {
        if (isRetrying || !videoSrc) return;

        const video = videoRef.current;
        if (!video) return;

        const error = video.error;
        const code = error ? error.code : 'Unknown';
        const url = videoSrc;
        const fileName = url.split('/').pop() || 'file';

        const nState = video.networkState;
        const rState = video.readyState;

        console.error(`[MobileVideoOverlay] FAIL: ${url} | Code: ${code} | Net: ${nState} | Ready: ${rState}`);

        let msg = "Error";
        if (code === 1) msg = "Aborted";
        else if (code === 2) msg = "Network Err";
        else if (code === 3) msg = "Decode Err";
        else if (code === 4) msg = "Codec Unsupported";
        else if (code === 'Unknown') msg = "Handshake Fail";

        const logEntry = `${fileName}: ${msg} (C:${code} N:${nState} R:${rState})`;
        setErrorLog(prev => [...prev.slice(-4), logEntry]);
        setStatusText(`${msg} [N:${nState} R:${rState}]`);
        setIsRetrying(true);

        setTimeout(() => {
            setErrorCount(prev => prev + 1);
            setIsRetrying(false);
        }, 2500);
    };

    const handleLoadedMetadata = () => {
        setIsLoading(false);
        setStatusText("Ready - Tap Screen");
        if (videoRef.current) {
            // Pre-mute to be safe during prep, but first tap will unmute
            videoRef.current.muted = true;
        }
    };

    const showUI = () => {
        setIsUIVisible(true);
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        hideTimerRef.current = setTimeout(() => {
            // Only auto-hide if video is playing and not loading
            if (videoRef.current && !videoRef.current.paused && !isLoading) {
                setIsUIVisible(false);
            }
        }, 5000);
    };

    const handleManualPlay = () => {
        showUI();
        if (videoRef.current) {
            // ONE-TAP SOUND FIX: 
            // Because this is a direct user gesture, Safari allows us to unmute 
            // and play in the same call.
            if (audioEnabled) {
                // Ensure the video element is unmuted directly in the gesture
                if (videoRef.current) {
                    videoRef.current.muted = false;
                    videoRef.current.volume = 1;
                }
                setInternalMuted(false);

                // Initialize/Resume Audio Context and Filter for Muffled Effect
                try {
                    let ctx = audioContextRef.current;
                    if (!ctx || ctx.state === 'closed') {
                        const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
                        ctx = new AudioContextClass();
                        audioContextRef.current = ctx;

                        // Re-create filter if context was closed
                        filterRef.current = null;
                        isAudioConnected.current = false;
                    }

                    let filter = filterRef.current;
                    if (!filter && ctx) {
                        filter = ctx.createBiquadFilter();
                        filter.type = 'lowpass';
                        filter.frequency.value = 20000;
                        filter.connect(ctx.destination);
                        filterRef.current = filter;
                    }

                    if (ctx && ctx.state === 'suspended') {
                        ctx.resume();
                    }

                    if (!isAudioConnected.current && ctx && filter && videoRef.current) {
                        if (!sourceRef.current) {
                            sourceRef.current = ctx.createMediaElementSource(videoRef.current);
                        }
                        sourceRef.current.connect(filter);
                        isAudioConnected.current = true;
                    }
                } catch (err) {
                    console.warn("Web Audio API not supported or failed:", err);
                }
            }

            videoRef.current.play().then(() => {
                setIsLoading(false);
                setStatusText("Live");
            }).catch(e => {
                setStatusText("Retry Tap");
                console.error("Manual play failed", e);
            });
        }
    };

    // Muffled Effect Frequency Ramp
    useEffect(() => {
        if (filterRef.current && audioContextRef.current) {
            const ctx = audioContextRef.current;
            const filter = filterRef.current;
            const now = ctx.currentTime;

            // Ensure context is running when we ramp
            if (ctx.state === 'suspended' && !isInfoOpen) {
                ctx.resume();
            }

            // 450Hz for 'underwater' muffled effect, 20000Hz for clear audio
            const targetFreq = isInfoOpen ? 450 : 20000;
            const timeConstant = isInfoOpen ? 0.05 : 0.15; // Fast ramp for better responsiveness

            filter.frequency.setTargetAtTime(targetFreq, now, timeConstant);
        }
    }, [isInfoOpen, activePlane?.id]);

    // Visibility Change & Audio Lifecycle
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && audioContextRef.current?.state === 'suspended') {
                audioContextRef.current.resume();
            }
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);
        showUI();
        
        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        };
    }, [activePlane?.id, isLoading]);

    // Video events for stability
    useEffect(() => {
        const v = videoRef.current;
        if (!v) return;

        const onWaiting = () => {}; // Could add loading spinner here if needed

        v.addEventListener('waiting', onWaiting);
        return () => {
            v.removeEventListener('waiting', onWaiting);
        };
    }, [videoSrc]);

    // Audio Context Cleanup - ONLY on Full Unmount
    useEffect(() => {
        return () => {
            if (audioContextRef.current) {
                audioContextRef.current.close().catch(console.error);
                audioContextRef.current = null;
            }
        };
    }, []);

    if (!isMobile || !activePlane || !videoSrc) return null;

    return (
        <div
            className="fixed inset-0 z-[500] w-full h-[100dvh] bg-black flex flex-col pointer-events-auto animate-in fade-in duration-500"
            onClick={showUI}
        >
            {/* Cinematic Top Bar - Fades out */}
            <div className={`absolute top-0 right-0 p-6 z-10 transition-opacity duration-1000 ${isUIVisible ? 'opacity-100' : 'opacity-0'}`}>
                <button
                    onClick={(e) => { e.stopPropagation(); onClose(); }}
                    className="flex items-center justify-center w-12 h-12 bg-white/10 hover:bg-white/20 text-white border border-white/30 rounded-full backdrop-blur-md active:scale-90 transition-all shadow-xl"
                    title="Close"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                </button>
            </div>

            <video
                ref={videoRef}
                key={videoSrc}
                src={videoSrc}
                autoPlay={false}
                muted={internalMuted}
                preload="auto"
                playsInline={true}
                webkit-playsinline="true"
                loop={true}
                className={`w-full h-full object-contain transition-opacity duration-1000 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
                onLoadedMetadata={handleLoadedMetadata}
                onPlaying={() => {
                    setIsLoading(false);
                    showUI(); // Start hide timer when playback begins
                }}
                onError={handleError}
                onWaiting={() => setIsLoading(true)}
            />

            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-12 h-12 border-2 border-white/10 border-t-white/80 rounded-full animate-spin" />
                </div>
            )}

            {/* Premium Play Overlay - Triggers Show UI */}
            {!isLoading && videoRef.current && videoRef.current.paused && (
                <div
                    className="absolute inset-0 flex flex-col items-center justify-center bg-black/20 backdrop-blur-[1px] cursor-pointer group active:scale-95 transition-all duration-500"
                    onClick={handleManualPlay}
                >
                    <div className="w-24 h-24 rounded-full bg-white/10 border border-white/20 flex items-center justify-center mb-6 shadow-[0_0_50px_rgba(255,255,255,0.1)] group-hover:bg-white/20 transition-all">
                        <div className="w-0 h-0 border-t-[18px] border-t-transparent border-l-[30px] border-l-white border-b-[18px] border-b-transparent ml-2 shadow-white" />
                    </div>
                </div>
            )}

            {/* Bottom Controls - Cinematic Centered Info Button */}
            <div className={`absolute bottom-0 left-0 right-0 p-8 pb-12 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex justify-center items-center transition-opacity duration-1000 ${isUIVisible ? 'opacity-100' : 'opacity-0'}`}>
                <button
                    onClick={(e) => { e.stopPropagation(); onOpenInfo(); }}
                    className="w-full max-w-[140px] h-12 flex items-center justify-center gap-3 bg-white/10 hover:bg-white/20 text-white border border-white/30 font-bold text-[11px] uppercase tracking-[0.2em] rounded-full backdrop-blur-md active:scale-95 transition-all shadow-[0_0_30px_rgba(255,255,255,0.1)]"
                >
                    Info
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>
                </button>
            </div>
        </div>
    );
}


