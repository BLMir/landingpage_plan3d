"use client";
import React, { useEffect, useState } from 'react';
import { useProgress } from '@react-three/drei';

const LOAD_STAGES = [
    { text: "INITIALIZING ENVIRONMENT...", color: "#4facfe" }, // Blue
    { text: "LOADING VOLCANIC DATA...", color: "#ff4b1f" },    // Red
    { text: "GENERATING FORESTS...", color: "#11998e" },       // Green
    { text: "FINALIZING WORLD...", color: "#f80759" },         // Pink
];

export const Loader = () => {
    const { progress, active } = useProgress();
    const [displayProgress, setDisplayProgress] = useState(0);
    const [stageIndex, setStageIndex] = useState(0);
    const [visible, setVisible] = useState(true);

    // Fake smooth progress to keep user engaged + sticky behavior
    useEffect(() => {
        let interval: NodeJS.Timeout;

        // START LOADING SEQUENCE
        // We force a minimum "fake" load time to show the messages
        setVisible(true);

        const startTime = Date.now();
        const MIN_DURATION = 6000; // 6 seconds minimum to ensure smoothness

        interval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const timeProgress = Math.min((elapsed / MIN_DURATION) * 100, 99); // Cap time at 99

            // Use the SLOWER of the two: Real download vs Fake Timer
            // This ensures distinct stages are seen even on fast connections.
            let target = 0;

            if (active) {
                // If active, we aim for the max of real vs time
                target = Math.max(timeProgress, progress);
            } else {
                // If done downloading, we still respect the timer up to 100
                target = Math.max(timeProgress, 100);
            }

            // Cap at 99 if we are strictly waiting for timer, but if done allow 100
            if (active && target > 99) target = 99;

            // MONOTONIC UPDATE: Never go backwards (Fixes 10% -> 9% glitch)
            setDisplayProgress(prev => {
                const next = prev + (target - prev) * 0.1; // Smooth interpolate
                // If target is lower than prev (glitch), stay at prev.
                // If next is basically target, snap.
                if (target < prev) return prev;
                return next;
            });

            // Update Text Stage based on %
            if (displayProgress < 25) setStageIndex(0);
            else if (displayProgress < 50) setStageIndex(1);
            else if (displayProgress < 75) setStageIndex(2);
            else setStageIndex(3);

            // Completion Check: Must be inactive, past time, and visually full
            // FIX: If download is done (!active) and time is up, FORCE finish.
            // Don't wait for the lerp to reach 99, just snap it to 100.
            if (!active && elapsed > MIN_DURATION) {
                setDisplayProgress(100);
                // Small buffer to show 100% then hide
                setTimeout(() => {
                    clearInterval(interval);
                    setVisible(false);
                }, 200);
            }

        }, 50);

        return () => clearInterval(interval);
    }, [active, progress]);

    if (!visible) return null;

    const currentStage = LOAD_STAGES[stageIndex];

    return (
        <div
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                background: 'rgba(5, 5, 5, 0.95)',
                backdropFilter: 'blur(20px)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999,
                transition: 'opacity 0.8s ease',
            }}
        >
            <div style={{
                fontFamily: "'Inter', sans-serif",
                color: '#e0e0e0',
                fontSize: '1rem',
                marginBottom: '20px',
                fontWeight: 300,
                textAlign: 'center',
                letterSpacing: '1px'
            }}>
                {currentStage.text} {Math.round(displayProgress)}%
            </div>
            <div style={{
                width: '240px',
                height: '4px',
                background: 'rgba(255,255,255,0.1)',
                borderRadius: '4px',
                overflow: 'hidden',
                position: 'relative' // Needed for absolute child
            }}>
                <div style={{
                    width: '100%',
                    height: '100%',
                    background: currentStage.color,
                    boxShadow: `0 0 15px ${currentStage.color}`,
                    // USE TRANSFORM INSTEAD OF WIDTH FOR BETTER PERFORMANCE (Compositor Thread)
                    transform: `scaleX(${displayProgress / 100})`,
                    transformOrigin: 'left',
                    transition: 'transform 0.1s linear, background 0.5s ease',
                    willChange: 'transform' // Hint browser to optimize
                }} />
            </div>
        </div>
    );
};
