'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import Webcam from 'react-webcam';
import { motion, AnimatePresence } from 'framer-motion';
import { Canvas } from '@react-three/fiber';
import { useTexture, CameraShake } from '@react-three/drei';
import { Mic, MicOff, Camera, VideoOff } from 'lucide-react';
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
    const [micPermission, setMicPermission] = useState(false);
    const [webcamEnabled, setWebcamEnabled] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);
    const [initStatus, setInitStatus] = useState('STANDBY');
    const [isSpeechSupported, setIsSpeechSupported] = useState(true);

    const [isMicActive, setIsMicActive] = useState(false);
    const [lastHeard, setLastHeard] = useState('');

    const webcamRef = useRef<any>(null);
    const battleAudioRef = useRef<HTMLAudioElement | null>(null);
    const endingAudioRef = useRef<HTMLAudioElement | null>(null);
    const recognitionRef = useRef<any>(null);
    const activelyListeningRef = useRef(false);

    // Use a ref for gameState to avoid restarting recognition on every state change
    const gameStateRef = useRef(gameState);
    useEffect(() => {
        gameStateRef.current = gameState;
    }, [gameState]);

    // Check support and permissions on mount
    useEffect(() => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            setIsSpeechSupported(false);
        }

        // Proactively check mic if possible (some browsers allow this without prompt if previously granted)
        navigator.mediaDevices.enumerateDevices().then(devices => {
            const hasMic = devices.some(device => device.kind === 'audioinput');
            if (!hasMic) {
                setMicPermission(false);
            }
        }).catch(() => { });

        battleAudioRef.current = new Audio('/battle.mp3');
        battleAudioRef.current.loop = true;
        endingAudioRef.current = new Audio('/ending.mp3');
        endingAudioRef.current.loop = true;

        return () => {
            battleAudioRef.current?.pause();
            endingAudioRef.current?.pause();
            recognitionRef.current?.stop();
        };
    }, []);

    const initializeSystem = async () => {
        setInitStatus('BOOTING...');

        try {
            // 1. Request Camera & Mic Permission explicitly
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            setCameraPermission(true);
            setMicPermission(true);
            stream.getTracks().forEach(track => track.stop());

            setInitStatus('LINKING BGM...');
            battleAudioRef.current?.play().catch(e => console.error("BGM Start Error:", e));

            setInitStatus('SYNCING VOICE...');
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            if (SpeechRecognition) {
                const recognition = new SpeechRecognition();
                recognition.lang = 'ja-JP';
                recognition.continuous = true;
                recognition.interimResults = true;

                recognition.onstart = () => setIsMicActive(true);
                recognition.onend = () => {
                    setIsMicActive(false);
                    if (activelyListeningRef.current) {
                        try { recognition.start(); } catch (e) { }
                    }
                };

                recognition.onresult = (event: any) => {
                    for (let i = event.resultIndex; i < event.results.length; i++) {
                        const text = event.results[i][0].transcript.trim();
                        setLastHeard(text);
                        if (gameStateRef.current === 'locked' && (FOX_TRIGGER_WORD.some(word => text.includes(word)) || text.length > 5)) {
                            startSummon();
                        }
                    }
                };

                recognition.onerror = (event: any) => {
                    if (event.error === 'not-allowed') {
                        setMicPermission(false);
                        activelyListeningRef.current = false;
                    }
                };

                recognitionRef.current = recognition;
                activelyListeningRef.current = true;
                recognition.start();
            }

            setInitStatus('COMPLETED');
            setTimeout(() => {
                setIsInitialized(true);
                setWebcamEnabled(true);
            }, 800);

        } catch (err) {
            console.error("Initialization failed:", err);
            setInitStatus('ERROR: ACCESS DENIED');
            alert("カメラとマイクの許可が必要です。ブラウザの設定を確認してください。");
        }
    };

    // Manage BGM transitions
    useEffect(() => {
        if (!isInitialized) return;

        if (['idle', 'detecting'].includes(gameState)) {
            endingAudioRef.current?.pause();
            if (endingAudioRef.current) endingAudioRef.current.currentTime = 0;
            battleAudioRef.current?.play().catch(() => { });
        } else if (['locked', 'summoning', 'closeup', 'victory', 'cooloff', 'evaporating'].includes(gameState)) {
            battleAudioRef.current?.pause();
            if (battleAudioRef.current) battleAudioRef.current.currentTime = 0;
            endingAudioRef.current?.pause();
        } else if (gameState === 'done') {
            battleAudioRef.current?.pause();
            endingAudioRef.current?.play().catch(() => { });
        }
    }, [gameState, isInitialized]);

    const { isFoxHand, handPosition } = useHandTracking(webcamRef, gameState + cameraPermission + webcamEnabled);
    const [isSynced, setIsSynced] = useState(false);

    useEffect(() => {
        if (!isFoxHand || !handPosition) {
            setIsSynced(false);
            return;
        }
        const targetX = 0.5;
        const targetY = 0.5;
        const dist = Math.sqrt(Math.pow(handPosition.x - targetX, 2) + Math.pow(handPosition.y - targetY, 2));
        setIsSynced(dist < 0.18);
    }, [isFoxHand, handPosition]);

    useEffect(() => {
        const interval = setInterval(() => {
            if (Math.random() > 0.7) {
                setBgFrame(prev => (prev + 1) % 2);
            }
        }, 3000);
        return () => clearInterval(interval);
    }, []);

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

    const playSummonSound = () => {
        try {
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const masterGain = audioCtx.createGain();
            masterGain.connect(audioCtx.destination);
            masterGain.gain.setValueAtTime(1.0, audioCtx.currentTime);

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

            setTimeout(() => {
                const now = audioCtx.currentTime;
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
        setTimeout(() => {
            setGameState('closeup');
            setTimeout(() => {
                setGameState('victory');
                setTimeout(() => {
                    setGameState('cooloff');
                    setTimeout(() => {
                        setGameState('evaporating');
                        setTimeout(() => setGameState('done'), 5000);
                    }, 4000);
                }, 3000);
            }, 1500);
        }, 1200);
    };

    const showWebcam = ['idle', 'detecting'].includes(gameState) && webcamEnabled;
    const isBiting = ['summoning', 'closeup'].includes(gameState);

    return (
        <main className="relative w-full h-screen overflow-hidden bg-black text-white font-sans">
            <AnimatePresence>
                {!isInitialized && (
                    <motion.div
                        key="startup"
                        exit={{ opacity: 0, scale: 1.1 }}
                        className="absolute inset-0 z-[100] bg-black flex flex-col items-center justify-center p-6 text-center overflow-hidden"
                    >
                        {/* Wandering Fox Background */}
                        <motion.img
                            src="/fox01.png"
                            initial={{ opacity: 0, x: -100, scale: 0.8 }}
                            animate={{
                                opacity: [0.1, 0.3, 0.15],
                                x: [-100, 100, -50],
                                y: [-20, 20, -10],
                                scale: [0.8, 0.85, 0.8]
                            }}
                            transition={{
                                duration: 25,
                                repeat: Infinity,
                                ease: "easeInOut"
                            }}
                            className="absolute z-0 w-[150%] h-[150%] object-contain pointer-events-none grayscale opacity-20 brightness-50"
                        />
                        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none z-[5]" />
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="relative z-10 space-y-8 max-w-md"
                        >
                            <div className="space-y-2">
                                <h1 className="text-4xl font-black italic text-red-600 tracking-tighter">FOX:SUMMON_NEXT</h1>
                                <p className="text-zinc-400 text-xs font-mono tracking-widest uppercase">System Initialization Required</p>
                            </div>

                            <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-lg space-y-4">
                                <p className="text-sm text-zinc-300 leading-relaxed">
                                    このアプリはカメラとマイクを使用します。
                                    デバイスの許可設定を確認し、下のボタンを押してシステムを起動してください。
                                </p>
                                <div className="grid grid-cols-2 gap-4 text-[10px] font-mono font-bold tracking-tight">
                                    <div className={`flex items-center justify-center gap-2 p-3 border transition-all duration-500 ${cameraPermission ? 'border-red-600 text-red-500 bg-red-900/10 shadow-[0_0_15px_rgba(255,0,0,0.2)]' : 'border-zinc-700 text-zinc-600'}`}>
                                        {cameraPermission ? <Camera size={14} /> : <VideoOff size={14} />}
                                        CAM: {cameraPermission ? 'READY' : 'WAITING'}
                                    </div>
                                    <div className={`flex items-center justify-center gap-2 p-3 border transition-all duration-500 ${!isSpeechSupported ? 'border-amber-600 text-amber-500 bg-amber-900/10' : micPermission ? 'border-red-600 text-red-500 bg-red-900/10 shadow-[0_0_15px_rgba(255,0,0,0.2)]' : 'border-zinc-700 text-zinc-600'}`}>
                                        {!isSpeechSupported ? <MicOff size={14} /> : micPermission ? <Mic size={14} /> : <Mic size={14} className="animate-pulse" />}
                                        MIC: {!isSpeechSupported ? 'UNSUPPORTED' : micPermission ? 'READY' : 'READY_TO_ACTIVATE'}
                                    </div>
                                </div>

                                {!isSpeechSupported && (
                                    <div className="bg-amber-900/20 border border-amber-600/50 p-3 rounded text-[10px] text-amber-500 font-bold leading-tight">
                                        ⚠️ お使いのブラウザは音声認識に対応していません。<br />
                                        SafariまたはChromeの通常ブラウザで開き直してください。
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={initializeSystem}
                                disabled={initStatus === 'BOOTING...'}
                                className="group relative w-full overflow-hidden bg-red-600 hover:bg-red-700 text-white font-black py-4 px-8 italic text-xl transition-all active:scale-95 disabled:opacity-50"
                            >
                                <span className="relative z-10">{initStatus === 'STANDBY' ? 'SYSTEM START' : initStatus}</span>
                                {initStatus === 'BOOTING...' && (
                                    <motion.div
                                        className="absolute bottom-0 left-0 h-1 bg-white"
                                        initial={{ width: 0 }}
                                        animate={{ width: '100%' }}
                                        transition={{ duration: 2 }}
                                    />
                                )}
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {isBiting && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0, x: "-50%", y: "-50%", left: "50%", top: "50%" }}
                        animate={{ opacity: 1, scale: 1.5, x: "-50%", y: "-50%" }}
                        exit={{ opacity: 0, scale: 2 }}
                        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                        className="absolute z-50 pointer-events-none w-full h-full origin-center"
                    >
                        <img src="/fox02.png" className="w-full h-full object-cover brightness-90 shadow-[0_0_100px_rgba(255,0,0,0.5)]" alt="Attack Fox" />
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: [0, 0.8, 0] }} transition={{ duration: 0.5 }} className="absolute inset-0 bg-red-600 mix-blend-overlay" />
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="absolute inset-0 z-0 bg-zinc-900">
                <motion.img
                    src={['summoning', 'closeup', 'victory', 'cooloff', 'evaporating', 'done'].includes(gameState) ? "/dead_bug.jpg" : (bgFrame === 0 ? "/city_bug01.jpg" : "/city_bug02.jpg")}
                    className={`w-full h-full object-cover transition-all duration-1000 ${gameState === 'done' ? 'grayscale opacity-60' : 'opacity-80'}`}
                    animate={['idle', 'detecting', 'locked'].includes(gameState) ? { scale: [1, 1.05, 1], x: [0, 8, -8, 0], y: [0, 5, -5, 0] } : { scale: 1, x: 0, y: 0 }}
                    transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                />
                {gameState === 'done' && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-red-900/40 mix-blend-multiply" />}
            </div>

            <div className={`absolute top-4 right-4 w-32 h-24 z-40 rounded-lg overflow-hidden border border-red-600/20 shadow-xl transition-all duration-700 pointer-events-none ${showWebcam ? 'opacity-100' : 'opacity-0'}`}>
                <div className="relative w-full h-full pointer-events-auto">
                    <Webcam ref={webcamRef} audio={false} className="w-full h-full object-cover grayscale contrast-125 brightness-125 blur-[1px]" onUserMedia={() => setCameraPermission(true)} videoConstraints={{ facingMode: "user" }} />
                    <div className="absolute inset-0 pointer-events-none">
                        <motion.div className="w-full h-[2px] bg-red-500/50 shadow-[0_0_8px_rgba(239,68,68,0.8)]" animate={{ top: ["0%", "100%", "0%"] }} transition={{ duration: 3, repeat: Infinity, ease: "linear" }} />
                        <div className="absolute bottom-2 right-8 text-[8px] font-mono text-red-500/80 animate-pulse">{isFoxHand ? "HAND_READY" : "SCANNING_HAND"}</div>
                        {handPosition && <div className="absolute w-2 h-2 bg-red-500 rounded-full shadow-[0_0_8px_#f00]" style={{ left: `${handPosition.x * 100}%`, top: `${handPosition.y * 100}%`, transform: 'translate(-50%, -50%)' }} />}
                    </div>
                </div>
            </div>

            <div className="absolute inset-0 z-20 pointer-events-none">
                <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
                    <ambientLight intensity={1.5} />
                    <Suspense fallback={null}><FoxScene state={gameState} /><SummonEffects state={gameState} /></Suspense>
                </Canvas>
            </div>

            <AnimatePresence>
                {(gameState === 'detecting' || gameState === 'locked') && (
                    <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: isSynced ? 0.3 : 0.6, scale: isFoxHand ? 1 : 0.95 }} exit={{ opacity: 0 }} className="absolute inset-0 z-25 flex items-center justify-center pointer-events-none">
                        <div className={`w-96 h-96 transition-all duration-300 ${isSynced ? 'text-red-600' : 'text-white'}`}>
                            <svg viewBox="0 0 100 100" className="w-full h-full fill-current">
                                <path d="M20,80 Q30,40 25,20 L35,45 Q50,40 65,45 L75,20 Q70,40 80,80 Z" />
                                <circle cx="50" cy="55" r="5" className="animate-pulse" />
                            </svg>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="absolute inset-0 z-30 flex flex-col items-center justify-between p-8 pointer-events-none">
                <div className="w-full flex justify-between items-start">
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-red-600 animate-pulse rounded-full" />
                            <h1 className="text-2xl font-black italic text-red-600 tracking-tighter">ANIME:REPRO_V1</h1>
                        </div>
                        <div className="flex gap-4 px-1">
                            <div className={`flex items-center gap-1.5 transition-colors ${cameraPermission ? 'text-emerald-500' : 'text-red-500 animate-pulse'}`}>
                                {cameraPermission ? <Camera size={14} /> : <VideoOff size={14} />}
                                <span className="text-[9px] font-mono font-bold leading-none tracking-tighter">{cameraPermission ? 'V-LINK_ACTIVE' : 'V-LINK_NG'}</span>
                            </div>
                            <div className={`flex items-center gap-1.5 transition-colors ${micPermission ? 'text-emerald-500' : 'text-red-500 animate-pulse'}`}>
                                {micPermission ? <Mic size={14} /> : <MicOff size={14} />}
                                <span className="text-[9px] font-mono font-bold leading-none tracking-tighter">{micPermission ? 'A-LINK_ACTIVE' : 'A-LINK_NG'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <AnimatePresence>
                    {(gameState === 'detecting' || gameState === 'locked') && (
                        <div className="flex flex-col items-center gap-8 mb-32">
                            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="bg-black/90 p-8 border-l-8 border-red-600 relative overflow-hidden">
                                {isMicActive && (
                                    <motion.div
                                        className="absolute bottom-0 left-0 h-1 bg-red-600"
                                        animate={{ width: ["0%", "100%", "0%"] }}
                                        transition={{ duration: 2, repeat: Infinity }}
                                    />
                                )}
                                <div className="flex justify-between items-center mb-4">
                                    <p className="text-red-500 text-xs font-mono uppercase tracking-widest">
                                        Signal: {isSynced ? 'SYNCHRONIZED' : 'DETECTING'}
                                    </p>
                                    {isMicActive ? (
                                        <div className="flex items-center gap-1 text-red-500 animate-pulse">
                                            <Mic size={10} />
                                            <span className="text-[8px] font-mono font-bold tracking-widest">LISTENING...</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1 text-zinc-600">
                                            <MicOff size={10} />
                                            <span className="text-[8px] font-mono font-bold tracking-widest">OFF_LINE</span>
                                        </div>
                                    )}
                                </div>
                                <p className="text-white text-3xl font-black italic text-center leading-tight mb-2">
                                    「準備はいいよ。いつでも喚びな…。」
                                </p>
                                <div className="h-4 flex items-center justify-center">
                                    {lastHeard && (
                                        <motion.p
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            key={lastHeard}
                                            className="text-red-400 text-[10px] font-mono italic"
                                        >
                                            Heard: "{lastHeard}"
                                        </motion.p>
                                    )}
                                </div>
                                <p className="text-zinc-500 text-[9px] font-mono text-center tracking-tighter uppercase mt-2">
                                    {isMicActive ? "Say 'KON!' or tap below" : "Mic inactive. PLEASE TAP TO SUMMON"}
                                </p>
                            </motion.div>
                            {isSynced && <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 0.5 }} className="text-white font-black text-6xl italic">KON!</motion.div>}
                        </div>
                    )}
                </AnimatePresence>

                {gameState === 'done' && (
                    <motion.div initial={{ opacity: 0, scale: 2 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-4 bg-red-600 p-8 shadow-2xl">
                        <h2 className="text-5xl font-black italic">MISSION COMPLETE</h2>
                        <button className="pointer-events-auto bg-white text-black px-10 py-3 font-black text-xl italic" onClick={() => setGameState('idle')}>Retry Summoning</button>
                    </motion.div>
                )}

                <div className="w-full flex justify-between items-end">
                    <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Frame: {bgFrame} / Mode: {micPermission ? 'VOICE_READY' : 'VOICE_ERROR'}</div>
                    <div className="bg-zinc-900/80 px-4 py-2 rounded-sm border-t-2 border-red-600 text-xs font-bold">
                        <span className="text-zinc-500 mr-2">SYSTEM:</span>
                        <span className="text-red-500">{gameState === 'locked' ? 'READY_FOR_SUMMON' : gameState.toUpperCase()}</span>
                    </div>
                </div>
            </div>

            <div className="absolute inset-0 z-50 opacity-0 cursor-crosshair" onClick={() => isSynced && startSummon()} />
        </main>
    );
}
