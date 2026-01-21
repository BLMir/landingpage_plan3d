'use client';

import { useState, useCallback } from 'react';
import styles from './Hero.module.css';
import Carousel from './Carousel';

import Image from 'next/image';

const IMAGE_COLORS = [
    { start: '#0ea5e9', end: '#3b82f6' }, // Ocean: Light Blue -> Blue
    { start: '#d946ef', end: '#8b5cf6' }, // Creative: Pink -> Purple
    { start: '#f97316', end: '#ef4444' }, // Volcano: Orange -> Red
    { start: '#6366f1', end: '#a855f7' }, // Gemini: Indigo -> Purple
];

export default function Hero() {
    const [gradientColors, setGradientColors] = useState(IMAGE_COLORS[0]);

    const scrollToQuiz = () => {
        const quizSection = document.getElementById('quiz');
        if (quizSection) {
            quizSection.scrollIntoView({ behavior: 'smooth' });
        }
    };

    const handleCarouselChange = useCallback((index: number) => {
        setGradientColors(IMAGE_COLORS[index] || IMAGE_COLORS[0]);
    }, []);

    const heroImages = [
        '/hero_landing_images/Comp_ChicaOceano.png',
        '/hero_landing_images/Comp_ChicoCreativo.png',
        '/hero_landing_images/Comp_NiñoVolcan.png',
        '/hero_landing_images/Gemini_Generated_Image_nq36hsnq36hsnq36.png'
    ];

    return (
        <section className={styles.hero}>
            <div className={styles.container}>
                <div className={styles.logo}>
                    <Image
                        src="/Logo color.png"
                        alt="Planet 5 Logo"
                        width={120}
                        height={120}
                        style={{ objectFit: 'contain' }}
                        priority
                    />
                </div>
                <h1 className={styles.title}>
                    Discover Your{' '}
                    <span
                        className={styles.gradientText}
                        style={{
                            '--gradient-start': gradientColors.start,
                            '--gradient-end': gradientColors.end,
                        } as React.CSSProperties}
                    >
                        Inner Planet
                    </span>
                </h1>

                <div
                    className={styles.visual}
                    style={{
                        '--gradient-start': gradientColors.start,
                        '--gradient-end': gradientColors.end,
                    } as React.CSSProperties}
                >
                    <Carousel images={heroImages} onIndexChange={handleCarouselChange} />
                </div>

                <button onClick={scrollToQuiz} className={styles.ctaButton}>
                    Create My Planet
                </button>

                <p className={styles.subtitle}>
                    A custom 3D printed masterpiece evolved from your unique Big 5 personality profile.
                </p>
            </div>
        </section>
    );
}
