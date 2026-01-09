'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import Webcam from 'react-webcam';
import { motion, AnimatePresence } from 'framer-motion';
import { Canvas } from '@react-three/fiber';
import { useTexture, CameraShake } from '@react-three/drei';
import { Mic } from 'lucide-react';
import * as THREE from 'three';
import { useHandTracking } from '@/hooks/useHandTracking';

const FOX_TRIGGER_WORD = ['コン', 'こん'];
const WEB_APP_TITLE = 'FOX:SUMMON_NEXT';

// --- 3D Components ---

const ParallaxGroup = ({ children, intensity = 1 }: { children: React.ReactNode, intensity?: number }) => {
    const group = useRef<THREE.Group>(null);
    useEffect(() => {
        const handleMove = (e: MouseEvent) => {
            if (!group.current) return;
            const x = (e.clientX / window.innerWidth) * 2 - 1;
            const y = -(e.clientY / window.innerHeight) * 2 + 1;
            group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, y * 0.1 * intensity, 0.1);
            group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, x * 0.1 * intensity, 0.1);
        };
        window.addEventListener('mousemove', handleMove);
        return () => window.removeEventListener('mousemove', handleMove);
    }, [intensity]);
    return <group ref={group}>{children}</group>;
};

const Particles = ({ count = 20, color = "#ff5e00" }) => {
    const particles = useRef<any[]>([]);
    if (particles.current.length === 0) {
        for (let i = 0; i < count; i++) {
            particles.current.push({
                position: [(Math.random() - 0.5) * 15, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 8],
                size: Math.random() * 0.08 + 0.02
            });
        }
    }
    return (
        <group>
            {particles.current.map((p, i) => (
                <mesh key={i} position={p.position}>
                    <sphereGeometry args={[p.size, 8, 8]} />
                    <meshBasicMaterial color={color} transparent opacity={0.4} />
                </mesh>
            ))}
        </group>
    );
};

const FoxScene = ({ state, handX }: { state: string, handX: number }) => {
    const texRight = useTexture('/fox_right.jpg');
    const texLeft = useTexture('/fox_left.jpg');
    const isFromRight = handX > 0.5;
    const tex = isFromRight ? texRight : texLeft;

    const meshRef = useRef<THREE.Mesh>(null);
    const [opac, setOpac] = useState(0);
    const [scaleFactor, setScaleFactor] = useState(0.1);
    const [posX, setPosX] = useState(15);
    const [posY, setPosY] = useState(-5);

    useEffect(() => {
        let animId: number;
        const animate = () => {
            if (!meshRef.current) return;
            if (state === 'summoning') {
                const targetX = isFromRight ? -25 : 25;
                const startX = isFromRight ? 20 : -20;
                setPosX(prev => THREE.MathUtils.lerp(prev === 15 || prev === -15 ? startX : prev, targetX, 0.08));
                setPosY(prev => THREE.MathUtils.lerp(prev, 0, 0.15));
                setScaleFactor(prev => THREE.MathUtils.lerp(prev, 35, 0.05));
                setOpac(prev => THREE.MathUtils.lerp(prev, 1, 0.15));
            } else if (state === 'closeup') {
                setPosX(0);
                setPosY(0);
                setScaleFactor(prev => THREE.MathUtils.lerp(prev, 25, 0.1));
                setOpac(1);
            } else if (state === 'evaporating') {
                setScaleFactor(prev => prev + 1.2);
                setOpac(prev => Math.max(0, prev - 0.1));
            } else {
                setPosX(isFromRight ? 15 : -15);
                setPosY(-5);
                setScaleFactor(0.1);
                setOpac(0);
            }
            animId = requestAnimationFrame(animate);
        };
        animate();
        return () => cancelAnimationFrame(animId);
    }, [state, isFromRight]);

    return (
        <group>
            <ParallaxGroup intensity={2}>
                <Particles count={state === 'done' ? 100 : 30} color={state === 'done' ? "#ff0000" : "#ff004c"} />
            </ParallaxGroup>
            <mesh ref={meshRef} position={[posX, posY, -2]} scale={[scaleFactor, scaleFactor, 1]}>
                <planeGeometry args={[1, 1]} />
                <meshBasicMaterial
                    map={tex}
                    transparent
                    blending={state === 'evaporating' ? THREE.AdditiveBlending : THREE.NormalBlending}
                    depthTest={false}
                    opacity={opac}
                />
            </mesh>
        </group>
    );
};

