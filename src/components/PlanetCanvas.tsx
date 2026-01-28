import React, { useRef, useEffect } from 'react';
import styles from './WorldQuiz.module.css';

interface PlanetCanvasProps {
    images: { low: HTMLImageElement[]; high: HTMLImageElement[] } | null;
    sliderValue: number;
    width: number;
    height: number;
    tintColor?: string;
    tintOpacity?: number;
}

export const PlanetCanvas: React.FC<PlanetCanvasProps> = ({ images, sliderValue, width, height, tintColor, tintOpacity }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !images) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear canvas
        ctx.clearRect(0, 0, width, height);
        ctx.globalCompositeOperation = 'source-over'; // Reset default
        ctx.globalAlpha = 1;

        let imgToDraw: HTMLImageElement | null = null;

        if (sliderValue === 50) {
            imgToDraw = images.low[0];
        } else if (sliderValue < 50) {
            const index = Math.min(19, Math.floor(((50 - sliderValue) / 50) * 19));
            imgToDraw = images.low[index];
        } else {
            const index = Math.min(19, Math.floor(((sliderValue - 50) / 50) * 19));
            imgToDraw = images.high[index];
        }

        if (imgToDraw && imgToDraw.complete) {
            // 1. Draw the planet image
            ctx.drawImage(imgToDraw, 0, 0, width, height);

            // 2. Apply tint if needed
            if (tintColor && tintOpacity && tintOpacity > 0) {
                // Save context state
                ctx.save();

                // Keep the opaque parts (source-atop means: draw new content only where existing content is opaque)
                ctx.globalCompositeOperation = 'source-atop';
                ctx.globalAlpha = tintOpacity;
                ctx.fillStyle = tintColor;

                // Fill the entire canvas with the tint color (it will be masked by the planet)
                ctx.fillRect(0, 0, width, height);

                // Restore context state
                ctx.restore();
            }
        }

    }, [images, sliderValue, width, height, tintColor, tintOpacity]);

    return (
        <canvas
            ref={canvasRef}
            width={width}
            height={height}
            className={styles.planetIcon}
            style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain'
            }}
        />
    );
};
