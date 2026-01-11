'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import Webcam from 'react-webcam';
import { motion, AnimatePresence } from 'framer-motion';
import { Canvas } from '@react-three/fiber';
import { useTexture, CameraShake } from '@react-three/drei';
import { Mic, MicOff, Camera, VideoOff } from 'lucide-react';
import * as THREE from 'three';
import { useHandTracking } from '@/hooks/useHandTracking';
import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';

const FOX_TRIGGER_WORD = ['コン', 'こん', 'kon', 'konn', 'こんっ', 'こんー', 'こーん', 'こん！', 'コン！', 'こん。', 'コン。'];
const WEB_APP_TITLE = 'FOX:SUMMON_NEXT';

// --- 3D Components ---

const ParallaxGroup = ({ children, intensity = 1 }: { children: React.ReactNode, intensity?: number }) => {
    const group = useRef<THREE.Group>(null);
    const target = useRef({ x: 0, y: 0 });

    useEffect(() => {
        const handleMove = (e: any) => {
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            target.current.x = (clientX / window.innerWidth) * 2 - 1;
            target.current.y = -(clientY / window.innerHeight) * 2 + 1;
        };
        window.addEventListener('mousemove', handleMove);
        window.addEventListener('touchmove', handleMove);
        return () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('touchmove', handleMove);
        };
    }, []);

    useFrame((state) => {
        if (!group.current) return;
        const currentIntensity = intensity;
        group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, target.current.y * 0.1 * currentIntensity, 0.05);
        group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, target.current.x * 0.1 * currentIntensity, 0.05);

        // Slowly drift back to center if intensity is low (like in ending)
        if (currentIntensity === 0) {
            target.current.x *= 0.9;
            target.current.y *= 0.9;
        }
    });

    return <group ref={group}>{children}</group>;
};

const Particles = ({ count = 20, color = "#ff5e00", isRising = false }) => {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const particles = useMemo(() => {
        const temp = [];
        for (let i = 0; i < count; i++) {
            temp.push({
                pos: new THREE.Vector3((Math.random() - 0.5) * 15, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 5),
                speed: 0.02 + Math.random() * 0.05
            });
        }
        return temp;
    }, [count]);

    useEffect(() => {
        let animId: number;
        const animate = () => {
            if (!meshRef.current) return;
            const dummy = new THREE.Object3D();
            particles.forEach((p, i) => {
                if (isRising) {
                    p.pos.y += p.speed;
                    if (p.pos.y > 8) p.pos.y = -8;
                }
                dummy.position.copy(p.pos);
                dummy.updateMatrix();
                meshRef.current?.setMatrixAt(i, dummy.matrix);
            });
            meshRef.current.instanceMatrix.needsUpdate = true;
            animId = requestAnimationFrame(animate);
        };
        animate();
        return () => cancelAnimationFrame(animId);
    }, [particles, isRising]);

    return (
        <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
            <sphereGeometry args={[0.05, 8, 8]} />
            <meshBasicMaterial color={color} transparent opacity={0.5} blending={THREE.AdditiveBlending} />
        </instancedMesh>
    );
};