const SummonEffects = ({ state }: { state: string }) => {
    if (state !== 'summoning' && state !== 'closeup') return null;
    return <CameraShake maxPitch={1.2} maxYaw={1.2} intensity={4} />;
};

export default function Home() {
    const [gameState, setGameState] = useState('idle');
    const [bgFrame, setBgFrame] = useState(0);
    const [cameraPermission, setCameraPermission] = useState(false);
    const webcamRef = useRef<any>(null);
    const { isFoxHand, handPosition } = useHandTracking(webcamRef);

    // Sync check for the hand silhouette
    const [isSynced, setIsSynced] = useState(false);

    useEffect(() => {
        if (!isFoxHand || !handPosition) {
            setIsSynced(false);
            return;
        }
        // Silhouette is at center area
        const targetX = 0.5;
        const targetY = 0.5;
        const dist = Math.sqrt(Math.pow(handPosition.x - targetX, 2) + Math.pow(handPosition.y - targetY, 2));
        setIsSynced(dist < 0.18);
    }, [isFoxHand, handPosition]);

    // Flip-book animation effect
    useEffect(() => {
        const interval = setInterval(() => {
            setBgFrame(prev => (prev + 1) % 2);
        }, 120);
        return () => clearInterval(interval);
    }, []);

    const playBeep = (freq = 880, length = 0.15) => {
        try {
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            oscillator.type = 'square';
            oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime);
            gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + length);
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + length);
        } catch (e) { }
    };

    useEffect(() => {
        if (['summoning', 'closeup', 'evaporating', 'done'].includes(gameState)) return;

        if (isSynced) {
            if (gameState !== 'locked') {
                setGameState('locked');
                playBeep(440, 0.2);
            }
        } else if (isFoxHand) {
            setGameState('detecting');
        } else {
            setGameState('idle');
        }
    }, [isSynced, isFoxHand, gameState]);

    useEffect(() => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) return;
        const recognition = new SpeechRecognition();
        recognition.lang = 'ja-JP';
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.onresult = (event: any) => {
            const lastResult = event.results[event.results.length - 1];
            const text = lastResult[0].transcript.trim();
            if (gameState === 'locked' && FOX_TRIGGER_WORD.some(word => text.includes(word))) {
                startSummon();
            }
        };
        recognition.start();
        return () => recognition.stop();
    }, [gameState]);

    const startSummon = () => {
        if (['summoning', 'closeup', 'evaporating', 'done'].includes(gameState)) return;
        setGameState('summoning');
        setTimeout(() => {
            setGameState('closeup');
            setTimeout(() => {
                setGameState('evaporating');
                setTimeout(() => setGameState('done'), 1000);
            }, 800);
        }, 1200);
    };

    return (
        <main className="relative w-full h-screen overflow-hidden bg-black text-white font-sans">
            {/* Background Layer: Animated Flip-book */}
            <div className="absolute inset-0 z-0">
                <img
                    src={gameState === 'done' ? "/city_bg.png" : (bgFrame === 0 ? "/city_bg.png" : "/city_bg2.png")}
                    alt="City Background"
                    className={`w-full h-full object-cover transition-none ${gameState === 'done' ? 'grayscale opacity-80 brightness-75' : 'opacity-70'}`}
                    style={gameState === 'done' ? { filter: 'sepia(1) saturate(5) hue-rotate(-50deg)' } : {}}
                />

                {/* Damage Overlay when done */}
                {gameState === 'done' && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="absolute inset-0 bg-red-900/40 mix-blend-multiply"
                    />
                )}
            </div>

            {/* Webcam Layer */}
            <div className="absolute top-4 right-4 w-64 h-48 z-40 rounded-lg overflow-hidden border-2 border-red-600/30 shadow-2xl">
                <Webcam
                    ref={webcamRef}
                    audio={false}
                    className="w-full h-full object-cover grayscale contrast-125 brightness-125"
                    onUserMedia={() => setCameraPermission(true)}
                    videoConstraints={{ facingMode: "user" }}
                />
            </div>

            {/* 3D Summoning Layer */}
            <div className="absolute inset-0 z-20 pointer-events-none">
                <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
                    <ambientLight intensity={1.5} />
                    <Suspense fallback={null}>
                        <FoxScene state={gameState} handX={handPosition?.x ?? 0.5} />
                        <SummonEffects state={gameState} />
                    </Suspense>
                </Canvas>
            </div>

            {/* Hand Sign Silhouette Overlay */}
            <AnimatePresence>
                {(gameState === 'detecting' || gameState === 'locked') && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: isSynced ? 0.3 : 0.6, scale: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-25 flex items-center justify-center pointer-events-none"
                    >
                        <div className={`w-96 h-96 transition-colors duration-300 ${isSynced ? 'text-red-600' : 'text-white'}`}>
                            <svg viewBox="0 0 100 100" className="w-full h-full fill-current">
                                <path d="M20,80 Q30,40 25,20 L35,45 Q50,40 65,45 L75,20 Q70,40 80,80 Z" />
                                <circle cx="50" cy="55" r="5" className="fill-red-600 animate-pulse" />
                            </svg>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* UI Overlay */}
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-between p-8 pointer-events-none">
                <div className="w-full flex justify-between items-start">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-red-600 animate-pulse rounded-full" />
                            <h1 className="text-2xl font-black tracking-tighter italic text-red-600">ANIME:REPRO_V1</h1>
                        </div>
                    </div>
                </div>

                <AnimatePresence>
                    {(gameState === 'detecting' || gameState === 'locked') && (
                        <div className="flex flex-col items-center gap-8 mb-32">
                            {/* Dialogue Message From Monster */}
                            <motion.div
                                initial={{ opacity: 0, y: 30 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-black/90 p-8 border-l-8 border-red-600 shadow-[0_0_50px_rgba(255,0,0,0.3)] max-w-xl"
                            >
                                <p className="text-red-500 text-xs font-mono uppercase tracking-[0.4em] mb-4">Signal: Synchronized</p>
                                <p className="text-white text-3xl font-black italic tracking-tighter leading-tight text-center">
                                    「準備はいいよ。いつでも喚びな…。」
                                </p>
                            </motion.div>

                            {isSynced && (
                                <motion.div
                                    animate={{ scale: [1, 1.1, 1] }}
                                    transition={{ repeat: Infinity, duration: 0.5 }}
                                    className="text-white font-black text-6xl italic drop-shadow-[0_0_40px_rgba(220,38,38,1)] uppercase"
                                >
                                    KON!
                                </motion.div>
                            )}
                        </div>
                    )}
                </AnimatePresence>

                {gameState === 'done' && (
                    <motion.div
                        initial={{ opacity: 0, scale: 2 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex flex-col items-center gap-4 bg-red-600 p-8 shadow-2xl"
                    >
                        <h2 className="text-5xl font-black italic">MISSION COMPLETE</h2>
                        <button
                            className="pointer-events-auto bg-white text-black px-10 py-3 font-black text-xl hover:bg-zinc-200 transition-colors uppercase italic"
                            onClick={() => setGameState('idle')}
                        >
                            Retry Summoning
                        </button>
                    </motion.div>
                )}

                <div className="w-full flex justify-between items-end">
                    <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
                        Frame: {bgFrame} / Mode: Cinematic Repro
                    </div>
                    <div className="bg-zinc-900/80 px-4 py-2 rounded-sm border-t-2 border-red-600 text-xs font-bold">
                        <span className="text-zinc-500 mr-2">STATE:</span>
                        <span className="text-red-500">{gameState.toUpperCase()}</span>
                    </div>
                </div>
            </div>

            {/* Trigger Layer */}
            <div
                className="absolute inset-0 z-50 opacity-0 cursor-crosshair"
                onClick={() => isSynced && startSummon()}
            />
        </main>
    );
}
