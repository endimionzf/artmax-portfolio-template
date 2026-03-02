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
    private loadQueue: { src: string, sources?: { src: string, type: string }[], resolve: (v: HTMLVideoElement | null) => void }[] = [];
    private isProcessingQueue = false;

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
            v.defaultMuted = true;
            v.playsInline = true;
            v.setAttribute('playsinline', '');
            v.setAttribute('webkit-playsinline', '');
            v.setAttribute('muted', '');
            v.style.position = 'fixed';
            v.style.top = '0';
            v.style.left = '0';
            v.style.width = '1px';
            v.style.height = '1px';
            v.style.opacity = '0.0001';
            v.style.pointerEvents = 'none';
            v.style.zIndex = '-9999';
            // Pre-warm the element
            v.load();
            this.pool.push(v);

            // iOS Safari is notoriously strict: if it's not in the DOM, it often refuses to autoplay or acquire hardware decoding
            if (typeof document !== 'undefined') {
                document.body.appendChild(v);
            }
        }
        this.updateStats();
    }

    private normalize(src: string): string {
        if (typeof window === 'undefined') return src;
        try {
            // Convert to absolute URL so that video.src (which is absolute)
            // matches the key in our activeMap.
            return new URL(src, window.location.href).href;
        } catch {
            return src;
        }
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

    public acquire(src: string, sources?: { src: string, type: string }[]): HTMLVideoElement | null {
        const normalizedSrc = this.normalize(src);
        this.stats.totalAcquisitions++;

        // 1. Check if already active
        const existing = this.activeMap.get(normalizedSrc);
        if (existing) {
            existing.count++;
            this.updateStats();
            return existing.video;
        }

        // 2. Get from pool
        const video = this.pool.pop();
        if (video) {
            // Only set src and load if it's different to preserve buffer/state
            // We use a custom data attribute to track the abstract ID since we could be using <source> tags
            const currentCacheKey = video.getAttribute('data-cache-key') || video.src;
            if (currentCacheKey !== normalizedSrc) {
                video.setAttribute('data-cache-key', normalizedSrc);

                // Clear any existing source children
                while (video.firstChild) {
                    video.removeChild(video.firstChild);
                }

                if (sources && sources.length > 0) {
                    // iOS Safari Bug: Safari often ignores dynamically appended <source> elements 
                    // on recycled <video> nodes. Evaluate the best codec in JS and assign .src directly!
                    let selectedSrc = sources[0].src;
                    for (const s of sources) {
                        // canPlayType returns 'probably', 'maybe', or '' (empty string means unsupported)
                        if (video.canPlayType(s.type) === 'probably') {
                            selectedSrc = s.src;
                            break;
                        } else if (video.canPlayType(s.type) === 'maybe' && selectedSrc === sources[0].src) {
                            selectedSrc = s.src;
                        }
                    }
                    video.src = this.normalize(selectedSrc);
                } else {
                    video.src = normalizedSrc;
                }

                video.load();
            }
            this.activeMap.set(normalizedSrc, { video, count: 1 });
            this.updateStats();
            return video;
        }

        // 3. Pool empty
        this.stats.failedAcquisitions++;
        this.updateStats();
        return null;
    }

    public async acquireAsync(src: string, sources?: { src: string, type: string }[]): Promise<HTMLVideoElement | null> {
        return new Promise((resolve) => {
            this.loadQueue.push({ src, sources, resolve });
            this.processQueue();
        });
    }

    private async processQueue() {
        if (this.isProcessingQueue || this.loadQueue.length === 0) return;
        this.isProcessingQueue = true;

        while (this.loadQueue.length > 0) {
            const task = this.loadQueue.shift();
            if (!task) continue;

            const video = this.acquire(task.src, task.sources);

            if (video && video.readyState < 2) {
                // Wait for the video to partially load before proceeding to the next one in the queue
                await new Promise<void>((resolveLoad) => {
                    const onLoaded = () => {
                        video.removeEventListener('loadeddata', onLoaded);
                        resolveLoad();
                    };
                    video.addEventListener('loadeddata', onLoaded);
                    // Fallback timeout just in case it hangs
                    setTimeout(() => {
                        video.removeEventListener('loadeddata', onLoaded);
                        resolveLoad();
                    }, 500);
                });
            } else if (!video) {
                // If pool is empty, we just wait a tiny bit to avoid busy looping and resolve null
                await new Promise(r => setTimeout(r, 50));
            }

            task.resolve(video);
        }

        this.isProcessingQueue = false;
    }

    public release(src: string) {
        // Also remove from queue if it hasn't started processing yet
        this.loadQueue = this.loadQueue.filter(t => t.src !== src);

        const normalizedSrc = this.normalize(src);
        const entry = this.activeMap.get(normalizedSrc);
        if (!entry) return;

        entry.count--;
        if (entry.count <= 0) {
            const video = entry.video;
            video.pause();

            // CRITICAL FIX: iOS Hardware Decoder Limit
            // We MUST clear the physical src attributes and drop the nodes so Safari 
            // releases its hardware decoders. If we leave 6 buffers open, Context Lost occurs.
            video.removeAttribute('src');
            video.removeAttribute('data-cache-key');
            while (video.firstChild) {
                video.removeChild(video.firstChild);
            }
            video.load(); // Flush the buffer immediately

            this.pool.push(video);
            this.activeMap.delete(normalizedSrc);
            this.updateStats();
            // Freeing a spot might mean we can process more from the queue
            this.processQueue();
        }
    }

    public prime() {
        this.pool.forEach(v => {
            v.play().then(() => v.pause()).catch(() => { });
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
