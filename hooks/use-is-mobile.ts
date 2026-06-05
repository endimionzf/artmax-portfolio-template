import { useState, useEffect } from 'react';

/**
 * Robust mobile device detection hook.
 * Factors in touch capability, screen size, and user agent.
 */
export function useIsMobile() {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => {
            const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
            const isSmall = window.innerWidth < 1024;
            const isUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            
            // On iPads and some tablets, isUA might be false but isTouch and isSmall (in portrait) could be true.
            // We use 1024 as the threshold for 'mobile-like' behavior in this project.
            setIsMobile(isUA || (isTouch && isSmall));
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    return isMobile;
}
