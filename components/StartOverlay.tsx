'use client';

import { useState } from 'react';
import { initAudioContext } from '@/hooks/use-spatial-audio';

import { videoPool } from '@/hooks/use-video-pool';

export function StartOverlay({ onStart }: { onStart: (isGrid: boolean) => void }) {
  const [visible, setVisible] = useState(true);

  const handleStart = async (isGrid: boolean) => {
    await initAudioContext();
    // CRITICAL iOS SAFARI FIX: 
    // Safari permanently blocks video playback unless triggered directly by a user tap.
    // This primes all 6 hidden <video> elements in the pool by triggering a silent .play() and .pause().
    videoPool.prime();

    setVisible(false);
    onStart(isGrid);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0f0f0f] px-6 text-center transition-opacity duration-1000">
      <div className="max-w-3xl flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-1000">
        <h1 className="text-4xl md:text-6xl font-black text-white tracking-widest mb-8 uppercase opacity-80">
          Artmax Studio
        </h1>

        <p className="text-white/60 font-serif italic text-lg md:text-xl leading-relaxed mb-12 max-w-2xl">
          "In the vastness of light and the immensity of time, every creation is a story captured in motion. How shall we witness these artifacts of imagination?"
        </p>

        <div className="flex flex-col md:flex-row gap-6 mb-16 w-full max-w-lg">
          <button
            onClick={() => handleStart(false)}
            className="flex-1 px-8 py-4 border border-white/20 bg-white/5 backdrop-blur-md text-white font-mono text-xs uppercase tracking-[0.2em] hover:bg-white hover:text-black hover:border-white transition-all group"
          >
            <span className="block mb-1 group-hover:text-black">Explore</span>
            <span className="text-[9px] opacity-40 group-hover:opacity-100 block leading-tight">
              3D exploration<br />(but with secret discoveries)
            </span>
            <span className="text-[8px] mt-2 opacity-30 group-hover:opacity-80 block font-sans tracking-normal lowercase italic">
              Keyboard and Mouse Required
            </span>
          </button>

          <button
            onClick={() => handleStart(true)}
            className="flex-1 px-8 py-4 border border-white/20 bg-white/5 backdrop-blur-md text-white font-mono text-xs uppercase tracking-[0.2em] hover:bg-white hover:text-black hover:border-white transition-all group"
          >
            <span className="block mb-1 group-hover:text-black">Index</span>
            <span className="text-[9px] opacity-40 group-hover:opacity-100 block leading-tight">
              Classical internet experience<br />of scrolling
            </span>
          </button>
        </div>
      </div>

      <div className="flex flex-col items-center gap-4 text-white/40 text-[10px] font-mono uppercase tracking-[0.15em]">
        <div className="flex items-center gap-8">
          <span className="flex items-center gap-2">
            <span className="px-1.5 py-0.5 border border-white/20 rounded">WASD</span>
            explore
          </span>
          <span className="flex items-center gap-2">
            <span className="px-1.5 py-0.5 border border-white/20 rounded">Mouse</span>
            interact
          </span>
        </div>
        <p className="opacity-50">
          Sound Required
        </p>
      </div>
    </div>
  );
}
