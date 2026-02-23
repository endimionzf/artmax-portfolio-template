'use client';

import { ScrollControls, OrthographicCamera } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useState, useRef, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useControls, button } from 'leva';

// Components
import { MediaPlane } from './SpatialMedia/MediaPlane';
import { CameraRig } from './Navigation/CameraRig';
import { Effects } from './Effects';
import { JourneyLines } from './JourneyLines';
import { DustParticles } from './DustParticles';

// Hooks & Utils
import { useJourneyPath, type PlaneData } from '@/hooks/use-journey-path';
import { getPseudo } from '@/utils/math';

interface ExperienceProps {
    audioEnabled: boolean;
    isGridMode: boolean;
    isStarted: boolean;
    visibleLines: string[];
    journeyState?: { category: 'video' | '3d' | 'ai', step: number } | null;
    onOpenInfo: (title: string) => void;
    onFocusClear?: () => void;
    onJourneyLineClick?: (category: 'video' | '3d' | 'ai') => void;
    onPlaneClick?: (category: 'video' | '3d' | 'ai', indexInCategory: number) => void;
    onPlanesLoaded?: (planes: PlaneData[]) => void;
    onCenterPoint?: (focused: boolean) => void;
}

export function Experience({ 
    audioEnabled, 
    isGridMode, 
    isStarted,
    visibleLines, 
    journeyState, 
    onOpenInfo, 
    onFocusClear, 
    onJourneyLineClick, 
    onPlaneClick, 
    onPlanesLoaded,
    onCenterPoint 
}: ExperienceProps) {
    const { camera, viewport } = useThree();
    const [listener] = useState(() => new THREE.AudioListener());
    const [planes, setPlanes] = useState<PlaneData[]>([]);
    const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
    const [currentCamZ, setCurrentCamZ] = useState(20);
    const [currentCamY, setCurrentCamY] = useState(0);
    const dragStatus = useRef({ hasMoved: false });
    const lastCamZRef = useRef(20);
    const lastCamYRef = useRef(0);

    // 1. Audio Session Management
    useEffect(() => {
        if (isStarted && listener.context.state === 'suspended') {
            console.log("[Experience] Attempting to resume AudioContext...");
            listener.context.resume().then(() => {
                console.log("[Experience] AudioContext state:", listener.context.state);
            });
        }
    }, [isStarted, listener]);

    // 2. Fetch and Initialize Data
    useEffect(() => {
        fetch('/api/portfolio')
            .then(res => res.json())
            .then(data => {
                const sorted = [...data].sort((a, b) => a.id - b.id); 
                const spacingVal = 2.9;
                const spreadVal = 20.3;
                const seedVal = 1512;

                const planesWithPositions = sorted.map((item, i) => {
                    const rx = getPseudo(seedVal + i * 13.5);
                    const ry = getPseudo(seedVal + i * 42.1);
                    const rz = getPseudo(seedVal + i * 7.9);
                    
                    const isPortrait = viewport.width < viewport.height;
                    const aspect = viewport.width / viewport.height;
                    
                    const effectiveSpreadX = isPortrait ? spreadVal * aspect * 1.2 : spreadVal;
                    const effectiveSpreadY = isPortrait ? spreadVal * 1.5 : spreadVal * 0.8;

                    const x = (rx - 0.5) * effectiveSpreadX;
                    const y = (ry - 0.5) * effectiveSpreadY;
                    const z = -(i * spacingVal);

                    return {
                        ...item,
                        position: [x, y, z] as [number, number, number]
                    };
                });
                setPlanes(planesWithPositions);
                if (onPlanesLoaded) onPlanesLoaded(planesWithPositions);
            })
            .catch(err => console.error("Failed to fetch portfolio data", err));
    }, [onPlanesLoaded]);

    // 2. Journey & Navigation Hooks
    const { journeyCurves, cameraCurves } = useJourneyPath(planes);

    const activeCameraCurve = journeyState?.category === 'video' ? cameraCurves.video : 
                              journeyState?.category === '3d' ? cameraCurves.render3d : 
                              journeyState?.category === 'ai' ? cameraCurves.ai : null;

    // 3. UI & Controls (Leva)
    const audioControls = useControls('Audio', {
        globalVolume: { value: 0.8, min: 0, max: 1, step: 0.1, label: 'Global Vol' },
        audioZOffset: { value: 2.0, min: -10, max: 10, step: 0.1 },
        audioDebug: { value: false, label: 'Audio Ray Debug' },
        editorMode: { value: false },
        'Log Positions': button(() => {
            console.log(JSON.stringify(planes, null, 2));
        })
    });
    
    // Explicitly destructure with fallbacks for production robustness
    const globalVolume = audioControls.globalVolume ?? 0.8;
    const audioZOffset = audioControls.audioZOffset ?? 2.0;
    const audioDebug = audioControls.audioDebug ?? false;
    const editorMode = audioControls.editorMode ?? false;

    const { useGenerator, seed, spreadXY, clusterSize, spacerSize, clusterSpacing, spacerSpacing, noiseZ } = useControls('Generator', {
        useGenerator: { value: true },
        seed: { value: 1512, min: 1, max: 3000, step: 1 },
        spreadXY: { value: 20.3, min: 0, max: 50, step: 0.1 },
        clusterSize: { value: 4, min: 1, max: 10, step: 1 },
        spacerSize: { value: 2, min: 0, max: 5, step: 1 },
        clusterSpacing: { value: 2.9, min: 1, max: 20, step: 0.1 },
        spacerSpacing: { value: 18.0, min: 5, max: 50, step: 0.5 },
        noiseZ: { value: 0, min: 0, max: 10, step: 0.1 }
    });

    // 4. Position & Layout Logic (Mobile-Aware)
    useEffect(() => {
        if (!useGenerator || planes.length === 0) return;

        setPlanes(prev => {
            let currentZ = 0;
            const isPortrait = viewport.width < viewport.height;
            const aspect = viewport.width / viewport.height;
            
            // On mobile portrait, narrow the X spread and increase the Y spread
            const effectiveSpreadX = isPortrait ? spreadXY * aspect * 1.2 : spreadXY;
            const effectiveSpreadY = isPortrait ? spreadXY * 1.5 : spreadXY * 0.8;

            return prev.map((p, i) => {
                const cycle = clusterSize + spacerSize;
                const cycleIndex = i % cycle;
                const isInCluster = cycleIndex < clusterSize;
                
                const rx = getPseudo(seed + i * 13.5);
                const ry = getPseudo(seed + i * 42.1);
                const rz = getPseudo(seed + i * 7.9);
                
                if (i > 0) {
                    const step = isInCluster ? clusterSpacing : spacerSpacing;
                    currentZ -= step;
                }

                return {
                    ...p,
                    position: [
                        (rx - 0.5) * effectiveSpreadX,
                        (ry - 0.5) * effectiveSpreadY,
                        currentZ + (rz - 0.5) * noiseZ
                    ]
                };
            });
        });
    }, [useGenerator, seed, spreadXY, clusterSize, spacerSize, clusterSpacing, spacerSpacing, noiseZ, planes.length, viewport.width, viewport.height]);

    const [gridPositions, scrollYRange] = useMemo(() => {
        const cols = viewport.width > viewport.height ? 3 : (viewport.width > viewport.height * 0.7 ? 2 : 1); 
        const spacingX = 5.2;
        const spacingY = -3.2;

        const numRows = Math.ceil(planes.length / cols);
        const offsetX = (cols - 1) * spacingX / 2;
        const offsetY = (numRows - 1) * spacingY / 2;

        const positions = planes.map((_, i) => [
            (i % cols) * spacingX - offsetX,
            Math.floor(i / cols) * spacingY - offsetY,
            0
        ] as [number, number, number]);

        return [positions, [-offsetY, (numRows - 1) * spacingY - offsetY]] as const;
    }, [planes.length, viewport.width, viewport.height]);
    
    // Calculate lateral bounds for camera wandering
    const cameraBounds = useMemo(() => {
        if (planes.length === 0) return { minX: -20, maxX: 20, minY: -20, maxY: 20 };
        
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        planes.forEach((plane, i) => {
            const pos = isGridMode ? gridPositions[i] : plane.position;
            minX = Math.min(minX, pos[0]);
            maxX = Math.max(maxX, pos[0]);
            minY = Math.min(minY, pos[1]);
            maxY = Math.max(maxY, pos[1]);
        });
        
        const margin = 1;
        return {
            minX: minX - margin,
            maxX: maxX + margin,
            minY: minY - margin,
            maxY: maxY + margin
        };
    }, [planes, gridPositions, isGridMode]);

    // Handle slideshow transitions
    useEffect(() => {
        if (journeyState && planes.length > 0) {
            const catPlanes = planes.filter(p => p.category === journeyState.category);
            const target = catPlanes[Math.max(0, Math.min(journeyState.step, catPlanes.length - 1))];
            if (target) setFocusedIndex(planes.findIndex(p => p.id === target.id));
        }
    }, [journeyState, planes]);

    // 5. Central Raycasting for HUD feedback
    const raycaster = useMemo(() => new THREE.Raycaster(), []);
    const lastPointedRef = useRef(false);

    useFrame((state) => {
        if (editorMode) return;
        
        raycaster.setFromCamera(state.pointer, state.camera);
        const intersects = raycaster.intersectObjects(state.scene.children, true);
        
        let isPointing = false;
        for (const hit of intersects) {
            if (hit.object.userData?.isPlane) {
                isPointing = true;
                break;
            }
        }

        if (isPointing !== lastPointedRef.current) {
            lastPointedRef.current = isPointing;
            onCenterPoint?.(isPointing);
        }

        // 6. Update local camera Z/Y for component-level culling
        // Update more frequently for smoother culling transitions
        if (Math.abs(state.camera.position.z - lastCamZRef.current) > 2) {
            lastCamZRef.current = state.camera.position.z;
            setCurrentCamZ(state.camera.position.z);
        }
        if (Math.abs(state.camera.position.y - lastCamYRef.current) > 1) {
            lastCamYRef.current = state.camera.position.y;
            setCurrentCamY(state.camera.position.y);
        }
    });

    return (
        <>
            {planes.length > 0 && (
                <ScrollControls pages={planes.length * 0.7} damping={0.2} enabled={!focusedIndex && !editorMode}> 
                    {editorMode ? (
                        <OrthographicCamera 
                            makeDefault 
                            position={[0, 0, 10]} 
                            zoom={10} 
                            near={-200} 
                            far={200}
                            onUpdate={c => c.lookAt(0, 0, -100)}
                        />
                    ) : (
                        <CameraRig 
                            isStarted={isStarted}
                            editorMode={editorMode} 
                            focusTarget={focusedIndex !== null ? (isGridMode ? gridPositions[focusedIndex] : planes[focusedIndex].position) : null} 
                            isGridMode={isGridMode}
                            scrollYRange={scrollYRange}
                            totalPlanes={planes.length}
                            activeCurve={activeCameraCurve}
                            journeyState={journeyState}
                            dragStatus={dragStatus}
                            listener={listener}
                            lastPlaneZ={planes[planes.length - 1]?.position[2] || 0}
                            bounds={cameraBounds}
                        />
                    )}
                    
                    {focusedIndex !== null && !editorMode && (
                        <mesh 
                            position={[0, 0, (isGridMode ? gridPositions[focusedIndex][2] : planes[focusedIndex].position[2]) - 0.1]}
                            onClick={(e) => {
                                e.stopPropagation();
                                setFocusedIndex(null);
                                onFocusClear?.();
                            }}
                        >
                            <planeGeometry args={[200, 200]} />
                            <meshBasicMaterial transparent opacity={0} />
                        </mesh>
                    )}
                    
                    <JourneyLines 
                        visibleLines={visibleLines} 
                        isGridMode={isGridMode} 
                        videoCurve={journeyCurves.video}
                        render3dCurve={journeyCurves.render3d}
                        aiCurve={journeyCurves.ai}
                        onLineClick={onJourneyLineClick}
                    />

                    {planes.map((plane, index) => {
                        const isVisible = visibleLines.length === 0 || visibleLines.includes(plane.category);
                        if (!isVisible && !editorMode) return null;

                        // Component-level Culling: Avoid mounting if way out of bounds
                        const zPos = isGridMode ? gridPositions[index][2] : plane.position[2];
                        const yPos = isGridMode ? gridPositions[index][1] : plane.position[1];

                        let isFar = false;
                        if (isGridMode) {
                            // Vertical window for grid (50 units = ~15+ rows)
                            isFar = Math.abs(yPos - currentCamY) > 50;
                        } else {
                            // Depth window for explorer (250 units to support 120-unit intro fly-in)
                            isFar = Math.abs(zPos - currentCamZ) > 250;
                        }

                        const isFocused = focusedIndex === index;
                        if (isFar && !editorMode && !isFocused) return null;

                        return (
                            <Suspense key={plane.id} fallback={null}>
                                <MediaPlane 
                                index={index}
                                {...plane}
                                audioEnabled={audioEnabled}
                                globalVolume={globalVolume}
                                audioZOffset={audioZOffset}
                                audioDebug={audioDebug}
                                editorMode={editorMode}
                                isFocused={focusedIndex === index}
                                isAnyFocused={focusedIndex !== null}
                                isGridMode={isGridMode}
                                listener={listener}
                                targetPosition={isGridMode ? gridPositions[index] : plane.position}
                                onPositionChange={(newPos) => setPlanes(prev => {
                                    const next = [...prev];
                                    next[index] = { ...next[index], position: newPos };
                                    return next;
                                })}
                                onOpenInfo={() => onOpenInfo(plane.title)}
                                onClick={(e) => {
                                    if (dragStatus.current.hasMoved) return;
                                    e.stopPropagation();
                                    if (focusedIndex === index) {
                                        setFocusedIndex(null);
                                        onFocusClear?.();
                                    } else {
                                        setFocusedIndex(index);
                                        const catPlanes = planes.filter(p => p.category === plane.category);
                                        onPlaneClick?.(plane.category, catPlanes.findIndex(p => p.id === plane.id));
                                    }
                                }}
                                onPointerOver={(e: any) => {
                                    if (isGridMode) return; // Disable hover effects in Grid Mode
                                    const actualPlaneZ = isGridMode ? gridPositions[index][2] : plane.position[2];
                                }}
                                onPointerOut={() => {}}
                            />
                        </Suspense>
                        );
                    })}

                    {/* Background click handler to exit focus mode */}
                    <mesh 
                        position={[0, 0, -500]} 
                        onClick={() => {
                            if (focusedIndex !== null) {
                                setFocusedIndex(null);
                                onFocusClear?.();
                            }
                        }}
                    >
                        <planeGeometry args={[2000, 2000]} />
                        <meshBasicMaterial transparent opacity={0} depthTest={false} />
                    </mesh>

                    {!editorMode && <Effects isFocused={focusedIndex !== null} focusTarget={focusedIndex !== null ? planes[focusedIndex].position : null} isGridMode={isGridMode} />}
                    <DustParticles depth={650} />
                </ScrollControls>
            )}
        </>
    );
}
