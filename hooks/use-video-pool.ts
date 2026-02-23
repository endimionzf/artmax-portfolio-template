import * as THREE from 'three';

/**
 * Global Video Pool Manager
 * Prevents browser from hitting the <video> element limit by reusing elements.
 * Manages allocation and deallocation based on priority/visibility.
 */

class VideoPool {
    private pool: HTMLVideoElement[] = [];
    private activeMap = new Map<string, { video: HTMLVideoElement, count: number }>();
    private maxElements = 6; // Strict limit to ensure performance in all modes
    
    // Stats for monitoring
    private stats = {
        active: 0,
        pooled: 0,
        totalAcquisitions: 0,
        failedAcquisitions: 0,
        peakActive: 0,
        activeSources: [] as { src: string, loadTime?: number }[]
    };

    private listeners = new Set<(stats: any) => void>();

    constructor() {
        if (typeof window === 'undefined') return;
        for (let i = 0; i < this.maxElements; i++) {
            const v = document.createElement('video');
            v.crossOrigin = 'anonymous';
            v.loop = true;
            v.muted = true;
            v.playsInline = true;
            v.style.display = 'none';
            // Pre-warm the element
            v.load();
            this.pool.push(v);
        }
        this.updateStats();
    }

    private updateStats() {
        this.stats.active = this.activeMap.size;
        this.stats.pooled = this.pool.length;
        this.stats.peakActive = Math.max(this.stats.peakActive, this.stats.active);
        this.stats.activeSources = Array.from(this.activeMap.keys()).map(src => ({
            src: src.split('/').pop() || src, // Just filename for clarity
            loadTime: (window as any).__videoLoadTimes?.[src]
        }));
        
        this.listeners.forEach(l => l({ ...this.stats }));
    }

    public subscribe(listener: (stats: any) => void) {
        this.listeners.add(listener);
        listener({ ...this.stats });
        return () => this.listeners.delete(listener);
    }

    public acquire(src: string): HTMLVideoElement | null {
        this.stats.totalAcquisitions++;
        
        // 1. Check if already active
        const existing = this.activeMap.get(src);
        if (existing) {
            existing.count++;
            this.updateStats();
            return existing.video;
        }

        // 2. Get from pool
        const video = this.pool.pop();
        if (video) {
            video.src = src;
            video.load();
            this.activeMap.set(src, { video, count: 1 });
            this.updateStats();
            return video;
        }

        // 3. Pool empty
        this.stats.failedAcquisitions++;
        this.updateStats();
        return null;
    }

    public release(src: string) {
        const entry = this.activeMap.get(src);
        if (!entry) return;

        entry.count--;
        if (entry.count <= 0) {
            const video = entry.video;
            video.pause();
            video.removeAttribute('src');
            video.load(); // Flush the buffer
            this.pool.push(video);
            this.activeMap.delete(src);
            this.updateStats();
        }
    }

    public prime() {
        this.pool.forEach(v => {
            v.play().then(() => v.pause()).catch(() => {});
        });
    }

    // External way to report load times
    public reportLoadTime(src: string, time: number) {
        if (typeof window === 'undefined') return;
        if (!(window as any).__videoLoadTimes) (window as any).__videoLoadTimes = {};
        (window as any).__videoLoadTimes[src] = time;
        this.updateStats();
    }
}

export const videoPool = new VideoPool();
