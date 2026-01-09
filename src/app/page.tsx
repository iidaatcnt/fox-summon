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
    // If hand is on the right side of screen (handX > 0.5), summon from right (use right texture).
    // Note: textures are already flipped so texRight is fox looking left (summoned from right),
    // and texLeft is fox looking right (summoned from left).
    const isFromRight = handX > 0.5;
    const tex = isFromRight ? texRight : texLeft;

    const meshRef = useRef<THREE.Mesh>(null);
    const [opac, setOpac] = useState(0);
    const [scaleFactor, setScaleFactor] = useState(0.1);
    const [posX, setPosX] = useState(10);
    const [posY, setPosY] = useState(-5);

    useEffect(() => {
        let animId: number;
        const animate = () => {
            if (!meshRef.current) return;
            if (state === 'summoning') {
                const targetX = 0;
                const startX = isFromRight ? 8 : -8;
                setPosX(prev => THREE.MathUtils.lerp(prev === 10 || prev === -10 ? startX : prev, targetX, 0.15));
                setPosY(prev => THREE.MathUtils.lerp(prev, 0, 0.15));
                setScaleFactor(prev => THREE.MathUtils.lerp(prev, 4, 0.1));
                setOpac(prev => THREE.MathUtils.lerp(prev, 1, 0.1));
            } else if (state === 'closeup') {
                setPosX(0);
                setPosY(0);
                setScaleFactor(prev => THREE.MathUtils.lerp(prev, 18, 0.08));
                setOpac(1);
            } else if (state === 'evaporating') {
                setScaleFactor(prev => prev + 0.5);
                setOpac(prev => Math.max(0, prev - 0.05));
            } else {
                setPosX(isFromRight ? 10 : -10);
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
                <Particles count={50} color={state === 'evaporating' ? "#ffffff" : "#ff004c"} />
            </ParallaxGroup>
            <mesh ref={meshRef} position={[posX, posY, -5]} scale={[scaleFactor, scaleFactor, 1]}>
                <planeGeometry args={[1.5, 1.5]} />
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
    return <CameraShake maxPitch={0.5} maxYaw={0.5} intensity={2} />;
};

export default function Home() {
    const [gameState, setGameState] = useState('idle');
    const [cameraPermission, setCameraPermission] = useState(false);
    const webcamRef = useRef<any>(null);
    const { isFoxHand, handPosition } = useHandTracking(webcamRef);

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
        if (gameState === 'summoning' || gameState === 'closeup' || gameState === 'evaporating') return;
        setGameState('summoning');
        setTimeout(() => {
            setGameState('closeup');
            setTimeout(() => {
                setGameState('evaporating');
                setTimeout(() => setGameState('idle'), 1500);
            }, 1000);
        }, 800);
    };

    return (
        <main className="relative w-full h-screen overflow-hidden bg-black text-white font-sans">
            {/* Background Layer: City with Leech Monster */}
            <div className="absolute inset-0 z-0">
                <img
                    src="/city_bg.png"
                    alt="City Background"
                    className="w-full h-full object-cover opacity-60"
                />
                <div className="absolute inset-0 bg-black/30" />
            </div>

            {/* Webcam Layer */}
            <div className="absolute top-4 right-4 w-64 h-48 z-10 rounded-lg overflow-hidden border-2 border-red-600/30 shadow-2xl">
                <Webcam
                    ref={webcamRef}
                    audio={false}
                    className="w-full h-full object-cover grayscale contrast-125"
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

            {/* UI Overlay */}
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-between p-8 pointer-events-none">
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
                </div>

                <AnimatePresence>
                    {gameState === 'locked' && (
                        <div className="flex flex-col items-center gap-8">
                            {/* Dialogue Message From Monster */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                className="bg-black/80 backdrop-blur-md border-l-4 border-red-600 p-6 rounded-r-xl max-w-sm shadow-2xl"
                            >
                                <p className="text-red-500 text-[10px] font-mono uppercase tracking-[0.3em] mb-2">Internal Signal</p>
                                <p className="text-white text-xl font-bold leading-relaxed italic">
                                    「準備はいいよ。いつでも喚びな…。」
                                </p>
                            </motion.div>

                            <motion.div
                                initial={{ scale: 2, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.5, opacity: 0 }}
                                className="relative w-64 h-64 flex items-center justify-center"
                            >
                                <div className="absolute top-0 left-0 w-12 h-12 border-t-2 border-l-2 border-red-600" />
                                <div className="absolute top-0 right-0 w-12 h-12 border-t-2 border-r-2 border-red-600" />
                                <div className="absolute bottom-0 left-0 w-12 h-12 border-b-2 border-l-2 border-red-600" />
                                <div className="absolute bottom-0 right-0 w-12 h-12 border-b-2 border-r-2 border-red-600" />
                                <div className="text-center">
                                    <p className="text-red-500 font-bold text-3xl tracking-tighter drop-shadow-[0_0_10px_rgba(220,38,38,0.5)]">
                                        コン！
                                    </p>
                                    <p className="text-white/50 text-[10px] mt-2 font-mono uppercase">Voice Trigger Ready</p>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                <AnimatePresence>
                    {(gameState === 'summoning' || gameState === 'closeup') && (
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1.5, opacity: 1 }}
                            exit={{ scale: 3, opacity: 0, filter: 'blur(20px)' }}
                            className="absolute inset-0 flex items-center justify-center"
                        >
                            <h2 className="text-[12rem] font-black italic text-white drop-shadow-[0_0_60px_rgba(255,255,255,0.8)] mix-blend-overlay">KON!</h2>
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

            {/* Click Trigger for Testing */}
            <div
                className="absolute inset-0 z-40 opacity-0 cursor-crosshair"
                onClick={() => gameState === 'locked' && startSummon()}
            />
        </main>
    );
}
