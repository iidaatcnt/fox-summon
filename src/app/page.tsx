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
                const targetX = isFromRight ? -30 : 30;
                const startX = isFromRight ? 25 : -25;
                // Slightly slower sweep to make the fox head recognizable
                setPosX(prev => {
                    const next = THREE.MathUtils.lerp(prev === 15 || prev === -15 ? startX : prev, targetX, 0.08);
                    return next;
                });
                setPosY(prev => THREE.MathUtils.lerp(prev, 0, 0.15));
                setScaleFactor(prev => THREE.MathUtils.lerp(prev, 40, 0.06)); // Still massive but builds up
                setOpac(prev => THREE.MathUtils.lerp(prev, 1, 0.2));
            } else if (state === 'closeup') {
                setPosX(0);
                setPosY(0);
                setScaleFactor(prev => THREE.MathUtils.lerp(prev, 30, 0.1));
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
    const { isFoxHand, handPosition } = useHandTracking(webcamRef, gameState + cameraPermission);

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

    // Slow swaying background (yurari-yurari) and occasional frame swap
    useEffect(() => {
        const interval = setInterval(() => {
            // Randomly swap image every few seconds instead of rapid flickering
            if (Math.random() > 0.7) {
                setBgFrame(prev => (prev + 1) % 2);
            }
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    // Keyboard support: Space to retry after mission complete
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'Space' && gameState === 'done') {
                setGameState('idle');
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [gameState]);

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
        // Once locked or summoning, we don't fall back to idle via hand tracking
        if (['locked', 'summoning', 'closeup', 'evaporating', 'done'].includes(gameState)) return;

        if (isSynced) {
            setGameState('locked');
            playBeep(440, 0.2);
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

    const playSummonSound = () => {
        try {
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const masterGain = audioCtx.createGain();
            masterGain.connect(audioCtx.destination);

            // 1. Ominous Low Growl (Foundation)
            const baseOsc = audioCtx.createOscillator();
            baseOsc.type = 'sawtooth';
            baseOsc.frequency.setValueAtTime(60, audioCtx.currentTime);
            baseOsc.frequency.exponentialRampToValueAtTime(30, audioCtx.currentTime + 2);

            const baseGain = audioCtx.createGain();
            baseGain.gain.setValueAtTime(0.15, audioCtx.currentTime);
            baseGain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 2);

            baseOsc.connect(baseGain);
            baseGain.connect(masterGain);
            baseOsc.start();
            baseOsc.stop(audioCtx.currentTime + 2.5);

            // 2. Whoosh Effect (Transition)
            const noiseBuffer = audioCtx.createBuffer(1, audioCtx.sampleRate * 2, audioCtx.sampleRate);
            const noiseData = noiseBuffer.getChannelData(0);
            for (let i = 0; i < noiseData.length; i++) noiseData[i] = Math.random() * 2 - 1;

            const whoosh = audioCtx.createBufferSource();
            whoosh.buffer = noiseBuffer;
            const whooshFilter = audioCtx.createBiquadFilter();
            whooshFilter.type = 'bandpass';
            whooshFilter.frequency.setValueAtTime(100, audioCtx.currentTime);
            whooshFilter.frequency.exponentialRampToValueAtTime(2000, audioCtx.currentTime + 0.8);

            const whooshGain = audioCtx.createGain();
            whooshGain.gain.setValueAtTime(0, audioCtx.currentTime);
            whooshGain.gain.linearRampToValueAtTime(0.4, audioCtx.currentTime + 0.1);
            whooshGain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.2);

            whoosh.connect(whooshFilter);
            whooshFilter.connect(whooshGain);
            whooshGain.connect(masterGain);
            whoosh.start();

            // 3. THE BITE (Gabburi!) - Multiple layers
            setTimeout(() => {
                const now = audioCtx.currentTime;

                // A. Heavy Impact (Sub-bass)
                const impact = audioCtx.createOscillator();
                impact.type = 'sine';
                impact.frequency.setValueAtTime(150, now);
                impact.frequency.exponentialRampToValueAtTime(40, now + 0.3);
                const impactGain = audioCtx.createGain();
                impactGain.gain.setValueAtTime(0.8, now);
                impactGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
                impact.connect(impactGain);
                impactGain.connect(masterGain);
                impact.start(now);
                impact.stop(now + 0.5);

                // B. Fleshy Crunch (White Noise with fast decay)
                const crunch = audioCtx.createBufferSource();
                crunch.buffer = noiseBuffer;
                const crunchFilter = audioCtx.createBiquadFilter();
                crunchFilter.type = 'lowpass';
                crunchFilter.frequency.setValueAtTime(2000, now);
                const crunchGain = audioCtx.createGain();
                crunchGain.gain.setValueAtTime(0.6, now);
                crunchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
                crunch.connect(crunchFilter);
                crunchFilter.connect(crunchGain);
                crunchGain.connect(masterGain);
                crunch.start(now);
                crunch.stop(now + 0.2);

                // C. High Transient (The "Snap")
                const snap = audioCtx.createOscillator();
                snap.type = 'square';
                snap.frequency.setValueAtTime(1200, now);
                const snapGain = audioCtx.createGain();
                snapGain.gain.setValueAtTime(0.1, now);
                snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
                snap.connect(snapGain);
                snapGain.connect(masterGain);
                snap.start(now);
                snap.stop(now + 0.1);
            }, 600); // Synchronized with the Fox sweep peak

        } catch (e) { }
    };

    const startSummon = () => {
        if (['summoning', 'closeup', 'evaporating', 'done'].includes(gameState)) return;
        playSummonSound();
        setGameState('summoning');
        // Give more time in 'summoning' and 'closeup' to see the fox clearly
        setTimeout(() => {
            setGameState('closeup');
            setTimeout(() => {
                setGameState('evaporating');
                setTimeout(() => setGameState('done'), 1000);
            }, 1000); // 1.0s closeup to see the face
        }, 1500); // 1.5s sweep time
    };

    const showWebcam = ['idle', 'detecting'].includes(gameState);

    const isBiting = ['summoning', 'closeup', 'evaporating'].includes(gameState);

    return (
        <main className="relative w-full h-screen overflow-hidden bg-black text-white font-sans">
            {/* Ultra Background: Massive Fox Backdrop during Summoning */}
            {/* Ultra Background: Massive Fox Backdrop during Summoning */}
            <AnimatePresence>
                {isBiting && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.05, x: "-50%", y: "-50%", left: "50%", top: "50%" }}
                        animate={{ opacity: 1, scale: 1, x: "-50%", y: "-50%" }}
                        exit={{ opacity: 0, scale: 2, x: "-50%", y: "-50%" }}
                        transition={{
                            duration: 0.5,
                            ease: [0.16, 1, 0.3, 1]
                        }}
                        className="absolute z-10 pointer-events-none w-full h-full origin-center"
                    >
                        <img
                            src="/fox_right.jpg"
                            className="w-full h-full object-cover brightness-75 shadow-[0_0_100px_rgba(255,0,0,0.5)]"
                            alt="Background Fox"
                        />
                        {/* Dramatic Red Flash Overlay */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: [0, 0.8, 0] }}
                            transition={{ duration: 0.5 }}
                            className="absolute inset-0 bg-red-600 mix-blend-overlay"
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Background Layer: Animated Flip-book */}
            <div className="absolute inset-0 z-0">
                <motion.img
                    src={gameState === 'done' ? "/city_bg.png" : (bgFrame === 0 ? "/city_bg.png" : "/city_bg2.png")}
                    alt="City Background"
                    className={`w-full h-full object-cover transition-none ${gameState === 'done' ? 'grayscale opacity-80 brightness-75' : 'opacity-70'}`}
                    style={gameState === 'done' ? { filter: 'sepia(1) saturate(5) hue-rotate(-50deg)' } : {}}
                    animate={gameState !== 'done' ? {
                        scale: [1, 1.05, 1],
                        x: [0, 20, -20, 0],
                        y: [0, 10, -10, 0],
                    } : {}}
                    transition={{
                        duration: 20,
                        repeat: Infinity,
                        ease: "linear"
                    }}
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
            <AnimatePresence>
                {showWebcam && (
                    <motion.div
                        initial={{ opacity: 0, x: 100 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.5 } }}
                        className="absolute top-4 right-4 w-64 h-48 z-40 rounded-lg overflow-hidden border-2 border-red-600/30 shadow-2xl"
                    >
                        <Webcam
                            ref={webcamRef}
                            audio={false}
                            className="w-full h-full object-cover grayscale contrast-125 brightness-125"
                            onUserMedia={() => setCameraPermission(true)}
                            videoConstraints={{ facingMode: "user" }}
                        />

                        {/* HUD / Monitoring Lines */}
                        <div className="absolute inset-0 pointer-events-none">
                            <motion.div
                                className="w-full h-[2px] bg-red-500/50 shadow-[0_0_8px_rgba(239,68,68,0.8)]"
                                animate={{ top: ["0%", "100%", "0%"] }}
                                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                            />
                            {/* Corners */}
                            <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-red-500/60" />
                            <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-red-500/60" />
                            <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-red-500/60" />
                            <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-red-500/60" />

                            <div className="absolute bottom-2 right-8 text-[8px] font-mono text-red-500/80 animate-pulse">
                                {isFoxHand ? "HAND_READY" : "SCANNING_HAND"}
                            </div>

                            {/* Tracking Dot Feedback */}
                            {handPosition && (
                                <div
                                    className="absolute w-2 h-2 bg-red-500 rounded-full shadow-[0_0_8px_#f00] transition-all duration-75"
                                    style={{
                                        left: `${handPosition.x * 100}%`,
                                        top: `${handPosition.y * 100}%`,
                                        transform: 'translate(-50%, -50%)'
                                    }}
                                />
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

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
                        animate={{
                            opacity: isSynced ? 0.3 : 0.6,
                            scale: isFoxHand ? 1 : 0.95,
                        }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-25 flex items-center justify-center pointer-events-none"
                    >
                        <div className={`w-96 h-96 transition-all duration-300 ${isSynced ? 'text-red-600 drop-shadow-[0_0_30px_rgba(255,0,0,0.8)]' : 'text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]'}`}>
                            {/* Inner detection glow */}
                            {isFoxHand && (
                                <motion.div
                                    className="absolute inset-0 bg-red-500/10 blur-3xl rounded-full"
                                    animate={{ scale: [1, 1.2, 1] }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                />
                            )}
                            <svg viewBox="0 0 100 100" className="w-full h-full fill-current">
                                <path d="M20,80 Q30,40 25,20 L35,45 Q50,40 65,45 L75,20 Q70,40 80,80 Z" />
                                <circle cx="50" cy="55" r="5" className={`animate-pulse ${isSynced ? 'fill-red-400' : 'fill-red-600'}`} />
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
