'use client';

import styles from './Hero.module.css';

export default function Hero() {
    const scrollToForm = () => {
        const formSection = document.getElementById('form');
        if (formSection) {
            formSection.scrollIntoView({ behavior: 'smooth' });
        }
    };

    return (
        <section className={styles.hero}>
            <div className={styles.content}>
                <h1 className={styles.title}>Discover Your <span className={styles.gradientText}>Inner Planet</span></h1>
                <p className={styles.subtitle}>
                    A custom 3D printed masterpiece evolved from your unique Big 5 personality profile.
                </p>
                <button onClick={scrollToForm} className={styles.ctaButton}>
                    Create My Planet
                </button>
            </div>
            <div className={styles.visual}>
                {/* Placeholder for 3D visual or image */}
                <div className={styles.planetPlaceholder}></div>
            </div>
        </section>
    );
}
