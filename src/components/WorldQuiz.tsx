'use client';

import Image from 'next/image';
import { useState, useEffect, useMemo } from 'react';
import styles from './WorldQuiz.module.css';

const questions = [
    {
        id: 'empathy',
        title: 'How empathetic are you?',
        folder: '1_How empathetic are you_',
        lowPrefix: '1_low',
        highPrefix: '1_high',
        logo: '/1_Quiz Planet Images/1_How empathetic are you_/1_logo.png',
        color: '#0ea5e9'
    },
    {
        id: 'sociable',
        title: 'How sociable are you?',
        folder: '2_How sociable are you_',
        lowPrefix: '2_low',
        highPrefix: '2_high',
        logo: '/1_Quiz Planet Images/2_How sociable are you_/2_logo.png',
        color: '#22c55e'
    },
    {
        id: 'persistent',
        title: 'How persistent are you?',
        folder: '3_How persistent are you_',
        lowPrefix: '3_low',
        highPrefix: '3_high',
        logo: '/1_Quiz Planet Images/3_How persistent are you_/3_logo.png',
        color: '#f97316'
    },
    {
        id: 'curious',
        title: 'How curious are you?',
        folder: '4_How curious are you_',
        lowPrefix: '4_low',
        highPrefix: '4_high',
        logo: '/1_Quiz Planet Images/4_How curious are you_/4_logo.png',
        color: '#38bdf8'
    },
    {
        id: 'relaxed',
        title: 'How relaxed are you?',
        folder: '5_How relaxed are you_',
        lowPrefix: '5_low',
        highPrefix: '5_high',
        logo: '/1_Quiz Planet Images/5_How relaxed are you_/5_logo.png',
        color: '#eab308'
    },
];

const artifactOptions = [
    { id: 'artifact_1', label: 'Digital - for free!', format: 'Digital', image: '/artifacts/Format_1.png', priceTiers: [0], subtitle: 'In which format would you like your planet?' },
    { id: 'artifact_2', label: 'Poster', format: 'Poster', image: '/artifacts/Format_2.png', priceTiers: [12, 22, 35], subtitle: 'Get a 20% off!' },
    { id: 'artifact_3', label: 'Lamp', format: 'Lamp', image: '/artifacts/Format_3.png', priceTiers: [45, 65, 95], subtitle: 'Get a 20% off!' },
    { id: 'artifact_4', label: 'Necklace', format: 'Necklace', image: '/artifacts/Format_4.png', priceTiers: [24, 39, 55], subtitle: 'Get a 20% off!' },
    { id: 'artifact_5', label: 'Earrings', format: 'Earrings', image: '/artifacts/Format_5.png', priceTiers: [18, 29, 42], subtitle: 'Get a 20% off!' },
    { id: 'artifact_6', label: 'Bracelet', format: 'Bracelet', image: '/artifacts/Format_6.png', priceTiers: [15, 25, 35], subtitle: 'Get a 20% off!' },
];

