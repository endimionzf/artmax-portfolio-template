import { useMemo } from 'react';
import * as THREE from 'three';
import { generateFramingPoints, generateCameraPoints, generateManhattanPoints, createLineCurvePath } from '@/utils/math';
import siteConfig from '@/site.config.json';

export interface PlaneData {
    id: number;
    title: string;
    position: [number, number, number];
    previewSrc?: string;
    fullSrc?: string;
    category: string;
    youtubeId?: string;
    year?: string;
    mediaType?: 'image' | 'video';
    techStack?: string;
    role?: string;
}

export type JourneyCurves = Record<string, THREE.Curve<THREE.Vector3> | null>;

export function useJourneyPath(planes: PlaneData[]) {
    return useMemo(() => {
        // 1. Sort planes sequentially by depth (Z) so lines always flow 'forward'
        const sorted = [...planes].sort((a, b) => b.position[2] - a.position[2]);

        const categories = (siteConfig.categories as Array<{ id: string, curvePreset?: string }>) || [
            { id: 'video', curvePreset: 'video' },
            { id: '3d', curvePreset: 'render3d' },
            { id: 'ai', curvePreset: 'ai' }
        ];

        const journeyCurves: JourneyCurves = {};
        const cameraCurves: JourneyCurves = {};

        for (const cat of categories) {
            const preset = cat.curvePreset || 'video';
            const rawPoints = generateFramingPoints(sorted, cat.id);
            const camPoints = generateCameraPoints(sorted, cat.id);

            if (preset === 'ai') {
                const manhattanPoints = generateManhattanPoints(rawPoints);
                journeyCurves[cat.id] = manhattanPoints.length > 1 ? createLineCurvePath(manhattanPoints) : null;
            } else {
                journeyCurves[cat.id] = rawPoints.length > 1 ? new THREE.CatmullRomCurve3(rawPoints, false, 'centripetal', 0.5) : null;
            }

            cameraCurves[cat.id] = camPoints.length > 1 ? new THREE.CatmullRomCurve3(camPoints, false, 'centripetal', 0.5) : null;
        }

        // Backward-compatible named properties for existing 3D scenes
        if (journeyCurves['video']) journeyCurves.video = journeyCurves['video'];
        if (journeyCurves['3d']) journeyCurves.render3d = journeyCurves['3d'];
        if (journeyCurves['ai']) journeyCurves.ai = journeyCurves['ai'];

        if (cameraCurves['video']) cameraCurves.video = cameraCurves['video'];
        if (cameraCurves['3d']) cameraCurves.render3d = cameraCurves['3d'];
        if (cameraCurves['ai']) cameraCurves.ai = cameraCurves['ai'];

        return {
            journeyCurves,
            cameraCurves,
            sortedPlanes: sorted
        };
    }, [planes]);
}
