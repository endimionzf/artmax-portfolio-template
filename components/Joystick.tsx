'use client';

import { useEffect, useRef, useState } from 'react';

// Global state for the camera rig to read without React re-renders hitting the main thread
export const joystickState = { y: 0, active: false };

export function Joystick({ isStarted, isGridMode, isFocused }: { isStarted?: boolean, isGridMode?: boolean, isFocused?: boolean }) {
    const [isVisible, setIsVisible] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const knobRef = useRef<HTMLDivElement>(null);
    const fadeTimeout = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        const checkMobile = () => {
            const mobile = window.innerWidth < 768;
            setIsMobile(mobile);
            if (mobile) {
                // Initial show on mobile
                showTemporary();
            }
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const showTemporary = () => {
        setIsVisible(true);
        if (fadeTimeout.current) clearTimeout(fadeTimeout.current);
        fadeTimeout.current = setTimeout(() => {
            if (!joystickState.active) setIsVisible(false);
        }, 5000);
    };

    // Wake up joystick on any screen touch
    useEffect(() => {
        const wake = () => {
            if (isMobile) showTemporary();
        };
        window.addEventListener('touchstart', wake, { passive: true });
        return () => window.removeEventListener('touchstart', wake);
    }, [isMobile]);

    if (!isMobile || !isStarted || isGridMode || isFocused) return null;

    const handlePointerDown = (e: React.PointerEvent) => {
        e.stopPropagation();
        e.nativeEvent.stopImmediatePropagation();
        (e.target as Element).setPointerCapture(e.pointerId);
        joystickState.active = true;
        setIsVisible(true);
        if (fadeTimeout.current) clearTimeout(fadeTimeout.current);
        handlePointerMove(e);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!joystickState.active || !containerRef.current || !knobRef.current) return;
        e.stopPropagation();
        e.nativeEvent.stopImmediatePropagation();
        
        const rect = containerRef.current.getBoundingClientRect();
        
        // Calculate Y position relative to center of container
        const centerY = rect.top + rect.height / 2;
        const maxDist = rect.height / 2;
        let deltaY = e.clientY - centerY;
        
        // Clamp
        if (deltaY < -maxDist) deltaY = -maxDist;
        if (deltaY > maxDist) deltaY = maxDist;
        
        // Update visual knob
        knobRef.current.style.transform = `translate(-50%, calc(-50% + ${deltaY}px))`;
        
        // Update exported state (-1 to 1)
        // Reversed: Pushing UP (negative deltaY) output becomes positive -> Moves Forward
        joystickState.y = -(deltaY / maxDist);
    };

    const handlePointerEnd = (e: React.PointerEvent) => {
        e.stopPropagation();
        e.nativeEvent.stopImmediatePropagation();
        (e.target as Element).releasePointerCapture(e.pointerId);
        joystickState.active = false;
        joystickState.y = 0;
        
        if (knobRef.current) {
            knobRef.current.style.transform = `translate(-50%, -50%)`;
            knobRef.current.style.transition = `transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)`;
        }
        
        showTemporary();
    };

    return (
        <div 
            className={`fixed bottom-24 right-8 z-[150] w-16 h-48 transition-opacity duration-1000 ${isVisible ? 'opacity-100' : 'opacity-0'} pointer-events-none`}
        >
            <div className="flex flex-col items-center justify-between h-full w-full pointer-events-none opacity-50">
                <div className="text-white text-[10px] font-bold tracking-widest p-2">FWD</div>
                <div className="w-[1px] h-full bg-gradient-to-b from-white/30 via-white/10 to-white/30" />
                <div className="text-white text-[10px] font-bold tracking-widest p-2">BCK</div>
            </div>
            
            {/* Active Touch Area */}
            <div 
                ref={containerRef}
                className="absolute inset-0 pointer-events-auto touch-none"
                onPointerDown={(e) => {
                    if (knobRef.current) knobRef.current.style.transition = 'none';
                    handlePointerDown(e);
                }}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerEnd}
                onPointerCancel={handlePointerEnd}
            >
                {/* The Knob */}
                <div 
                    ref={knobRef}
                    className="absolute top-1/2 left-1/2 w-12 h-12 bg-white/20 border border-white/50 backdrop-blur-md rounded-full shadow-[0_0_15px_rgba(255,255,255,0.2)] -translate-x-1/2 -translate-y-1/2 flex items-center justify-center"
                >
                    <div className="w-4 h-4 rounded-full bg-white/80" />
                </div>
            </div>
        </div>
    );
}
