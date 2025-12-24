import { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

export const useHandTracking = (videoRef) => {
    const [handLandmarker, setHandLandmarker] = useState(null);
    const [isFoxHand, setIsFoxHand] = useState(false);
    const [webcamRunning, setWebcamRunning] = useState(false);

    // Initialize MediaPipe HandLandmarker
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
                numHands: 2
            });
            setHandLandmarker(landmarker);
        };
        createHandLandmarker();
    }, []);

    // Detection Loop
    useEffect(() => {
        if (!handLandmarker || !videoRef.current || !videoRef.current.video) return;

        let requestAnimationFrameId;
        const video = videoRef.current.video;

        const predict = async () => {
            if (video.readyState >= 2) {
                const startTimeMs = performance.now();
                const result = handLandmarker.detectForVideo(video, startTimeMs);

                if (result.landmarks && result.landmarks.length > 0) {
                    // Check for Fox Sign in any detected hand
                    const detected = result.landmarks.some(landmarks => detectFoxSign(landmarks));
                    setIsFoxHand(detected);
                } else {
                    setIsFoxHand(false);
                }
            }
            requestAnimationFrameId = requestAnimationFrame(predict);
        };

        // Wait for video to load
        if (video.readyState >= 2) {
            predict();
        } else {
            video.onloadeddata = predict;
        }

        return () => cancelAnimationFrame(requestAnimationFrameId);
    }, [handLandmarker, videoRef]);

    return { isFoxHand };
};

// Fox Sign Detection Logic
// "Fox Hand": Middle (12) + Ring (16) touching Thumb (4). Index (8) + Pinky (20) Up.
const detectFoxSign = (landmarks) => {
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];
    const ringTip = landmarks[16];
    const pinkyTip = landmarks[20];

    const indexPip = landmarks[6]; // Lower joint
    const pinkyPip = landmarks[18]; // Lower joint

    // Calculate distances (simplified 2D distance for speed, Z is available too)
    const dist = (p1, p2) => Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));

    // 1. Thumb should be close to Middle and Ring
    const thumbToMiddle = dist(thumbTip, middleTip);
    const thumbToRing = dist(thumbTip, ringTip);
    const threshold = 0.08; // Configurable threshold based on scale

    const isClosed = thumbToMiddle < threshold && thumbToRing < threshold;

    // 2. Index and Pinky should be extended (Tips higher (lower y) than PIP joints or just far from palm)
    // Assuming hand is upright. If checking shape purely relative, we check distance from Wrist (0)
    const wrist = landmarks[0];
    const distWristIndex = dist(wrist, indexTip);
    const distWristPinky = dist(wrist, pinkyTip);
    const distWristMiddle = dist(wrist, middleTip);

    // Index and Pinky should be further from wrist than Middle/Ring (since Middle/Ring are curled)
    // Actually, Middle/Ring curled means they are closer to wrist than when extended? 
    // Wait, Fox sign involves touching tips. The fingers are bent forward.
    // Index and Pinky are STRAIGHT up.
    // So: Index and Pinky extended, Middle and Ring curled/meeting thumb.

    // Let's use simple Y coordinate check if hand is upright
    // Tip Y < Pip Y (remember Y increases downwards)
    const indexUp = indexTip.y < indexPip.y;
    const pinkyUp = pinkyTip.y < pinkyPip.y;

    return isClosed && indexUp && pinkyUp;
};
