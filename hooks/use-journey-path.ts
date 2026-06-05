import { useMemo } from 'react';
import * as THREE from 'three';
import { generateFramingPoints, generateCameraPoints, generateManhattanPoints, createLineCurvePath } from '@/utils/math';

export interface PlaneData {
    id: number;
    title: string;
    position: [number, number, number];
    previewSrc?: string;
    fullSrc?: string;
    category: 'video' | '3d' | 'ai';
    youtubeId?: string;
    year?: string;
}

export interface JourneyCurves {
    video: THREE.Curve<THREE.Vector3> | null;
    render3d: THREE.Curve<THREE.Vector3> | null;
    ai: THREE.Curve<THREE.Vector3> | null;
}

export function useJourneyPath(planes: PlaneData[]) {
    return useMemo(() => {
        // 1. Sort planes sequentially by depth (Z) so lines always flow 'forward'
        const sorted = [...planes].sort((a, b) => b.position[2] - a.position[2]);

        const vPoints = generateFramingPoints(sorted, 'video');
        const rPoints = generateFramingPoints(sorted, '3d');
        const aPointsRaw = generateFramingPoints(sorted, 'ai');
        const aPoints = generateManhattanPoints(aPointsRaw);

        // 3. Generate points for camera focus path
        const vCam = generateCameraPoints(sorted, 'video');
        const rCam = generateCameraPoints(sorted, '3d');
        const aCam = generateCameraPoints(sorted, 'ai');

        // 4. Construct Curves
        return {
            journeyCurves: {
                video: vPoints.length > 1 ? new THREE.CatmullRomCurve3(vPoints, false, 'centripetal', 0.5) : null,
                render3d: rPoints.length > 1 ? new THREE.CatmullRomCurve3(rPoints, false, 'centripetal', 0.5) : null,
                ai: aPoints.length > 1 ? createLineCurvePath(aPoints) : null,
            },
            cameraCurves: {
                video: vCam.length > 1 ? new THREE.CatmullRomCurve3(vCam, false, 'centripetal', 0.5) : null,
                render3d: rCam.length > 1 ? new THREE.CatmullRomCurve3(rCam, false, 'centripetal', 0.5) : null,
                ai: aCam.length > 1 ? new THREE.CatmullRomCurve3(aCam, false, 'centripetal', 0.5) : null,
            },
            sortedPlanes: sorted
        };
    }, [planes]);
}
