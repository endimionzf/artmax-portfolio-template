'use client';

import { StartOverlay } from '@/components/StartOverlay';
import { ContactOverlay } from '@/components/ContactOverlay';
import { Canvas } from '@react-three/fiber';
import { Experience } from '@/components/Experience';
import { Suspense, useState, useEffect, useCallback } from 'react';
import { HUD } from '@/components/HUD';
import { Joystick } from '@/components/Joystick';
import { Leva } from 'leva';
import { resumeAudioContext } from '@/hooks/use-spatial-audio';
import { ResourceMonitor } from '@/components/ResourceMonitor';
import { videoPool } from '@/hooks/use-video-pool';
import { MinigameUI } from '@/components/Minigame/MinigameUI';


export default function Home() {
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [activeProjectInfo, setActiveProjectInfo] = useState<any | null>(null);
  const [currentPlanes, setCurrentPlanes] = useState<any[]>([]);
  const [isGridMode, setIsGridMode] = useState(false);
  const [visibleLines, setVisibleLines] = useState<string[]>([]);
  const [isStarted, setIsStarted] = useState(false);
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  
  // Game State
  const [minigameStatus, setMinigameStatus] = useState<'idle' | 'invited' | 'active' | 'won' | 'rejected' | 'completed'>('idle');
  const [radarButtonVisible, setRadarButtonVisible] = useState(false);
  
  // Production Readiness: Hide Leva unless ?debug=true is present
  const [showDebug, setShowDebug] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setShowDebug(params.get('debug') === 'true' || process.env.NODE_ENV === 'development');
  }, []);
  
  // Controls the fixed slideshow sequence length based on user click
  const [journeyState, setJourneyState] = useState<{ category: 'video'|'3d'|'ai', step: number } | null>(null);
  // We need to know max planes to bound the next/prev buttons, Experience can bubble this up
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({ video: 0, '3d': 0, 'ai': 0 });

  const toggleLine = (category: 'video'|'3d'|'ai') => {
      setVisibleLines(prev => prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]);
  };

  const handleNextJourney = useCallback(() => {
      if (journeyState) {
          const max = categoryCounts[journeyState.category] - 1;
          setJourneyState({ ...journeyState, step: Math.min(journeyState.step + 1, max) });
      }
  }, [journeyState, categoryCounts]);

  const handlePrevJourney = useCallback(() => {
      if (journeyState) {
          setJourneyState({ ...journeyState, step: Math.max(journeyState.step - 1, 0) });
      }
  }, [journeyState]);

  const handlePlanesLoaded = useCallback((planes: any[]) => {
      setCurrentPlanes(planes);
      setCategoryCounts({
          video: planes.filter(p => p.category === 'video').length,
          '3d': planes.filter(p => p.category === '3d').length,
          ai: planes.filter(p => p.category === 'ai').length
      });
  }, []);

  const handleFocusClear = useCallback(() => {
      setActiveProjectInfo(null);
      setJourneyState(null);
      setIsInfoOpen(false);
  }, []);

  const handlePlaneClick = useCallback((category: 'video'|'3d'|'ai', indexInCategory: number) => {
      setJourneyState({ category, step: indexInCategory });
  }, []);

  const handleOpenInfo = useCallback((planeData: any) => {
      setActiveProjectInfo(planeData);
  }, []);

  const handleJourneyLineClick = useCallback((category: 'video'|'3d'|'ai') => {
      if (journeyState?.category === category) {
        setJourneyState(null);
      } else {
        setJourneyState({ category, step: 0 });
        if (!visibleLines.includes(category)) {
            setVisibleLines(prev => [...prev, category]);
        }
      }
  }, [journeyState, visibleLines]);

  const [isPointingAtPlane, setIsPointingAtPlane] = useState(false);

  // Mute audio when contact overlay is open
  const effectiveAudioEnabled = audioEnabled && !isContactOpen;

  // Auto-detect the focused plane for the INFO button
  const focusedPlane = journeyState 
    ? currentPlanes.filter(p => p.category === journeyState.category)[journeyState.step] 
    : null;

  // Minigame Timer (Show radar button after 60s of normal Explorer mode)
  useEffect(() => {
    // Only run timer if we are in explorer mode, no project focused, and minigame is either idle or was previously rejected
    if (isStarted && !isGridMode && !journeyState && (minigameStatus === 'idle' || minigameStatus === 'rejected') && !radarButtonVisible) {
      const timer = setTimeout(() => {
        setRadarButtonVisible(true);
      }, 60000); // 60 seconds
      return () => clearTimeout(timer);
    }
  }, [isStarted, isGridMode, journeyState, minigameStatus, radarButtonVisible]);

  return (
    <main className="relative w-full h-[100dvh] overflow-hidden bg-[#0a0a0a]">
      {showDebug && <ResourceMonitor />}
      <Leva hidden={!showDebug} />
      <StartOverlay onStart={() => { 
        import('@/hooks/use-spatial-audio').then(({ initAudioContext }) => {
            initAudioContext();
        });
        videoPool.prime();
        setAudioEnabled(true); 
        setIsStarted(true); 
      }} />

      <ContactOverlay 
        isOpen={isContactOpen} 
        onClose={() => setIsContactOpen(false)} 
      />

      {/* Background Ambience */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-[#111] to-black opacity-40 z-0" />
      
      {/* 3D Scene */}
      <div className="w-full h-full">
        <Canvas 
          shadows 
          dpr={[1, 2]} 
          camera={{ position: [0, 0, 40], fov: 50, near: 0.1, far: 1000 }}
          gl={{ 
            antialias: true,
            alpha: true,
            powerPreference: "high-performance",
            stencil: false,
            depth: true
          }}
        >
          <color attach="background" args={['#0f0f0f']} />
          <Suspense fallback={null}>
            <Experience 
              isStarted={isStarted}
              audioEnabled={effectiveAudioEnabled} 
              isGridMode={isGridMode}
              visibleLines={visibleLines}
              journeyState={journeyState}
              isInfoOpen={isInfoOpen}
              onFocusClear={handleFocusClear}
              onPlaneClick={handlePlaneClick}
              onOpenInfo={handleOpenInfo}
              onPlanesLoaded={handlePlanesLoaded}
              onJourneyLineClick={handleJourneyLineClick}
              onCenterPoint={setIsPointingAtPlane}
              minigameStatus={minigameStatus}
              onDiscountUnlocked={() => setMinigameStatus('won')}
            />
          </Suspense>
        </Canvas>
      </div>

      <HUD 
          isStarted={isStarted}
          audioEnabled={audioEnabled} 
          onToggleAudio={setAudioEnabled} 
          activeProjectInfo={activeProjectInfo || focusedPlane}
          isGridMode={isGridMode}
          onToggleGridMode={() => {
            const nextGridMode = !isGridMode;
            setIsGridMode(nextGridMode);
            if (nextGridMode) {
              setVisibleLines([]); // Default to no tags selected to show everything
            } else {
              setVisibleLines([]); // Clean slate for Explorer mode
            }
          }}
          visibleLines={visibleLines}
          onToggleLine={toggleLine}
          journeyState={journeyState}
          onNextJourney={handleNextJourney}
          onPrevJourney={handlePrevJourney}
          maxStep={journeyState ? categoryCounts[journeyState.category] - 1 : 0}
          isPointingAtPlane={isPointingAtPlane}
          onOpenContact={() => setIsContactOpen(true)}
          isInfoOpen={isInfoOpen}
          onToggleInfo={() => setIsInfoOpen(!isInfoOpen)}
          onCloseInfo={() => { 
            setActiveProjectInfo(null); 
            setIsInfoOpen(false);
          }}
          showRadarButton={radarButtonVisible}
          onRadarClick={() => {
              setRadarButtonVisible(false); // Hide the button
              setMinigameStatus('invited'); // Show the popup
          }}
      />
      
      <Joystick isStarted={isStarted} isGridMode={isGridMode} isFocused={!!journeyState} />

      <MinigameUI 
          status={minigameStatus}
          onAccept={() => setMinigameStatus('active')}
          onReject={() => setMinigameStatus('rejected')} // End game flow, restarts the 60s timer
          onCloseReward={() => setMinigameStatus('completed')} // Close cleanly, button disappears forever
      />
    </main>
  );
}
