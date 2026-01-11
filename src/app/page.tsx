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
    const tex01 = useTexture('/fox01.png');
    const tex02 = useTexture('/fox02.png');
    const tex03 = useTexture('/fox03.png');

    const meshRef = useRef<THREE.Mesh>(null);
    const [opac, setOpac] = useState(0);
    const [scaleFactor, setScaleFactor] = useState(1);
    const [activeTex, setActiveTex] = useState<THREE.Texture>(tex01);

    useEffect(() => {
        let animId: number;
        const animate = () => {
            if (!meshRef.current) return;

            if (state === 'locked') {
                setActiveTex(tex01);
                setScaleFactor(13);
                setOpac(prev => THREE.MathUtils.lerp(prev, 1, 0.15));
            } else if (state === 'summoning' || state === 'closeup') {
                setActiveTex(tex02);
                setScaleFactor(prev => THREE.MathUtils.lerp(prev, 18, 0.2));
                setOpac(1);
            } else if (state === 'victory') {
                setOpac(0); // Hide fox to show the dead_bug background clearly
            } else if (state === 'cooloff') {
                setActiveTex(tex03);
                setScaleFactor(prev => THREE.MathUtils.lerp(prev, 11, 0.1));
                setOpac(prev => THREE.MathUtils.lerp(prev, 1, 0.1));
            } else if (state === 'evaporating') {
                setActiveTex(tex03);
                setScaleFactor(prev => prev + 0.01);
                setOpac(prev => Math.max(0, prev - 0.005));
            } else {
                setOpac(0);
                setScaleFactor(0.1);
            }
            animId = requestAnimationFrame(animate);
        };
        animate();
        return () => cancelAnimationFrame(animId);
    }, [state, tex01, tex02, tex03]);

    return (
        <group>
            <ParallaxGroup intensity={state === 'locked' ? 0.3 : 1.5}>
                <Particles count={state === 'evaporating' ? 180 : 30} color={state === 'evaporating' ? "#ffffff" : "#ff004c"} />
            </ParallaxGroup>
            <mesh ref={meshRef} position={[0, 0, -2]} scale={[scaleFactor, scaleFactor, 1]}>
                <planeGeometry args={[1, 1]} />
                <meshBasicMaterial
                    map={activeTex}
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
    const [webcamEnabled, setWebcamEnabled] = useState(false);
    const webcamRef = useRef<any>(null);
    const battleAudioRef = useRef<HTMLAudioElement | null>(null);
    const endingAudioRef = useRef<HTMLAudioElement | null>(null);

    // Initialize audio and handle browser autoplay policy
    useEffect(() => {
        battleAudioRef.current = new Audio('/battle.mp3');
        battleAudioRef.current.loop = true;
        endingAudioRef.current = new Audio('/ending.mp3');
        endingAudioRef.current.loop = true;

        const handleFirstInteraction = () => {
            if (gameState === 'idle' || gameState === 'detecting') {
                battleAudioRef.current?.play().catch(() => { });
            }
            window.removeEventListener('click', handleFirstInteraction);
            window.removeEventListener('keydown', handleFirstInteraction);
            window.removeEventListener('touchstart', handleFirstInteraction);
        };

        window.addEventListener('click', handleFirstInteraction);
        window.addEventListener('keydown', handleFirstInteraction);
        window.addEventListener('touchstart', handleFirstInteraction);

        return () => {
            battleAudioRef.current?.pause();
            endingAudioRef.current?.pause();
            window.removeEventListener('click', handleFirstInteraction);
            window.removeEventListener('keydown', handleFirstInteraction);
            window.removeEventListener('touchstart', handleFirstInteraction);
        };
    }, []);

    // Manage BGM states
    useEffect(() => {
        if (['idle', 'detecting'].includes(gameState)) {
            // Transition back to idle/detecting (on retry or start)
            endingAudioRef.current?.pause();
            if (endingAudioRef.current) endingAudioRef.current.currentTime = 0;
            battleAudioRef.current?.play().catch(() => { });
        } else if (['locked', 'summoning', 'closeup', 'victory', 'cooloff', 'evaporating'].includes(gameState)) {
            // Hand recognized or summon in progress
            battleAudioRef.current?.pause();
            if (battleAudioRef.current) battleAudioRef.current.currentTime = 0;
            endingAudioRef.current?.pause();
        } else if (gameState === 'done') {
            // Mission complete, waiting state
            battleAudioRef.current?.pause();
            endingAudioRef.current?.play().catch(() => { });
        }
    }, [gameState]);

    // Initial delay for camera to "boot up"
    useEffect(() => {
        const timer = setTimeout(() => {
            setWebcamEnabled(true);
        }, 1500);
        return () => clearTimeout(timer);
    }, []);

    const { isFoxHand, handPosition } = useHandTracking(webcamRef, gameState + cameraPermission + webcamEnabled);

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
        if (['locked', 'summoning', 'closeup', 'victory', 'cooloff', 'evaporating', 'done'].includes(gameState)) return;

        if (isSynced) {
            setGameState('locked');
            playBeep(440, 0.2);
        } else if (isFoxHand) {
            setGameState('detecting');
        } else {
            setGameState('idle');
        }
    }, [isSynced, isFoxHand, gameState]);

    // Use a ref for gameState to avoid restarting recognition on every state change
    const gameStateRef = useRef(gameState);
    useEffect(() => {
        gameStateRef.current = gameState;
    }, [gameState]);

    const recognitionRef = useRef<any>(null);

    useEffect(() => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.error('Speech recognition not supported');
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = 'ja-JP';
        recognition.continuous = true;
        recognition.interimResults = true;
        recognitionRef.current = recognition;

        let activelyListening = false;

        recognition.onresult = (event: any) => {
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const text = event.results[i][0].transcript.trim();
                if (gameStateRef.current === 'locked' && FOX_TRIGGER_WORD.some(word => text.includes(word))) {
                    startSummon();
                }
            }
        };

        recognition.onend = () => {
            if (activelyListening) {
                try {
                    recognition.start();
                } catch (e) {
                    console.error('Speech recognition restart failed:', e);
                }
            }
        };

        recognition.onerror = (event: any) => {
            if (event.error === 'not-allowed') {
                activelyListening = false;
            }
        };

        // Function to start recognition on user gesture
        const startRecognitionOnGesture = () => {
            if (!activelyListening) {
                activelyListening = true;
                try {
                    recognition.start();
                    console.log('Speech recognition started by user gesture');
                } catch (e) {
                    console.error('Speech recognition start failed:', e);
                }
            }
        };

        window.addEventListener('click', startRecognitionOnGesture);
        window.addEventListener('touchstart', startRecognitionOnGesture);

        return () => {
            activelyListening = false;
            recognition.stop();
            window.removeEventListener('click', startRecognitionOnGesture);
            window.removeEventListener('touchstart', startRecognitionOnGesture);
        };
    }, []);

    const playSummonSound = () => {
        try {
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const masterGain = audioCtx.createGain();
            masterGain.connect(audioCtx.destination);
            masterGain.gain.setValueAtTime(1.0, audioCtx.currentTime);

            // 1. Ominous Buildup (Rising frequency and volume)
            const buildUp = audioCtx.createOscillator();
            buildUp.type = 'sawtooth';
            buildUp.frequency.setValueAtTime(40, audioCtx.currentTime);
            buildUp.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + 1.2);

            const buildGain = audioCtx.createGain();
            buildGain.gain.setValueAtTime(0, audioCtx.currentTime);
            buildGain.gain.linearRampToValueAtTime(0.6, audioCtx.currentTime + 1.0);

            const buildFilter = audioCtx.createBiquadFilter();
            buildFilter.type = 'lowpass';
            buildFilter.frequency.setValueAtTime(200, audioCtx.currentTime);
            buildFilter.frequency.exponentialRampToValueAtTime(2000, audioCtx.currentTime + 1.2);

            buildUp.connect(buildFilter);
            buildFilter.connect(buildGain);
            buildGain.connect(masterGain);
            buildUp.start();
            buildUp.stop(audioCtx.currentTime + 1.5);

            // 2. Heavy Whoosh / Wind
            const noiseBuffer = audioCtx.createBuffer(1, audioCtx.sampleRate * 4, audioCtx.sampleRate);
            const noiseData = noiseBuffer.getChannelData(0);
            for (let i = 0; i < noiseData.length; i++) noiseData[i] = Math.random() * 2 - 1;

            const whoosh = audioCtx.createBufferSource();
            whoosh.buffer = noiseBuffer;
            const whooshFilter = audioCtx.createBiquadFilter();
            whooshFilter.type = 'bandpass';
            whooshFilter.frequency.setValueAtTime(100, audioCtx.currentTime);
            whooshFilter.frequency.exponentialRampToValueAtTime(4000, audioCtx.currentTime + 1.2);

            const whooshGain = audioCtx.createGain();
            whooshGain.gain.setValueAtTime(0, audioCtx.currentTime);
            whooshGain.gain.linearRampToValueAtTime(1.0, audioCtx.currentTime + 1.0);
            whooshGain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 3.0);

            whoosh.connect(whooshFilter);
            whooshFilter.connect(whooshGain);
            whooshGain.connect(masterGain);
            whoosh.start();

            // 3. THE GRAND BITE (Impact at 1.2s)
            setTimeout(() => {
                const now = audioCtx.currentTime;

                // A. Sub-bass Explosion
                const impact = audioCtx.createOscillator();
                impact.type = 'triangle';
                impact.frequency.setValueAtTime(150, now);
                impact.frequency.exponentialRampToValueAtTime(30, now + 1.0);
                const impactGain = audioCtx.createGain();
                impactGain.gain.setValueAtTime(2.0, now);
                impactGain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);
                impact.connect(impactGain);
                impactGain.connect(masterGain);
                impact.start(now);
                impact.stop(now + 2.0);

                // B. Hard Crunch
                const crunch = audioCtx.createBufferSource();
                crunch.buffer = noiseBuffer;
                const crunchFilter = audioCtx.createBiquadFilter();
                crunchFilter.type = 'lowpass';
                crunchFilter.frequency.setValueAtTime(1200, now);
                const crunchGain = audioCtx.createGain();
                crunchGain.gain.setValueAtTime(1.5, now);
                crunchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
                crunch.connect(crunchFilter);
                crunchFilter.connect(crunchGain);
                crunchGain.connect(masterGain);
                crunch.start(now);
                crunch.stop(now + 1.0);

                // C. High-pitched Ringing (Aftershock)
                const ring = audioCtx.createOscillator();
                ring.type = 'sine';
                ring.frequency.setValueAtTime(1000, now);
                const ringGain = audioCtx.createGain();
                ringGain.gain.setValueAtTime(0.3, now);
                ringGain.gain.exponentialRampToValueAtTime(0.001, now + 2.5);
                ring.connect(ringGain);
                ringGain.connect(masterGain);
                ring.start(now);
                ring.stop(now + 2.8);
            }, 1200);

        } catch (e) { }
    };

    const startSummon = () => {
        if (['summoning', 'closeup', 'victory', 'cooloff', 'evaporating', 'done'].includes(gameState)) return;
        playSummonSound();
        setGameState('summoning');

        // 1. Attack Moment (fox02)
        setTimeout(() => {
            setGameState('closeup');

            // 2. Victory Announcement (dead_bug.jpg only)
            setTimeout(() => {
                setGameState('victory');

                // 3. Sitting Fox Appearing (fox03)
                setTimeout(() => {
                    setGameState('cooloff');

                    // 4. Final slow evaporation
                    setTimeout(() => {
                        setGameState('evaporating');
                        setTimeout(() => setGameState('done'), 5000);
                    }, 4000);
                }, 3000); // Display victory scene for 3 seconds
            }, 1500); // Attack duration
        }, 1200);
    };

    const showWebcam = ['idle', 'detecting'].includes(gameState) && webcamEnabled;

    const isBiting = ['summoning', 'closeup'].includes(gameState);
    const isFoxEnding = ['cooloff', 'evaporating'].includes(gameState);

    return (
        <main className="relative w-full h-screen overflow-hidden bg-black text-white font-sans">
            {/* Ultra Background: Massive Fox Backdrop during Summoning */}
            {/* Ultra Background: Massive Fox Backdrop during Summoning */}
            <AnimatePresence>
                {isBiting && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0, x: "-50%", y: "-50%", left: "50%", top: "50%" }}
                        animate={{ opacity: 1, scale: 1.5, x: "-50%", y: "-50%" }}
                        exit={{ opacity: 0, scale: 2 }}
                        transition={{
                            duration: 0.8,
                            ease: [0.22, 1, 0.36, 1]
                        }}
                        className="absolute z-50 pointer-events-none w-full h-full origin-center"
                    >
                        <img
                            src="/fox02.png"
                            className="w-full h-full object-cover brightness-90 shadow-[0_0_100px_rgba(255,0,0,0.5)]"
                            alt="Attack Fox"
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

            {/* Background Layer (The Story Canvas) */}
            <div className="absolute inset-0 z-0 bg-zinc-900">
                <motion.img
                    src={['summoning', 'closeup', 'victory', 'cooloff', 'evaporating', 'done'].includes(gameState) ? "/dead_bug.jpg" : (bgFrame === 0 ? "/city_bug01.jpg" : "/city_bug02.jpg")}
                    alt="Story Background"
                    className={`w-full h-full object-cover transition-all duration-1000 ${gameState === 'done' ? 'grayscale opacity-60' : 'opacity-80'}`}
                    animate={['idle', 'detecting', 'locked'].includes(gameState) ? {
                        scale: [1, 1.05, 1],
                        x: [0, 8, -8, 0],
                        y: [0, 5, -5, 0],
                    } : { scale: 1, x: 0, y: 0 }}
                    transition={{
                        duration: 8,
                        repeat: Infinity,
                        ease: "easeInOut"
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

            {/* Webcam Layer (Always mounted for persistence, hidden when not needed) */}
            <div
                className={`absolute top-4 right-4 w-64 h-48 z-40 rounded-lg overflow-hidden border-2 border-red-600/30 shadow-2xl transition-all duration-700 pointer-events-none
                ${showWebcam ? 'opacity-100 translate-x-0 scale-100' : 'opacity-0 translate-x-20 scale-50'}`}
            >
                <div className="relative w-full h-full pointer-events-auto">
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
                </div>
            </div>

            {/* 3D Summoning Layer */}
            <div className="absolute inset-0 z-20 pointer-events-none">
                <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
                    <ambientLight intensity={1.5} />
                    <Suspense fallback={null}>
                        <FoxScene state={gameState} />
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
                        <span className="text-zinc-500 mr-2">SYSTEM:</span>
                        <span className="text-red-500">{gameState === 'locked' ? 'READY_FOR_SUMMON' : gameState.toUpperCase()}</span>
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