const FoxScene = ({ state }: { state: string }) => {
    const tex01 = useTexture('/fox01.png');
    const tex02 = useTexture('/fox02.png');
    const tex03 = useTexture('/fox03.png');

    const meshRef = useRef<THREE.Mesh>(null);
    const matRef = useRef<THREE.MeshBasicMaterial>(null);
    const stateRefs = useRef({ opac: 0, scale: 1 });
    const [activeTex, setActiveTex] = useState<THREE.Texture>(tex01);

    useEffect(() => {
        if (state === 'locked') {
            setActiveTex(tex01);
        } else if (state === 'summoning' || state === 'closeup') {
            setActiveTex(tex02);
        } else if (['victory', 'cooloff', 'evaporating', 'done'].includes(state)) {
            setActiveTex(tex03);
        }
    }, [state, tex01, tex02, tex03]);

    useFrame(() => {
        if (!meshRef.current || !matRef.current) return;

        // Force zero rotation at all times to prevent any slanting
        meshRef.current.rotation.set(0, 0, 0);

        if (state === 'locked') {
            stateRefs.current.scale = THREE.MathUtils.lerp(stateRefs.current.scale, 13, 0.15);
            stateRefs.current.opac = THREE.MathUtils.lerp(stateRefs.current.opac, 1, 0.15);
        } else if (state === 'summoning' || state === 'closeup') {
            stateRefs.current.scale = THREE.MathUtils.lerp(stateRefs.current.scale, 18, 0.2);
            stateRefs.current.opac = 1;
        } else {
            stateRefs.current.opac = 0;
            stateRefs.current.scale = 0.1;
        }

        meshRef.current.scale.set(stateRefs.current.scale, stateRefs.current.scale, 1);
        matRef.current.opacity = stateRefs.current.opac;
    });

    // Only render the 3D mesh for locked/summoning states.
    // Victory and ending will use a more stable 2D overlay.
    const show3DMesh = ['locked', 'summoning', 'closeup'].includes(state);

    return (
        <group>
            <ParallaxGroup intensity={['cooloff', 'evaporating', 'done'].includes(state) ? 0 : (state === 'locked' ? 0.3 : 1.5)}>
                <Particles
                    count={state === 'evaporating' ? 300 : 40}
                    color={state === 'evaporating' ? "#ffffff" : "#3b82f6"} // Heroic Blue
                    isRising={state === 'evaporating'}
                />
                {show3DMesh && (
                    <mesh ref={meshRef} position={[0, 0, -2.5]}>
                        <planeGeometry args={[1, 1]} />
                        <meshBasicMaterial
                            ref={matRef}
                            map={activeTex}
                            transparent
                            depthTest={false}
                            opacity={0}
                        />
                    </mesh>
                )}
            </ParallaxGroup>
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
    const [isKonShouted, setIsKonShouted] = useState(false);
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
                        const transcript = event.results[i][0].transcript.trim();
                        // Normalize: remove punctuation and lowercase
                        const text = transcript.replace(/[。？！!.?、]$/, "").toLowerCase();
                        setLastHeard(transcript);

                        // Clear lastHeard after 3 seconds
                        setTimeout(() => setLastHeard(prev => prev === transcript ? '' : prev), 3000);

                        if (gameStateRef.current === 'locked') {
                            const isMatch = FOX_TRIGGER_WORD.some(word =>
                                text === word || text.includes(word)
                            );
                            if (isMatch || text.length > 5) {
                                startSummon();
                            }
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
        if (gameState === 'locked') {
            playBeep(440, 0.1);
            setTimeout(() => playBeep(880, 0.1), 100);
        }

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'Space') {
                if (!isInitialized && initStatus === 'STANDBY') {
                    initializeSystem();
                } else if (['victory', 'cooloff', 'evaporating', 'done'].includes(gameState)) {
                    setGameState('idle');
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [gameState, isInitialized, initStatus]);

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
        // Use Ref to avoid stale closure issues
        if (['summoning', 'closeup', 'victory', 'cooloff', 'evaporating', 'done'].includes(gameStateRef.current)) return;

        setIsKonShouted(true);
        setTimeout(() => setIsKonShouted(false), 2000);

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
                        exit={{
                            opacity: 0,
                            scale: 1.2,
                            transition: { duration: 0.8, ease: "easeOut" }
                        }}
                        className="absolute inset-0 z-[100] bg-zinc-950 flex flex-col items-center justify-center p-6 text-center overflow-hidden font-sans"
                    >
                        {/* High-Tech Particles */}
                        <div className="absolute inset-0 opacity-20 z-0">
                            {[...Array(20)].map((_, i) => (
                                <motion.div
                                    key={i}
                                    className="absolute w-1 h-1 bg-blue-400 rounded-full"
                                    initial={{ x: Math.random() * 100 + "%", y: Math.random() * 100 + "%", opacity: 0 }}
                                    animate={{ y: [null, "-10%"], opacity: [0, 1, 0] }}
                                    transition={{ duration: 5 + Math.random() * 5, repeat: Infinity, delay: Math.random() * 5 }}
                                />
                            ))}
                        </div>

                        {/* Majestic Heroic Fox */}
                        <motion.img
                            src="/fox01.png"
                            initial={{ opacity: 0, scale: 1.1, y: 50 }}
                            animate={{
                                opacity: [0.3, 0.5, 0.3],
                                scale: [1.05, 1.1, 1.05],
                            }}
                            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
                            className="absolute z-0 w-full h-full object-contain pointer-events-none drop-shadow-[0_0_80px_rgba(59,130,246,0.3)] filter brightness-125 saturate-150"
                        />

                        {/* Hero HUD Elements */}
                        <div className="absolute top-10 inset-x-0 flex justify-between px-10 opacity-60">
                            <div className="text-left">
                                <div className="text-[10px] font-mono text-cyan-400 font-black tracking-[.3em]">HERO_OS_V2.5</div>
                                <div className="text-[8px] font-mono text-white/40 tracking-widest uppercase">Encryption: Secure</div>
                            </div>
                            <div className="text-right">
                                <div className="text-[10px] font-mono text-cyan-400 font-black tracking-[.3em]">MISSION: KON_AWAKEN</div>
                                <div className="text-[8px] font-mono text-white/40 tracking-widest uppercase">Status: Standby</div>
                            </div>
                        </div>

                        <motion.div
                            initial={{ y: 50, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ duration: 0.8, delay: 0.2 }}
                            className="relative z-20 w-full max-w-2xl space-y-12"
                        >
                            {/* Heroic Title Section */}
                            <div className="space-y-4">
                                <motion.div
                                    className="w-20 h-1 bg-cyan-500 mx-auto rounded-full shadow-[0_0_15px_rgba(34,211,238,0.8)]"
                                    animate={{ width: [40, 100, 40] }}
                                    transition={{ duration: 3, repeat: Infinity }}
                                />
                                <div className="relative">
                                    <h1 className="text-7xl md:text-8xl font-black text-white tracking-widest leading-none drop-shadow-[0_0_30px_rgba(59,130,246,0.5)] uppercase">
                                        Fox<span className="text-cyan-400 italic">Hero</span>
                                    </h1>
                                    <p className="text-cyan-400 text-xs font-mono font-black tracking-[0.5em] mt-4 uppercase">
                                        Guardian Alliance Initiative
                                    </p>
                                </div>
                            </div>

                            {/* System Readiness Box */}
                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="bg-cyan-950/20 backdrop-blur-md border-t-2 border-cyan-500/30 p-6 text-left rounded-xl shadow-xl">
                                    <h3 className="text-cyan-400 font-black text-xs tracking-[0.3em] mb-4 uppercase flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-pulse" />
                                        Avatar Link Status
                                    </h3>
                                    <div className="space-y-3">
                                        <div className={`flex items-center gap-3 transition-all ${cameraPermission ? 'text-white' : 'text-white/20'}`}>
                                            <Camera size={14} className={cameraPermission ? 'text-cyan-400' : ''} />
                                            <span className="text-[10px] font-mono uppercase tracking-widest">Optical: {cameraPermission ? 'LINKED' : 'WAITING'}</span>
                                        </div>
                                        <div className={`flex items-center gap-3 transition-all ${micPermission ? 'text-white' : 'text-white/20'}`}>
                                            <Mic size={14} className={micPermission ? 'text-cyan-400' : ''} />
                                            <span className="text-[10px] font-mono uppercase tracking-widest">Voice: {micPermission ? 'LINKED' : 'WAITING'}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white/5 backdrop-blur-md border border-white/10 p-6 text-left rounded-xl flex flex-col justify-center shadow-lg">
                                    <p className="text-[9px] text-zinc-400 font-mono leading-relaxed uppercase tracking-widest">
                                        ヒーローを呼び出すために、カメラとマイクの許可が必要です。
                                        準備ができたら、下のボタンを押して出撃してください。
                                    </p>
                                </div>
                            </div>

                            {/* Hero Start Button */}
                            <div className="relative group max-w-sm mx-auto">
                                <motion.div
                                    className="absolute -inset-1 bg-gradient-to-r from-cyan-600 to-blue-400 rounded-lg opacity-40 blur group-hover:opacity-100 transition duration-500"
                                    animate={{ opacity: [0.3, 0.6, 0.3] }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                />
                                <button
                                    onClick={initializeSystem}
                                    disabled={initStatus === 'BOOTING...'}
                                    className="relative w-full bg-zinc-900 border border-cyan-500/50 text-white py-6 px-10 rounded-lg transition-all active:scale-[0.98] group-hover:border-cyan-400 shadow-2xl"
                                >
                                    <div className="flex flex-col items-center">
                                        <span className="text-[9px] font-mono text-cyan-400 font-black tracking-[0.4em] mb-1">
                                            SYSTEM_ACTIVATION
                                        </span>
                                        <span className="text-3xl font-black tracking-widest uppercase">
                                            {initStatus === 'STANDBY' ? 'Start Mission' : initStatus}
                                        </span>
                                    </div>

                                    {initStatus === 'BOOTING...' && (
                                        <motion.div
                                            className="absolute bottom-0 left-1 right-1 h-1 bg-cyan-500 rounded-full shadow-[0_0_10px_rgba(6,182,212,0.8)]"
                                            initial={{ width: 0 }}
                                            animate={{ width: 'calc(100% - 8px)' }}
                                            transition={{ duration: 2 }}
                                        />
                                    )}
                                </button>

                                <div className="mt-4 flex items-center justify-center gap-2 opacity-50">
                                    <span className="text-[10px] font-mono text-white/50 uppercase tracking-[0.3em]">Press</span>
                                    <span className="bg-white/10 px-2 py-0.5 rounded text-[10px] font-mono text-cyan-400 border border-white/20">SPACE</span>
                                    <span className="text-[10px] font-mono text-white/50 uppercase tracking-[0.3em]">to activate</span>
                                </div>
                            </div>

                            <p className="text-[8px] font-mono text-zinc-600 tracking-widest uppercase mt-4">
                                Justice. Courage. Alliance.
                            </p>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {isKonShouted && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.5, rotate: -10 }}
                        animate={{ opacity: 1, scale: [1.2, 1], rotate: [0, 5] }}
                        exit={{ opacity: 0, scale: 2, filter: 'blur(20px)' }}
                        className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none"
                    >
                        <h2 className="text-[25vw] font-black italic text-cyan-500 drop-shadow-[0_0_50px_rgba(6,182,212,0.9)] filter contrast-150 tracking-tighter">
                            コン！
                        </h2>
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
                        <img src="/fox02.png" className="w-full h-full object-cover brightness-90 shadow-[0_0_100px_rgba(6,182,212,0.5)]" alt="Attack Fox" />
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: [0, 0.8, 0] }} transition={{ duration: 0.5 }} className="absolute inset-0 bg-cyan-600 mix-blend-overlay" />
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="absolute inset-0 z-0 bg-zinc-950">
                <motion.img
                    src={['victory', 'cooloff', 'evaporating', 'done'].includes(gameState) ? "/city_bug01.jpg" : (['summoning', 'closeup'].includes(gameState) ? "/dead_bug.jpg" : (bgFrame === 0 ? "/city_bug01.jpg" : "/city_bug02.jpg"))}
                    className={`w-full h-full object-cover transition-all duration-1000 ${gameState === 'done' ? 'grayscale opacity-40' : 'opacity-60'}`}
                    animate={['idle', 'detecting', 'locked'].includes(gameState) ? { scale: [1, 1.05, 1], rotate: [0, 1, -1, 0] } : { scale: 1.1 }}
                    transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
                />
                {['victory', 'cooloff', 'evaporating'].includes(gameState) && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="absolute inset-0 bg-blue-500/10 mix-blend-overlay"
                    />
                )}
            </div>

            {/* Victory/Farewell Heroic Fox Overlay (2D Steady Display) */}
            <AnimatePresence>
                {['victory', 'cooloff', 'evaporating'].includes(gameState) && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8, y: 50 }}
                        animate={{
                            opacity: gameState === 'evaporating' ? 0 : 1,
                            scale: gameState === 'evaporating' ? 1.2 : 1,
                            y: 0
                        }}
                        exit={{ opacity: 0 }}
                        transition={{
                            duration: gameState === 'evaporating' ? 5 : 1.2,
                            ease: "easeOut"
                        }}
                        className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none p-10"
                    >
                        <div className="relative w-full max-w-lg aspect-square flex items-center justify-center">
                            <motion.img
                                src="/fox01.png"
                                className="w-full h-full object-contain filter drop-shadow-[0_0_60px_rgba(59,130,246,0.6)]"
                                animate={{
                                    y: [0, -20, 0],
                                    filter: [
                                        'drop-shadow(0 0 40px rgba(59,130,246,0.4))',
                                        'drop-shadow(0 0 80px rgba(59,130,246,0.7))',
                                        'drop-shadow(0 0 40px rgba(59,130,246,0.4))'
                                    ]
                                }}
                                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                            />
                            {/* Heroic Name Plate */}
                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.5 }}
                                className="absolute bottom-0 left-0 bg-blue-600/20 backdrop-blur-sm border-l-4 border-blue-500 py-2 px-6"
                            >
                                <span className="text-white font-black italic tracking-widest text-xl">FOX HERO</span>
                            </motion.div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className={`absolute top-4 right-4 w-32 h-24 z-40 rounded-lg overflow-hidden border border-cyan-500/20 shadow-xl transition-all duration-700 pointer-events-none ${showWebcam ? 'opacity-100' : 'opacity-0'}`}>
                <div className="relative w-full h-full pointer-events-auto">
                    <Webcam ref={webcamRef} audio={false} className="w-full h-full object-cover grayscale contrast-125 brightness-125 blur-[1px]" onUserMedia={() => setCameraPermission(true)} videoConstraints={{ facingMode: "user" }} />
                    <div className="absolute inset-0 pointer-events-none">
                        <motion.div className="w-full h-[2px] bg-cyan-500/50 shadow-[0_0_8px_rgba(6,182,212,0.8)]" animate={{ top: ["0%", "100%", "0%"] }} transition={{ duration: 3, repeat: Infinity, ease: "linear" }} />
                        <div className="absolute bottom-2 right-8 text-[8px] font-mono text-cyan-500/80 animate-pulse">{isFoxHand ? "HERO_READY" : "SCANNING"}</div>
                        {handPosition && <div className="absolute w-2 h-2 bg-cyan-500 rounded-full shadow-[0_0_8px_#0ff]" style={{ left: `${handPosition.x * 100}%`, top: `${handPosition.y * 100}%`, transform: 'translate(-50%, -50%)' }} />}
                    </div>
                </div>
            </div>

            <div className="absolute inset-0 z-20 pointer-events-none">
                <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
                    <ambientLight intensity={1.5} />
                    <Suspense fallback={null}><FoxScene state={gameState} /><SummonEffects state={gameState} /></Suspense>
                </Canvas>
            </div>

            {/* Kizuna: Hand Sync Silhouette */}
            <AnimatePresence>
                {(gameState === 'idle' || gameState === 'detecting' || gameState === 'locked') && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: isSynced ? 0.3 : 0.6, scale: isFoxHand ? 1 : 0.95 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-25 flex items-center justify-center pointer-events-none"
                    >
                        <div className={`w-96 h-96 transition-all duration-300 ${isSynced ? 'text-cyan-400' : 'text-white'}`}>
                            <svg viewBox="0 0 100 100" className="w-full h-full fill-current">
                                <path d="M20,80 Q30,40 25,20 L35,45 Q50,40 65,45 L75,20 Q70,40 80,80 Z" />
                                <circle cx="50" cy="55" r="5" className="animate-pulse" />
                            </svg>
                            <div className="text-center mt-4">
                                <span className="text-[10px] font-mono font-black tracking-[0.5em] uppercase opacity-50">
                                    {isSynced ? "BOND_LINKED" : (isFoxHand ? "ALIGNHAND" : "AWAITING_GESTURE")}
                                </span>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="absolute inset-0 z-30 flex flex-col items-center justify-between p-8 pointer-events-none">
                {/* Top Status Bar */}
                <div className="w-full flex justify-between items-start">
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-cyan-500 animate-pulse rounded-full" />
                            <h1 className="text-2xl font-black italic text-cyan-500 tracking-tighter uppercase px-2 py-1 border-b-2 border-cyan-500/30">Hero_Alliance_V2</h1>
                        </div>
                        <div className="flex gap-4 px-1">
                            <div className={`flex items-center gap-1.5 transition-colors ${cameraPermission ? 'text-cyan-400' : 'text-red-500 animate-pulse'}`}>
                                {cameraPermission ? <Camera size={14} /> : <VideoOff size={14} />}
                                <span className="text-[9px] font-mono font-bold leading-none tracking-tighter">{cameraPermission ? 'V-LINK_OK' : 'V-LINK_NG'}</span>
                            </div>
                            <div className={`flex items-center gap-1.5 transition-colors ${micPermission ? 'text-cyan-400' : 'text-red-500 animate-pulse'}`}>
                                {micPermission ? <Mic size={14} /> : <MicOff size={14} />}
                                <span className="text-[9px] font-mono font-bold leading-none tracking-tighter">{micPermission ? 'A-LINK_OK' : 'A-LINK_NG'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom Instruction Panel */}
                <AnimatePresence>
                    {(gameState === 'detecting' || gameState === 'locked') && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 20 }}
                            className="flex flex-col items-center gap-12 mb-32"
                        >
                            <div className="bg-black/80 backdrop-blur-md p-10 border-t border-b border-cyan-500/30 relative overflow-hidden max-w-lg shadow-[0_0_50px_rgba(0,0,0,0.9)] rounded-lg pointer-events-auto">
                                {isMicActive && (
                                    <motion.div
                                        className="absolute inset-0 bg-cyan-900/10 pointer-events-none"
                                        animate={{ opacity: [0, 0.2, 0] }}
                                        transition={{ duration: 2, repeat: Infinity }}
                                    />
                                )}
                                <div className="flex justify-between items-center mb-6">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 bg-cyan-500 rounded-full animate-ping" />
                                        <span className="text-[10px] font-mono text-cyan-400 font-bold uppercase tracking-widest">Acoustic Monitoring...</span>
                                    </div>
                                    {isMicActive && (
                                        <div className="flex items-center gap-1.5 text-cyan-400/80">
                                            <Mic size={12} className="animate-pulse" />
                                            <span className="text-[10px] font-mono font-bold tracking-widest uppercase">Live</span>
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-4">
                                    <div className="flex items-end gap-2">
                                        <span className="text-white text-5xl font-black italic tracking-tighter uppercase leading-none">Hero</span>
                                        <span className="text-cyan-500 text-sm font-mono font-bold pb-1 tracking-[0.3em]">LINK_INIT</span>
                                    </div>
                                    <p className="text-zinc-400 text-xs font-mono leading-relaxed uppercase">
                                        &gt; 狐の手をカメラの中央に合わせてください。<br />
                                        &gt; リンクが完了すると覚醒状態に入ります。<br />
                                        &gt; 合言葉は「コン！」です。
                                    </p>
                                </div>
                                <div className="flex items-center gap-4 mt-8 pt-6 border-t border-white/5">
                                    <div className={`w-2 h-2 rounded-full ${gameState === 'locked' ? 'bg-cyan-500 animate-ping' : 'bg-zinc-600'}`} />
                                    <p className="text-cyan-500 text-[10px] font-mono uppercase tracking-[0.4em] font-bold">
                                        {gameState === 'locked' ? 'READY_FOR_VOICE_LINK' : 'SCANNING_SIGNAL'}
                                    </p>
                                </div>
                            </div>

                            <p className="text-white text-4xl font-black italic text-center leading-tight drop-shadow-[0_0_20px_rgba(255,255,255,0.2)]">
                                {gameState === 'locked' ? "「 ... 喚べ。 」" : "「 いつでもいいよ。 」"}
                            </p>

                            <div className="h-4 flex items-center justify-center">
                                <AnimatePresence mode="wait">
                                    {lastHeard && (
                                        <motion.p
                                            initial={{ opacity: 0, y: 5 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0 }}
                                            key={lastHeard}
                                            className="text-cyan-400 text-[11px] font-mono italic tracking-widest"
                                        >
                                            &gt; TRACE: "{lastHeard}"
                                        </motion.p>
                                    )}
                                </AnimatePresence>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Bottom Bar: System Info */}
                <div className="w-full flex justify-between items-end">
                    <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
                        Frame: {bgFrame} / Mode: {micPermission ? 'VOICE_READY' : 'VOICE_ERROR'}
                    </div>
                    <div className="bg-zinc-900/80 px-4 py-2 rounded-sm border-t-2 border-cyan-600 text-xs font-bold">
                        <span className="text-zinc-500 mr-2">SYSTEM:</span>
                        <span className="text-cyan-500 uppercase">
                            {gameState === 'locked' ? 'READY_FOR_SUMMON' :
                                gameState === 'cooloff' ? 'FAREWELL' :
                                    gameState === 'evaporating' ? 'DEPARTING...' :
                                        gameState}
                        </span>
                    </div>
                </div>
            </div>

            {/* Background KON text during link */}
            <AnimatePresence>
                {isSynced && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ scale: [1, 1.05, 1], opacity: [0.1, 0.25, 0.1] }}
                        exit={{ opacity: 0 }}
                        transition={{ repeat: Infinity, duration: 1.5 }}
                        className="fixed inset-0 flex items-center justify-center z-10 pointer-events-none"
                    >
                        <span className="text-cyan-600 font-black text-[30vw] italic select-none blur-sm uppercase opacity-20">KON</span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Dramatic Vignette for Tension */}
            <AnimatePresence>
                {gameState === 'locked' && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 pointer-events-none z-20 shadow-[inset_0_0_200px_rgba(0,0,0,1)] bg-black/40 bg-[radial-gradient(circle,transparent_40%,rgba(0,0,0,0.8)_100%)]"
                    />
                )}
            </AnimatePresence>

            {/* Retry Guide at the end */}
            <AnimatePresence>
                {gameState === 'done' && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        className="absolute bottom-12 inset-x-0 z-50 flex flex-col items-center gap-4 pointer-events-none"
                    >
                        <div className="pointer-events-auto bg-black/80 backdrop-blur-xl border border-cyan-500/50 px-8 py-4 rounded-full shadow-[0_0_30px_rgba(6,182,212,0.3)]">
                            <button
                                onClick={() => setGameState('idle')}
                                className="text-cyan-400 font-black italic tracking-widest text-lg hover:text-white transition-colors"
                            >
                                PRESS <span className="text-white mx-2 outline px-2 rounded-sm outline-1 outline-white">SPACE</span> TO RESTART
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Hidden click bypass for testing/touch */}
            <div className="absolute inset-0 z-50 opacity-0 cursor-crosshair" onClick={() => isSynced && startSummon()} />
        </main>
    );
}
