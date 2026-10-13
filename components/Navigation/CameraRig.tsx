'use client';

import { useScroll } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useControls } from 'leva';


export interface CameraRigProps {
    editorMode: boolean;
    focusTarget: [number, number, number] | null;
    isGridMode: boolean;
    scrollYRange?: readonly [number, number];
    totalPlanes: number;
    activeCurve: THREE.Curve<THREE.Vector3> | THREE.CatmullRomCurve3 | null;
    journeyState?: { category: string, step: number } | null;
    dragStatus?: React.MutableRefObject<{ hasMoved: boolean }>;
    listener: THREE.AudioListener;
    lastPlaneZ: number;
    bounds?: { minX: number; maxX: number; minY: number; maxY: number } | null;
    isStarted: boolean;
    isGizmoDragging?: boolean;
    isGameActive?: boolean;
}

export function CameraRig({
    editorMode,
    focusTarget,
    isGridMode,
    scrollYRange,
    totalPlanes,
    activeCurve,
    journeyState,
    dragStatus,
    listener,
    lastPlaneZ,
    bounds,
    isStarted,
    isGizmoDragging,
    isGameActive
}: CameraRigProps) {
    const scroll = useScroll();
    const { camera, size } = useThree();
    const dragOffset = useRef(new THREE.Vector2(0, 0));
    const isDragging = useRef(false);
    const lastPointer = useRef(new THREE.Vector2(0, 0));
    const lastScrollOffset = useRef(0);
    const keys = useRef<{ [key: string]: boolean }>({});

    // Idle & Intro State
    const introOffset = useRef(120);
    const lastInteraction = useRef(0);
    const didInteract = useRef(false);
    const autoPilotDir = useRef(1); // 1 for forward, -1 for backward

    // Every listener needs an AudioListener on the camera
    useEffect(() => {
        camera.add(listener);
        return () => { camera.remove(listener); };
    }, [camera, listener]);

    // Spline Tracking refs
    const currentCurveT = useRef(0);
    const lastJourneyState = useRef(journeyState);

    // Initialize position along the curve gracefully instead of violently snapping to 0
    useEffect(() => {
        if (journeyState && !lastJourneyState.current) {
            const activePoints = (activeCurve && 'points' in activeCurve) ? (activeCurve as any).points.length : 1;
            currentCurveT.current = journeyState.step / Math.max(1, activePoints - 1);
        }
        lastJourneyState.current = journeyState;
    }, [journeyState, activeCurve]);

    const { fov, dragSensitivity, scrollSteer } = useControls('Camera', {
        fov: { value: 50, min: 10, max: 150, step: 1 },
        dragSensitivity: { value: 0.015, min: 0.001, max: 0.035, step: 0.001 },
        scrollSteer: { value: 0.01, min: 0.0, max: 1.0, step: 0.01, label: 'Scroll Steering' }
    });

    useEffect(() => {
        if (camera instanceof THREE.PerspectiveCamera) {
            // Override Leva config dynamically on mobile resolutions
            const isMobile = size.width < 768;
            const targetFov = (isGridMode && isMobile) ? 75 : fov;

            camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, 0.1);
            camera.updateProjectionMatrix();
        }
    }, [camera, fov, isGridMode, size.width]);

    // Force animation frame loop to continuously lerp FOV smoothly when state changes
    useFrame(() => {
        if (camera instanceof THREE.PerspectiveCamera) {
            const isMobile = size.width < 768;
            const targetFov = (isGridMode && isMobile) ? 75 : fov;

            if (Math.abs(camera.fov - targetFov) > 0.1) {
                camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, 0.05);
                camera.updateProjectionMatrix();
            }
        }
    });

    // Handle Drag & Keyboard Events
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isStarted) return;
            keys.current[e.code] = true;
            didInteract.current = true;
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            keys.current[e.code] = false;
        };

        const handleGeneralMove = () => {
            if (isStarted) didInteract.current = true;
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        window.addEventListener('pointermove', handleGeneralMove);

        if (editorMode || focusTarget) return;

        const handleDown = (e: PointerEvent) => {
            if (!isStarted || e.button !== 0 || isGizmoDragging) return;
            isDragging.current = true;
            lastPointer.current.set(e.clientX, e.clientY);
            if (dragStatus) dragStatus.current.hasMoved = false;
            didInteract.current = true;
        };

        const handleMove = (e: PointerEvent) => {
            if (!isDragging.current || !isStarted || isGizmoDragging) return;
            const dx = e.clientX - lastPointer.current.x;
            const dy = e.clientY - lastPointer.current.y;

            if (dragStatus && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
                dragStatus.current.hasMoved = true;
            }

            const isMobile = window.innerWidth < 1024;
            const effectiveSensitivity = isMobile ? dragSensitivity * 1.5 : dragSensitivity;

            if (isMobile && isGridMode && scroll.el) {
                // Handled in touchmove for better preventDefault control
                return;
            } else {
                // Explorer mode / Desktop: Standard XY Drag
                dragOffset.current.x -= dx * effectiveSensitivity;
                dragOffset.current.y += dy * effectiveSensitivity;
            }
            lastPointer.current.set(e.clientX, e.clientY);
            didInteract.current = true;
        };

        const handleUp = () => {
            isDragging.current = false;
        };

        // PINCH-TO-TRAVEL (MULTI-TOUCH)
        const lastPinchDist = { current: 0 };
        const handleTouchStart = (e: TouchEvent) => {
            if (e.touches.length === 2) {
                const dist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
                lastPinchDist.current = dist;
                didInteract.current = true;
            } else if (e.touches.length === 1 && isGridMode) {
                // Track start position for one-finger grid scroll
                lastPointer.current.set(e.touches[0].clientX, e.touches[0].clientY);
            }
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (e.touches.length === 2 && scroll.el && !focusTarget && !isGridMode) {
                const dist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );

                const delta = dist - lastPinchDist.current;

                // Sensitivity: Increased for better responsiveness on modern high-res screens
                const pinchSensitivity = 8.0;

                // Only move if the pinch delta is significant to avoid jitter
                if (Math.abs(delta) > 0.5) {
                    // Inverted: += to match standard zoom behavior
                    scroll.el.scrollTop += delta * pinchSensitivity;
                }

                lastPinchDist.current = dist;
                didInteract.current = true;

                // Prevent browser zoom while pinching the app
                if (e.cancelable) e.preventDefault();
            } else if (e.touches.length === 1 && isGridMode && scroll.el) {
                // ONE-FINGER GRID SCROLL INTERCEPTOR
                // Intercept raw touch moves to bypass R3F mesh-blocking
                const touch = e.touches[0];
                const dy = touch.clientY - lastPointer.current.y;

                // Consistently tuned sensitivity for grid navigation
                scroll.el.scrollTop -= dy * 1.0;

                lastPointer.current.set(touch.clientX, touch.clientY);
                didInteract.current = true;

                // Prevent browser bounce if within the app
                if (e.cancelable) e.preventDefault();
            }
        };

        window.addEventListener('pointerdown', handleDown);
        window.addEventListener('pointermove', handleMove);
        window.addEventListener('pointerup', handleUp);
        window.addEventListener('touchstart', handleTouchStart, { passive: false });
        window.addEventListener('touchmove', handleTouchMove, { passive: false });

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener('pointermove', handleGeneralMove);
            window.removeEventListener('pointerdown', handleDown);
            window.removeEventListener('pointermove', handleMove);
            window.removeEventListener('pointerup', handleUp);
            window.removeEventListener('touchstart', handleTouchStart);
            window.removeEventListener('touchmove', handleTouchMove);
        };
    }, [editorMode, focusTarget, dragSensitivity, dragStatus, isStarted, isGizmoDragging, isGridMode]);

    // Custom Scroll Handling
    useEffect(() => {
        if (!scroll.el) return;
        const el = scroll.el;

        // Disable native touch scrolling on mobile to unlock X/Y drag
        el.style.touchAction = 'none';

        const handleWheel = (e: WheelEvent) => {
            if (focusTarget || !isStarted || isGizmoDragging) return;
            e.preventDefault();

            if (isGridMode) {
                el.scrollTop += e.deltaY * 2.5;
            } else {
                el.scrollTop += e.deltaY * 0.8;
            }
            didInteract.current = true;
        };

        el.addEventListener('wheel', handleWheel, { passive: false });
        return () => el.removeEventListener('wheel', handleWheel);
    }, [scroll.el, isGridMode, focusTarget, isStarted, isGizmoDragging]);

    // Center the camera drag when transitioning into Grid Mode
    const lastGridMode = useRef(isGridMode);
    useEffect(() => {
        if (isGridMode && !lastGridMode.current) {
            dragOffset.current.set(0, 0);
        }
        lastGridMode.current = isGridMode;
    }, [isGridMode]);

    useFrame((state, delta) => {
        // Base step logic
        const baseSpeed = 4;
        const baseStep = baseSpeed * delta;

        // Update interaction time if needed
        if (didInteract.current) {
            lastInteraction.current = state.clock.elapsedTime;
            didInteract.current = false;
        }

        if (journeyState && activeCurve && focusTarget && !isGridMode) {
            const totalSteps = ('points' in activeCurve) ? (activeCurve as any).points.length : 1;
            const targetT = totalSteps > 1 ? journeyState.step / (totalSteps - 1) : 0;

            currentCurveT.current = THREE.MathUtils.lerp(currentCurveT.current, targetT, delta * 1.5);
            const splinePos = activeCurve.getPoint(currentCurveT.current);

            let optimalZOffset = 4;
            if (state.camera instanceof THREE.PerspectiveCamera) {
                const fovRadian = state.camera.fov * (Math.PI / 180);
                const planeHeightWithMargin = 2.7 * 1.4;
                // Add conditional padding for portrait/mobile to prevent excessive zooming
                const isPortrait = state.size.width < state.size.height;
                const widthMargin = isPortrait ? 1.4 : 1.15; // 40% margin on mobile vs 15% on desktop
                const planeWidthWithMargin = 4.8 * widthMargin;

                const requiredZForHeight = (planeHeightWithMargin / 2) / Math.tan(fovRadian / 2);
                const requiredZForWidth = (planeWidthWithMargin / state.camera.aspect / 2) / Math.tan(fovRadian / 2);
                optimalZOffset = Math.max(4.0, requiredZForHeight - 2.0, requiredZForWidth - 2.0);
            }

            const targetPos = new THREE.Vector3(splinePos.x, splinePos.y + 1.6, splinePos.z + optimalZOffset);
            const dist = state.camera.position.distanceTo(targetPos);

            // Dynamic step: slower if far, faster if close. 
            const speedFactor = Math.pow(THREE.MathUtils.clamp(15 / Math.max(1, dist), 0.3, 2.5), 0.8);
            const dynamicStep = baseStep * speedFactor;

            state.camera.position.x = THREE.MathUtils.lerp(state.camera.position.x, targetPos.x, dynamicStep);
            state.camera.position.y = THREE.MathUtils.lerp(state.camera.position.y, targetPos.y, dynamicStep);
            state.camera.position.z = THREE.MathUtils.lerp(state.camera.position.z, targetPos.z, dynamicStep);

            dragOffset.current.x = state.camera.position.x;
            dragOffset.current.y = state.camera.position.y;
            lastScrollOffset.current = scroll.offset;

        } else if (focusTarget) {
            const [tx, ty, tz] = focusTarget;
            let optimalZOffset = 4;
            if (state.camera instanceof THREE.PerspectiveCamera) {
                const fovRadian = state.camera.fov * (Math.PI / 180);
                const planeHeightWithMargin = 2.7 * 1.4;
                const isPortrait = state.size.width < state.size.height;
                const widthMargin = isPortrait ? 1.4 : 1.15;
                const planeWidthWithMargin = 4.8 * widthMargin;

                const requiredZForHeight = (planeHeightWithMargin / 2) / Math.tan(fovRadian / 2);
                const requiredZForWidth = (planeWidthWithMargin / state.camera.aspect / 2) / Math.tan(fovRadian / 2);
                optimalZOffset = Math.max(2.5, requiredZForHeight - 1.2, requiredZForWidth - 1.2);
            }

            const targetPos = new THREE.Vector3(tx, ty, tz + optimalZOffset);
            const dist = state.camera.position.distanceTo(targetPos);
            const speedFactor = Math.pow(THREE.MathUtils.clamp(15 / Math.max(1, dist), 0.3, 2.5), 0.8);
            const dynamicStep = baseStep * speedFactor;

            state.camera.position.x = THREE.MathUtils.lerp(state.camera.position.x, targetPos.x, dynamicStep);
            state.camera.position.y = THREE.MathUtils.lerp(state.camera.position.y, targetPos.y, dynamicStep);
            state.camera.position.z = THREE.MathUtils.lerp(state.camera.position.z, targetPos.z, dynamicStep);

            dragOffset.current.x = state.camera.position.x;
            dragOffset.current.y = state.camera.position.y;
            lastScrollOffset.current = scroll.offset;

        } else if (isGridMode && scrollYRange) {
            const [topY, bottomY] = scrollYRange;
            const isMobile = size.width < 768;

            let targetY;
            if (isMobile) {
                // CONTINUOUS SCROLL FOR MOBILE
                targetY = THREE.MathUtils.lerp(topY, bottomY, scroll.offset);
            } else {
                // PAGED SNAP FOR DESKTOP
                const pageGap = 15;
                const numPages = Math.round(Math.abs(bottomY - topY) / pageGap) + 1;
                const currentPage = Math.round(scroll.offset * (numPages - 1));
                targetY = topY - (currentPage * pageGap);
            }

            state.camera.position.z = THREE.MathUtils.lerp(state.camera.position.z, 10, baseStep);
            state.camera.position.x = THREE.MathUtils.lerp(state.camera.position.x, 0, baseStep);
            state.camera.position.y = THREE.MathUtils.lerp(state.camera.position.y, targetY, 0.1);

            dragOffset.current.set(0, state.camera.position.y);

        } else {
            // Explore Mode

            // Intro / Idle Logic
            if (isStarted) {
                introOffset.current = THREE.MathUtils.lerp(introOffset.current, 0, delta * 0.8);
            }

            const isIdle = (state.clock.elapsedTime - lastInteraction.current) > 30;
            if (isIdle && !isGridMode && !focusTarget && isStarted) {
                // Auto-Pilot Glide
                if (scroll.el) {
                    const glideSpeed = 150 * delta; // Adjust glide speed
                    const maxScroll = scroll.el.scrollHeight - scroll.el.clientHeight;

                    if (autoPilotDir.current === 1) {
                        scroll.el.scrollTop += glideSpeed;
                        if (scroll.el.scrollTop >= maxScroll - 1) autoPilotDir.current = -1;
                    } else {
                        scroll.el.scrollTop -= glideSpeed;
                        if (scroll.el.scrollTop <= 1) autoPilotDir.current = 1;
                    }
                }
            }

            // WASD / Keyboard lateral movement
            const moveSpeed = 15 * delta;
            if (isStarted) {
                if (keys.current['KeyA'] || keys.current['ArrowLeft']) {
                    dragOffset.current.x -= moveSpeed;
                    lastInteraction.current = state.clock.elapsedTime;
                }
                if (keys.current['KeyD'] || keys.current['ArrowRight']) {
                    dragOffset.current.x += moveSpeed;
                    lastInteraction.current = state.clock.elapsedTime;
                }
                if (keys.current['KeyE']) {
                    dragOffset.current.y += moveSpeed; // Unreal Style: Up
                    lastInteraction.current = state.clock.elapsedTime;
                }
                if (keys.current['KeyQ']) {
                    dragOffset.current.y -= moveSpeed; // Unreal Style: Down
                    lastInteraction.current = state.clock.elapsedTime;
                }

                if (keys.current['KeyW'] || keys.current['ArrowUp']) {
                    if (scroll.el) scroll.el.scrollTop += 20;
                    lastInteraction.current = state.clock.elapsedTime;
                }
                if (keys.current['KeyS'] || keys.current['ArrowDown']) {
                    if (scroll.el) scroll.el.scrollTop -= 20;
                    lastInteraction.current = state.clock.elapsedTime;
                }


            }

            // Apply Lateral Bounds clamping
            if (bounds) {
                let limitXMin = bounds.minX;
                let limitXMax = bounds.maxX;
                let limitYMin = bounds.minY;
                let limitYMax = bounds.maxY;

                if (isGameActive) {
                    const width = (bounds.maxX - bounds.minX) * 30;
                    const height = (bounds.maxY - bounds.minY) * 30;
                    const cx = (bounds.maxX + bounds.minX) / 2;
                    const cy = (bounds.maxY + bounds.minY) / 2;
                    limitXMin = cx - width / 2;
                    limitXMax = cx + width / 2;
                    limitYMin = cy - height / 2;
                    limitYMax = cy + height / 2;
                }

                dragOffset.current.x = THREE.MathUtils.clamp(dragOffset.current.x, limitXMin, limitXMax);
                dragOffset.current.y = THREE.MathUtils.clamp(dragOffset.current.y, limitYMin, limitYMax);
            }

            const deltaScroll = scroll.offset - lastScrollOffset.current;
            lastScrollOffset.current = scroll.offset;

            // 3-layer layout: Z range is ~0 to -24. Start just in front, stop at last layer.
            const startZ = 25; // Close enough to see layer 0 clearly
            const endZ = lastPlaneZ - 5; // Stop just past the 3rd layer
            const targetDistance = startZ - endZ;

            if (Math.abs(deltaScroll) > 0.0001) {
                dragOffset.current.x += state.pointer.x * deltaScroll * targetDistance * scrollSteer;
                dragOffset.current.y += state.pointer.y * deltaScroll * targetDistance * scrollSteer;
                if (!isIdle) lastInteraction.current = state.clock.elapsedTime;
            }

            const targetZ = startZ - (scroll.offset * targetDistance) + introOffset.current;

            state.camera.position.z = THREE.MathUtils.lerp(state.camera.position.z, targetZ, baseStep);
            state.camera.position.x = THREE.MathUtils.lerp(state.camera.position.x, dragOffset.current.x, baseStep);
            state.camera.position.y = THREE.MathUtils.lerp(state.camera.position.y, dragOffset.current.y, baseStep);
        }
    });

    return null;
}
