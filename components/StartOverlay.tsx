'use client';

import { useState } from 'react';
import { initAudioContext } from '@/hooks/use-spatial-audio';

export function StartOverlay({ onStart }: { onStart: () => void }) {
  const [visible, setVisible] = useState(true);

  const handleStart = async () => {
     await initAudioContext();
     setVisible(false);
     onStart();
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0f0f0f] transition-opacity duration-1000">
      <h1 className="text-4xl md:text-6xl font-black text-white tracking-widest mb-12 uppercase">
          Artmax Studio
      </h1>
      <button 
         onClick={handleStart}
         className="px-8 py-3 border border-white text-white font-mono text-sm uppercase tracking-[0.2em] hover:bg-white hover:text-black transition-all mb-12"
      >
        Enter Experience
      </button>

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
