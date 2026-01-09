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

const FoxScene = ({ state }: { state: string }) => {
    const tex = useTexture('/fox_demon.png');
    const meshRef = useRef<THREE.Mesh>(null);
    const [opac, setOpac] = useState(0);
    const [scaleFactor, setScaleFactor] = useState(0.1);
    const [posX, setPosX] = useState(10);

    useEffect(() => {
        let animId: number;
        const animate = () => {
            if (!meshRef.current) return;
            if (state === 'summoning') {
                setPosX(prev => THREE.MathUtils.lerp(prev, 0, 0.1));
                setScaleFactor(prev => THREE.MathUtils.lerp(prev, 2.5, 0.08));
                setOpac(prev => THREE.MathUtils.lerp(prev, 1, 0.1));
            } else if (state === 'closeup') {
                setPosX(0);
                setScaleFactor(prev => THREE.MathUtils.lerp(prev, 15, 0.05));
                setOpac(1);
            } else if (state === 'evaporating') {
                setScaleFactor(prev => prev + 0.3);
                setOpac(prev => Math.max(0, prev - 0.02));
            } else {
                setPosX(10);
                setScaleFactor(0.1);
                setOpac(0);
            }
            animId = requestAnimationFrame(animate);
        };
        animate();
        return () => cancelAnimationFrame(animId);
    }, [state]);

    return (
        <group>
            <ParallaxGroup intensity={2}>
                <Particles count={50} color={state === 'evaporating' ? "#ffffff" : "#ff004c"} />
            </ParallaxGroup>
            <mesh ref={meshRef} position={[posX, -0.5, -5]} scale={[scaleFactor, scaleFactor, 1]}>
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
    return <CameraShake maxY={0.2} maxYYaw={0.2} intensity={1} />;
};

export default function Home() {
    const [gameState, setGameState] = useState('idle');
    const [cameraPermission, setCameraPermission] = useState(false);
    const webcamRef = useRef<any>(null);
    const { isFoxHand } = useHandTracking(webcamRef);

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
        if (['summoning', 'closeup', 'evaporating'].includes(gameState)) return;
        if (isFoxHand) {
            if (gameState !== 'locked') {
                setGameState('locked');
                playBeep();
            }
        } else if (gameState === 'locked') {
            setGameState('idle');
        }
    }, [isFoxHand, gameState]);

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
        setGameState('summoning');
        setTimeout(() => {
            setGameState('closeup');
            setTimeout(() => {
                setGameState('evaporating');
                setTimeout(() => setGameState('idle'), 1500);
            }, 1500);
        }, 1000);
    };

    return (
        <main className="relative w-full h-screen overflow-hidden bg-black text-white font-sans">
            <div className="absolute inset-0 z-0 bg-[#0a0a0c]">
                <Webcam
                    ref={webcamRef}
                    audio={false}
                    className="w-full h-full object-cover opacity-70 grayscale contrast-125"
                    onUserMedia={() => setCameraPermission(true)}
                    videoConstraints={{ facingMode: "user" }}
                />
                <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.03),rgba(0,255,0,0.01),rgba(0,0,255,0.03))] z-1 bg-[length:100%_2px,3px_100%] pointer-events-none" />
            </div>

            <div className="absolute inset-0 z-10 pointer-events-none">
                <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
                    <ambientLight intensity={1.5} />
                    <Suspense fallback={null}>
                        <FoxScene state={gameState} />
                        <SummonEffects state={gameState} />
                    </Suspense>
                </Canvas>
            </div>

            <div className="absolute inset-0 z-20 flex flex-col items-center justify-between p-8 pointer-events-none">
                <div className="w-full flex justify-between items-start">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-red-600 animate-pulse rounded-full" />
                            <h1 className="text-2xl font-black tracking-tighter italic text-red-600">FOX:SUMMON_NEXT</h1>
                        </div>
                        <div className="text-[10px] font-mono text-red-500/60 uppercase tracking-widest pl-5">
                            System Active: Detection On
                        </div>
                    </div>
                    <div className="p-2 border border-white/10 rounded-full bg-black/40 backdrop-blur-sm shadow-xl">
                        <Mic className={`w-6 h-6 ${gameState === 'locked' ? 'text-red-500 animate-pulse' : 'text-zinc-600'}`} />
                    </div>
                </div>

                <AnimatePresence>
                    {gameState === 'locked' && (
                        <motion.div
                            initial={{ scale: 2, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.5, opacity: 0 }}
                            className="relative w-72 h-72 flex items-center justify-center"
                        >
                            <div className="absolute top-0 left-0 w-12 h-12 border-t-2 border-l-2 border-red-600" />
                            <div className="absolute top-0 right-0 w-12 h-12 border-t-2 border-r-2 border-red-600" />
                            <div className="absolute bottom-0 left-0 w-12 h-12 border-b-2 border-l-2 border-red-600" />
                            <div className="absolute bottom-0 right-0 w-12 h-12 border-b-2 border-r-2 border-red-600" />
                            <div className="text-center">
                                <p className="text-red-600 font-black text-xs tracking-widest uppercase mb-1">Target Locked</p>
                                <p className="text-white font-bold text-2xl tracking-tighter">コン！と言え</p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <AnimatePresence>
                    {(gameState === 'summoning' || gameState === 'closeup') && (
                        <motion.div
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1.2, opacity: 1 }}
                            exit={{ scale: 2, opacity: 0, filter: 'blur(20px)' }}
                            className="absolute inset-0 flex items-center justify-center bg-red-600/10"
                        >
                            <h2 className="text-9xl font-black italic text-white drop-shadow-[0_0_50px_rgba(255,255,255,0.8)]">KON!</h2>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="w-full flex justify-between items-end">
                    <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
                        Devil Mode / Priority: Max
                    </div>
                    <div className="bg-zinc-900/80 px-4 py-2 rounded-sm border-t-2 border-red-600 text-xs font-bold">
                        <span className="text-zinc-500 mr-2">STATE:</span>
                        <span className="text-red-500">{gameState.toUpperCase()}</span>
                    </div>
                </div>
            </div>

            <div
                className="absolute inset-0 z-30 opacity-0 cursor-crosshair"
                onClick={() => gameState === 'locked' && startSummon()}
            />
        </main>
    );
}
