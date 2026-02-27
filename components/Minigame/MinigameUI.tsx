import React from 'react';

interface MinigameUIProps {
    status: 'idle' | 'invited' | 'active' | 'won' | 'rejected' | 'completed';
    onAccept: () => void;
    onReject: () => void;
    onCloseReward: () => void;
}

export function MinigameUI({ status, onAccept, onReject, onCloseReward }: MinigameUIProps) {
    if (status === 'idle' || status === 'active' || status === 'rejected' || status === 'completed') return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-md pointer-events-auto">
            <div className="bg-[#0f0f0f] border border-white/20 p-10 md:p-16 max-w-xl w-full text-center relative transition-all duration-700 animate-in fade-in zoom-in-95">
                
                {/* Decorative Corner Accents */}
                <div className="absolute top-4 left-4 w-3 h-3 border-t border-l border-white/40" />
                <div className="absolute top-4 right-4 w-3 h-3 border-t border-r border-white/40" />
                <div className="absolute bottom-4 left-4 w-3 h-3 border-b border-l border-white/40" />
                <div className="absolute bottom-4 right-4 w-3 h-3 border-b border-r border-white/40" />
                
                {status === 'invited' && (
                    <div className="flex flex-col items-center">
                        <div className="font-mono text-[10px] text-white/50 uppercase tracking-[0.4em] mb-4">
                            A Distant Murmur
                        </div>
                        <h2 className="text-2xl md:text-3xl font-black text-white tracking-[0.1em] uppercase mb-6 leading-tight">
                            Look Beyond The Known
                        </h2>
                        <p className="font-mono text-xs md:text-sm tracking-[0.1em] text-white/70 leading-loose mb-10 max-w-md">
                            Somewhere out there in the vast dark, a faint melody is calling. We have lived comfortably within these borders, but there is always something more waiting to be discovered. 
                            <br/><br/>
                            Will you untether yourself from the known grid, follow your eyes and ears, and explore the space beyond?
                        </p>
                        <div className="flex flex-col sm:flex-row gap-6 justify-center w-full">
                            <button 
                                onClick={onReject}
                                className="px-8 py-3 text-white/50 font-mono text-[11px] uppercase tracking-[0.3em] hover:text-white transition-colors duration-500"
                            >
                                Stay Here
                            </button>
                            <button 
                                onClick={onAccept}
                                className="px-8 py-3 border border-white/30 text-white font-mono text-[11px] uppercase tracking-[0.3em] hover:bg-white hover:text-black hover:border-white transition-all duration-500"
                            >
                                Explore The Dark
                            </button>
                        </div>
                    </div>
                )}

                {status === 'won' && (
                    <div className="flex flex-col items-center">
                        <div className="font-mono text-[10px] text-[#FFD700] uppercase tracking-[0.4em] mb-4">
                            The Source of the Melody
                        </div>
                        <h2 className="text-2xl md:text-3xl font-black text-white tracking-[0.1em] uppercase mb-6 leading-tight">
                            A Pale Golden Dot
                        </h2>
                        <p className="font-mono text-xs tracking-[0.1em] text-white/70 leading-loose mb-8 max-w-md">
                            You voyaged across the silence and found what was hidden. It is in our nature to explore, to reach out into the dark and find the light. For your beautiful curiosity, a token of appreciation from across the cosmos:
                        </p>
                        
                        <div className="w-full bg-white/5 border border-white/10 py-6 mb-10 flex flex-col items-center justify-center relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#FFD700]/10 to-transparent animate-pulse" />
                            <span className="font-mono text-xl md:text-2xl tracking-[0.3em] text-[#FFD700] relative z-10">
                                ARTMAXPLANET
                            </span>
                        </div>
                        
                        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40 mb-10">
                            Mention this discovery code for 10% off your next visionary project.
                        </p>
                        <button 
                            onClick={onCloseReward}
                            className="px-10 py-3 border border-white/30 text-white font-mono text-[11px] uppercase tracking-[0.3em] hover:bg-white hover:text-black hover:border-white transition-all duration-500"
                        >
                            Return Home
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
