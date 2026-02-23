import React, { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

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
            
            // Fix: Multiply glow alpha by uOpacity (or a normalized version) so it doesn't leave a trail
            // uOpacity lerps to 0 when hidden, so this will kill the glow too.
            gl_FragColor = vec4(finalColor, uOpacity + glow * uOpacity);
          }
        `}
      />
    </mesh>
  );
}

interface JourneyLinesProps {
  visibleLines: string[];
  isGridMode: boolean;
  videoCurve: THREE.CatmullRomCurve3 | null;
  render3dCurve: THREE.CatmullRomCurve3 | null;
  aiCurve: THREE.CatmullRomCurve3 | null;
  onLineClick?: (category: 'video' | '3d' | 'ai') => void;
}

export function JourneyLines({ visibleLines, isGridMode, videoCurve, render3dCurve, aiCurve, onLineClick }: JourneyLinesProps) {
  if (isGridMode) return null;

  // Tubing needs a segment count to smoothly render the curve.
  // Overdrive segments by 20x to make curves buttery smooth and fluid!
  const videoSegments = videoCurve ? Math.max(200, videoCurve.points.length * 20) : 200;
  const render3dSegments = render3dCurve ? Math.max(200, render3dCurve.points.length * 20) : 200;
  const aiSegments = aiCurve ? Math.max(200, aiCurve.points.length * 20) : 200;

  return (
    <group>
      {/* 🔴 RED: The Analog Waveform (Video) */}
      {videoCurve && (
          <AnimatedTube 
             curve={videoCurve} 
             tubularSegments={videoSegments} 
             radius={0.08} 
             radialSegments={16} 
             color="#ff003c" 
             opacity={0.8} 
             isVisible={visibleLines.includes('video')} 
             onClick={() => onLineClick?.('video')}
          />
      )}

      {/* 🟢 GREEN: Architectural Wireframe (3D) */}
      {render3dCurve && (
          <AnimatedTube 
             curve={render3dCurve} 
             tubularSegments={render3dSegments} 
             radius={0.05} 
             radialSegments={8} 
             color="#00ff41" 
             opacity={0.7} 
             wireframe={true}
             isVisible={visibleLines.includes('3d')} 
             onClick={() => onLineClick?.('3d')}
          />
      )}

      {/* 🔵 BLUE: The Synaptic Flow (AI) */}
      {aiCurve && (
          <AnimatedTube 
             curve={aiCurve} 
             tubularSegments={aiSegments} 
             radius={0.06} 
             radialSegments={16} 
             color="#0066ff" 
             opacity={0.8} 
             isVisible={visibleLines.includes('ai')} 
             onClick={() => onLineClick?.('ai')}
          />
      )}
    </group>
  );
}
