'use client';

import { useState, useEffect } from 'react';

export function FullscreenButton() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    // Check initial state
    setIsFullscreen(!!document.fullscreenElement);

    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        const elem = document.documentElement as any;
        if (elem.requestFullscreen) {
          await elem.requestFullscreen();
        } else if (elem.webkitRequestFullscreen) { /* Safari */
          await elem.webkitRequestFullscreen();
        } else if (elem.msRequestFullscreen) { /* IE11 */
          await elem.msRequestFullscreen();
        }
      } else {
        const doc = document as any;
        if (doc.exitFullscreen) {
          await doc.exitFullscreen();
        } else if (doc.webkitExitFullscreen) { /* Safari */
          await doc.webkitExitFullscreen();
        } else if (doc.msExitFullscreen) { /* IE11 */
          await doc.msExitFullscreen();
        }
      }
    } catch (err: any) {
      console.error(`Error config fullscreen: ${err.message}`);
      alert("Fullscreen could not be enabled. Your browser might be blocking it.");
    }
  };

  return (
    <button
      onClick={toggleFullscreen}
      className="p-3 bg-red-600 hover:bg-red-500 text-white shadow-lg rounded-full transition-all flex items-center justify-center pointer-events-auto"
      title="Toggle Fullscreen"
    >
      {isFullscreen ? (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
      )}
    </button>
  );
}
