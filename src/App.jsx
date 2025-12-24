import React, { useState, useEffect, useRef, Suspense } from 'react';
import Webcam from 'react-webcam';
import { motion, AnimatePresence } from 'framer-motion';
import { Canvas } from '@react-three/fiber';
import { useTexture, CameraShake } from '@react-three/drei';
import { Mic } from 'lucide-react';
import * as THREE from 'three';
import { useHandTracking } from './hooks/useHandTracking';

// --- Constants & Config ---
const FOX_TRIGGER_WORD = ['コン', 'こん'];
const WEB_APP_TITLE = 'FOX SUMMON';

// --- Components ---

// 3D Fox Effect overlaid on camera
const FoxScene = ({ trigger }) => {
  const tex = useTexture('/fox_demon.png');
  // Simple billboard plane that shakes/scales when triggered
  return (
    <mesh position={[0, -0.5, -5]} visible={trigger} scale={trigger ? [7, 7, 1] : [0.1, 0.1, 0.1]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={tex} transparent blending={THREE.AdditiveBlending} depthTest={false} opacity={0.9} />
    </mesh>
  );
};

const Effects = ({ trigger }) => {
  if (!trigger) return null;
  return (
    <CameraShake
      maxY={0.2}
      maxYYaw={0.2}
      pitchFrequency={0.5}
      rollFrequency={0.5}
      yawFrequency={0.5}
      intensity={1}
    />
  );
}

// --- Main App ---
export default function App() {
  const [gameState, setGameState] = useState('idle'); // idle, locked, summoned, dialogue
  const [dialogue, setDialogue] = useState('');
  const [cameraPermission, setCameraPermission] = useState(false);

  const webcamRef = useRef(null);
  const { isFoxHand } = useHandTracking(webcamRef);

  // State Machine Logic
  useEffect(() => {
    if (gameState === 'summoned' || gameState === 'dialogue') return;

    if (isFoxHand) {
      if (gameState !== 'locked') setGameState('locked');
    } else {
      if (gameState === 'locked') setGameState('idle');
    }
  }, [isFoxHand, gameState]);

  // Voice Recognition Setup
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Speech recognition not supported");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'ja-JP';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      const lastResult = event.results[event.results.length - 1];
      const text = lastResult[0].transcript.trim();
      // console.log("Heard:", text);
      if (FOX_TRIGGER_WORD.some(word => text.includes(word))) {
        handleSummon();
      }
    };

    recognition.start();
    return () => recognition.stop();
  }, [gameState]);

  const handleSummon = () => {
    if (gameState === 'locked') {
      setGameState('summoned');
      // Play sound effect here if available
      setTimeout(() => {
        setGameState('dialogue');
        setDialogue('...これは昼の悪魔だね。飲み込んでいい？');
      }, 2500);
    } else if (gameState === 'dialogue') {
      // Second "Kon" confirmation
      setDialogue('（ゴクリ...）');
      setTimeout(() => setGameState('idle'), 2000);
    }
  };

  const handleUserMedia = () => setCameraPermission(true);

  // Force reset for demo
  const reset = () => {
    setGameState('idle');
    setDialogue('');
  }

  return (
    <div className="relative w-full h-full overflow-hidden bg-black text-white select-none font-sans">
      {/* Background Camera Feed */}
      <div className="absolute inset-0 z-0">
        <Webcam
          ref={webcamRef}
          audio={false}
          className="w-full h-full object-cover opacity-60"
          onUserMedia={handleUserMedia}
          videoConstraints={{ facingMode: "user" }} // Use front camera
        />
      </div>

      {/* 3D Overlay Layer */}
      <div className="absolute inset-0 z-10 pointer-events-none">
        <Canvas>
          <ambientLight intensity={0.5} />
          <Suspense fallback={null}>
            <FoxScene trigger={gameState === 'summoned' || gameState === 'dialogue'} />
            <Effects trigger={gameState === 'summoned'} />
          </Suspense>
        </Canvas>
      </div>

      {/* UI Overlay */}
      <div className="absolute inset-0 z-20 flex flex-col items-center justify-between p-8 pointer-events-none">

        {/* Header / Status */}
        <div className="w-full flex justify-between items-start">
          <div className="bg-black/50 backdrop-blur-md p-4 rounded-lg border border-white/10">
            <h1 className="text-xl font-bold tracking-widest text-[#ff5e00]">{WEB_APP_TITLE}</h1>
            <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
              <span className={`w-2 h-2 rounded-full ${cameraPermission ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="uppercase">{gameState}</span>
            </div>
          </div>

          <div className="flex gap-2 pointer-events-auto">
            {gameState === 'dialogue' && (
              <button onClick={reset} className="p-2 bg-white/10 rounded-full text-xs">Reset</button>
            )}
            <div className="p-2 bg-black/50 rounded-full border border-white/10">
              <Mic className={`w-5 h-5 ${gameState === 'locked' ? 'text-[#ff5e00] animate-pulse' : 'text-gray-500'}`} />
            </div>
          </div>
        </div>

        {/* Reticle / HUD */}
        <AnimatePresence>
          {gameState === 'locked' && (
            <motion.div
              initial={{ scale: 1.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64"
            >
              {/* Animated Bracket Reticle */}
              <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-[#ff004c]" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-[#ff004c]" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-[#ff004c]" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-[#ff004c]" />

              <p className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[#ff004c] font-bold tracking-widest whitespace-nowrap animate-pulse">
                FOX SIGN LOCKED
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom Dialogue / Prompt */}
        <div className="w-full max-w-lg pointer-events-auto">
          <AnimatePresence mode="wait">
            {gameState === 'dialogue' ? (
              <motion.div
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 20, opacity: 0 }}
                className="bg-black/80 border-l-4 border-[#ff5e00] p-6 rounded-r-lg backdrop-blur-xl"
                onClick={handleSummon} // Allow clicking valid confirmation
              >
                <p className="text-xl font-medium text-[#ffd700] mb-2">狐の悪魔</p>
                <p className="text-lg leading-relaxed">{dialogue}</p>
                <p className="text-sm text-gray-500 mt-4 animate-pulse">「コン」と言って肯定（またはタップ）</p>
              </motion.div>
            ) : gameState === 'summoned' ? (
              <div className="text-center">
                <p className="text-[#ff5e00] font-black text-6xl tracking-tighter scale-150 animate-bounce drop-shadow-[0_0_15px_rgba(255,94,0,0.8)]">
                  KON!
                </p>
              </div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>

      {/* Simulation Trigger (Invisible touch area) */}
      {/* Only active in locking state if voice fails */}
      {gameState === 'locked' && (
        <div
          className="absolute inset-0 z-30 cursor-pointer"
          onClick={handleSummon}
          title="Tap to Force Summon"
        />
      )}
    </div>
  );
}
