import React, { useMemo, useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { PivotControls } from '@react-three/drei';

// Custom component to handle dynamic growth animation using shaders
function AnimatedTube({ curve, tubularSegments, radius, radialSegments, color, opacity, wireframe, isVisible, onClick }: any) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const lastVisible = useRef(isVisible);

  const uniforms = useMemo(() => ({
    uColor: { value: new THREE.Color(color) },
    uOpacity: { value: 0.0 }, // Initialize zero, lerp it later
    uProgress: { value: 0.0 }
  }), [color]);

  // Reset progress or fill depending on active state
  useEffect(() => {
    if (materialRef.current) {
        if (isVisible && !lastVisible.current) {
            materialRef.current.uniforms.uProgress.value = 0.0;
        }
    }
    lastVisible.current = isVisible;
  }, [isVisible]);

  useFrame((_, delta) => {
    if (materialRef.current) {
      if (isVisible && materialRef.current.uniforms.uProgress.value < 1.0) {
        // Growth duration: ~2.5 seconds to reach 1.0
        materialRef.current.uniforms.uProgress.value = Math.min(1.0, materialRef.current.uniforms.uProgress.value + delta * 0.4);
      }
      
      const targetOpacity = isVisible ? opacity : 0.0;
      materialRef.current.uniforms.uOpacity.value = THREE.MathUtils.lerp(materialRef.current.uniforms.uOpacity.value, targetOpacity, 0.05);
    }
  });

  return (
    <mesh 
        visible={isVisible || (materialRef.current?.uniforms.uOpacity.value ?? 0) > 0.01}
        onClick={(e) => { e.stopPropagation(); onClick?.(); }}
        onPointerOver={(e) => { e.stopPropagation(); }} 
        onPointerOut={() => { }}
    >
      <tubeGeometry args={[curve, tubularSegments, radius, radialSegments, false]} />
      <shaderMaterial 
        ref={materialRef}
        transparent
        wireframe={wireframe}
        blending={THREE.AdditiveBlending}
        uniforms={uniforms}
        depthWrite={false}
        vertexShader={`
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform vec3 uColor;
          uniform float uOpacity;
          uniform float uProgress;
          varying vec2 vUv;
          void main() {
            // UV x corresponds to the length of the tube from 0 to 1
            if (vUv.x > uProgress) discard;
            
            // Additive glow head effect
            float glow = smoothstep(uProgress - 0.05, uProgress, vUv.x) * 2.0;
            vec3 finalColor = mix(uColor, vec3(1.0), glow * smoothstep(0.0, 0.1, uProgress));
            
            gl_FragColor = vec4(finalColor, uOpacity + glow * uOpacity);
          }
        `}
      />
    </mesh>
  );
}

