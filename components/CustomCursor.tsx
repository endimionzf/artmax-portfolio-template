'use client';

import { useEffect, useState } from 'react';

export function CustomCursor() {
    const [position, setPosition] = useState({ x: -100, y: -100 });
    const [isActive, setIsActive] = useState(false);

    useEffect(() => {
        let rafId: number;

        const updatePosition = (e: MouseEvent) => {
            setPosition({ x: e.clientX, y: e.clientY });
        };

        const checkCursorState = () => {
            setIsActive(document.body.dataset.cursorType === 'info');
            rafId = requestAnimationFrame(checkCursorState);
        };

        // Attach mouse move tracker to window
        window.addEventListener('mousemove', updatePosition);
        // Start checking for data-attribute cursor state
        rafId = requestAnimationFrame(checkCursorState);

        return () => {
            window.removeEventListener('mousemove', updatePosition);
            cancelAnimationFrame(rafId);
        };
    }, []);

    return (
        <div 
            className="fixed top-0 left-0 pointer-events-none z-[9999] flex items-center justify-center rounded-full bg-black/80 backdrop-blur-md border border-white/20 text-white font-black tracking-widest text-[11px] transition-all duration-300 ease-out"
            style={{
                transform: `translate(${position.x - 45}px, ${position.y - 45}px) scale(${isActive ? 1 : 0})`,
                width: '90px',
                height: '90px',
                opacity: isActive ? 1 : 0
            }}
        >
            INFO
        </div>
    );
}
