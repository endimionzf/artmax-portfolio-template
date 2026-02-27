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
function VideoTube({ curve, segments, radius, radialSegments, isVisible, onClick }: any) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const spriteRef = useRef<THREE.Sprite>(null);
  const startTimeRef = useRef<number | null>(null);
  
  const uniforms = useMemo(() => ({
    uOpacity: { value: 0.0 },
    uCycleProgress: { value: 0.0 },
    uIsFade: { value: 0.0 }
  }), []);

  const playheadTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.arc(32, 32, 28, 0, Math.PI * 2);
      ctx.fillStyle = '#ff0000';
      ctx.fill();
    }
    return new THREE.CanvasTexture(canvas);
  }, []);

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
            uniform float uOpacity;
            uniform float uCycleProgress;
            uniform float uIsFade;
            varying vec2 vUv;
            
            void main() {
              vec3 red = vec3(1.0, 0.0, 0.0); // Pure Red #ff0000
              vec3 white = vec3(1.0, 1.0, 1.0);
              
              // Base color: Red behind progress, White ahead
              vec3 baseColor = vUv.x <= uCycleProgress ? red : white;
              
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

interface JourneyLinesProps {
  visibleLines: string[];
  isGridMode: boolean;
  videoCurve: THREE.Curve<THREE.Vector3> | null;
  render3dCurve: THREE.Curve<THREE.Vector3> | null;
  aiCurve: THREE.Curve<THREE.Vector3> | null;
  onLineClick?: (category: 'video' | '3d' | 'ai') => void;
  onGizmoDragStatus?: (isDragging: boolean) => void;
}

export function JourneyLines({ 
  visibleLines, 
  isGridMode, 
  videoCurve, 
  render3dCurve, 
  aiCurve, 
  onLineClick,
  onGizmoDragStatus 
}: JourneyLinesProps) {
  const [offsets, setOffsets] = useState<THREE.Vector3[]>([]);
  
  // Sync offsets when base curve changes or length moves
  useEffect(() => {
    if (render3dCurve && 'points' in render3dCurve) {
       const pts = (render3dCurve as any).points as THREE.Vector3[];
       if (offsets.length !== pts.length) {
         setOffsets(pts.map(() => new THREE.Vector3(0, 0, 0)));
       }
    } else {
       setOffsets([]);
    }
  }, [render3dCurve]); // eslint-disable-line react-hooks/exhaustive-deps

  // Derive the active curve from base + offsets
  const activeRender3dCurve = useMemo(() => {
    if (!render3dCurve || !('points' in render3dCurve) || offsets.length === 0) return render3dCurve;
    const originalPoints = (render3dCurve as any).points as THREE.Vector3[];
    if (offsets.length !== originalPoints.length) return render3dCurve;

    const modifiedPoints = originalPoints.map((p, i) => p.clone().add(offsets[i]));
    return new THREE.CatmullRomCurve3(modifiedPoints, false, 'centripetal', 0.5);
  }, [render3dCurve, offsets]);

  if (isGridMode) return null;

  // Tubing needs a segment count to smoothly render the curve.
  const videoSegments = videoCurve && 'points' in videoCurve ? Math.max(200, (videoCurve as any).points.length * 20) : 400;
  const render3dSegments = activeRender3dCurve && 'points' in activeRender3dCurve ? Math.max(200, (activeRender3dCurve as any).points.length * 20) : 400;
  const aiSegments = aiCurve && 'points' in aiCurve ? Math.max(200, (aiCurve as any).points.length * 20) : 600;

  return (
    <group>
      {/* 🔴 RED: The Analog Waveform (Video) - YouTube style playhead */}
      {videoCurve && (
          <VideoTube 
             curve={videoCurve} 
             segments={videoSegments} 
             radius={0.06} 
             radialSegments={8} 
             isVisible={visibleLines.includes('video')} 
             onClick={() => onLineClick?.('video')}
          />
      )}

       {/* 🟢 GREEN: Architectural Wireframe (3D) */}
      {activeRender3dCurve && (
          <AnimatedTube 
             curve={activeRender3dCurve} 
             tubularSegments={render3dSegments} 
             radius={0.015} 
             radialSegments={8} 
             color="#00ff41" 
             opacity={0.6} 
             wireframe={true}
             isVisible={visibleLines.includes('3d')} 
             onClick={() => onLineClick?.('3d')}
          />
      )}

      {/* Interactive Spline Nodes for 3D Line */}
      {visibleLines.includes('3d') && render3dCurve && 'points' in render3dCurve && offsets.length === (render3dCurve as any).points.length &&
        (render3dCurve as any).points.map((p: THREE.Vector3, i: number) => {
          // Only show vertices that are between planes (heuristic: odd indices often fall in connectors)
          // and skip first/last to avoid breaking flow too much
          if (i === 0 || i === offsets.length - 1 || i % 2 === 0) return null;

          // the current offset for this point
          const currentOffset = offsets[i];
          
          // Construct a matrix that represents the Absolute clamped position
          // By setting anchor to [0,0,0], the matrix becomes the world transform.
          const clampingMatrix = new THREE.Matrix4().makeTranslation(
             p.x + currentOffset.x,
             p.y + currentOffset.y,
             p.z + currentOffset.z
          );

          return (
            <PivotControls
              key={`node-${i}-${p.x}-${p.z}`}
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
                
                // Calculate the offset relative to the original point p
                const newOffset = newWorldPos.clone().sub(p);
                
                setOffsets(prev => {
                  const next = [...prev];
                  const clampedOffset = newOffset.clone();
                  // Clamp to 2.0 unit threshold
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
                <meshStandardMaterial color="#00ff41" emissive="#00ff41" emissiveIntensity={2} />
              </mesh>
            </PivotControls>
          )
        })
      }

      {/* 🔵 BLUE: The Synaptic Flow (AI) - Cyberpunk Manhattan style */}
      {aiCurve && (
          <CyberTube 
             curve={aiCurve} 
             segments={aiSegments} 
             radius={0.02} 
             radialSegments={4} 
             color="#00f3ff" 
             opacity={0.9} 
             isVisible={visibleLines.includes('ai')} 
             onClick={() => onLineClick?.('ai')}
          />
      )}
    </group>
  );
}
