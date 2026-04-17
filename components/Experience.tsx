'use client';

import { ScrollControls, OrthographicCamera } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useState, useRef, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useControls, button } from 'leva';
import { useStore } from '@/store/useStore';

// Components
import { MediaPlane } from './SpatialMedia/MediaPlane';
import { CameraRig } from './Navigation/CameraRig';
import { Effects } from './Effects';
import { JourneyLines } from './JourneyLines';
import { DustParticles } from './DustParticles';
import { HiddenPlanet } from './Minigame/HiddenPlanet';

function FadeOverlay({ opacity }: { opacity: number }) {
    const { camera } = useThree();
    const meshRef = useRef<THREE.Mesh>(null);

    useFrame(() => {
        if (meshRef.current) {
            // Stay fixed in front of camera
            const v = new THREE.Vector3(0, 0, -0.2); // Very close to near plane
            v.applyQuaternion(camera.quaternion);
            v.add(camera.position);
            meshRef.current.position.copy(v);
            meshRef.current.quaternion.copy(camera.quaternion);
        }
    });

    return (
        <mesh ref={meshRef} frustumCulled={false}>
            <planeGeometry args={[2, 2]} />
            <meshBasicMaterial
                color="black"
                transparent
                opacity={opacity}
                depthTest={false}
                depthWrite={false}
            />
        </mesh>
    );
}

// Sub-component to darken the background when in Focus mode
function FocusDarkener({ isFocused, isGridMode }: { isFocused: boolean, isGridMode: boolean }) {
    const { camera } = useThree();
    const meshRef = useRef<THREE.Mesh>(null);
    const targetOpacity = isFocused ? 0.85 : 0; // 85% darkness

    useFrame((_, delta) => {
        if (meshRef.current) {
            // Keep it fixed to the camera.
            // In Grid mode, videos are co-planar, so we slip the darkener right behind the focused item (-4.5).
            // In Explorer mode, videos have extreme 3D depth, so we push it way back (-15.0).
            const targetZ = isGridMode ? -4.5 : -15.0;
            const v = new THREE.Vector3(0, 0, targetZ);
            v.applyQuaternion(camera.quaternion);
            v.add(camera.position);
            meshRef.current.position.copy(v);
            meshRef.current.quaternion.copy(camera.quaternion);

            // Smoothly animate opacity
            const material = meshRef.current.material as THREE.MeshBasicMaterial;
            material.opacity = THREE.MathUtils.lerp(material.opacity, targetOpacity, delta * 5);

            // Optimization: hide entirely if opacity is near zero
            meshRef.current.visible = material.opacity > 0.01;
        }
    });

    return (
        <mesh ref={meshRef} frustumCulled={false}>
            {/* Scale up massively so it covers the whole screen even pushed 15 units back */}
            <planeGeometry args={[200, 200]} />
            <meshBasicMaterial
                color="black"
                transparent
                opacity={0}
                depthTest={false}
                depthWrite={false}
            />
        </mesh>
    );
}

// Hooks & Utils
import { useJourneyPath, type PlaneData } from '@/hooks/use-journey-path';
import { getPseudo } from '@/utils/math';

