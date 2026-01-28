'use client';

import Image from 'next/image';
import { useState, useEffect, useMemo } from 'react';
import styles from './WorldQuiz.module.css';
import { useImagePreloader } from '@/hooks/useImagePreloader';
import { PlanetCanvas } from './PlanetCanvas';
import { ArrowLeft, ArrowRight } from './Icons';

type QuestionFeedback = {
    low: string;
    high: string;
};

const feedbackMessages: Record<string, QuestionFeedback> = {
    'empathy': { low: "I'm like a desert", high: "I'm more like an ocean" },
    'sociable': { low: "I'm more like a forest", high: "I'm energetic like magma!" },
    'persistent': { low: "I orbit around many things!", high: "I like to keep my ring together" },
    'curious': { low: "I deal with my own craters", high: "I like to discover new comets" },
    'relaxed': { low: "I have some storms inside me", high: "I have a clear sky" },
};

type GlowColors = {
    low: string;
    high: string;
};

const glowColorMap: Record<string, GlowColors> = {
    'empathy': { low: '#D9851E', high: '#3B82F6' },
    'sociable': { low: '#22C55E', high: '#EF4444' },
    'persistent': { low: '#C084FC', high: '#D9851E' },
    'curious': { low: '#94A3B8', high: '#EAB308' },
    'relaxed': { low: '#94A3B8', high: '#FFFFFF' },
};

const tintColorMap: Record<string, GlowColors> = {
    'empathy': { low: '#D9851E', high: '#3B82F6' },
    'sociable': { low: '#40E0D0', high: '#EF4444' }, // Turquoise to Red
    'persistent': { low: '#C084FC', high: '#D9851E' },
    'curious': { low: '#94A3B8', high: '#EAB308' },
    'relaxed': { low: '#94A3B8', high: '#FFFFFF' },
};

const interpolateColor = (color1: string, color2: string, factor: number) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color1);
    const result2 = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color2);

    if (!result || !result2) return color1;

    const r1 = parseInt(result[1], 16);
    const g1 = parseInt(result[2], 16);
    const b1 = parseInt(result[3], 16);

    const r2 = parseInt(result2[1], 16);
    const g2 = parseInt(result2[2], 16);
    const b2 = parseInt(result2[3], 16);

    const r = Math.round(r1 + factor * (r2 - r1));
    const g = Math.round(g1 + factor * (g2 - g1));
    const b = Math.round(b1 + factor * (b2 - b1));

    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
};

const questions = [
    {
        id: 'empathy',
        title: 'How empathetic are you?',
        folder: '1_How empathetic are you_',
        lowPrefix: '1_low',
        highPrefix: '1_high',
        logo: '/quiz_planet_images/1_How empathetic are you_/1_logo.png',
        color: '#0ea5e9'
    },
    {
        id: 'sociable',
        title: 'How sociable are you?',
        folder: '2_How sociable are you_',
        lowPrefix: '2_low',
        highPrefix: '2_high',
        logo: '/quiz_planet_images/2_How sociable are you_/2_logo.png',
        color: '#22c55e'
    },
    {
        id: 'persistent',
        title: 'How persistent are you?',
        folder: '3_How persistent are you_',
        lowPrefix: '3_low',
        highPrefix: '3_high',
        logo: '/quiz_planet_images/3_How persistent are you_/3_logo.png',
        color: '#f97316'
    },
    {
        id: 'curious',
        title: 'How curious are you?',
        folder: '4_How curious are you_',
        lowPrefix: '4_low',
        highPrefix: '4_high',
        logo: '/quiz_planet_images/4_How curious are you_/4_logo.png',
        color: '#38bdf8'
    },
    {
        id: 'relaxed',
        title: 'How relaxed are you?',
        folder: '5_How relaxed are you_',
        lowPrefix: '5_low',
        highPrefix: '5_high',
        logo: '/quiz_planet_images/5_How relaxed are you_/5_logo.png',
        color: '#eab308'
    },
];

