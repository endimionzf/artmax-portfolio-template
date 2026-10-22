import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

import siteConfig from '@/site.config.json';
import { withBasePath } from '@/utils/basepath';

export interface HUDProps {
  audioEnabled: boolean;
  onToggleAudio: (state: boolean) => void;
  activeProjectInfo?: any | null;
  onCloseInfo?: () => void;
  isGridMode?: boolean;
  onToggleGridMode?: () => void;
  visibleLines: string[];
  onToggleLine: (category: string) => void;
  journeyState?: { category: string, step: number } | null;
  categories?: Array<{ id: string, label: string, color: string, curvePreset?: string }>;
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
  onBack?: () => void;
}

export function HUD({
  audioEnabled, onToggleAudio, activeProjectInfo, onCloseInfo,
  isGridMode, onToggleGridMode, visibleLines, onToggleLine,
  journeyState, onNextJourney, onPrevJourney, maxStep, isStarted,
  isPointingAtPlane = false, onOpenContact,
  isInfoOpen = false, onToggleInfo,
  showRadarButton = false, onRadarClick,
  onBack,
  categories
}: HUDProps) {
  // Keep a cached copy of the info so the text doesn't instantly vanish while fading out
  const [displayInfo, setDisplayInfo] = useState<any | null>(null);
  const [isUserActive, setIsUserActive] = useState(true);
  const [logoError, setLogoError] = useState(false);

  const configuredCategories = categories || (siteConfig.categories as Array<{ id: string, label: string, color: string, curvePreset?: string }> | undefined) || [
    { id: 'video', label: 'Video', color: '#ff003c' },
    { id: '3d', label: '3D', color: '#00ff41' },
    { id: 'ai', label: 'AI', color: '#0066ff' }
  ];

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

  const branding = (siteConfig as any).branding || {};
  const navigation = (siteConfig as any).navigation || {};
  const messages = (siteConfig as any).messages || {};

  return (
    <>
      <div className={`fixed inset-0 z-[100] pointer-events-none flex flex-col justify-between p-8 transition-opacity duration-700 ${isUserActive ? 'opacity-100' : 'opacity-0'}`}>
        {/* Top Bar (Logo + Audio Control) */}
        <div className="flex justify-between items-start w-full">
          <div className="flex flex-col gap-4 items-start pointer-events-auto">
            <button
              onClick={onOpenContact}
              className={`mix-blend-difference transition-all duration-1000 ${isStarted ? 'opacity-90 hover:opacity-50 hover:scale-105 active:scale-95' : 'opacity-20'}`}
              title={branding.contactButtonTitle || 'Contact'}
            >
              {branding.logoType === 'text' || !branding.logoImage || logoError ? (
                <span className="text-xl md:text-2xl font-black text-white tracking-widest uppercase">
                  {branding.logoText || siteConfig.site?.title || 'Studio'}
                </span>
              ) : (
                <Image
                  src={withBasePath(branding.logoImage || '/artmax_logo.png')}
                  alt={branding.logoAlt || 'Studio Logo'}
                  width={120}
                  height={40}
                  className="object-contain w-[80px] md:w-[120px] h-auto"
                  priority
                  onError={() => setLogoError(true)}
                />
              )}
            </button>

            {isStarted && navigation.showJournalLink !== false && (
              <Link 
                href={navigation.journalLinkUrl || '/blog'} 
                className="text-[10px] font-mono tracking-[0.3em] uppercase text-white/40 hover:text-white transition-opacity duration-1000 mix-blend-difference"
              >
                {navigation.journalLinkText || '// Journey_Log'}
              </Link>
            )}
          </div>
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
                <div className="fixed bottom-[15vh] md:bottom-10 left-1/2 -translate-x-1/2 flex gap-8 pointer-events-auto z-20 bg-black/20 backdrop-blur-md px-6 py-3 rounded-full border border-white/5 shadow-2xl transition-all duration-500">
                  <button
                    onClick={onBack}
                    className="px-6 h-12 flex items-center justify-center rounded-full border bg-white/10 text-white border-white/30 hover:bg-white/20 transition-all font-bold tracking-[0.2em] text-xs uppercase"
                  >
                    {messages.backButton || 'BACK'}
                  </button>

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
                    {messages.infoButton || 'INFO'}
                  </button>
                </div>
              )}

              {/* Dynamic Category Buttons - Hide when focusing on a specific project */}
              {!journeyState && (
                <div className="flex flex-wrap justify-center gap-4 pointer-events-auto mix-blend-difference">
                  {configuredCategories.map((cat) => {
                    const isLineVisible = visibleLines.includes(cat.id);
                    return (
                      <button
                        key={cat.id}
                        onClick={() => onToggleLine(cat.id)}
                        className={`flex items-center gap-2 px-4 py-2 border rounded-full transition-all duration-300 ${isLineVisible ? 'hover:scale-105' : 'border-white/30 hover:bg-white/10'}`}
                        style={{
                          borderColor: isLineVisible ? cat.color : undefined,
                          backgroundColor: isLineVisible ? `${cat.color}25` : undefined,
                          boxShadow: isLineVisible ? `0 0 15px ${cat.color}80` : undefined,
                        }}
                      >
                        <div
                          className="w-2 h-2 rounded-full transition-all"
                          style={{
                            backgroundColor: isLineVisible ? cat.color : 'rgba(255, 255, 255, 0.7)',
                            boxShadow: isLineVisible ? `0 0 8px ${cat.color}` : undefined,
                          }}
                        />
                        <span
                          className="text-xs font-bold tracking-[0.2em] uppercase transition-colors"
                          style={{ color: isLineVisible ? cat.color : '#ffffff' }}
                        >
                          {cat.label}
                        </span>
                      </button>
                    );
                  })}
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
          className={`text-white w-full max-w-4xl px-8 lg:px-0 cursor-auto transition-all duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${isInfoOpen ? 'translate-y-0 opacity-100 delay-200' : 'translate-y-8 opacity-0'} max-h-[90vh] overflow-y-auto no-scrollbar pb-32`}
        >
          {/* Header */}
          <h2 className="text-4xl lg:text-6xl font-bold mb-6 tracking-tight">
            {displayInfo?.title || ''}
          </h2>

          {/* Tech Stack Pills (Monospace neon aesthetic) */}
          {(displayInfo?.techStack || displayInfo?.tech_stack) && (
            <div className="mb-8">
              <h3 className="text-xs uppercase tracking-[0.2em] text-cyan-400/80 mb-3 font-mono">
                {messages.techStackHeader || '// Tech_Stack'}
              </h3>
              <div className="flex flex-wrap gap-2">
                {(Array.isArray(displayInfo.techStack)
                  ? displayInfo.techStack
                  : String(displayInfo.techStack || displayInfo.tech_stack).split(',')
                )
                  .map((t: string) => t.trim())
                  .filter(Boolean)
                  .map((tech: string, i: number) => (
                    <span
                      key={i}
                      className="px-3.5 py-1.5 bg-cyan-950/40 border border-cyan-400/40 text-cyan-300 rounded-md text-xs font-mono tracking-wider shadow-[0_0_12px_rgba(6,182,212,0.15)]"
                    >
                      {tech}
                    </span>
                  ))}
              </div>
            </div>
          )}

          {/* General Tags */}
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
            {displayInfo?.role && (
              <div>
                <h3 className="text-xs uppercase tracking-[0.2em] text-white/40 mb-2 font-mono">Role</h3>
                <p className="text-lg text-white/90 whitespace-pre-wrap">{displayInfo.role}</p>
              </div>
            )}

            {displayInfo?.client && (
              <div>
                <h3 className="text-xs uppercase tracking-[0.2em] text-white/40 mb-2 font-mono">Client</h3>
                <p className="text-lg text-white/90 whitespace-pre-wrap">{displayInfo.client}</p>
              </div>
            )}

            {displayInfo?.year && (
              <div>
                <h3 className="text-xs uppercase tracking-[0.2em] text-white/40 mb-2 font-mono">Year</h3>
                <p className="text-lg text-white/90 whitespace-pre-wrap">{displayInfo.year}</p>
              </div>
            )}

            {displayInfo?.agency && (
              <div>
                <h3 className="text-xs uppercase tracking-[0.2em] text-white/40 mb-2 font-mono">Agency</h3>
                <p className="text-lg text-white/90 whitespace-pre-wrap">{displayInfo.agency}</p>
              </div>
            )}

            {displayInfo?.production && (
              <div>
                <h3 className="text-xs uppercase tracking-[0.2em] text-white/40 mb-2 font-mono">Production</h3>
                <p className="text-lg text-white/90 whitespace-pre-wrap">{displayInfo.production}</p>
              </div>
            )}

            {displayInfo?.director && (
              <div>
                <h3 className="text-xs uppercase tracking-[0.2em] text-white/40 mb-2 font-mono">Director</h3>
                <p className="text-lg text-white/90 whitespace-pre-wrap">{displayInfo.director}</p>
              </div>
            )}

            {displayInfo?.producer && (
              <div>
                <h3 className="text-xs uppercase tracking-[0.2em] text-white/40 mb-2 font-mono">Producer</h3>
                <p className="text-lg text-white/90 whitespace-pre-wrap">{displayInfo.producer}</p>
              </div>
            )}

            {/* Dynamic Custom Roles & Credits */}
            {displayInfo?.customRoles &&
              Object.entries(displayInfo.customRoles).map(([roleKey, roleValue]) => {
                if (!roleValue || !String(roleValue).trim()) return null;
                return (
                  <div key={roleKey}>
                    <h3 className="text-xs uppercase tracking-[0.2em] text-white/40 mb-2 font-mono">{roleKey}</h3>
                    <p className="text-lg text-white/90 whitespace-pre-wrap">{String(roleValue)}</p>
                  </div>
                );
              })}

            {/* Context-Aware Smart Link */}
            {displayInfo?.link && (
              <div className="md:col-span-2 pt-4">
                {(() => {
                  const link = displayInfo.link.trim();
                  const isBlog = link.startsWith('/blog') || link.startsWith('blog/');
                  const isGitHub = link.includes('github.com');
                  const formattedLink = link.startsWith('http') || link.startsWith('/') ? link : `/${link}`;

                  if (isBlog) {
                    return (
                      <Link
                        href={formattedLink}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-cyan-950/60 border border-cyan-400/50 text-cyan-300 hover:bg-cyan-900/60 transition-all font-mono text-xs uppercase tracking-[0.2em] shadow-[0_0_15px_rgba(6,182,212,0.2)] hover:scale-105 active:scale-95"
                      >
                        Read Case Study / Article →
                      </Link>
                    );
                  }

                  if (isGitHub) {
                    return (
                      <a
                        href={link.startsWith('http') ? link : `https://${link}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-white/10 border border-white/30 text-white hover:bg-white/20 transition-all font-mono text-xs uppercase tracking-[0.2em] shadow-lg hover:scale-105 active:scale-95"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                          <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                        </svg>
                        View on GitHub
                      </a>
                    );
                  }

                  return (
                    <a
                      href={link.startsWith('http') ? link : `https://${link}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-2 text-sm uppercase tracking-[0.2em] font-bold text-white hover:text-white/70 transition-colors border-b border-white pb-1"
                    >
                      Live Project / Demo ↗
                    </a>
                  );
                })()}
              </div>
            )}
          </div>
        </div>

        {/* Floating Back Button for Info Mode */}
        <div 
          className={`fixed bottom-12 left-1/2 -translate-x-1/2 z-[1001] transition-all duration-700 delay-500 ${isInfoOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-4 pointer-events-none'}`}
        >
          <button
            onClick={onCloseInfo}
            className="px-10 h-14 flex items-center justify-center rounded-full border bg-white text-black border-white hover:bg-black hover:text-white transition-all font-bold tracking-[0.3em] text-xs uppercase shadow-[0_20px_40px_rgba(0,0,0,0.3)]"
          >
            BACK
          </button>
        </div>
      </div>
    </>
  );
}
