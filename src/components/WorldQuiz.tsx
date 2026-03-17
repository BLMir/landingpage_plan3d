'use client';

import Image from 'next/image';
import { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import styles from './WorldQuiz.module.css';
import { Planet3D, Planet3DHandle } from './Planet3D';
import { useProgress } from '@react-three/drei';
import { ArrowLeft, ArrowRight, Download, Mail } from './Icons';
import * as THREE from 'three';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { getAssetPath } from '@/utils/paths';
import personalityData from '@/data/personality_data.json';
import personalityLanding from '@/data/personality_landing.json';

type QuestionFeedback = {
    low: string;
    high: string;
};

const feedbackMessages: Record<string, QuestionFeedback> = {
    'Agreeableness': { low: "I prioritize my own needs", high: "I genuinely enjoy helping others" },
    'Extraversion': { low: "I prefer quiet, solitary time", high: "I'm the life of the party" },
    'Conscientiousness': { low: "I'm more relaxed and spontaneous", high: "I'm highly organized and planned" },
    'Neuroticism': { low: "I stay calm under pressure", high: "I'm sensitive to stress and changes" },
    'Openness': { low: "I prefer familiar routines", high: "I love exploring new ideas and hobbies" },
};

type GlowColors = {
    low: string;
    high: string;
};

const elementColors: Record<string, GlowColors> = {
    'Q1': { low: '#FF4444', high: '#3B82F6' }, // Redish -> Blue
    'Q2': { low: '#B45309', high: '#16A34A' }, // Ocre -> Green
    'Q3': { low: '#A855F7', high: '#FACC15' }, // Purple -> Yellow
    'Q4': { low: '#3B82F6', high: '#22D3EE' }, // Blue -> Cyan
    'Q5': { low: '#FDE047', high: '#FFFFFF' }, // Yellow -> White
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

const elementOptions = [
    { id: 'Q1', title: 'Volcanos & Oceans', icon: '/1_Quiz Planet Images/VolcanOcean.png', low: '/1_Quiz Planet Images/each_element/volcanos.png', high: '/1_Quiz Planet Images/each_element/oceans.png', folder: '1_How empathetic are you_', lowPrefix: '1_low', highPrefix: '1_high' },
    { id: 'Q2', title: 'Deserts & Forests', icon: '/1_Quiz Planet Images/desertForest.png', low: '/1_Quiz Planet Images/each_element/desert.png', high: '/1_Quiz Planet Images/each_element/forest.png', folder: '2_How sociable are you_', lowPrefix: '2_low', highPrefix: '2_high' },
    { id: 'Q3', title: 'Rings of Asteroids', icon: '/1_Quiz Planet Images/Rings.png', low: '/1_Quiz Planet Images/each_element/empty.png', high: '/1_Quiz Planet Images/each_element/rings.png', folder: '3_How persistent are you_', lowPrefix: '3_low', highPrefix: '3_high' },
    { id: 'Q4', title: 'Fall stars & Comets', icon: '/1_Quiz Planet Images/Comets.png', low: '/1_Quiz Planet Images/each_element/comets_low.png', high: '/1_Quiz Planet Images/each_element/comets_high.png', folder: '4_How curious are you_', lowPrefix: '4_low', highPrefix: '4_high' },
    { id: 'Q5', title: 'Storms & Clear sky', icon: '/1_Quiz Planet Images/Clouds.png', low: '/1_Quiz Planet Images/each_element/clouds_low.png', high: '/1_Quiz Planet Images/each_element/clouds_high.png', folder: '5_How relaxed are you_', lowPrefix: '5_low', highPrefix: '5_high' },
];

const traitsToAssign = ['Agreeableness', 'Extraversion', 'Conscientiousness', 'Openness'];

const artifactOptions = [
    { id: 'artifact_1', label: 'Digital', format: 'Digital', image: getAssetPath('/artifact/Format_1.png'), priceTiers: [0], subtitle: '' },
    { id: 'artifact_3', label: 'Lamp', format: 'Lamp', image: getAssetPath('/artifact/Format_3.png'), priceTiers: [45, 65, 95], subtitle: '' },
    { id: 'artifact_4', label: 'Necklace', format: 'Necklace', image: getAssetPath('/artifact/Format_4.png'), priceTiers: [24, 39, 55], subtitle: '' },
    { id: 'artifact_6', label: 'Bracelet', format: 'Bracelet', image: getAssetPath('/artifact/Format_6.png'), priceTiers: [15, 25, 35], subtitle: '' },
];


export default function WorldQuiz() {
    const [view, setView] = useState<'traitSelection' | 'traitSummary' | 'quiz' | 'email' | 'artifact' | 'success'>('quiz');
    const [isQuizReady, setIsQuizReady] = useState(false);
    const [showInitialLoader, setShowInitialLoader] = useState(false);
    const [loaderProgress, setLoaderProgress] = useState(0);

    // Trait Selection State
    const [assignmentStep, setAssignmentStep] = useState(0);
    const [assignments, setAssignments] = useState<Record<string, string>>({
        'Agreeableness': 'Q1',
        'Extraversion': 'Q2',
        'Conscientiousness': 'Q3',
        'Openness': 'Q4',
        'Neuroticism': 'Q5'
    }); // Trait -> ElementID
    const [tempSelection, setTempSelection] = useState<string | null>('Q1');

    // Quiz State
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [sliderValue, setSliderValue] = useState(50);
    const [allAnswers, setAllAnswers] = useState<Record<string, number>>({}); 

    // UI State
    const [showIdleOverlay, setShowIdleOverlay] = useState(false); // Commented out/disabled for now
    const [hasInteracted, setHasInteracted] = useState(false);
    const idleTimerRef = useMemo(() => ({ current: null as NodeJS.Timeout | null }), []);
    const [email, setEmail] = useState('');
    const [userName, setUserName] = useState('');
    const [userAge, setUserAge] = useState('');
    const [isQuestionTransitioning, setIsQuestionTransitioning] = useState(false);

    // Instruction Text State (Fading)
    const [showSelectionInstruction, setShowSelectionInstruction] = useState(true);
    const instructionTimerRef = useRef<NodeJS.Timeout | null>(null);

    const resetInstructionTimer = () => {
        setShowSelectionInstruction(false);
        if (instructionTimerRef.current) clearTimeout(instructionTimerRef.current);
        instructionTimerRef.current = setTimeout(() => {
            setShowSelectionInstruction(true);
        }, 4000); // 4 seconds of inactivity to show again
    };
    const [selectedArtifact, setSelectedArtifact] = useState<string | null>(artifactOptions[0].id);
    const [submitting, setSubmitting] = useState(false);
    const planet3DRef = useRef<Planet3DHandle>(null);
    const [carouselIndex, setCarouselIndex] = useState(0);
    const [isTitleFading, setIsTitleFading] = useState(false);
    const [selectedPrices, setSelectedPrices] = useState<Record<string, number>>(
        Object.fromEntries(artifactOptions.map(opt => [opt.id, opt.priceTiers[0]]))
    );
    const [wishlisted, setWishlisted] = useState<Set<string>>(new Set(['artifact_1']));
    const [elementValues, setElementValues] = useState<Record<string, number>>({
        'Q1': 50, 'Q2': 50, 'Q3': 50, 'Q4': 50, 'Q5': 50
    });
    const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
    const [orderedTraits, setOrderedTraits] = useState<string[]>([
        'Agreeableness',
        'Extraversion',
        'Conscientiousness',
        'Openness',
        'Neuroticism'
    ]);
    const [planetLoading, setPlanetLoading] = useState(false);
    const [planetProgress, setPlanetProgress] = useState(0);

    // Assignment Logic
    const currentTrait = traitsToAssign[assignmentStep];
    const isElementAssigned = (elementId: string) => false;

    const handleElementSelect = (elementId: string) => {
        if (isElementAssigned(elementId)) return;
        setTempSelection(elementId); // Always select, never unselect
        resetInstructionTimer();
    };

    const handleTraitNext = () => {
        if (!tempSelection) return;

        resetInstructionTimer();
        const newAssignments = { ...assignments, [currentTrait]: tempSelection };
        setAssignments(newAssignments);

        // Auto-select next element for the next step
        const nextStep = assignmentStep + 1;
        if (nextStep < traitsToAssign.length) {
            setTempSelection(`Q${nextStep + 1}`);
        } else {
            setTempSelection(null);
        }

        if (assignmentStep < traitsToAssign.length - 1) {
            setAssignmentStep(assignmentStep + 1);
        } else {
            // Find the last element and assign it to Neuroticism
            // Filter newAssignments to only include the 4 primary traits currently being assigned
            const primaryAssignedElements = Object.entries(newAssignments)
                .filter(([trait]) => traitsToAssign.includes(trait))
                .map(([_, elementId]) => elementId);

            const remainingElement = elementOptions.find(opt => !primaryAssignedElements.includes(opt.id))!;
            const finalAssignments = { ...newAssignments, 'Neuroticism': remainingElement.id };
            setAssignments(finalAssignments);

            // Initialize orderedTraits based on element order Q1, Q2, Q3, Q4, Q5
            const traitOrder = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5'].map(id => {
                const match = Object.entries(finalAssignments).find(([_, eid]) => eid === id);
                return match ? match[0] : 'Neuroticism'; // Fallback to Neuroticism if not found (shouldn't happen with correct remainingElement logic)
            });
            setOrderedTraits(traitOrder);
            setView('traitSummary');
        }
    };

    const handleTraitBack = () => {
        if (assignmentStep > 0) {
            resetInstructionTimer();
            const prevTrait = traitsToAssign[assignmentStep - 1];
            const prevElement = assignments[prevTrait];

            // Remove the assignment of the previous trait
            const newAssignments = { ...assignments };
            delete newAssignments[prevTrait];
            setAssignments(newAssignments);

            setAssignmentStep(assignmentStep - 1);
            setTempSelection(prevElement); // Highlight the one they had selected
        }
    };

    const handleDecideForMe = () => {
        resetInstructionTimer();
        const autoAssignments = {
            'Agreeableness': 'Q1',
            'Extraversion': 'Q2',
            'Conscientiousness': 'Q3',
            'Openness': 'Q4',
            'Neuroticism': 'Q5'
        };
        setAssignments(autoAssignments);
        setTempSelection(null);

        // Map Q1-Q5 to traits using the same pattern as handleTraitNext
        const traitOrder = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5'].map(id =>
            Object.entries(autoAssignments).find(([_, eid]) => eid === id)![0]
        );
        setOrderedTraits(traitOrder);
        setView('traitSummary');
    };

    // Quiz Generation based on assignments
    const quizQuestions = useMemo(() => personalityLanding, []);

    const getDescriptorText = (questionIndex: number, value: number) => {
        return null; // Simplified for landing flow
    };

    const currentQuestion = quizQuestions[currentQuestionIndex];

    // Inactivity Instruction Logic
    useEffect(() => {
        if (view === 'quiz') {
            const timer = setTimeout(() => setIsQuizReady(true), 2000);
            return () => clearTimeout(timer);
        } else {
            setIsQuizReady(false);
        }
    }, [view]);

    // Auto-start planet loader when quiz view is active
    useEffect(() => {
        if (view === 'quiz' && !planetLoading && planetProgress === 0) {
            setPlanetLoading(true);
            setPlanetProgress(0);
            const startTime = Date.now();
            const duration = 7000;

            const interval = setInterval(() => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(100, Math.floor((elapsed / duration) * 100));
                setPlanetProgress(progress);

                if (elapsed >= duration) {
                    clearInterval(interval);
                    setPlanetLoading(false);
                }
            }, 16);
        }
    }, [view, planetLoading, planetProgress]);

    useEffect(() => {
        const resetTimer = () => {
            if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
            idleTimerRef.current = setTimeout(() => {
                setShowIdleOverlay(true);
            }, 8000); // 8 seconds
        };

        if (view === 'quiz' && !hasInteracted) {
            setShowIdleOverlay(true);
        }

        resetTimer();
        return () => {
            if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        };
    }, [sliderValue, currentQuestionIndex, idleTimerRef, view, hasInteracted]);

    const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = Number(e.target.value);
        updateSliderAndPlanet(value);
    };

    const updateSliderAndPlanet = (value: number) => {
        setSliderValue(value);
        setHasInteracted(true);
        setShowIdleOverlay(false);
        if (currentQuestion) {
            setElementValues(prev => ({
                ...prev,
                [currentQuestion.elementId]: value
            }));
        }
    };

    const handleBackQuestion = () => {
        if (currentQuestionIndex === 0) return;
        setIsQuestionTransitioning(true);
        setTimeout(() => {
            setCurrentQuestionIndex(prev => prev - 1);
            setSliderValue(50);
            setIsQuestionTransitioning(false);
        }, 800);
    };

    const handleNextQuestion = () => {
        setIsQuestionTransitioning(true);
        setAllAnswers({ ...allAnswers, [currentQuestion.id]: sliderValue });

        setTimeout(() => {
            if (currentQuestionIndex < quizQuestions.length - 1) {
                const nextIndex = currentQuestionIndex + 1;
                setCurrentQuestionIndex(nextIndex);
                setSliderValue(50);
                setShowIdleOverlay(false);
            } else {
                setView('artifact');
            }
            setIsQuestionTransitioning(false);
        }, 800);
    };

    const handleDownloadSTL = async (exportMode: 'standard' | 'hole' | 'ring' | 'ring_hole' | 'four_holes' | 'flat' = 'standard') => {
        // ... (Download Logic preserved as in Head)
    };

    const handleEmailSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setView('artifact');
    };

    const handleSubmit = async () => {
        if (submitting) return;
        setSubmitting(true);
        try {
            const answersArray = quizQuestions.map(q => ({
                questionId: q.id,
                statement: q.statement,
                score: allAnswers[q.id] || 50
            }));

            const payload = {
                userName,
                userAge,
                email,
                assignments,
                selectedFormat: selectedArtifact,
                estimatedPrice: selectedPrices[selectedArtifact || 'artifact_1'],
                isWishlisted: wishlisted.has(selectedArtifact || 'artifact_1'),
                quizResults: answersArray,
                timestamp: new Date().toISOString()
            };

            const response = await fetch('/api/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (response.ok) {
                setView('success');
            }
        } catch (error) {
            console.error('Error submitting form:', error);
        } finally {
            setSubmitting(false);
        }
    };

    const prevArtifact = () => {
        setCarouselIndex(prev => (prev - 1 + artifactOptions.length) % artifactOptions.length);
        setSelectedArtifact(artifactOptions[(carouselIndex - 1 + artifactOptions.length) % artifactOptions.length].id);
    };

    const nextArtifact = () => {
        setCarouselIndex(prev => (prev + 1) % artifactOptions.length);
        setSelectedArtifact(artifactOptions[(carouselIndex + 1) % artifactOptions.length].id);
    };

    const currentGlowColor = useMemo(() => {
        if (!currentQuestion) return '#3B82F6';
        const colors = elementColors[currentQuestion.elementId];
        return interpolateColor(colors.low, colors.high, sliderValue / 100);
    }, [currentQuestion, sliderValue]);

    const tintInfo = useMemo(() => {
        if (!currentQuestion) return { color: 'transparent', opacity: 0 };
        const colors = elementColors[currentQuestion.elementId];
        const delta = Math.abs(sliderValue - 50);
        let opacity = 0;
        if (delta > 5) opacity = (delta / 25) * 0.3;
        const isLow = sliderValue < 50;
        return {
            color: isLow ? colors.low : colors.high,
            opacity: Math.min(0.6, opacity)
        };
    }, [currentQuestion, sliderValue]);


    return (
        <section id="quiz" className={styles.quizSection}>
            <div className={styles.nebula} />
            
            <div className={styles.quizLayout}>
                {view === 'quiz' && (
                    <>
                        <div className={`${styles.topQuizLayer} ${isQuizReady ? styles.quizFadeIn : ''}`}>
                            <div className={`${styles.progressContainer} ${isQuestionTransitioning ? styles.transitioning : ''}`}>
                                {quizQuestions.map((_, index) => (
                                    <div
                                        key={index}
                                        className={`${styles.progressLine} ${index <= currentQuestionIndex ? styles.active : ''}`}
                                    />
                                ))}
                            </div>
                            <h2
                                className={`${styles.questionTitle} ${isQuestionTransitioning ? styles.fadeOut : styles.fadeIn}`}
                            >
                                {currentQuestion.statement}
                            </h2>
                        </div>

                        <div className={styles.centerQuizLayer}>
                            <div
                                className={`${styles.globalPlanetContainer} ${styles.globalPlanetVisible}`}
                                style={{ '--glow-color': currentGlowColor } as React.CSSProperties}
                            >
                                <div className={styles.planetVisual}>
                                    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                                        <Suspense fallback={<div className={styles.planetLoaderPlaceholder}>Establishing Connection...</div>}>
                                            <Planet3D
                                                ref={planet3DRef}
                                                values={elementOptions.map(opt => elementValues[opt.id])}
                                                currentSection={currentQuestion ? elementOptions.findIndex(e => e.id === currentQuestion.elementId) : -1}
                                                tintColor={tintInfo.color}
                                                tintOpacity={tintInfo.opacity}
                                            />
                                        </Suspense>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className={`${styles.bottomQuizLayer} ${isQuizReady ? styles.quizFadeIn : ''}`}>
                            <div className={`${styles.unifiedTextContainer} ${isQuestionTransitioning ? styles.fadeOut : styles.fadeIn}`}>
                                <div className={`${styles.instructionOverlay} ${(showIdleOverlay && isQuizReady) ? styles.active : styles.hidden}`}>
                                    <div>Move with the slider</div>
                                    <div><ArrowLeft className={`${styles.instructionIcon} ${styles.instructionIconLeft}`} /> how little or how much <ArrowRight className={`${styles.instructionIcon} ${styles.instructionIconRight}`} /></div>
                                    <div>the sentence represents you.</div>
                                </div>
                            </div>

                            <div className={`${styles.sliderContainerVisible} ${isQuestionTransitioning ? styles.fadeOut : styles.fadeIn}`}>
                                <div className={styles.logoSliderWrapper} style={{ '--slider-value': sliderValue } as React.CSSProperties}>
                                    <div className={styles.sliderPercentage}>{sliderValue}%</div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        step="1"
                                        value={sliderValue}
                                        onChange={handleSliderChange}
                                        className={styles.logoSliderInteractable}
                                        style={{
                                            '--glow-color': currentGlowColor,
                                            '--thumb-image': `url('${getAssetPath('/Logo color.png')}')`
                                        } as React.CSSProperties}
                                    />
                                    <div className={styles.sliderTrackLine} />
                                </div>
                            </div>

                            <div className={styles.quizNavigationButtons}>
                                <button
                                    className={`${styles.navControlBtn} ${currentQuestionIndex === 0 ? styles.unclickable : ''} ${isQuestionTransitioning ? styles.transitioning : ''}`}
                                    onClick={() => !isQuestionTransitioning && handleBackQuestion()}
                                    disabled={currentQuestionIndex === 0 || isQuestionTransitioning}
                                >
                                    <ArrowLeft /> Back
                                </button>
                                <button
                                    className={`${styles.navControlBtn} ${styles.primary} ${isQuestionTransitioning ? styles.transitioning : ''}`}
                                    onClick={() => !isQuestionTransitioning && handleNextQuestion()}
                                    disabled={isQuestionTransitioning}
                                >
                                    {currentQuestionIndex === quizQuestions.length - 1 ? 'Finish' : 'Next question'} <ArrowRight />
                                </button>
                            </div>
                        </div>
                    </>
                )}

                {view === 'email' && (
                    <div className={styles.emailForm}>
                        <div className={styles.emailHeader}>
                            <h2 className={styles.questionTitle}>We’ll let you know when it’s ready!</h2>
                        </div>
                        <div className={styles.emailBottom}>
                            <form onSubmit={handleEmailSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
                                <input type="text" required placeholder="Your Name" value={userName} onChange={(e) => setUserName(e.target.value)} className={styles.emailInput} />
                                <input type="number" required placeholder="Age" value={userAge} onChange={(e) => setUserAge(e.target.value)} className={styles.emailInput} />
                                <input type="email" required placeholder="enter@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className={styles.emailInput} />
                                <button type="submit" className={styles.continueBtn}>Save your planet</button>
                            </form>
                        </div>
                    </div>
                )}
                                {view === 'artifact' && (
                    <div className={styles.artifactSection}>
                        <h2 className={styles.artifactTitle}>How would you like your planet?</h2>
                        <p className={styles.artifactSubtitle}>
                            Get a 10% off when we launch!
                        </p>

                        <div className={styles.artifactGrid}>
                            {artifactOptions.slice(0, 4).map((artifact, idx) => {
                                const isSaved = wishlisted.has(artifact.id);
                                const isDigital = artifact.id === 'artifact_1';
                                
                                // Map artifact to material override
                                let matOverride: 'lamp' | 'silver' | 'darkWood' | undefined = undefined;
                                if (artifact.label.toLowerCase().includes('lamp')) matOverride = 'lamp';
                                if (artifact.label.toLowerCase().includes('necklace')) matOverride = 'silver';
                                if (artifact.label.toLowerCase().includes('bracelet')) matOverride = 'darkWood';

                                // Map artifact to background image
                                let bgImage = '';
                                if (isDigital) bgImage = '/bg_web_elements/bg_free.png';
                                else if (artifact.label.toLowerCase().includes('lamp')) bgImage = '/bg_web_elements/bg_lamp.png';
                                else if (artifact.label.toLowerCase().includes('necklace')) bgImage = '/bg_web_elements/bg_necklace.png';
                                else if (artifact.label.toLowerCase().includes('bracelet')) bgImage = '/bg_web_elements/bg_bracelet.png';

                                return (
                                    <div key={artifact.id} className={styles.artifactCard}>
                                        <Image 
                                            src={getAssetPath(bgImage)} 
                                            alt="" 
                                            fill 
                                            className={styles.artifactCardBg}
                                            priority={idx < 4}
                                        />
                                        
                                        <div className={styles.artifactCanvasWrapper}>
                                            <Suspense fallback={null}>
                                                <Planet3D
                                                    values={elementOptions.map(opt => elementValues[opt.id])}
                                                    currentSection={4} // Show all elements (rings, comets, clouds)
                                                    materialOverride={matOverride}
                                                    tintColor={tintInfo.color}
                                                    isStatic={true}
                                                />
                                            </Suspense>
                                        </div>

                                        <div className={styles.artifactInfo}>
                                            <h3 className={styles.artifactName}>{artifact.label}</h3>
                                            <button
                                                className={`${styles.artifactButton} ${isSaved || isDigital ? styles.wishlisted : ''} ${isDigital ? styles.disabled : ''}`}
                                                onClick={() => {
                                                    if (isDigital) return;
                                                    setWishlisted(prev => {
                                                        const next = new Set(prev);
                                                        if (next.has(artifact.id)) next.delete(artifact.id);
                                                        else next.add(artifact.id);
                                                        return next;
                                                    });
                                                }}
                                            >
                                                {isDigital ? 'Free' : (isSaved ? 'Saved!' : 'Wishlist')}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <button onClick={handleSubmit} className={styles.continueBtn} disabled={submitting}>
                            {submitting ? 'Transmitting...' : 'Receive Transmission'}
                        </button>
                    </div>
                )}

                {view === 'success' && (
                    <div className={styles.successMessage}>
                        <span className={styles.successIcon}>✨</span>
                        <h2 className={styles.questionTitle}>Transmission Received</h2>
                        <p className={styles.optionDesc}>Check your inbox to continue your journey.</p>
                    </div>
                )}
            </div>
        </section >
    );
}
