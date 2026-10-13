'use client';

import * as THREE from 'three';
import { StartOverlay } from '@/components/StartOverlay';
import { ContactOverlay } from '@/components/ContactOverlay';
import { Canvas } from '@react-three/fiber';
import { Experience } from '@/components/Experience';
import { Suspense, useState, useEffect, useCallback, useMemo } from 'react';
import { HUD } from '@/components/HUD';

import { Leva } from 'leva';
import { resumeAudioContext } from '@/hooks/use-spatial-audio';
import { ResourceMonitor } from '@/components/ResourceMonitor';
import { videoPool } from '@/hooks/use-video-pool';
import { MinigameUI } from '@/components/Minigame/MinigameUI';
import { UniversalVideoOverlay } from '@/components/UniversalVideoOverlay';
import { useIsMobile } from '@/hooks/use-is-mobile';


export default function Home() {
  const isMobile = useIsMobile();
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
  const [journeyState, setJourneyState] = useState<{ category: string, step: number } | null>(null);
  // We need to know max planes to bound the next/prev buttons, Experience can bubble this up
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});

  const toggleLine = (category: string) => {
    setVisibleLines(prev => prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]);
  };

  const handleNextJourney = useCallback(() => {
    if (journeyState) {
      const max = (categoryCounts[journeyState.category] || 1) - 1;
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
    const counts: Record<string, number> = {};
    planes.forEach(p => {
      if (p.category) {
        counts[p.category] = (counts[p.category] || 0) + 1;
      }
    });
    setCategoryCounts(counts);
  }, []);

  const handleFocusClear = useCallback(() => {
    setActiveProjectInfo(null);
    setJourneyState(null);
    setIsInfoOpen(false);
  }, []);

  const handlePlaneClick = useCallback((category: string, indexInCategory: number) => {
    console.log(`[Page] handlePlaneClick - Category: ${category}, IndexInCategory: ${indexInCategory}`);
    setJourneyState({ category, step: indexInCategory });
  }, []);

  const handleOpenInfo = useCallback((planeData: any) => {
    setActiveProjectInfo(planeData);
  }, []);

  const handleJourneyLineClick = useCallback((category: string) => {
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
  const focusedPlane = useMemo(() => {
    if (!journeyState || currentPlanes.length === 0) return null;
    const catPlanes = currentPlanes.filter(p => p.category === journeyState.category);
    // Safety check: ensure step is within bounds
    const safeStep = Math.min(Math.max(0, journeyState.step), catPlanes.length - 1);
    return catPlanes[safeStep] || null;
  }, [journeyState, currentPlanes]);

  // Minigame Timer (Show radar button after 15s)
  useEffect(() => {
    // Only run timer if minigame is idle or was previously rejected
    if (isStarted && (minigameStatus === 'idle' || minigameStatus === 'rejected') && !radarButtonVisible) {
      const timer = setTimeout(() => {
        setRadarButtonVisible(true);
      }, 15000); // 15 seconds
      return () => clearTimeout(timer);
    }
  }, [isStarted, minigameStatus, radarButtonVisible]);

  return (
    <main className="relative w-full h-[100dvh] overflow-hidden bg-[#0a0a0a]">
      {showDebug && <ResourceMonitor />}
      <Leva hidden={!showDebug} />
      <StartOverlay onStart={(initialGrid) => {
        setAudioEnabled(true);
        setIsGridMode(initialGrid);
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
          style={{ touchAction: 'none' }}
          camera={{ position: [0, 0, 40], fov: 50, near: 0.01, far: 1000 }}
          gl={{
            antialias: true,
            alpha: true,
            powerPreference: "high-performance",
            stencil: false,
            depth: true
          }}
        >
          <color attach="background" args={['#0f0f0f']} />
          <primitive object={new THREE.FogExp2('#0f0f0f', 0.03)} attach="fog" />
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
        onToggleAudio={(enabled) => {
          if (enabled) resumeAudioContext();
          setAudioEnabled(enabled);
        }}
        activeProjectInfo={activeProjectInfo || focusedPlane}
        isGridMode={isGridMode}
        onToggleGridMode={() => {
          resumeAudioContext();
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
        onBack={handleFocusClear}
        showRadarButton={radarButtonVisible}
        onRadarClick={() => {
          setRadarButtonVisible(false); // Hide the button
          setMinigameStatus('invited'); // Show the popup
        }}
      />



      <UniversalVideoOverlay
        activePlane={focusedPlane}
        audioEnabled={effectiveAudioEnabled}
        isInfoOpen={isInfoOpen}
        onClose={handleFocusClear}
        onOpenInfo={() => setIsInfoOpen(true)}
      />

      <MinigameUI
        status={minigameStatus}
        onAccept={() => {
          // Force switch to Explorer mode if in Grid mode or Focused
          if (isGridMode) {
            setIsGridMode(false);
            setVisibleLines([]); // Clean slate for Explorer mode
          }
          if (journeyState) {
            handleFocusClear();
          }
          setMinigameStatus('active');
        }}
        onReject={() => setMinigameStatus('rejected')} // End game flow, restarts the 60s timer
        onCloseReward={() => setMinigameStatus('completed')} // Close cleanly, button disappears forever
      />
    </main>
  );
}
