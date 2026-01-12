import { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

export const useHandTracking = (videoRef: React.RefObject<any>, isPaused: boolean = false) => {
    const [handLandmarker, setHandLandmarker] = useState<HandLandmarker | null>(null);
    const [isFoxHand, setIsFoxHand] = useState(false);
    const [handPosition, setHandPosition] = useState<{ x: number, y: number } | null>(null);

    useEffect(() => {
        const createHandLandmarker = async () => {
            const vision = await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
            );
            const landmarker = await HandLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
                    delegate: "GPU"
                },
                runningMode: "VIDEO",
                numHands: 1
            });
            setHandLandmarker(landmarker);
        };
        createHandLandmarker();
    }, []);

    useEffect(() => {
        if (!handLandmarker) return;

        let requestAnimationFrameId: number;
        let isLoopActive = true;

        const predictLoop = async () => {
            if (!isLoopActive) return;

            if (!isPaused) {
                const video = videoRef.current?.video;
                if (video && video.readyState >= 2) {
                    try {
                        const startTimeMs = performance.now();
                        const result = handLandmarker.detectForVideo(video, startTimeMs);

                        if (result.landmarks && result.landmarks.length > 0) {
                            const detected = result.landmarks.some(landmarks => detectFoxSign(landmarks));
                            setIsFoxHand(detected);
                            if (detected) {
                                const pos = result.landmarks[0][12];
                                setHandPosition({ x: pos.x, y: pos.y });
                            }
                        } else {
                            setIsFoxHand(false);
                            setHandPosition(null);
                        }
                    } catch (err) {
                        // Silently ignore tracking errors unless critical
                    }
                }
            }

            requestAnimationFrameId = requestAnimationFrame(predictLoop);
        };

        predictLoop();

        return () => {
            isLoopActive = false;
            cancelAnimationFrame(requestAnimationFrameId);
        };
    }, [handLandmarker, videoRef, isPaused]);

    return { isFoxHand, handPosition };
};

const detectFoxSign = (landmarks: any[]) => {
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];
    const ringTip = landmarks[16];
    const pinkyTip = landmarks[20];

    const indexPip = landmarks[6];
    const pinkyPip = landmarks[18];

    const dist = (p1: any, p2: any) => Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));

    // Thumb meets Middle and Ring tips
    const threshold = 0.15; // Relaxed from 0.08
    const isClosed = dist(thumbTip, middleTip) < threshold && dist(thumbTip, ringTip) < threshold;

    // Index and Pinky are straight up
    // Higher up means smaller y value in normalized coordinates
    const indexUp = indexTip.y < indexPip.y - 0.05;
    const pinkyUp = pinkyTip.y < pinkyPip.y - 0.05;

    return isClosed && indexUp && pinkyUp;
};
