'use client';

import Image from 'next/image';
import { useState } from 'react';
import styles from './WorldQuiz.module.css';

const worldOptions = [
    { id: 'ocean', label: 'Oceanic', image: '/quiz_images/ocean.png', desc: 'Deep, fluid, and mysterious', color: '#0ea5e9' },
    { id: 'forest', label: 'Verdant', image: '/quiz_images/forest.png', desc: 'Growth, life, and harmony', color: '#22c55e' },
    { id: 'volcano', label: 'Volcanic', image: '/quiz_images/magma.png', desc: 'Passion, energy, and raw power', color: '#f97316' },
    { id: 'sky', label: 'Ethereal', image: '/quiz_images/craters.png', desc: 'Light, freedom, and dreams', color: '#38bdf8' },
    { id: 'crystal', label: 'Crystalline', image: '/quiz_images/desierto.png', desc: 'Order, clarity, and precision', color: '#eab308' }, // Changed color to gold-ish
];

const artifactOptions = [
    { id: 'lamp', label: 'Lamp', image: '/artifacts_Images/Lamp_Volcano.png' },
    { id: 'necklace', label: 'Necklace', image: '/artifacts_Images/Necklace_Oceanic.png' },
    { id: 'keychain', label: 'Keychain', image: '/artifacts_Images/Gemini_Generated_Image_jprwvhjprwvhjprw.png' },
];

export default function WorldQuiz() {
    const [sliderValue, setSliderValue] = useState(2);
    const [view, setView] = useState<'quiz' | 'email' | 'artifact' | 'success'>('quiz');
    const [email, setEmail] = useState('');
    const [selectedArtifact, setSelectedArtifact] = useState<string | null>(artifactOptions[0].id);
    const [submitting, setSubmitting] = useState(false);

    const activeOption = worldOptions[sliderValue];

    const handleContinue = () => {
        setView('email');
    };

    const handleEmailSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) return;
        setView('artifact');
    };

    const handleSubmit = async () => {
        if (!email || !selectedArtifact) return;

        setSubmitting(true);
        try {
            const res = await fetch('/api/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email,
                    worldType: activeOption.id,
                    selectedProduct: selectedArtifact,
                    type: 'quiz_complete',
                    timestamp: new Date().toISOString(),
                }),
            });

            if (res.ok) {
                setView('success');
            }
        } catch (error) {
            console.error('Failed to submit', error);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <section className={styles.quizSection} id="quiz">
            <div className={styles.container}>
                <div className={styles.stepperContainer}>
                    <div className={styles.stepperLabel}>
                        {view === 'success' ? <span>Complete</span> : <span>Initiation</span>}
                        <span>
                            {view === 'quiz' ? 'Step 1 of 3' :
                                view === 'email' ? 'Step 2 of 3' :
                                    view === 'artifact' ? 'Step 3 of 3' : 'Complete'}
                        </span>
                    </div>
                    <div className={styles.progressBar}>
                        <div
                            className={styles.progressFill}
                            style={{
                                width: view === 'quiz' ? '33%' :
                                    view === 'email' ? '66%' :
                                        view === 'artifact' ? '90%' : '100%'
                            }}
                        ></div>
                    </div>
                </div>

                {view === 'quiz' && (
                    <>
                        <h2 className={styles.questionTitle}>What is the essence of your world?</h2>

                        <div
                            className={styles.activeOptionDisplay}
                            style={{ '--glow-color': activeOption.color } as React.CSSProperties}
                        >
                            <div className={styles.planetVisual}>
                                {worldOptions.map((option, index) => (
                                    <div
                                        key={option.id}
                                        className={`${styles.planetImageWrapper} ${index === sliderValue ? styles.active : ''}`}
                                        style={{ '--glow-color': option.color } as React.CSSProperties}
                                    >
                                        <Image
                                            src={option.image}
                                            alt={option.label}
                                            fill
                                            sizes="(max-width: 768px) 90vw, 600px"
                                            className={styles.planetIcon}
                                            priority={true}
                                        />
                                    </div>
                                ))}
                            </div>
                            <h3 className={styles.optionLabel}>{activeOption.label}</h3>
                            <p className={styles.optionDesc}>{activeOption.desc}</p>
                        </div>

                        <div className={styles.sliderContainer}>
                            <input
                                type="range"
                                min="0"
                                max={worldOptions.length - 1}
                                step="1"
                                value={sliderValue}
                                onChange={(e) => setSliderValue(Number(e.target.value))}
                                className={styles.slider}
                                style={{ '--glow-color': activeOption.color } as React.CSSProperties}
                                aria-label="Select world essence"
                            />
                        </div>

                        <button onClick={handleContinue} className={styles.continueBtn}>
                            Continue
                        </button>
                    </>
                )}

                {view === 'email' && (
                    <div className={styles.emailForm}>
                        <h2 className={styles.questionTitle}>Save your Essence</h2>
                        <p className={styles.emailSubtext}>
                            Enter your contact to proceed to artifact selection.
                        </p>

                        <form onSubmit={handleEmailSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
                            <input
                                type="email"
                                required
                                placeholder="enter@email.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className={styles.emailInput}
                                autoFocus
                            />
                            <button
                                type="submit"
                                className={styles.continueBtn}
                                style={{ marginTop: '0.5rem' }}
                            >
                                Continue
                            </button>
                        </form>
                    </div>
                )}

                {view === 'artifact' && (
                    <div className={styles.emailForm}>
                        <h2 className={styles.questionTitle}>Choose your Artifact</h2>
                        <p className={styles.emailSubtext}>
                            Select the vessel for your world's energy.
                        </p>

                        <div className={styles.artifactPreviewContainer}>
                            {selectedArtifact && (
                                <div className={styles.artifactPreviewImageWrapper}>
                                    <Image
                                        src={artifactOptions.find(a => a.id === selectedArtifact)?.image || ''}
                                        alt="Selected Artifact"
                                        fill
                                        className={styles.artifactPreviewImage}
                                        priority
                                    />
                                </div>
                            )}
                        </div>

                        <div className={styles.artifactThumbnails}>
                            {artifactOptions.map((artifact) => (
                                <div
                                    key={artifact.id}
                                    className={`${styles.artifactThumbnailCard} ${selectedArtifact === artifact.id ? styles.selected : ''}`}
                                    onClick={() => setSelectedArtifact(artifact.id)}
                                >
                                    <div className={styles.thumbnailImageContainer}>
                                        <Image
                                            src={artifact.image}
                                            alt={artifact.label}
                                            fill
                                            className={styles.artifactImage}
                                        />
                                    </div>
                                    <span className={styles.thumbnailLabel}>{artifact.label}</span>
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={handleSubmit}
                            className={styles.continueBtn}
                            disabled={submitting || !selectedArtifact}
                            style={{
                                marginTop: '0.5rem',
                                opacity: selectedArtifact ? 1 : 0.5,
                                cursor: selectedArtifact ? 'pointer' : 'not-allowed'
                            }}
                        >
                            {submitting ? 'Transmitting...' : 'Receive Transmission'}
                        </button>
                    </div>
                )}

                {view === 'success' && (
                    <div className={styles.successMessage}>
                        <span className={styles.successIcon}>✨</span>
                        <h2 className={styles.questionTitle}>Transmission Received</h2>
                        <p className={styles.optionDesc}>
                            Check your inbox to continue your journey.
                        </p>
                    </div>
                )}
            </div>
        </section>
    );
}
