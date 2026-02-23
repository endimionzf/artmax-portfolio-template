'use client';

import { useEffect, useState } from 'react';
import { videoPool } from '@/hooks/use-video-pool';

export function ResourceMonitor() {
    const [stats, setStats] = useState<any>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const unsubscribe = videoPool.subscribe(setStats);
        
        // Toggle with 'D' key (for Diagnostics)
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key.toLowerCase() === 'd' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                setIsVisible(v => !v);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            unsubscribe();
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    if (!isVisible || !stats) return null;

    return (
        <div className="fixed top-4 left-4 z-[1000] bg-black/90 text-[10px] font-mono p-4 border border-white/20 text-white/90 min-w-[240px] shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-3 border-b border-white/10 pb-2">
                <span className="font-bold tracking-widest uppercase text-white">Resource Monitor</span>
                <span className="bg-white/10 px-1 rounded text-[8px]">CMD+D TO HIDE</span>
            </div>

            <div className="space-y-4">
                {/* Pool Status */}
                <section>
                    <div className="flex justify-between mb-1">
                        <span className="text-white/50">VIDEO POOL</span>
                        <span>{stats.active} / {stats.pooled + stats.active} ACTIVE</span>
                    </div>
                    <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-blue-500 transition-all duration-500" 
                            style={{ width: `${(stats.active / (stats.pooled + stats.active)) * 100}%` }}
                        />
                    </div>
                </section>

                {/* Acquisition Stats */}
                <section className="grid grid-cols-2 gap-2">
                    <div className="bg-white/5 p-2 rounded">
                        <div className="text-white/40 uppercase mb-1">Total Hits</div>
                        <div className="text-sm font-bold">{stats.totalAcquisitions}</div>
                    </div>
                    <div className="bg-white/5 p-2 rounded">
                        <div className="text-white/40 uppercase mb-1 text-red-400">Failures</div>
                        <div className="text-sm font-bold text-red-500">{stats.failedAcquisitions}</div>
                    </div>
                </section>

                {/* Active Sources & Load Times */}
                <section>
                    <div className="text-white/50 mb-2 uppercase border-b border-white/5 pb-1">Live Loads</div>
                    <div className="space-y-1 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                        {stats.activeSources.length === 0 && <div className="text-white/30 italic">No active loads</div>}
                        {stats.activeSources.map((s: any, i: number) => (
                            <div key={i} className="flex justify-between items-center bg-white/5 px-2 py-1 rounded">
                                <span className="truncate max-w-[140px] text-white/80">{s.src}</span>
                                <span className={s.loadTime ? "text-green-400 font-bold" : "text-yellow-500 animate-pulse"}>
                                    {s.loadTime ? `${s.loadTime}ms` : 'LOADING...'}
                                </span>
                            </div>
                        ))}
                    </div>
                </section>

                <div className="pt-2 border-t border-white/10 flex justify-between text-white/40 italic text-[9px]">
                    <span>Peak Active: {stats.peakActive}</span>
                    <span>System: Stable</span>
                </div>
            </div>

            <style jsx>{`
                .custom-scrollbar::-webkit-scrollbar { width: 3px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
            `}</style>
        </div>
    );
}
