import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function DustParticles({ depth = 650 }: { depth?: number }) {
  const pointsRef = useRef<THREE.Points>(null);

  // Refined Atmospheric settings
  const count = 3000;
  const size = 0.45;
  const speed = 1.5;
  const opacity = 0.08;
  const color = '#ffffff';

  // Generate uniform tunnel distribution
  const { positions, phases, scales } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    const scales = new Float32Array(count);

    for (let i = 0; i < count; i++) {
        // Uniform tunnel distribution
        // Extended massive boundaries for the minigame 
        positions[i * 3] = (Math.random() - 0.5) * 800;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 600;
        // Z distribution from just behind the camera (50) to the far depth
        positions[i * 3 + 2] = 50 - (Math.random() * depth);

        phases[i] = Math.random() * Math.PI * 2;
        scales[i] = 0.3 + Math.random() * 0.7;
    }

    return { positions, phases, scales };
  }, [count, depth]);

  const shaderArgs = useMemo(() => ({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
      uSize: { value: size },
      uSpeed: { value: speed }
    },
    vertexShader: `
      uniform float uTime;
      uniform float uSize;
      uniform float uSpeed;
      attribute float phase;
      attribute float scale;
      varying float vOpacity;
      void main() {
        vOpacity = 0.5 + 0.5 * sin(uTime * uSpeed + phase);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = uSize * scale * (300.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying float vOpacity;
      void main() {
        float d = distance(gl_PointCoord, vec2(0.5));
        if (d > 0.5) discard;
        float strength = 1.0 - (d * 2.0);
        gl_FragColor = vec4(uColor, strength * vOpacity * uOpacity);
      }
    `
  }), [color, opacity, size, speed]);

  useFrame((state) => {
    if (pointsRef.current) {
      const material = pointsRef.current.material as THREE.ShaderMaterial;
      material.uniforms.uTime.value = state.clock.elapsedTime;
      // Ambient drift removed to stabilize tunnel perception
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-phase" args={[phases, 1]} />
        <bufferAttribute attach="attributes-scale" args={[scales, 1]} />
      </bufferGeometry>
      <shaderMaterial
        args={[shaderArgs]}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
