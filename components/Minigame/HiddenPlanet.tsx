import { useRef, useEffect, useState } from 'react';
import { useFrame, useThree, useLoader } from '@react-three/fiber';
import { Sphere } from '@react-three/drei';
import { useControls } from 'leva';
import * as THREE from 'three';

interface HiddenPlanetProps {
    isGameActive: boolean;
    onDiscover: () => void;
}

export function HiddenPlanet({ isGameActive, onDiscover }: HiddenPlanetProps) {
    const meshRef = useRef<THREE.Mesh>(null);
    const hintRef = useRef<THREE.Mesh>(null);
    const lastPingTime = useRef<number>(-9); // Start at -9 so it pings almost immediately
    const { camera } = useThree();
    
    // Leva Debug Controls
    const { 
        planetX, planetY, planetZ, planetScale,
        baseVolume, refDistance, maxDistance, rolloffFactor,
        showDebugSpheres
    } = useControls('Planet Settings', {
        planetX: { value: 220, min: -500, max: 500 },
        planetY: { value: 60, min: -500, max: 500 },
        planetZ: { value: -50, min: -1000, max: 100 },
        planetScale: { value: 0.1, min: 0.1, max: 10, step: 0.1 },
        baseVolume: { value: 2.0, min: 0.1, max: 20 },
        refDistance: { value: 24, min: 1, max: 200 },
        maxDistance: { value: 50, min: 10, max: 2000 }, // Lowered min limit to allow 50 or below if needed
        rolloffFactor: { value: 2.8, min: 0, max: 10 },
        showDebugSpheres: false // Toggle the visual bounds
    });

    // We instantiate an entirely separate listener for the Minigame so it doesn't get 
    // caught in the Master Muffle filter applied to the global video listener.
    const [minigameListener] = useState(() => new THREE.AudioListener());
    const [audio] = useState(() => new THREE.PositionalAudio(minigameListener));

    // Mount the isolated listener to the camera
    useEffect(() => {
        camera.add(minigameListener);
        return () => {
            camera.remove(minigameListener);
        };
    }, [camera, minigameListener]);

    const planetPosition = new THREE.Vector3(planetX, planetY, planetZ);

    // Audio setup/update
    useEffect(() => {
        const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
        const loader = new THREE.AudioLoader();
        loader.load(`${basePath}/audio/birds.ogg`, (buffer) => {
            audio.setBuffer(buffer);
            audio.setVolume(baseVolume);
            
            if (audio.panner) audio.panner.panningModel = 'HRTF';
            
            audio.setDistanceModel('exponential'); 
            audio.setRefDistance(refDistance); 
            audio.setMaxDistance(maxDistance); 
            audio.setRolloffFactor(rolloffFactor); 
            audio.setLoop(true);
            
            // Start/Stop based on game state
            if (isGameActive && !audio.isPlaying) {
                audio.play();
            } else if (!isGameActive && audio.isPlaying) {
                 audio.pause();
            }
        });

        return () => {
            if (audio.isPlaying) audio.stop();
        };
    }, [isGameActive, audio, baseVolume, refDistance, maxDistance, rolloffFactor]);


    useFrame((state) => {
        if (!meshRef.current) return;
        
        // CRITICAL BUG FIX: Force the WebAudio engine to track the moving/orbiting physical 
        // matrices in strict 3D space, instead of flattening the coordinate to a 2D sound
        audio.updateMatrixWorld(true);
        
        // Culling logic to save performance and hide it from far away
        const dist = camera.position.distanceTo(planetPosition);
        
        // Let it start fading at 120 units, and be completely invisible at 160 units.
        const START_FADE = 120;
        const FULL_CULL = 160;
        
        meshRef.current.visible = dist < FULL_CULL;

        if (meshRef.current.visible) {
             // Slowly rotate the planet
             meshRef.current.rotation.y += 0.001;
             meshRef.current.rotation.x += 0.0005;
             
             // Dynamically fade out the opacity and emissive light as we pull away
             const material = meshRef.current.material as THREE.MeshStandardMaterial;
             if (material) {
                 material.transparent = true;
                 // Alpha goes from 1.0 down to 0.0
                 let alpha = 1.0;
                 if (dist > START_FADE) {
                     alpha = 1.0 - ((dist - START_FADE) / (FULL_CULL - START_FADE));
                     alpha = Math.max(0, Math.min(1, alpha));
                 }
                 material.opacity = alpha;
                 // Also scale back the blinding emissive when faded
                 material.emissiveIntensity = 1.2 * alpha;
             }
        }

        // Radar HUD Update
        if (hintRef.current) {
             const now = state.clock.elapsedTime;
             
             // Trigger a new ping every 7 seconds
             if (now - lastPingTime.current > 7.0) {
                 lastPingTime.current = now;
             }
             
             // The ping lasts for 1.5 seconds total (1s grow, 0.5s fade)
             const timeSincePing = now - lastPingTime.current;
             const isPinging = timeSincePing < 1.5;
             
             const material = hintRef.current.material as THREE.ShaderMaterial;
             if (!material || !material.uniforms) return;

             if (!isPinging) {
                 material.uniforms.uIntensity.value = 0;
                 return; // Save math cycles when invisible
             }

             // Project the strict 3D world coordinates of the planet onto the 2D camera plane
             const vector = planetPosition.clone();
             vector.project(camera);

             let nx = vector.x;
             let ny = vector.y;

             // If the planet is physically behind the camera frustum, mirror the direction
             if (vector.z > 1) {
                 nx *= -1;
                 ny *= -1;
             }
             
             // Calculate Directional Vector mathematically
             const magnitude = Math.sqrt(nx * nx + ny * ny);
             let dirX = 0;
             let dirY = 0;
             if (magnitude > 0) {
                 // Dividing by magnitude gives us a vector length of exactly 1 (pointing from camera center to edge)
                 dirX = nx / magnitude;
                 dirY = ny / magnitude;
             }
             
             // Smooth enter over 1.0 second, smooth exit over 0.5 seconds
             let animPower = 0;
             if (timeSincePing < 1.0) {
                 // Grows from 0 to 1 over the first second (ease out cubic for a nice pop)
                 let t = timeSincePing;
                 animPower = 1.0 - Math.pow(1.0 - t, 3.0);
             } else {
                 // Fades from 1 to 0 over the last 0.5 seconds
                 let t = (timeSincePing - 1.0) / 0.5;
                 animPower = 1.0 - t;
             }
             animPower = Math.max(0.0, Math.min(1.0, animPower));

             // Set visual strength based on physical distance
             let distanceFactor = 1.0 - (dist / maxDistance);
             let intensity = Math.max(0.1, Math.min(1, distanceFactor));
             
             // Check if the planet is currently visible anywhere within the screen bounds
             // (NDC coordinates between -1 and 1 on both axes, and not behind the camera)
             const isOnScreen = vector.z <= 1 && vector.x >= -1 && vector.x <= 1 && vector.y >= -1 && vector.y <= 1;
             
             if (isOnScreen) {
                 intensity = 0.0; // Mute the ping entirely since they can see it
             }
             
             // Set Uniforms for Shader (Position and Scale are handled flawlessly by the Vertex Shader!)
             material.uniforms.uDirection.value.set(dirX, dirY);
             material.uniforms.uIntensity.value = intensity * animPower;
             
             const pCamera = camera as THREE.PerspectiveCamera;
             material.uniforms.uAspect.value = pCamera.aspect;
        }
    });

    if (!isGameActive) return null; // Unmount entirely when game is idle

    return (
        <>
            <group position={planetPosition}>
                <Sphere 
                    ref={meshRef} 
                    args={[15, 64, 64]} // Increased size to 15 radius 
                    scale={planetScale}
                    onClick={(e) => {
                        e.stopPropagation();
                        console.log("[HiddenPlanet] Discovered!");
                        onDiscover();
                    }}
                    onPointerOver={() => { document.body.style.cursor = 'pointer' }}
                    onPointerOut={() => { document.body.style.cursor = 'auto' }}
                >
                    {/* A mysterious minimal material until we have a real texture */}
                    <meshStandardMaterial 
                        color="#FFD700" 
                        emissive="#FF8C00"
                        emissiveIntensity={1.2}
                        roughness={0.1} 
                        metalness={0.9} 
                        wireframe={false}
                        transparent={true}
                    />
                </Sphere>
                
                {/* Unreal Engine style Audio Boundary Visualizations */}
                {showDebugSpheres && (
                    <>
                        {/* Inner Core (100% Volume Range) */}
                        <Sphere args={[refDistance, 32, 32]}>
                            <meshBasicMaterial color="#00ff00" wireframe transparent opacity={0.15} />
                        </Sphere>
                        {/* Outer Edge (Fade out to 0% Range) */}
                        <Sphere args={[maxDistance, 32, 32]}>
                            <meshBasicMaterial color="#ff0000" wireframe transparent opacity={0.05} />
                        </Sphere>
                    </>
                )}

                <primitive object={audio} />
            </group>

            {/* Default full-screen HUD Shader Plane */}
            <mesh ref={hintRef} renderOrder={999} frustumCulled={false}>
                <planeGeometry args={[2, 2]} />
                <shaderMaterial 
                    transparent
                    depthTest={false}
                    depthWrite={false}
                    blending={THREE.AdditiveBlending}
                    uniforms={{
                        uDirection: { value: new THREE.Vector2(0, 0) },
                        uIntensity: { value: 0 },
                        uAspect: { value: 1.0 },
                        uColor: { value: new THREE.Color('#FF8C00') }
                    }}
                    vertexShader={`
                        varying vec2 vUv;
                        void main() {
                            vUv = uv;
                            // Natively map geometry to the screen regardless of perspective camera math. 
                            // This completely guarantees ZERO dragging lag!
                            gl_Position = vec4(position.xy, 0.0, 1.0);
                        }
                    `}
                    fragmentShader={`
                        uniform vec2 uDirection;
                        uniform float uIntensity;
                        uniform float uAspect;
                        uniform vec3 uColor;
                        varying vec2 vUv;

                        void main() {
                            // -1.0 to 1.0 across the screen
                            vec2 pos = vUv * 2.0 - 1.0;

                            // Protect against zero division/NaN
                            vec2 dir = normalize(uDirection + vec2(0.0001, 0.0001));

                            // Calculate how far this pixel is pushed against the edge we are pointing to
                            float edgeSweep = dot(pos, dir);
                            
                            // Scale up the thickness on vertical (mobile) screens
                            // If aspect is 0.5 (tall phone), boost width by 2.0x so it's actually visible
                            float aspectBoost = max(1.0, 1.0 / uAspect);
                            
                            // Spread the glow dramatically further inside the screen
                            float bleedStart = 1.0 - (uIntensity * 0.75 * aspectBoost);
                            
                            // Smooth gradient wall from the margin bleed-start to slightly off-screen
                            float alpha = smoothstep(bleedStart, 1.1, edgeSweep);
                            
                            // Raised maximum opacity to make it powerful
                            alpha *= (uIntensity * 0.85);
                            
                            gl_FragColor = vec4(uColor, alpha);
                        }
                    `}
                />
            </mesh>
        </>
    );
}