const artifactOptions = [
    { id: 'artifact_1', label: 'Digital - for free!', format: 'Digital', image: '/artifact/Format_1.png', priceTiers: [0], subtitle: 'In which format would you like your planet?' },
    { id: 'artifact_2', label: 'Poster', format: 'Poster', image: '/artifact/Format_2.png', priceTiers: [12, 22, 35], subtitle: 'Get a 20% off!' },
    { id: 'artifact_3', label: 'Lamp', format: 'Lamp', image: '/artifact/Format_3.png', priceTiers: [45, 65, 95], subtitle: 'Get a 20% off!' },
    { id: 'artifact_4', label: 'Necklace', format: 'Necklace', image: '/artifact/Format_4.png', priceTiers: [24, 39, 55], subtitle: 'Get a 20% off!' },
    { id: 'artifact_5', label: 'Earrings', format: 'Earrings', image: '/artifact/Format_5.png', priceTiers: [18, 29, 42], subtitle: 'Get a 20% off!' },
    { id: 'artifact_6', label: 'Bracelet', format: 'Bracelet', image: '/artifact/Format_6.png', priceTiers: [15, 25, 35], subtitle: 'Get a 20% off!' },
];

// Trait Data
const traitMap: Record<string, Record<number, string>> = {
    'empathy': { 0: 'Selfish', 15: 'Competitive', 35: 'Skeptical', 65: 'Trusting', 85: 'Cooperative', 100: 'Kind' },
    'sociable': { 0: 'Reserved', 15: 'Solitary', 35: 'Withdrawn', 65: 'Outgoing', 85: 'Talkative', 100: 'Sociable' },
    'persistent': { 0: 'Careless', 15: 'Unreliable', 35: 'Disorganized', 65: 'Organized', 85: 'Reliable', 100: 'Disciplined' },
    'curious': { 0: 'Practical', 15: 'Routine-oriented', 35: 'Traditional', 65: 'Imaginative', 85: 'Adventurous', 100: 'Creative' },
    'relaxed': { 0: 'Anxious', 15: 'Insecure', 35: 'Vulnerable', 65: 'Resilient', 85: 'Confident', 100: 'Calm' }
};