export default function WorldQuiz() {
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [sliderValue, setSliderValue] = useState(50);
    const [answers, setAnswers] = useState<Record<string, number>>({});
    const [view, setView] = useState<'quiz' | 'email' | 'artifact' | 'success'>('quiz');
    const [email, setEmail] = useState('');
    const [selectedArtifact, setSelectedArtifact] = useState<string | null>(artifactOptions[0].id);
    const [submitting, setSubmitting] = useState(false);
    const [carouselIndex, setCarouselIndex] = useState(0);
    const [selectedPrices, setSelectedPrices] = useState<Record<string, number>>(
        Object.fromEntries(artifactOptions.map(opt => [opt.id, opt.priceTiers[0]]))
    );
    const [wishlisted, setWishlisted] = useState<Set<string>>(new Set());

    const nextArtifact = () => {
        setCarouselIndex((prev) => (prev + 1) % artifactOptions.length);
        setSelectedArtifact(artifactOptions[(carouselIndex + 1) % artifactOptions.length].id);
    };

    const prevArtifact = () => {
        setCarouselIndex((prev) => (prev - 1 + artifactOptions.length) % artifactOptions.length);
        setSelectedArtifact(artifactOptions[(carouselIndex - 1 + artifactOptions.length) % artifactOptions.length].id);
    };

    const currentQuestion = questions[currentQuestionIndex];

    const currentImage = useMemo(() => {
        const folder = `/1_Quiz Planet Images/${currentQuestion.folder}`;
        let subFolder = '';
        let prefix = '';
        let frame = 0;

        if (sliderValue === 50) {
            // Pure blank state - we can use the first frame of either low or high (assuming both start from blank)
            // or just pick one. Let's pick low_00.
            return `${folder}/${currentQuestion.lowPrefix}/${currentQuestion.lowPrefix}_00.png`;
        } else if (sliderValue < 50) {
            // Low side: 50 -> 0 (0-20 frames)
            // 50 value -> index 0
            // 0 value -> index 19
            subFolder = currentQuestion.lowPrefix;
            prefix = currentQuestion.lowPrefix;
            frame = Math.floor(((50 - sliderValue) / 50) * 19);
        } else {
            // High side: 50 -> 100 (0-20 frames)
            // 50 value -> index 0
            // 100 value -> index 19
            subFolder = currentQuestion.highPrefix;
            prefix = currentQuestion.highPrefix;
            frame = Math.floor(((sliderValue - 50) / 50) * 19);
        }

        const frameStr = frame.toString().padStart(2, '0');
        // The prefixes in the filenames actually match the lowPrefix/highPrefix
        // e.g. /1_Quiz Planet Images/1_How empathetic are you_/1_low/1_low_00.png
        return `${folder}/${subFolder}/${prefix}_${frameStr}.png`;
    }, [sliderValue, currentQuestion]);

    const handleNext = () => {
        const newAnswers = { ...answers, [currentQuestion.id]: sliderValue };
        setAnswers(newAnswers);

        if (currentQuestionIndex < questions.length - 1) {
            setCurrentQuestionIndex(currentQuestionIndex + 1);
            setSliderValue(50); // Reset slider for next question
        } else {
            setView('email');
        }
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
                    quizAnswers: answers,
                    selectedProduct: selectedArtifact,
                    format: artifactOptions.find(a => a.id === selectedArtifact)?.format,
                    price: selectedPrices[selectedArtifact],
                    wishlistedItems: Array.from(wishlisted).map(id => artifactOptions.find(a => a.id === id)?.format),
                    type: 'quiz_complete_v3',
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
                <div className={styles.headerLogo}>
                    <Image
                        src={view === 'quiz' ? currentQuestion.logo : '/1_Quiz Planet Images/1_How empathetic are you_/1_logo.png'}
                        alt="Question Logo"
                        width={80}
                        height={80}
                        className={styles.headerLogoImage}
                    />
                </div>

                {view === 'quiz' && (
                    <>
                        <h2 className={styles.questionTitle}>{currentQuestion.title}</h2>

                        <div
                            className={styles.activeOptionDisplay}
                            style={{ '--glow-color': currentQuestion.color } as React.CSSProperties}
                        >
                            <div className={styles.planetVisual}>
                                <div
                                    className={`${styles.planetImageWrapper} ${styles.active}`}
                                    style={{ '--glow-color': currentQuestion.color } as React.CSSProperties}
                                >
                                    <Image
                                        src={currentImage}
                                        alt="Planet transition"
                                        fill
                                        sizes="(max-width: 768px) 90vw, 600px"
                                        className={styles.planetIcon}
                                        priority={true}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className={styles.sliderContainer}>
                            <div className={styles.logoSliderWrapper}>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    step="1"
                                    value={sliderValue}
                                    onChange={(e) => setSliderValue(Number(e.target.value))}
                                    className={styles.logoSlider}
                                    style={{
                                        '--glow-color': currentQuestion.color,
                                        '--thumb-image': `url('/Logo color.png')`
                                    } as React.CSSProperties}
                                    aria-label="Select your intensity"
                                />
                                <div className={styles.sliderTrackLine} />
                            </div>
                        </div>

                        <button onClick={handleNext} className={styles.continueBtn}>
                            {currentQuestionIndex === questions.length - 1 ? 'Finish Essence' : 'Next Question'}
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
                        <h2 className={styles.questionTitle}>Thanks!</h2>
                        <p className={styles.emailSubtext}>
                            In which format would you like your planet?
                        </p>

                        <div className={styles.carouselContainer}>
                            <button onClick={prevArtifact} className={styles.navBtn} aria-label="Previous artifact">
                                ‹
                            </button>

                            <div className={styles.carouselTrack}>
                                {artifactOptions.map((artifact, idx) => {
                                    let offset = idx - carouselIndex;
                                    if (offset > artifactOptions.length / 2) offset -= artifactOptions.length;
                                    if (offset < -artifactOptions.length / 2) offset += artifactOptions.length;

                                    const isActive = idx === carouselIndex;
                                    const isSaved = wishlisted.has(artifact.id);

                                    return (
                                        <div
                                            key={artifact.id}
                                            className={`${styles.carouselItem} ${isActive ? styles.activeItem : ''}`}
                                            onClick={() => {
                                                setCarouselIndex(idx);
                                                setSelectedArtifact(artifact.id);
                                            }}
                                            style={{
                                                transform: `translateX(${offset * 105}%) scale(${isActive ? 1 : 0.8})`,
                                                opacity: Math.abs(offset) > 1 ? 0 : (isActive ? 1 : 0.5),
                                                zIndex: isActive ? 10 : 1
                                            }}
                                        >
                                            <div className={styles.artifactMainImageWrapper}>
                                                <Image
                                                    src={artifact.image}
                                                    alt={artifact.label}
                                                    fill
                                                    className={styles.artifactMainImage}
                                                    priority={isActive}
                                                />
                                            </div>

                                            <h3 className={styles.artifactFormatTitle}>{artifact.format}</h3>

                                            <button
                                                className={`${styles.wishlistBtn} ${isSaved ? styles.saved : ''}`}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setWishlisted(prev => {
                                                        const next = new Set(prev);
                                                        if (next.has(artifact.id)) next.delete(artifact.id);
                                                        else next.add(artifact.id);
                                                        return next;
                                                    });
                                                }}
                                            >
                                                {isSaved ? '✓ Saved' : 'Wishlist +'}
                                            </button>

                                            <p className={styles.promoText}>{artifact.subtitle}</p>

                                            <div className={styles.pricePillsContainer}>
                                                {artifact.priceTiers.map((price) => (
                                                    <button
                                                        key={price}
                                                        className={`${styles.pricePill} ${selectedPrices[artifact.id] === price ? styles.activePill : ''}`}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedPrices(prev => ({ ...prev, [artifact.id]: price }));
                                                        }}
                                                    >
                                                        {price === 0 ? 'Free' : `${price}€`}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <button onClick={nextArtifact} className={styles.navBtn} aria-label="Next artifact">
                                ›
                            </button>
                        </div>

                        <button
                            onClick={handleSubmit}
                            className={styles.continueBtn}
                            disabled={submitting || !selectedArtifact}
                            style={{
                                marginTop: '2rem',
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
