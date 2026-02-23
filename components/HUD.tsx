import { useEffect, useState } from 'react';
import Image from 'next/image';

export interface HUDProps {
  audioEnabled: boolean;
  onToggleAudio: (state: boolean) => void;
  activeProjectInfo?: { title: string } | null;
  onCloseInfo?: () => void;
  isGridMode?: boolean;
  onToggleGridMode?: () => void;
  visibleLines: string[];
  onToggleLine: (category: 'video' | '3d' | 'ai') => void;
  journeyState?: { category: 'video' | '3d' | 'ai', step: number } | null;
  onNextJourney?: () => void;
  onPrevJourney?: () => void;
  maxStep?: number;
  isStarted?: boolean;
  isPointingAtPlane?: boolean;
  onOpenContact?: () => void;
}

export function HUD({ 
  audioEnabled, onToggleAudio, activeProjectInfo, onCloseInfo, 
  isGridMode, onToggleGridMode, visibleLines, onToggleLine, 
  journeyState, onNextJourney, onPrevJourney, maxStep, isStarted,
  isPointingAtPlane = false, onOpenContact
}: HUDProps) {
  // Keep a cached copy of the info so the text doesn't instantly vanish while fading out
  const [displayInfo, setDisplayInfo] = useState<{ title: string } | null>(null);
  const [isUserActive, setIsUserActive] = useState(true);

  // Toggle global hardware cursor state
  useEffect(() => {
    if (isPointingAtPlane) {
      document.documentElement.classList.add('cursor-active');
    } else {
      document.documentElement.classList.remove('cursor-active');
    }
  }, [isPointingAtPlane]);

  useEffect(() => {
    if (!isStarted) {
      setIsUserActive(true);
      return;
    }

    let timeout: NodeJS.Timeout;
    const handleActivity = () => {
      setIsUserActive(true);
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        setIsUserActive(false);
      }, 3000);
    };

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('mousedown', handleActivity);
    window.addEventListener('keydown', handleActivity);

    // Initial timeout
    timeout = setTimeout(() => setIsUserActive(false), 3000);

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('mousedown', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      clearTimeout(timeout);
    };
  }, [isStarted]);

  useEffect(() => {
    if (activeProjectInfo) {
      setDisplayInfo(activeProjectInfo);
    }
  }, [activeProjectInfo]);

  return (
    <>
    <div className={`fixed inset-0 z-[100] pointer-events-none flex flex-col justify-between p-8 transition-opacity duration-700 ${isUserActive ? 'opacity-100' : 'opacity-0'}`}>
      {/* Top Bar (Logo + Audio Control) */}
      <div className="flex justify-between items-start w-full">
        <button 
          onClick={onOpenContact}
          className={`pointer-events-auto mix-blend-difference transition-all duration-1000 ${isStarted ? 'opacity-90 hover:opacity-50 hover:scale-105 active:scale-95' : 'opacity-20'}`}
          title="Contact Artmax Studio"
        >
          <Image 
            src="/artmax_logo.png" 
            alt="Artmax Logo" 
            width={120} 
            height={40} 
            style={{ width: '120px', height: 'auto' }}
            className="object-contain"
            priority
          />
        </button>
        
        {/* Right: Audio & Controls */}
        {isStarted && (
          <div className="flex flex-col items-end gap-2 animate-in fade-in duration-1000">
            <button 
              onClick={() => onToggleGridMode?.()}
              className={`text-white font-bold tracking-[0.2em] text-sm pointer-events-auto hover:opacity-50 transition-opacity ${isGridMode ? 'opacity-50' : ''}`}
            >
              {isGridMode ? 'VIEW: EXPLORE' : 'VIEW: GRID'}
            </button>
            <button 
              onClick={() => onToggleAudio(!audioEnabled)}
              className="text-white font-bold tracking-[0.2em] text-sm pointer-events-auto hover:opacity-50 transition-opacity"
            >
              {audioEnabled ? 'AUDIO: ON' : 'AUDIO: OFF'}
            </button>
          </div>
        )}
      </div>

      {/* Bottom Bar (Scroll Hint + Controls) */}
      <div className="flex justify-between items-end w-full relative h-32">
        {/* Empty left div to balance layout if needed, or put something here */}
        <div className="w-10"></div>
        
        {/* Center: RGB Journey Controls & Slideshow Flow */}
        {isStarted && (
          <div className="flex flex-col items-center gap-6 animate-in fade-in slide-in-from-bottom-4 duration-1000">
              
              {/* Navigation Triangles for Journey Slideshow */}
              {journeyState && (
                  <div className="flex gap-8 pointer-events-auto mix-blend-difference">
                      <button 
                        onClick={onPrevJourney}
                        disabled={journeyState.step === 0}
                        className={`w-12 h-12 flex items-center justify-center rounded-full border border-white/30 backdrop-blur-sm transition-all ${journeyState.step === 0 ? 'opacity-20 cursor-not-allowed' : 'opacity-100 hover:scale-110 hover:bg-white/10'}`}
                      >
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                      </button>
                      <button 
                        onClick={onNextJourney}
                        disabled={journeyState.step >= (maxStep || 0)}
                        className={`w-12 h-12 flex items-center justify-center rounded-full border border-white/30 backdrop-blur-sm transition-all ${journeyState.step >= (maxStep || 0) ? 'opacity-20 cursor-not-allowed' : 'opacity-100 hover:scale-110 hover:bg-white/10'}`}
                      >
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                      </button>
                  </div>
              )}

              {/* RGB Category Buttons */}
              <div className="flex gap-4 pointer-events-auto mix-blend-difference">
                 <button 
                   onClick={() => onToggleLine('video')}
                   className={`flex items-center gap-2 px-4 py-2 border rounded-full transition-all duration-300 ${visibleLines.includes('video') ? 'bg-[#ff003c]/20 border-[#ff003c] shadow-[0_0_15px_rgba(255,0,60,0.5)]' : 'border-white/30 hover:bg-white/10'} opacity-100`}
                 >
                   <div className={`w-2 h-2 rounded-full ${visibleLines.includes('video') ? 'bg-[#ff003c] shadow-[0_0_8px_#ff003c]' : 'bg-white/70'}`} />
                   <span className={`text-xs font-bold tracking-[0.2em] uppercase ${visibleLines.includes('video') ? 'text-[#ff003c]' : 'text-white'}`}>Video</span>
                 </button>

                 <button 
                   onClick={() => onToggleLine('3d')}
                   className={`flex items-center gap-2 px-4 py-2 border rounded-full transition-all duration-300 ${visibleLines.includes('3d') ? 'bg-[#00ff41]/20 border-[#00ff41] shadow-[0_0_15px_rgba(0,255,65,0.5)]' : 'border-white/30 hover:bg-white/10'} opacity-100`}
                 >
                   <div className={`w-2 h-2 rounded-full ${visibleLines.includes('3d') ? 'bg-[#00ff41] shadow-[0_0_8px_#00ff41]' : 'bg-white/70'}`} />
                   <span className={`text-xs font-bold tracking-[0.2em] uppercase ${visibleLines.includes('3d') ? 'text-[#00ff41]' : 'text-white'}`}>3D</span>
                 </button>

                 <button 
                   onClick={() => onToggleLine('ai')}
                   className={`flex items-center gap-2 px-4 py-2 border rounded-full transition-all duration-300 ${visibleLines.includes('ai') ? 'bg-[#0066ff]/20 border-[#0066ff] shadow-[0_0_15px_rgba(0,102,255,0.5)]' : 'border-white/30 hover:bg-white/10'} opacity-100`}
                 >
                   <div className={`w-2 h-2 rounded-full ${visibleLines.includes('ai') ? 'bg-[#0066ff] shadow-[0_0_8px_#0066ff]' : 'bg-white/70'}`} />
                   <span className={`text-xs font-bold tracking-[0.2em] uppercase ${visibleLines.includes('ai') ? 'text-[#0066ff]' : 'text-white'}`}>AI</span>
                 </button>
              </div>
          </div>
        )}
        
        {/* Right: Empty for now (Fullscreen removed) */}
        <div className="w-10"></div>
      </div>
    </div>
      
      {/* Project Info Overlay */}
      <div 
        className={`fixed inset-0 z-[200] bg-[#0f0f0f]/90 backdrop-blur-sm flex items-center justify-center cursor-pointer transition-all duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${activeProjectInfo ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={onCloseInfo}
      >
        {/* Prevent clicks inside the text container from closing the overlay (optional) */}
        <div 
          className={`text-white max-w-2xl px-6 lg:px-0 cursor-auto transition-all duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${activeProjectInfo ? 'translate-y-0 opacity-100 delay-200' : 'translate-y-8 opacity-0'}`}
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className="text-4xl lg:text-5xl font-bold mb-4 tracking-tight">
            {displayInfo?.title || ''}
          </h2>
          <div className="flex gap-3 mb-8">
            <span className="px-4 py-1 bg-white/10 rounded-full text-xs uppercase tracking-wider">Design</span>
            <span className="px-4 py-1 bg-white/10 rounded-full text-xs uppercase tracking-wider">WebGL</span>
          </div>
          <p className="text-lg lg:text-xl text-white/80 leading-relaxed mb-8">
            This completely decoupled HTML architecture overlays flawlessly over the 3D canvas rendering engine without 
            being aggressively forced onto the scene graph coordinate scales.
          </p>
          <div>
            <h3 className="text-sm uppercase tracking-widest text-white/50 mb-3">Highlights</h3>
            <ul className="text-white/80 space-y-2 list-disc pl-5">
              <li>Perfected UI resolution on all monitor scales</li>
              <li>Isolated React state prevents graphical glitching</li>
              <li>Unrivaled cinematic lighting retention from Canvas bounds</li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
