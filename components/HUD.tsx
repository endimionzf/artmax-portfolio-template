import { useEffect, useState } from 'react';
import Image from 'next/image';

export interface HUDProps {
  audioEnabled: boolean;
  onToggleAudio: (state: boolean) => void;
  activeProjectInfo?: any | null;
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
  isInfoOpen?: boolean;
  onToggleInfo?: () => void;
  showRadarButton?: boolean;
  onRadarClick?: () => void;
}

export function HUD({
  audioEnabled, onToggleAudio, activeProjectInfo, onCloseInfo,
  isGridMode, onToggleGridMode, visibleLines, onToggleLine,
  journeyState, onNextJourney, onPrevJourney, maxStep, isStarted,
  isPointingAtPlane = false, onOpenContact,
  isInfoOpen = false, onToggleInfo,
  showRadarButton = false, onRadarClick
}: HUDProps) {
  // Keep a cached copy of the info so the text doesn't instantly vanish while fading out
  const [displayInfo, setDisplayInfo] = useState<any | null>(null);
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

    const checkMobileFade = () => {
      // Never fade the UI on mobile
      if (window.innerWidth < 768) {
        setIsUserActive(true);
        return true; // Indicates we handled it
      }
      return false;
    };

    let timeout: NodeJS.Timeout;
    const handleActivity = () => {
      if (checkMobileFade()) return;

      setIsUserActive(true);
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        if (!checkMobileFade()) setIsUserActive(false);
      }, 3000);
    };

    // Initial check
    if (!checkMobileFade()) {
      timeout = setTimeout(() => setIsUserActive(false), 3000);
    }

    // Also re-evaluate if window changes or journeyState changes
    window.addEventListener('resize', handleActivity);
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('mousedown', handleActivity);
    window.addEventListener('keydown', handleActivity);

    return () => {
      window.removeEventListener('resize', handleActivity);
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('mousedown', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      clearTimeout(timeout);
    };
  }, [isStarted, journeyState]);

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
              className="object-contain w-[80px] md:w-[120px] h-auto"
              priority
            />
          </button>
        </div>

        {/* Left Middle Controls: Audio & View */}
        <div className="fixed left-6 md:left-8 top-1/2 -translate-y-1/2 flex flex-col items-center gap-4 pointer-events-auto mix-blend-difference z-10">
          {isStarted && !journeyState && (
            <>
              <button
                onClick={() => onToggleGridMode?.()}
                className={`w-10 h-10 flex items-center justify-center rounded-full border border-white/30 backdrop-blur-sm transition-all hover:bg-white/10 hover:scale-110 text-white`}
                title={isGridMode ? "Switch to Explorer Mode" : "Switch to Grid Mode"}
              >
                {isGridMode ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                )}
              </button>
              <button
                onClick={() => onToggleAudio(!audioEnabled)}
                className={`w-10 h-10 flex items-center justify-center rounded-full border border-white/30 backdrop-blur-sm transition-all hover:bg-white/10 hover:scale-110 text-white`}
                title={audioEnabled ? "Mute Output" : "Enable Audio"}
              >
                {audioEnabled ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>
                )}
              </button>
              {showRadarButton && (
                <button
                  onClick={onRadarClick}
                  className="w-10 h-10 flex items-center justify-center rounded-full border border-[#FF8C00]/50 backdrop-blur-sm transition-all hover:bg-[#FF8C00]/20 hover:scale-110 text-[#FF8C00] shadow-[0_0_15px_rgba(255,140,0,0.3)] animate-pulse"
                  title="Intercept Signal"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <circle cx="12" cy="12" r="4"></circle>
                    <circle cx="12" cy="12" r="1"></circle>
                    <path d="M12 12l5-5"></path>
                  </svg>
                </button>
              )}
            </>
          )}
        </div>

        {/* Bottom Bar (Scroll Hint + Controls) */}
        <div className="flex justify-between items-end w-full relative h-32">
          {/* Left padding/placeholder */}
          <div className="w-10 md:w-32"></div>

          {/* Center: RGB Journey Controls & Slideshow Flow */}
          {isStarted && (
            <div className="flex flex-col items-center gap-6 animate-in fade-in slide-in-from-bottom-4 duration-1000">

              {/* Navigation Triangles for Journey Slideshow */}
              {journeyState && (
                <div className="fixed bottom-[15vh] md:bottom-24 left-1/2 -translate-x-1/2 flex gap-8 pointer-events-auto mix-blend-difference z-20">
                  <button
                    onClick={onPrevJourney}
                    disabled={journeyState.step === 0}
                    className={`w-12 h-12 flex items-center justify-center rounded-full border border-white/30 backdrop-blur-sm transition-all ${journeyState.step === 0 ? 'opacity-20 cursor-not-allowed' : 'opacity-100 hover:scale-110 hover:bg-white/10'}`}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                  </button>
                  <button
                    onClick={onNextJourney}
                    disabled={journeyState.step >= (maxStep || 0)}
                    className={`w-12 h-12 flex items-center justify-center rounded-full border border-white/30 backdrop-blur-sm transition-all ${journeyState.step >= (maxStep || 0) ? 'opacity-20 cursor-not-allowed' : 'opacity-100 hover:scale-110 hover:bg-white/10'}`}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                  </button>

                  <button
                    onClick={onToggleInfo}
                    className={`px-6 h-12 flex items-center justify-center rounded-full border transition-all font-bold tracking-[0.2em] text-xs uppercase ${isInfoOpen ? 'bg-white text-black border-white' : 'bg-white/10 text-white border-white/30 hover:bg-white/20'}`}
                  >
                    INFO
                  </button>
                </div>
              )}

              {/* RGB Category Buttons - Hide when focusing on a specific project */}
              {!journeyState && (
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
                    className={`flex items-center gap-2 px-4 py-2 border rounded-full transition-all duration-300 ${visibleLines.includes('ai') ? 'bg-[#00f3ff]/20 border-[#00f3ff] shadow-[0_0_15px_rgba(0,243,255,0.5)]' : 'border-white/30 hover:bg-white/10'} opacity-100`}
                  >
                    <div className={`w-2 h-2 rounded-full ${visibleLines.includes('ai') ? 'bg-[#00f3ff] shadow-[0_0_8px_#00f3ff]' : 'bg-white/70'}`} />
                    <span className={`text-xs font-bold tracking-[0.2em] uppercase ${visibleLines.includes('ai') ? 'text-[#00f3ff]' : 'text-white'}`}>AI</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Right: Empty for now */}
          <div className="w-10 md:w-32"></div>
        </div>
      </div>

      {/* Project Info Overlay */}
      <div
        className={`fixed inset-0 z-[1000] bg-[#0f0f0f]/90 backdrop-blur-2xl flex items-center justify-center cursor-pointer transition-all duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${isInfoOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={onCloseInfo}
      >
        <div
          className={`text-white w-full max-w-4xl px-8 lg:px-0 cursor-auto transition-all duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${isInfoOpen ? 'translate-y-0 opacity-100 delay-200' : 'translate-y-8 opacity-0'} max-h-[90vh] overflow-y-auto no-scrollbar`}
        >
          {/* Header */}
          <h2 className="text-4xl lg:text-6xl font-bold mb-6 tracking-tight">
            {displayInfo?.title || ''}
          </h2>

          {/* Tags */}
          {displayInfo?.tags && (
            <div className="flex flex-wrap gap-3 mb-10">
              {displayInfo.tags.split(',').map((tag: string, i: number) => (
                <span key={i} className="px-5 py-2 bg-white/10 border border-white/20 rounded-full text-xs uppercase tracking-[0.1em] text-white/90">
                  {tag.trim()}
                </span>
              ))}
            </div>
          )}

          {/* Description */}
          {displayInfo?.description && (
            <p className="text-xl lg:text-2xl text-white/85 leading-relaxed mb-12 font-light whitespace-pre-wrap max-w-3xl">
              {displayInfo.description}
            </p>
          )}

          {/* Metadata Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8 border-t border-white/10 pt-10">
            {displayInfo?.client && (
              <div>
                <h3 className="text-xs uppercase tracking-[0.2em] text-white/40 mb-2">Client</h3>
                <p className="text-lg text-white/90 whitespace-pre-wrap">{displayInfo.client}</p>
              </div>
            )}

            {displayInfo?.agency && (
              <div>
                <h3 className="text-xs uppercase tracking-[0.2em] text-white/40 mb-2">Agency</h3>
                <p className="text-lg text-white/90 whitespace-pre-wrap">{displayInfo.agency}</p>
              </div>
            )}

            {displayInfo?.production && (
              <div>
                <h3 className="text-xs uppercase tracking-[0.2em] text-white/40 mb-2">Production</h3>
                <p className="text-lg text-white/90 whitespace-pre-wrap">{displayInfo.production}</p>
              </div>
            )}

            {displayInfo?.director && (
              <div>
                <h3 className="text-xs uppercase tracking-[0.2em] text-white/40 mb-2">Director</h3>
                <p className="text-lg text-white/90 whitespace-pre-wrap">{displayInfo.director}</p>
              </div>
            )}

            {displayInfo?.producer && (
              <div>
                <h3 className="text-xs uppercase tracking-[0.2em] text-white/40 mb-2">Producer</h3>
                <p className="text-lg text-white/90 whitespace-pre-wrap">{displayInfo.producer}</p>
              </div>
            )}

            {displayInfo?.link && (
              <div className="md:col-span-2 pt-4">
                <a
                  href={displayInfo.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-2 text-sm uppercase tracking-[0.2em] font-bold text-white hover:text-white/70 transition-colors border-b border-white pb-1"
                >
                  View Project
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17L17 7" /><path d="M7 7h10v10" /></svg>
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