export default function WorldQuiz() {
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [sliderValue, setSliderValue] = useState(50);
    const [answers, setAnswers] = useState<Record<string, number>>({});
    const [view, setView] = useState<'quiz' | 'email' | 'artifact' | 'success'>('quiz');
    const [showIdleOverlay, setShowIdleOverlay] = useState(true); // Start true for initial "Drag to start"
    const [hasInteracted, setHasInteracted] = useState(false);
    const idleTimerRef = useMemo(() => ({ current: null as NodeJS.Timeout | null }), []);
    const [email, setEmail] = useState('');
    const [selectedArtifact, setSelectedArtifact] = useState<string | null>(artifactOptions[0].id);
    const [submitting, setSubmitting] = useState(false);
    const [carouselIndex, setCarouselIndex] = useState(0);
    const [selectedPrices, setSelectedPrices] = useState<Record<string, number>>(
        Object.fromEntries(artifactOptions.map(opt => [opt.id, opt.priceTiers[0]]))
    );
    const [wishlisted, setWishlisted] = useState<Set<string>>(new Set(['artifact_1'])); // Digital saved by default

    const nextArtifact = () => {
        setCarouselIndex((prev) => (prev + 1) % artifactOptions.length);
        setSelectedArtifact(artifactOptions[(carouselIndex + 1) % artifactOptions.length].id);
    };

    const prevArtifact = () => {
        setCarouselIndex((prev) => (prev - 1 + artifactOptions.length) % artifactOptions.length);
        setSelectedArtifact(artifactOptions[(carouselIndex - 1 + artifactOptions.length) % artifactOptions.length].id);
    };

    const currentQuestion = questions[currentQuestionIndex];
    const { images, isLoading } = useImagePreloader(currentQuestion);

    // Idle timer logic
    useEffect(() => {
        const resetTimer = () => {
            if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
            idleTimerRef.current = setTimeout(() => {
                setShowIdleOverlay(true);
            }, 5000);
        };

        // Initialize timer
        resetTimer();

        // Cleanup
        return () => {
            if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        };
    }, [sliderValue, currentQuestionIndex, idleTimerRef]);

    const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSliderValue(Number(e.target.value));
        setShowIdleOverlay(false);
        setHasInteracted(true);

        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        idleTimerRef.current = setTimeout(() => {
            setShowIdleOverlay(true);
        }, 5000);
    };

    const handleNext = () => {
        const newAnswers = { ...answers, [currentQuestion.id]: sliderValue };
        setAnswers(newAnswers);

        if (currentQuestionIndex < questions.length - 1) {
            setCurrentQuestionIndex(currentQuestionIndex + 1);
            setSliderValue(50);
            setHasInteracted(false);
            setShowIdleOverlay(false);
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

    const currentGlowColor = useMemo(() => {
        const colors = glowColorMap[currentQuestion.id];
        if (!colors) return currentQuestion.color;
        return interpolateColor(colors.low, colors.high, sliderValue / 100);
    }, [currentQuestion.id, sliderValue, currentQuestion.color]);

    const tintInfo = useMemo(() => {
        const colors = tintColorMap[currentQuestion.id];
        if (!colors) return { color: 'transparent', opacity: 0 };

        const delta = Math.abs(sliderValue - 50);
        let opacity = 0;
        if (delta > 5) {
            opacity = (delta / 25) * 0.3;
        }

        const isLow = sliderValue < 50;
        return {
            color: isLow ? colors.low : colors.high,
            opacity: Math.min(0.6, opacity)
        };
    }, [currentQuestion.id, sliderValue]);

    // Data for all traits of current question to render (and toggle visibility via CSS)
    const allTraits = useMemo(() => {
        const traits = traitMap[currentQuestion.id];
        if (!traits) return [];
        return [
            { label: traits[0], posClass: styles['pos-0'], threshold: 5, type: 'low' },
            { label: traits[15], posClass: styles['pos-15'], threshold: 15, type: 'low' },
            { label: traits[35], posClass: styles['pos-35'], threshold: 35, type: 'low' },
            { label: traits[65], posClass: styles['pos-65'], threshold: 65, type: 'high' },
            { label: traits[85], posClass: styles['pos-85'], threshold: 85, type: 'high' },
            { label: traits[100], posClass: styles['pos-100'], threshold: 95, type: 'high' },
        ];
    }, [currentQuestion.id]);

    const getTraitVisibility = (threshold: number, type: string) => {
        if (type === 'low') return sliderValue <= threshold && sliderValue < 50;
        if (type === 'high') return sliderValue >= threshold && sliderValue > 50;
        return false;
    };

    // Calculate active traits based on slider value
    const activeTraits = useMemo(() => {
        const traits = traitMap[currentQuestion.id];
        if (!traits) return [];

        const activeList: { label: string; posClass: string }[] = [];

        // Low side (0-50%)
        if (sliderValue < 50) {
            if (sliderValue <= 35) activeList.push({ label: traits[35], posClass: styles['pos-35'] });
            if (sliderValue <= 15) activeList.push({ label: traits[15], posClass: styles['pos-15'] });
            if (sliderValue <= 5) activeList.push({ label: traits[0], posClass: styles['pos-0'] });
        }

        // High side (50-100%)
        else if (sliderValue > 50) {
            if (sliderValue >= 65) activeList.push({ label: traits[65], posClass: styles['pos-65'] });
            if (sliderValue >= 85) activeList.push({ label: traits[85], posClass: styles['pos-85'] });
            if (sliderValue >= 95) activeList.push({ label: traits[100], posClass: styles['pos-100'] });
        }

        return activeList;
    }, [currentQuestion.id, sliderValue]);

    return (
        <section className={styles.quizSection} id="quiz">
            <div className={styles.container}>
                {view === 'quiz' ? (
                    <div className={styles.progressContainer}>
                        {questions.map((_, index) => (
                            <div
                                key={index}
                                className={`${styles.progressLine} ${index <= currentQuestionIndex ? styles.active : ''}`}
                            />
                        ))}
                    </div>
                ) : (
                    <div className={styles.headerLogo}>
                        <Image
                            src="/bg_web_elements/logo.png"
                            alt="Logo"
                            width={200}
                            height={200}
                            className={styles.headerLogoImage}
                        />
                    </div>
                )}

                {view === 'quiz' && (
                    <>
                        <h2 className={styles.questionTitle}>{currentQuestion.title}</h2>

                        <div
                            className={styles.activeOptionDisplay}
                            style={{ '--glow-color': currentGlowColor } as React.CSSProperties}
                        >
                            <div className={styles.planetVisual}>
                                {allTraits.map((trait, idx) => {
                                    const isVisible = getTraitVisibility(trait.threshold, trait.type);
                                    return (
                                        <div
                                            key={`${trait.label}-${idx}`}
                                            className={`${styles.planetLabel} ${isVisible ? styles.visible : ''} ${trait.posClass}`}
                                        >
                                            {trait.label}
                                        </div>
                                    );
                                })}
                                <div
                                    className={`${styles.planetImageWrapper} ${styles.active}`}
                                    style={{ '--glow-color': currentGlowColor } as React.CSSProperties}
                                >
                                    {!images || isLoading ? (
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(255,255,255,0.5)' }}>
                                            Loading Essence...
                                        </div>
                                    ) : (
                                        <PlanetCanvas
                                            images={images}
                                            sliderValue={sliderValue}
                                            width={500}
                                            height={500}
                                            tintColor={tintInfo.color}
                                            tintOpacity={tintInfo.opacity}
                                        />
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className={styles.overlayContainer}>
                            {showIdleOverlay ? (
                                <div className={styles.idleOverlay}>
                                    <ArrowLeft className={`${styles.arrowIcon} ${styles.arrowLeft}`} />
                                    <span className={styles.idleText}>Drag to start</span>
                                    <ArrowRight className={`${styles.arrowIcon} ${styles.arrowRight}`} />
                                </div>
                            ) : (
                                <div className={styles.feedbackContainer}>
                                    <span key={`${currentQuestion.id}-${sliderValue < 50 ? 'low' : 'high'}`} className={styles.feedbackText}>
                                        {sliderValue < 50
                                            ? feedbackMessages[currentQuestion.id]?.low
                                            : feedbackMessages[currentQuestion.id]?.high}
                                    </span>
                                </div>
                            )}
                        </div>

                        <div className={styles.sliderContainer}>
                            <div className={styles.logoSliderWrapper}>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    step="1"
                                    value={sliderValue}
                                    onChange={handleSliderChange}
                                    className={styles.logoSlider}
                                    style={{
                                        '--glow-color': currentGlowColor,
                                        '--thumb-image': `url('/Logo color.png')`
                                    } as React.CSSProperties}
                                    aria-label="Select your intensity"
                                />
                                <div className={styles.sliderTrackLine} />
                                <div
                                    className={styles.customThumb}
                                    style={{
                                        left: `calc(${sliderValue}% + (${8 - sliderValue * 0.16}px))`
                                    }}
                                >
                                    {sliderValue}%
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={handleNext}
                            className={styles.continueBtn}
                            style={{
                                opacity: hasInteracted ? 1 : 0.5,
                                pointerEvents: hasInteracted ? 'auto' : 'none',
                                filter: hasInteracted ? 'none' : 'grayscale(0.5)'
                            }}
                        >
                            {currentQuestionIndex === questions.length - 1 ? 'Finish' : 'Next Question'}
                        </button>
                    </>
                )}

                {view === 'email' && (
                    <div className={styles.emailForm}>
                        <h2 className={styles.questionTitle}>Save your planet!</h2>
                        <p className={styles.emailSubtext} style={{ whiteSpace: 'pre-line' }}>
                            We’ll let you know{'\n'}when it’s ready!
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
                                Save your planet
                            </button>
                        </form>
                    </div>
                )}

                {view === 'artifact' && (
                    <div className={styles.emailForm} style={{ maxWidth: '800px' }}>
                        <h2 className={styles.questionTitle} style={{ fontSize: '2rem' }}>Save your planet!</h2>
                        <p className={styles.emailSubtext} style={{ whiteSpace: 'pre-line', marginBottom: '0.5rem' }}>
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
                                    const isDigital = artifact.id === 'artifact_1';

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

                                            <h3 className={styles.artifactFormatTitle}>{isDigital ? 'Digital (free)' : artifact.format}</h3>

                                            <button
                                                className={`${styles.wishlistBtn} ${isSaved ? styles.saved : ''}`}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    // Allow toggling even for digital if user wants, or we can enforce keep-saved.
                                                    // User said "already being clicked and say Saved". Keeping toggle logic for flexibility but default is Checked.
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

                                            {isSaved ? (
                                                <div className={styles.priceContainer}>
                                                    <p className={styles.promoText} style={{ color: 'white' }}>
                                                        {isDigital
                                                            ? "We’ll always send you your digital planet + the results of your personality test"
                                                            : "How would you value this handmade product?"
                                                        }
                                                    </p>
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
                                            ) : (
                                                <p className={styles.promoText} style={{ color: 'white', fontSize: '1rem', marginTop: '1rem' }}>
                                                    Save it to your wishlist and get a 20% off when ready!
                                                </p>
                                            )}

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
