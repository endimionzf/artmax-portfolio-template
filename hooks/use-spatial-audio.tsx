'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

// Global context and notification system
let globalAudioContext: AudioContext | null = null;
const contextListeners = new Set<(ctx: AudioContext | null) => void>();

function notifyContextChange() {
    contextListeners.forEach(l => l(globalAudioContext));
}

export function useAudioContext() {
    const [ctx, setCtx] = useState<AudioContext | null>(globalAudioContext);
    
    useEffect(() => {
        const handler = (newCtx: AudioContext | null) => setCtx(newCtx);
        contextListeners.add(handler);
        return () => {
            contextListeners.delete(handler);
        };
    }, []);

    return ctx;
}

// Helper to unlock audio
export const initAudioContext = async () => {
    if (!globalAudioContext) {
        globalAudioContext = THREE.AudioContext.getContext() as any;
    }
    if (globalAudioContext && globalAudioContext.state === 'suspended') {
        await globalAudioContext.resume();
    }
    notifyContextChange();
    return true;
};

export const getGlobalAudioContext = () => globalAudioContext;

export const resumeAudioContext = async () => {
    if (globalAudioContext && (globalAudioContext.state === 'suspended' || globalAudioContext.state === 'interrupted')) {
        await globalAudioContext.resume();
        notifyContextChange();
    }
};