// Custom component for the AI line with a cyberpunk aesthetic
function CyberTube({ curve, segments, radius, radialSegments, color, opacity, isVisible, onClick }: any) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const lastVisible = useRef(isVisible);

  const uniforms = useMemo(() => ({
    uColor: { value: new THREE.Color(color) },
    uTime: { value: 0.0 },
    uOpacity: { value: 0.0 },
    uProgress: { value: 0.0 }
  }), [color]);

  useEffect(() => {
    if (materialRef.current) {
        if (isVisible && !lastVisible.current) {
            materialRef.current.uniforms.uProgress.value = 0.0;
        }
    }
    lastVisible.current = isVisible;
  }, [isVisible]);

  useFrame((state, delta) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value += delta;
      
      if (isVisible && materialRef.current.uniforms.uProgress.value < 1.0) {
        materialRef.current.uniforms.uProgress.value = Math.min(1.0, materialRef.current.uniforms.uProgress.value + delta * 0.5);
      }
      
      const targetOpacity = isVisible ? opacity : 0.0;
      materialRef.current.uniforms.uOpacity.value = THREE.MathUtils.lerp(materialRef.current.uniforms.uOpacity.value, targetOpacity, 0.05);
    }
  });

  return (
    <mesh 
        visible={isVisible || (materialRef.current?.uniforms.uOpacity.value ?? 0) > 0.01}
        onClick={(e) => { e.stopPropagation(); onClick?.(); }}
        onPointerOver={(e) => { e.stopPropagation(); }} 
    >
      <tubeGeometry args={[curve, segments, radius, radialSegments, false]} />
      <shaderMaterial 
        ref={materialRef}
        transparent
        blending={THREE.AdditiveBlending}
        uniforms={uniforms}
        depthWrite={false}
        vertexShader={`
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform vec3 uColor;
          uniform float uTime;
          uniform float uOpacity;
          uniform float uProgress;
          varying vec2 vUv;
          
          void main() {
            if (vUv.x > uProgress) discard;
            
            // High-frequency data pulse - Slower speed (orig 3.0 -> 0.8)
            float pulse = step(0.98, fract(vUv.x * 20.0 - uTime * 0.8));
            float scanline = sin(vUv.x * 100.0 - uTime * 2.0) * 0.5 + 0.5;
            
            // Precision glow head - Slower growth/tail
            float head = smoothstep(uProgress - 0.01, uProgress, vUv.x) * 2.5;
            
            vec3 finalColor = mix(uColor, vec3(1.0, 1.0, 1.0), pulse + head * 0.5);
            // Slightly flatter alpha for 2D look
            float alpha = (uOpacity * 0.5) + (pulse * uOpacity) + (head * uOpacity) + (scanline * 0.1 * uOpacity);
            
            gl_FragColor = vec4(finalColor, alpha);
          }
        `}
      />
    </mesh>
  );
}

// Custom component for the Video line with a YouTube-style playhead aesthetic
function VideoTube({ curve, segments, radius, radialSegments, isVisible, onClick, color = '#ff003c' }: any) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const spriteRef = useRef<THREE.Sprite>(null);
  const startTimeRef = useRef<number | null>(null);
  
  const uniforms = useMemo(() => ({
    uColor: { value: new THREE.Color(color) },
    uOpacity: { value: 0.0 },
    uCycleProgress: { value: 0.0 },
    uIsFade: { value: 0.0 }
  }), [color]);

  const playheadTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.arc(32, 32, 28, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }
    return new THREE.CanvasTexture(canvas);
  }, [color]);

  useEffect(() => {
    return () => {
      if (playheadTexture) playheadTexture.dispose();
    };
  }, [playheadTexture]);

  useEffect(() => {
    if (isVisible) {
      startTimeRef.current = null; // Will be set in the next useFrame
    } else {
      startTimeRef.current = null;
    }
  }, [isVisible]);

  useFrame((state) => {
    if (materialRef.current) {
      const currentTime = state.clock.getElapsedTime();
      
      if (isVisible && startTimeRef.current === null) {
        startTimeRef.current = currentTime;
      }

      let uProgress = 0.0;
      let uIsFade = 0.0;

      if (isVisible && startTimeRef.current !== null) {
        const elapsed = currentTime - startTimeRef.current;
        const cycleDuration = 45.0;
        const progressInCycle = elapsed % cycleDuration;
        
        if (progressInCycle < 3.0) {
          // Phase 1: 3s White Hold
          uProgress = 0.0;
          uIsFade = 0.0;
          if (spriteRef.current) spriteRef.current.visible = false;
        } else if (progressInCycle < 33.0) {
          // Phase 2: 30s Red Travel
          uProgress = (progressInCycle - 3.0) / 30.0;
          uIsFade = 0.0;
          if (spriteRef.current) {
            const point = curve.getPointAt(uProgress);
            spriteRef.current.position.copy(point);
            spriteRef.current.visible = true;
          }
        } else if (progressInCycle < 43.0) {
          // Phase 3: 10s Red Hold
          uProgress = 1.0;
          uIsFade = 0.0;
          if (spriteRef.current) spriteRef.current.visible = false;
        } else {
          // Phase 4: 2s Fade (back to white)
          uProgress = 1.0;
          uIsFade = (progressInCycle - 43.0) / 2.0;
          if (spriteRef.current) spriteRef.current.visible = false;
        }
      } else {
        if (spriteRef.current) spriteRef.current.visible = false;
      }
      
      materialRef.current.uniforms.uCycleProgress.value = uProgress;
      materialRef.current.uniforms.uIsFade.value = uIsFade;
      
      const targetOpacity = isVisible ? 1.0 : 0.0;
      materialRef.current.uniforms.uOpacity.value = THREE.MathUtils.lerp(materialRef.current.uniforms.uOpacity.value, targetOpacity, 0.05);
    }
  });

  return (
    <group>
      <mesh 
          visible={isVisible || (materialRef.current?.uniforms.uOpacity.value ?? 0) > 0.01}
          onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      >
        <tubeGeometry args={[curve, segments, radius, radialSegments, false]} />
        <shaderMaterial 
          ref={materialRef}
          transparent
          blending={THREE.NormalBlending}
          uniforms={uniforms}
          depthWrite={false}
          vertexShader={`
            varying vec2 vUv;
            void main() {
              vUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            uniform vec3 uColor;
            uniform float uOpacity;
            uniform float uCycleProgress;
            uniform float uIsFade;
            varying vec2 vUv;
            
            void main() {
              vec3 white = vec3(1.0, 1.0, 1.0);
              
              // Base color: Configured color behind progress, White ahead
              vec3 baseColor = vUv.x <= uCycleProgress ? uColor : white;
              
              // Fade back to white at cycle end
              vec3 finalColor = mix(baseColor, white, uIsFade);
              
              // Base alpha modulated by accessibility
              float alpha = 0.7 * uOpacity;
              
              gl_FragColor = vec4(finalColor, alpha);
            }
          `}
        />
      </mesh>
      <sprite ref={spriteRef} scale={[0.35, 0.35, 1]}>
        <spriteMaterial 
          map={playheadTexture} 
          transparent 
          depthTest={true}
          color="#ff0000"
        />
      </sprite>
    </group>
  );
}

