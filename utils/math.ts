import * as THREE from 'three';

/**
 * Deterministic pseudo-random number generator based on a seed.
 * Returns a value between 0 and 1.
 */
export const getPseudo = (s: number): number => {
    const x = Math.sin(s) * 10000;
    return x - Math.floor(x);
};

/**
 * Generates framing points for a journey path based on plane positions.
 * Used to create the visual spline line that flows around the planes.
 */
export const generateFramingPoints = (planes: any[], category: 'video' | '3d' | 'ai'): THREE.Vector3[] => {
    const catPlanes = planes.filter(p => p.category === category);
    if (catPlanes.length === 0) return [];
    
    const points: THREE.Vector3[] = [];
    const W = 2.4 + 0.4; // Plane width half + margin
    const H = 1.35 + 0.4; // Plane height half + margin
    
    catPlanes.forEach((p, i) => {
        const center = new THREE.Vector3(...p.position);
        const pattern = i % 4;
        
        if (pattern === 0) {
            points.push(new THREE.Vector3(center.x - W, center.y - 0.5, center.z));
            points.push(new THREE.Vector3(center.x - W, center.y + H, center.z));
            points.push(new THREE.Vector3(center.x + 0.5, center.y + H, center.z));
        } else if (pattern === 1) {
            points.push(new THREE.Vector3(center.x - 0.5, center.y - H, center.z));
            points.push(new THREE.Vector3(center.x + W, center.y - H, center.z));
            points.push(new THREE.Vector3(center.x + W, center.y + 0.5, center.z));
        } else if (pattern === 2) {
            points.push(new THREE.Vector3(center.x - W, center.y - H * 0.4, center.z));
            points.push(new THREE.Vector3(center.x - W, center.y + H * 0.4, center.z));
        } else {
            points.push(new THREE.Vector3(center.x - W * 0.4, center.y - H, center.z));
            points.push(new THREE.Vector3(center.x + W * 0.4, center.y - H, center.z));
        }
    });
    
    return points;
};

/**
 * Generates camera focus points along the path.
 * Usually matches the center of the planes with a vertical offset.
 */
export const generateCameraPoints = (planes: any[], category: 'video' | '3d' | 'ai'): THREE.Vector3[] => {
    const catPlanes = planes.filter(p => p.category === category);
    // Camera path matches the old logic: center of plane offset by -1.6 on Y
    return catPlanes.map(p => new THREE.Vector3(p.position[0], p.position[1] - 1.6, p.position[2]));
};