interface ExperienceProps {
    audioEnabled: boolean;
    isGridMode: boolean;
    isStarted: boolean;
    visibleLines: string[];
    journeyState?: { category: 'video' | '3d' | 'ai', step: number } | null;
    onOpenInfo: (plane: any) => void;
    onFocusClear?: () => void;
    onJourneyLineClick?: (category: 'video' | '3d' | 'ai') => void;
    onPlaneClick?: (category: 'video' | '3d' | 'ai', indexInCategory: number) => void;
    onPlanesLoaded?: (planes: PlaneData[]) => void;
    onCenterPoint?: (focused: boolean) => void;
    isInfoOpen?: boolean;
    minigameStatus?: 'idle' | 'invited' | 'active' | 'won' | 'rejected' | 'completed';
    onDiscountUnlocked?: () => void;
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
    onCenterPoint,
    isInfoOpen = false,
    minigameStatus = 'idle',
    onDiscountUnlocked
}: ExperienceProps) {
    const { camera, viewport } = useThree();
    const [listener] = useState(() => new THREE.AudioListener());
    const [planes, setPlanes] = useState<PlaneData[]>([]);
    const { activeVideoId, setActiveVideoId } = useStore();
    const [currentCamZ, setCurrentCamZ] = useState(20);
    const [currentCamY, setCurrentCamY] = useState(0);
    const [isGizmoDragging, setIsGizmoDragging] = useState(false);
    const dragStatus = useRef({ hasMoved: false });
    const lastCamZRef = useRef(20);
    const lastCamYRef = useRef(0);

    useEffect(() => {
        camera.add(listener);
        return () => {
            camera.remove(listener);
        };
    }, [camera, listener]);

    // Transition State
    const [displayedIsGridMode, setDisplayedIsGridMode] = useState(isGridMode);
    const [displayedVisibleLines, setDisplayedVisibleLines] = useState(visibleLines);
    const [fadeOpacity, setFadeOpacity] = useState(0);
    const isTransitioning = useRef(false);

    useEffect(() => {
        // Triggered when props change
        if (isGridMode === displayedIsGridMode &&
            JSON.stringify(visibleLines) === JSON.stringify(displayedVisibleLines)) return;

        // If we are merely changing tags in Explorer mode, update instantly without fading
        if (!isGridMode && !displayedIsGridMode) {
            setDisplayedVisibleLines(visibleLines);
            return;
        }

        // If we are exiting Grid Mode to Explorer, skip the fade and update instantly
        if (!isGridMode && displayedIsGridMode) {
            setDisplayedIsGridMode(false);
            setDisplayedVisibleLines(visibleLines);
            setFadeOpacity(0);
            isTransitioning.current = false;
            return;
        }

        if (isTransitioning.current) return;
        isTransitioning.current = true;

        // Timeline:
        // 0.0 - 0.4: Fade to 1
        // 0.4 - 0.5: Stay at 1, swap state
        // 0.5 - 0.9: Fade to 0

        let start: number | null = null;
        const duration = 1000; // 1 second total cycle

        let stateSwapped = false;

        const animate = (time: number) => {
            if (!start) start = time;
            const elapsed = time - start;
            const p = elapsed / duration;

            if (p < 0.4) {
                // Fade In (to black)
                setFadeOpacity(p / 0.4);
            } else if (p < 0.5) {
                setFadeOpacity(1);
                if (!stateSwapped) {
                    setDisplayedIsGridMode(isGridMode);
                    setDisplayedVisibleLines(visibleLines);
                    stateSwapped = true;
                }
            } else if (p < 0.9) {
                // Fade Out (to clear)
                setFadeOpacity(1 - (p - 0.5) / 0.4);
            } else {
                setFadeOpacity(0);
                isTransitioning.current = false;
                return;
            }
            requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);

    }, [isGridMode, visibleLines]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (isStarted && listener.context.state === 'suspended') {
            console.log("[Experience] Attempting to resume AudioContext...");
            listener.context.resume().then(() => {
                console.log("[Experience] AudioContext state:", listener.context.state);
            });
        }
    }, [isStarted, listener]);

    // 1b. Global Audio Effects (Muffling)
    const filterRef = useRef<BiquadFilterNode | null>(null);
    useEffect(() => {
        if (!listener.context) return;

        // Create low-pass filter for muffling
        const filter = listener.context.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 20000; // Default wide open
        filter.Q.value = 1;

        // Master Insert Strategy:
        // Intercept the final output of the Three.js AudioListener. 
        // We disconnect the listener.gain from the destination and insert our filter.
        try {
            listener.gain.disconnect();
            listener.gain.connect(filter);
            filter.connect(listener.context.destination);
            filterRef.current = filter;
            console.log("[Audio] Master Muffling Inserted");
        } catch (e) {
            console.error("[Audio] Failed to insert master filter:", e);
        }

        return () => {
            try {
                filter.disconnect();
                listener.gain.disconnect();
                listener.gain.connect(listener.context.destination);
                filterRef.current = null;
                console.log("[Audio] Master Muffling Removed");
            } catch (e) {
                console.error("[Audio] Failed to restore audio path:", e);
            }
        };
    }, [listener]);

    // Handle muffling transitions
    useEffect(() => {
        if (!filterRef.current || !listener.context) return;
        const targetFreq = isInfoOpen ? 400 : 20000;
        // Use a faster ramp for the activation, slower for deactivation
        const rampTime = isInfoOpen ? 0.05 : 0.2;
        filterRef.current.frequency.setTargetAtTime(targetFreq, listener.context.currentTime, rampTime);
    }, [isInfoOpen, listener]);

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
        seed: { value: 2024, min: 1, max: 3000, step: 1 },
        spreadXY: { value: 20.0, min: 0, max: 100, step: 0.1, label: 'Spread XY' },
        clusterSize: { value: 4, min: 1, max: 10, step: 1 },
        spacerSize: { value: 2, min: 0, max: 5, step: 1 },
        clusterSpacing: { value: 2.9, min: 1, max: 20, step: 0.1 },
        spacerSpacing: { value: 15.0, min: 5, max: 50, step: 0.5, label: 'Layer Depth (Z)' },
        noiseZ: { value: 4.0, min: 0, max: 10, step: 0.1 }
    });

    // 4. Position & Layout Logic (Mobile-Aware)
    useEffect(() => {
        if (!useGenerator || planes.length === 0) return;

        setPlanes(prev => {
            // ALWAYS sort by ID first so that `i` is deterministic for the pseudo-random generator
            const sortedById = [...prev].sort((a, b) => a.id - b.id);

            const isPortrait = viewport.width < viewport.height;
            const aspect = viewport.width / viewport.height;

            const effectiveSpreadX = isPortrait ? spreadXY * aspect * 1.2 : spreadXY;
            const effectiveSpreadY = isPortrait ? spreadXY * 1.4 : spreadXY * 0.8;

            const totalLayers = 5;
            const planesCount = sortedById.length;
            const planesPerLayer = Math.ceil(planesCount / totalLayers);

            // Grid logic: we want roughly a square or landscape grid depending on spread
            const cols = Math.ceil(Math.sqrt(planesPerLayer * (effectiveSpreadX / effectiveSpreadY)));
            const rows = Math.ceil(planesPerLayer / cols);

            const nextPlanes = sortedById.map((p, i) => {
                const layerIndex = Math.floor(i / planesPerLayer);
                const indexInLayer = i % planesPerLayer;

                const gridX = indexInLayer % cols;
                const gridY = Math.floor(indexInLayer / cols);

                // Re-center indices
                const nx = (gridX / Math.max(1, cols - 1)) - 0.5;
                const ny = (gridY / Math.max(1, rows - 1)) - 0.5;

                // LAYER STAGGERING:
                // Offset the grid slightly for each layer so they don't stack
                const offsetX = (layerIndex % 2 === 0 ? 0 : 0.25);
                const offsetY = (layerIndex % 3 === 0 ? 0 : 0.25);

                const rx = getPseudo(seed + i * 13.5);
                const ry = getPseudo(seed + i * 42.1);
                const rz = getPseudo(seed + i * 7.9);

                // Strictly layer-based Z positioning
                const z = -(layerIndex * spacerSpacing);

                return {
                    ...p,
                    position: [
                        (nx + offsetX + (rx - 0.5) * 0.4) * effectiveSpreadX,
                        (ny + offsetY + (ry - 0.5) * 0.4) * effectiveSpreadY,
                        z + (rz - 0.5) * noiseZ
                    ]
                } as PlaneData;
            });

            // 1. Sort by Z-depth (Near-to-Far) to ensure consistent indexing with JourneyCurves
            const sortedPlanes = [...nextPlanes].sort((a, b) => b.position[2] - a.position[2]);

            return sortedPlanes;
        });
    }, [useGenerator, seed, spreadXY, clusterSize, spacerSize, clusterSpacing, spacerSpacing, noiseZ, planes.length, viewport.width, viewport.height]);

    // Notify parent of the final sorted plane list in a separate effect to avoid render-loop / pure-function violations
    useEffect(() => {
        if (onPlanesLoaded && planes.length > 0) {
            onPlanesLoaded(planes);
        }
    }, [planes, onPlanesLoaded]);

    // List of planes actually visible in the current mode
    const filteredPlanes = useMemo(() => {
        if (!displayedIsGridMode) return planes;
        // If no filter is selected, show everything. Otherwise, only show selected categories.
        if (displayedVisibleLines.length === 0) return planes;

        return planes.filter(p => {
            if (p.category === 'video' && displayedVisibleLines.includes('video')) return true;
            if (p.category === '3d' && displayedVisibleLines.includes('3d')) return true;
            if (p.category === 'ai' && displayedVisibleLines.includes('ai')) return true;
            return false;
        });
    }, [planes, displayedIsGridMode, displayedVisibleLines]);

    const [gridPositionsMap, scrollYRange, gridMeta] = useMemo(() => {
        const isWidescreen = viewport.width > viewport.height;
        const cols = isWidescreen ? 3 : 2;
        const rows = isWidescreen ? 2 : 3;
        const itemsPerPage = cols * rows;

        const isMobilePortrait = !isWidescreen && viewport.width < 768;
        const spacingX = isMobilePortrait ? 2.4 : 5.2; // Optimized for 0.45x scaling
        const spacingY = isMobilePortrait ? -1.6 : -3.2;

        const numPages = Math.ceil(filteredPlanes.length / itemsPerPage);
        const positionMap = new Map<number, [number, number, number]>();

        filteredPlanes.forEach((plane, i) => {
            const pageIndex = Math.floor(i / itemsPerPage);
            const indexInPage = i % itemsPerPage;

            const col = indexInPage % cols;
            const row = Math.floor(indexInPage / cols);

            // Center each page vertically
            const pageOffsetY = (rows - 1) * spacingY / 2;
            const pageOffsetX = (cols - 1) * spacingX / 2;

            // Each page is separated by a large vertical gap (e.g., 20 units)
            const pageVerticalGap = 15;

            positionMap.set(plane.id, [
                col * spacingX - pageOffsetX,
                (row * spacingY - pageOffsetY) - (pageIndex * pageVerticalGap),
                0
            ]);
        });

        // The scroll range covers all pages
        const lastPageY = -((numPages - 1) * 15);

        return [positionMap, [0, lastPageY], { itemsPerPage, numPages, pageGap: 15 }] as const;
    }, [filteredPlanes, viewport.width, viewport.height]);

    // Calculate lateral bounds for camera wandering
    const cameraBounds = useMemo(() => {
        if (filteredPlanes.length === 0) return { minX: -20, maxX: 20, minY: -20, maxY: 20 };

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        filteredPlanes.forEach((plane) => {
            const pos = displayedIsGridMode ? gridPositionsMap.get(plane.id) : plane.position;
            if (!pos) return;
            minX = Math.min(minX, pos[0]);
            maxX = Math.max(maxX, pos[0]);
            minY = Math.min(minY, pos[1]);
            maxY = Math.max(maxY, pos[1]);
        });

        const margin = 1;
        if (minX === Infinity) return { minX: -20, maxX: 20, minY: -20, maxY: 20 };
        return {
            minX: minX - margin,
            maxX: maxX + margin,
            minY: minY - margin,
            maxY: maxY + margin
        };
    }, [filteredPlanes, gridPositionsMap, displayedIsGridMode]);

    // Handle slideshow transitions
    useEffect(() => {
        if (journeyState && planes.length > 0) {
            const catPlanes = planes.filter(p => p.category === journeyState.category);
            const target = catPlanes[Math.max(0, Math.min(journeyState.step, catPlanes.length - 1))];
            if (target && activeVideoId !== target.id) {
                setActiveVideoId(target.id);
            }
        } else if (!journeyState && activeVideoId !== null) {
            // Clear local focus if journey is cleared externally
            setActiveVideoId(null);
        }
    }, [journeyState, planes, activeVideoId, setActiveVideoId]);

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
                <ScrollControls pages={isGridMode ? gridMeta.numPages * 2 : gridMeta.numPages} damping={0.2} enabled={!activeVideoId && !editorMode}>
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
                            focusTarget={activeVideoId !== null ? (displayedIsGridMode ? (gridPositionsMap.get(activeVideoId) || null) : planes.find(p => p.id === activeVideoId)?.position || null) : null}
                            isGridMode={displayedIsGridMode}
                            scrollYRange={scrollYRange}
                            totalPlanes={filteredPlanes.length}
                            activeCurve={activeCameraCurve}
                            journeyState={journeyState}
                            dragStatus={dragStatus}
                            listener={listener}
                            lastPlaneZ={planes[planes.length - 1]?.position[2] || 0}
                            bounds={cameraBounds}
                            isGizmoDragging={isGizmoDragging}
                            isGameActive={minigameStatus === 'active'}
                        />
                    )}

                    {activeVideoId !== null && !editorMode && (
                        <mesh
                            position={[0, 0, (displayedIsGridMode ? (gridPositionsMap.get(activeVideoId)?.[2] || 0) : (planes.find(p => p.id === activeVideoId)?.position[2] || 0)) - 0.1]}
                            onClick={(e) => {
                                e.stopPropagation();
                                setActiveVideoId(null);
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
                        onGizmoDragStatus={setIsGizmoDragging}
                    />

                    {planes.map((plane, index) => {
                        // In grid mode, only show filtered planes
                        const gridPos = gridPositionsMap.get(plane.id);
                        if (displayedIsGridMode && !gridPos) return null;

                        const zPos = displayedIsGridMode ? gridPos![2] : plane.position[2];
                        const yPos = displayedIsGridMode ? gridPos![1] : plane.position[1];

                        let isFar = false;
                        if (displayedIsGridMode) {
                            isFar = Math.abs(yPos - currentCamY) > 50;
                        } else {
                            // Tightened for 2-layer visibility (approx 3x spacer)
                            isFar = Math.abs(zPos - currentCamZ) > 50;
                        }

                        const isFocused = activeVideoId === plane.id;

                        // PERFORMANCE OPTIMIZATION:
                        // Instead of returning null and breaking onClick for distant planes,
                        // we always render the MediaPlane but pass it the isFar status.
                        // The MediaPlane will skip expensive texture loading if it's far.

                        const isMobilePortrait = viewport.width < viewport.height && viewport.width < 768;
                        const gridScale = (displayedIsGridMode && isMobilePortrait) ? 0.45 : 1.0;

                        return (
                            <Suspense key={plane.id} fallback={null}>
                                <MediaPlane
                                    index={index}
                                    {...plane}
                                    audioEnabled={audioEnabled}
                                    globalVolume={globalVolume}
                                    audioZOffset={audioZOffset}
                                    activeSpacerSpacing={spacerSpacing}
                                    audioDebug={audioDebug}
                                    editorMode={editorMode}
                                    isGridMode={displayedIsGridMode}
                                    listener={listener}
                                    isCulled={isFar && !isFocused && !editorMode}
                                    targetPosition={displayedIsGridMode ? gridPos! : plane.position}
                                    targetScale={gridScale}
                                    onPositionChange={(newPos) => setPlanes(prev => {
                                        const next = [...prev];
                                        next[index] = { ...next[index], position: newPos };
                                        return next;
                                    })}
                                    onOpenInfo={() => onOpenInfo(plane)}
                                    onClick={(e) => {
                                        if (dragStatus.current.hasMoved) return;
                                        e.stopPropagation();
                                        if (activeVideoId === plane.id) {
                                            setActiveVideoId(null);
                                            onFocusClear?.();
                                        } else {
                                            setActiveVideoId(plane.id);
                                            // Use the plane index in the current sorted list
                                            const catPlanes = planes.filter(p => p.category === plane.category);
                                            const indexInCategory = catPlanes.findIndex(p => p.id === plane.id);
                                            console.log(`[Experience] Clicking Plane: ${plane.id}, Category: ${plane.category}, IndexInCategory: ${indexInCategory}`);
                                            onPlaneClick?.(plane.category, indexInCategory);
                                        }
                                    }}
                                    onPointerOver={(e: any) => {
                                        if (displayedIsGridMode) return;
                                    }}
                                    onPointerOut={() => { }}
                                />
                            </Suspense>
                        );
                    })}

                    {/* Background click handler to exit focus mode */}
                    <mesh
                        position={[0, 0, -500]}
                        onClick={() => {
                            if (activeVideoId !== null) {
                                setActiveVideoId(null);
                                onFocusClear?.();
                            }
                        }}
                    >
                        <planeGeometry args={[2000, 2000]} />
                        <meshBasicMaterial transparent opacity={0} depthTest={false} />
                    </mesh>

                    {!editorMode && <Effects isFocused={activeVideoId !== null} focusTarget={activeVideoId !== null ? planes.find(p => p.id === activeVideoId)?.position || null : null} isGridMode={displayedIsGridMode} />}
                    <DustParticles depth={650} />

                    <HiddenPlanet
                        isGameActive={minigameStatus === 'active'}
                        onDiscover={() => {
                            if (onDiscountUnlocked) onDiscountUnlocked();
                        }}
                    />

                    <FocusDarkener isFocused={activeVideoId !== null} isGridMode={displayedIsGridMode} />
                    <FadeOverlay opacity={fadeOpacity} />
                </ScrollControls>
            )}
        </>
    );
}