import siteConfig from '@/site.config.json';

interface JourneyLinesProps {
  visibleLines: string[];
  isGridMode: boolean;
  curves?: Record<string, THREE.Curve<THREE.Vector3> | null>;
  videoCurve?: THREE.Curve<THREE.Vector3> | null;
  render3dCurve?: THREE.Curve<THREE.Vector3> | null;
  aiCurve?: THREE.Curve<THREE.Vector3> | null;
  onLineClick?: (category: string) => void;
  onGizmoDragStatus?: (isDragging: boolean) => void;
}

export function JourneyLines({ 
  visibleLines, 
  isGridMode, 
  curves,
  videoCurve, 
  render3dCurve, 
  aiCurve, 
  onLineClick,
  onGizmoDragStatus 
}: JourneyLinesProps) {
  const [offsets, setOffsets] = useState<THREE.Vector3[]>([]);
  
  const categories = (siteConfig.categories as Array<{ id: string, color: string, curvePreset?: string }> | undefined) || [
    { id: 'video', color: '#ff003c', curvePreset: 'video' },
    { id: '3d', color: '#00ff41', curvePreset: 'render3d' },
    { id: 'ai', color: '#0066ff', curvePreset: 'ai' }
  ];

  const render3dCat = categories.find(c => (c.curvePreset || (c.id === '3d' ? 'render3d' : '')) === 'render3d') || { id: '3d' };
  const rawRender3dCurve = curves?.[render3dCat.id] || render3dCurve;

  // Sync offsets when base curve changes or length moves
  useEffect(() => {
    if (rawRender3dCurve && 'points' in rawRender3dCurve) {
       const pts = (rawRender3dCurve as any).points as THREE.Vector3[];
       if (offsets.length !== pts.length) {
         setOffsets(pts.map(() => new THREE.Vector3(0, 0, 0)));
       }
    } else {
       setOffsets([]);
    }
  }, [rawRender3dCurve]); // eslint-disable-line react-hooks/exhaustive-deps

  // Derive the active curve from base + offsets
  const activeRender3dCurve = useMemo(() => {
    if (!rawRender3dCurve || !('points' in rawRender3dCurve) || offsets.length === 0) return rawRender3dCurve;
    const originalPoints = (rawRender3dCurve as any).points as THREE.Vector3[];
    if (offsets.length !== originalPoints.length) return rawRender3dCurve;

    const modifiedPoints = originalPoints.map((p, i) => p.clone().add(offsets[i]));
    return new THREE.CatmullRomCurve3(modifiedPoints, false, 'centripetal', 0.5);
  }, [rawRender3dCurve, offsets]);

  if (isGridMode) return null;

  return (
    <group>
      {categories.map((cat) => {
        const curve = curves?.[cat.id] || (cat.id === 'video' ? videoCurve : cat.id === '3d' ? render3dCurve : cat.id === 'ai' ? aiCurve : null);
        if (!curve) return null;

        const isVisible = visibleLines.includes(cat.id);
        const preset = cat.curvePreset || (cat.id === '3d' ? 'render3d' : cat.id === 'ai' ? 'ai' : 'video');
        const segments = curve && 'points' in curve ? Math.max(200, (curve as any).points.length * 20) : (preset === 'ai' ? 600 : 400);

        if (preset === 'video') {
          return (
            <VideoTube 
              key={cat.id}
              curve={curve} 
              segments={segments} 
              radius={0.06} 
              radialSegments={8} 
              color={cat.color}
              isVisible={isVisible} 
              onClick={() => onLineClick?.(cat.id)}
            />
          );
        }

        if (preset === 'render3d') {
          return (
            <React.Fragment key={cat.id}>
              <AnimatedTube 
                curve={activeRender3dCurve || curve} 
                tubularSegments={segments} 
                radius={0.015} 
                radialSegments={8} 
                color={cat.color} 
                opacity={0.6} 
                wireframe={true}
                isVisible={isVisible} 
                onClick={() => onLineClick?.(cat.id)}
              />

              {/* Interactive Spline Nodes for 3D Line */}
              {isVisible && rawRender3dCurve && 'points' in rawRender3dCurve && offsets.length === (rawRender3dCurve as any).points.length &&
                (rawRender3dCurve as any).points.map((p: THREE.Vector3, i: number) => {
                  if (i === 0 || i === offsets.length - 1 || i % 2 === 0) return null;
                  const currentOffset = offsets[i];
                  const clampingMatrix = new THREE.Matrix4().makeTranslation(
                    p.x + currentOffset.x,
                    p.y + currentOffset.y,
                    p.z + currentOffset.z
                  );

                  return (
                    <PivotControls
                      key={`node-${cat.id}-${i}-${p.x}-${p.z}`}
                      anchor={[0, 0, 0]}
                      matrix={clampingMatrix}
                      depthTest={true}
                      disableRotations
                      disableScaling
                      activeAxes={[true, true, true]}
                      scale={0.9}
                      lineWidth={3}
                      onDragStart={() => onGizmoDragStatus?.(true)}
                      onDragEnd={() => onGizmoDragStatus?.(false)}
                      onDrag={(m) => {
                        const newWorldPos = new THREE.Vector3();
                        newWorldPos.setFromMatrixPosition(m);
                        const newOffset = newWorldPos.clone().sub(p);
                        setOffsets(prev => {
                          const next = [...prev];
                          const clampedOffset = newOffset.clone();
                          if (clampedOffset.length() > 2.0) {
                            clampedOffset.normalize().multiplyScalar(2.0);
                          }
                          next[i] = clampedOffset;
                          return next;
                        });
                      }}
                    >
                      <mesh position={new THREE.Vector3(0,0,0)}>
                        <boxGeometry args={[0.08, 0.08, 0.08]} />
                        <meshStandardMaterial color={cat.color} emissive={cat.color} emissiveIntensity={2} />
                      </mesh>
                    </PivotControls>
                  );
                })
              }
            </React.Fragment>
          );
        }

        if (preset === 'ai') {
          return (
            <CyberTube 
              key={cat.id}
              curve={curve} 
              segments={segments} 
              radius={0.02} 
              radialSegments={4} 
              color={cat.color} 
              opacity={0.9} 
              isVisible={isVisible} 
              onClick={() => onLineClick?.(cat.id)}
            />
          );
        }

        return null;
      })}
    </group>
  );
}
