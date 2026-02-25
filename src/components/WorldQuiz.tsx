'use client';

import Image from 'next/image';
import { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import styles from './WorldQuiz.module.css';
import { Planet3D, Planet3DHandle } from './Planet3D';
import { useProgress } from '@react-three/drei';
import { ArrowLeft, ArrowRight, Download, Mail } from './Icons';
import * as THREE from 'three';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { getAssetPath } from '@/utils/paths';
import personalityData from '@/data/personality_data.json';

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
    { id: 'artifact_1', label: 'Digital - for free!', format: 'Digital', image: getAssetPath('/artifact/Format_1.png'), priceTiers: [0], subtitle: 'In which format would you like your planet?' },
    { id: 'artifact_2', label: 'Poster', format: 'Poster', image: getAssetPath('/artifact/Format_2.png'), priceTiers: [12, 22, 35], subtitle: 'Get a 20% off!' },
    { id: 'artifact_3', label: 'Lamp', format: 'Lamp', image: getAssetPath('/artifact/Format_3.png'), priceTiers: [45, 65, 95], subtitle: 'Get a 20% off!' },
    { id: 'artifact_4', label: 'Necklace', format: 'Necklace', image: getAssetPath('/artifact/Format_4.png'), priceTiers: [24, 39, 55], subtitle: 'Get a 20% off!' },
    { id: 'artifact_5', label: 'Earrings', format: 'Earrings', image: getAssetPath('/artifact/Format_5.png'), priceTiers: [18, 29, 42], subtitle: 'Get a 20% off!' },
    { id: 'artifact_6', label: 'Bracelet', format: 'Bracelet', image: getAssetPath('/artifact/Format_6.png'), priceTiers: [15, 25, 35], subtitle: 'Get a 20% off!' },
];


export default function WorldQuiz() {
    const [view, setView] = useState<'traitSelection' | 'traitSummary' | 'quiz' | 'email' | 'artifact' | 'success'>('traitSummary');
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
    const [allAnswers, setAllAnswers] = useState<Record<string, number>>({}); // Statement ID -> Score (0-100)

    // UI State
    const [showIdleOverlay, setShowIdleOverlay] = useState(false); // Commented out/disabled for now
    const [hasInteracted, setHasInteracted] = useState(false);
    const idleTimerRef = useMemo(() => ({ current: null as NodeJS.Timeout | null }), []);
    const [email, setEmail] = useState('');
    const [userName, setUserName] = useState('');
    const [userAge, setUserAge] = useState('');

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
    const isElementAssigned = (elementId: string) => Object.values(assignments).includes(elementId);

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
    const quizQuestions = useMemo(() => {
        const grouped = personalityData.reduce((acc, curr) => {
            if (!acc[curr.trait]) acc[curr.trait] = [];
            acc[curr.trait].push(curr);
            return acc;
        }, {} as Record<string, typeof personalityData>);

        const questions: any[] = [];
        // Sequence: All 5 for Q1 element's trait, then All 5 for Q2, etc.
        const elementOrder = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5'];

        elementOrder.forEach(elementId => {
            const trait = Object.entries(assignments).find(([_, eid]) => eid === elementId)?.[0];
            if (trait && grouped[trait]) {
                // Take only the first 3 statements for each trait
                const statements = grouped[trait].slice(0, 3);
                const element = elementOptions.find(opt => opt.id === elementId)!;
                statements.forEach(statement => {
                    questions.push({
                        ...statement,
                        element,
                        trait
                    });
                });
            }
        });
        return questions;
    }, [assignments, view]);

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

    useEffect(() => {
        const resetTimer = () => {
            if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
            idleTimerRef.current = setTimeout(() => {
                setShowIdleOverlay(true);
            }, 8000); // 8 seconds
        };

        // Show immediately at the beginning of the Quiz or after reset
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
                [currentQuestion.element.id]: value
            }));
        }
    };

    const animateSliderTo = (target: number) => {
        const start = sliderValue;
        const duration = 400;
        const startTime = performance.now();

        const animate = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // Ease out cubic
            const ease = 1 - Math.pow(1 - progress, 3);
            const current = start + (target - start) * ease;

            updateSliderAndPlanet(Math.round(current));

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        requestAnimationFrame(animate);
    };

    const handleQuizButtonClick = (type: 'minusminus' | 'minus' | 'middle' | 'plus' | 'plusplus') => {
        if (!currentQuestion) return;

        const isStandard = currentQuestion.direction === 'Standard (+)';
        let newValue = sliderValue;

        switch (type) {
            case 'minusminus':
                newValue = isStandard ? Math.max(0, sliderValue - 25) : Math.min(100, sliderValue + 25);
                break;
            case 'minus':
                newValue = isStandard ? Math.max(0, sliderValue - 15) : Math.min(100, sliderValue + 15);
                break;
            case 'middle':
                {
                    const s = sliderValue;
                    const wobbleShift = isStandard ? -1 : 1;
                    updateSliderAndPlanet(Math.max(0, Math.min(100, s + wobbleShift)));
                    setTimeout(() => updateSliderAndPlanet(s), 100);
                    newValue = s; // Stay at current position
                }
                break;
            case 'plus':
                newValue = isStandard ? Math.min(100, sliderValue + 15) : Math.max(0, sliderValue - 15);
                break;
            case 'plusplus':
                newValue = isStandard ? Math.min(100, sliderValue + 25) : Math.max(0, sliderValue - 25);
                break;
        }

        animateSliderTo(newValue);
        // Automatically advance after animation duration (400ms) + small buffer
        setTimeout(() => {
            handleNextQuestion();
        }, 600);
    };

    const handleDownloadSTL = () => {
        const scene = planet3DRef.current?.getScene();
        if (!scene) return;

        // Force root matrix update to ensure correct Scales/Positions
        scene.updateMatrixWorld(true);

        // --- Simplex Noise Port (GLSL -> JS) ---
        const mod289_vec3 = (v: THREE.Vector3) => {
            return new THREE.Vector3(
                v.x - Math.floor(v.x * (1.0 / 289.0)) * 289.0,
                v.y - Math.floor(v.y * (1.0 / 289.0)) * 289.0,
                v.z - Math.floor(v.z * (1.0 / 289.0)) * 289.0
            );
        };
        const mod289_vec4 = (x: number, y: number, z: number, w: number) => {
            const m = (val: number) => val - Math.floor(val * (1.0 / 289.0)) * 289.0;
            return [m(x), m(y), m(z), m(w)];
        };
        const permute_vec4 = (x: number, y: number, z: number, w: number) => {
            const m = (val: number) => ((val * 34.0) + 1.0) * val;
            const res = mod289_vec4(m(x), m(y), m(z), m(w));
            return res;
        };
        const taylorInvSqrt_vec4 = (x: number, y: number, z: number, w: number) => {
            const s = (val: number) => 1.79284291400159 - 0.85373472095314 * val;
            return [s(x), s(y), s(z), s(w)];
        };

        const snoise = (v: THREE.Vector3) => {
            const C = { x: 1.0 / 6.0, y: 1.0 / 3.0 };
            const D = { x: 0.0, y: 0.5, z: 1.0, w: 2.0 };

            // First corner
            const dot_v_Cyyy = v.x * C.y + v.y * C.y + v.z * C.y;
            const i = new THREE.Vector3(
                Math.floor(v.x + dot_v_Cyyy),
                Math.floor(v.y + dot_v_Cyyy),
                Math.floor(v.z + dot_v_Cyyy)
            );
            const dot_i_Cxxx = i.x * C.x + i.y * C.x + i.z * C.x;
            const x0 = new THREE.Vector3(v.x - i.x + dot_i_Cxxx, v.y - i.y + dot_i_Cxxx, v.z - i.z + dot_i_Cxxx);

            // Other corners
            const g = new THREE.Vector3(
                x0.y <= x0.x ? 1 : 0,
                x0.z <= x0.y ? 1 : 0,
                x0.x <= x0.z ? 1 : 0
            );
            const l = new THREE.Vector3(1 - g.x, 1 - g.y, 1 - g.z);
            const i1 = new THREE.Vector3(Math.min(g.x, l.z), Math.min(g.y, l.x), Math.min(g.z, l.y));
            const i2 = new THREE.Vector3(Math.max(g.x, l.z), Math.max(g.y, l.x), Math.max(g.z, l.y));

            const x1 = new THREE.Vector3(x0.x - i1.x + C.x, x0.y - i1.y + C.x, x0.z - i1.z + C.x);
            const x2 = new THREE.Vector3(x0.x - i2.x + C.y, x0.y - i2.y + C.y, x0.z - i2.z + C.y);
            const x3 = new THREE.Vector3(x0.x - D.y, x0.y - D.y, x0.z - D.y);

            // Permutations
            const i_mod = mod289_vec3(i);
            const p_z = [i_mod.z, i_mod.z + i1.z, i_mod.z + i2.z, i_mod.z + 1.0];
            const p_y = [i_mod.y, i_mod.y + i1.y, i_mod.y + i2.y, i_mod.y + 1.0];
            const p_x = [i_mod.x, i_mod.x + i1.x, i_mod.x + i2.x, i_mod.x + 1.0];

            let p = permute_vec4(p_z[0], p_z[1], p_z[2], p_z[3]);
            p = permute_vec4(p[0] + p_y[0], p[1] + p_y[1], p[2] + p_y[2], p[3] + p_y[3]);
            p = permute_vec4(p[0] + p_x[0], p[1] + p_x[1], p[2] + p_x[2], p[3] + p_x[3]);

            const ns = [0.142857142857 * 2.0 - 0.0, 0.142857142857 * 0.5 - 0.0, 0.142857142857 * 1.0 - 0.0];
            const j = [
                p[0] - 49.0 * Math.floor(p[0] * ns[2] * ns[2]),
                p[1] - 49.0 * Math.floor(p[1] * ns[2] * ns[2]),
                p[2] - 49.0 * Math.floor(p[2] * ns[2] * ns[2]),
                p[3] - 49.0 * Math.floor(p[3] * ns[2] * ns[2]),
            ];

            const x_ = [Math.floor(j[0] * ns[2]), Math.floor(j[1] * ns[2]), Math.floor(j[2] * ns[2]), Math.floor(j[3] * ns[2])];
            const y_ = [Math.floor(j[0] - 7.0 * x_[0]), Math.floor(j[1] - 7.0 * x_[1]), Math.floor(j[2] - 7.0 * x_[2]), Math.floor(j[3] - 7.0 * x_[3])];

            const x = [x_[0] * ns[0] + (-1.0), x_[1] * ns[0] + (-1.0), x_[2] * ns[0] + (-1.0), x_[3] * ns[0] + (-1.0)];
            const y = [y_[0] * ns[0] + (-1.0), y_[1] * ns[0] + (-1.0), y_[2] * ns[0] + (-1.0), y_[3] * ns[0] + (-1.0)];
            const h = [1.0 - Math.abs(x[0]) - Math.abs(y[0]), 1.0 - Math.abs(x[1]) - Math.abs(y[1]), 1.0 - Math.abs(x[2]) - Math.abs(y[2]), 1.0 - Math.abs(x[3]) - Math.abs(y[3])];

            const b0 = [x[0], x[1], y[0], y[1]];
            const b1 = [x[2], x[3], y[2], y[3]];

            const s0 = [Math.floor(b0[0]) * 2.0 + 1.0, Math.floor(b0[1]) * 2.0 + 1.0, Math.floor(b0[2]) * 2.0 + 1.0, Math.floor(b0[3]) * 2.0 + 1.0];
            const s1 = [Math.floor(b1[0]) * 2.0 + 1.0, Math.floor(b1[1]) * 2.0 + 1.0, Math.floor(b1[2]) * 2.0 + 1.0, Math.floor(b1[3]) * 2.0 + 1.0];

            const sh = [h[0] < 0.0 ? -1.0 : 0.0, h[1] < 0.0 ? -1.0 : 0.0, h[2] < 0.0 ? -1.0 : 0.0, h[3] < 0.0 ? -1.0 : 0.0];

            const a0 = [b0[0] + s0[0] * sh[0], b0[2] + s0[2] * sh[0], b0[1] + s0[1] * sh[1], b0[3] + s0[3] * sh[1]];
            const a1 = [b1[0] + s1[0] * sh[2], b1[2] + s1[2] * sh[2], b1[1] + s1[1] * sh[3], b1[3] + s1[3] * sh[3]];

            const p0 = new THREE.Vector3(a0[0], a0[1], h[0]);
            const p1 = new THREE.Vector3(a0[2], a0[3], h[1]);
            const p2 = new THREE.Vector3(a1[0], a1[1], h[2]);
            const p3 = new THREE.Vector3(a1[2], a1[3], h[3]);

            const norm = taylorInvSqrt_vec4(p0.dot(p0), p1.dot(p1), p2.dot(p2), p3.dot(p3));
            p0.multiplyScalar(norm[0]);
            p1.multiplyScalar(norm[1]);
            p2.multiplyScalar(norm[2]);
            p3.multiplyScalar(norm[3]);

            const m = [
                Math.max(0.6 - x0.dot(x0), 0.0),
                Math.max(0.6 - x1.dot(x1), 0.0),
                Math.max(0.6 - x2.dot(x2), 0.0),
                Math.max(0.6 - x3.dot(x3), 0.0)
            ];
            const m2 = [m[0] * m[0], m[1] * m[1], m[2] * m[2], m[3] * m[3]];
            const m4 = [m2[0] * m2[0], m2[1] * m2[1], m2[2] * m2[2], m2[3] * m2[3]];

            const res = 42.0 * (m4[0] * p0.dot(x0) + m4[1] * p1.dot(x1) + m4[2] * p2.dot(x2) + m4[3] * p3.dot(x3));
            return res;
        };

        const getGrowthAlpha = (pos: THREE.Vector3, seedPoint: THREE.Vector3, intensity: number) => {
            if (intensity <= 0.001) return 0.0;
            if (intensity >= 1.0) return 1.0;
            const posNorm = pos.clone().normalize();
            const seedNorm = seedPoint.clone().normalize();
            const align = posNorm.dot(seedNorm);
            const grad = align * 0.5 + 0.5;

            // Match shader: float n = snoise(posNorm * 3.5) * 0.5 + 0.5;
            const n = snoise(posNorm.clone().multiplyScalar(3.5)) * 0.5 + 0.5;
            const growthMap = grad * 0.85 + n * 0.15; // mix(grad, n, 0.15)

            const threshold = 1.05 - (intensity * 1.10);
            const edge0 = threshold;
            const edge1 = threshold + 0.15;
            const x = Math.max(0, Math.min(1, (growthMap - edge0) / (edge1 - edge0)));
            return x * x * (3 - 2 * x); // smoothstep
        };

        const bakeMesh = (mesh: THREE.Mesh): THREE.BufferGeometry | null => {
            if (!mesh.geometry || !mesh.visible) return null;

            const isPlanet = mesh.name === 'planet_base_mesh';

            // Expand indexed geometry to non-indexed for stability
            const rawGeo = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
            const geometry = new THREE.BufferGeometry();

            // Only use position attribute for merging
            const posAttr = rawGeo.attributes.position.clone();
            geometry.setAttribute('position', posAttr);

            // 1. Bake Morph Targets 
            if (mesh.morphTargetInfluences && rawGeo.morphAttributes?.position) {
                const morphTargets = rawGeo.morphAttributes.position as THREE.BufferAttribute[];
                const tempPos = new THREE.Vector3();
                const morphPos = new THREE.Vector3();

                // Multi-tone Alpha Calculation for Planet
                const s1 = (elementValues['Q1'] ?? 50) / 100;
                const s2 = (elementValues['Q2'] ?? 50) / 100;
                const intenVolcano = (s1 < 0.5) ? (0.5 - s1) * 2.0 : 0.0;
                const intenOcean = (s1 > 0.5) ? (s1 - 0.5) * 2.0 : 0.0;
                const intenDesert = (s2 < 0.5) ? (0.5 - s2) * 2.0 : 0.0;
                const intenForest = (s2 > 0.5) ? (s2 - 0.5) * 2.0 : 0.0;

                const seedQ1 = new THREE.Vector3(0.0, 1.0, 0.0);
                const seedQ2 = new THREE.Vector3(0.8, -0.5, 0.3);

                // Morph Dictionary Mapping
                const dict = mesh.morphTargetDictionary || {};
                const typeMap: Record<number, number> = {}; // morphIdx -> type (0:Desert, 1:Ocean, 2:Volcan, 3:Forest)
                for (const key in dict) {
                    const k = key.toLowerCase();
                    const idx = dict[key];
                    if (k.includes('ocean')) typeMap[idx] = 1;
                    else if (k.includes('desert')) typeMap[idx] = 0;
                    else if (k.includes('volcan')) typeMap[idx] = 2;
                    else if (k.includes('forest')) typeMap[idx] = 3;
                }

                for (let i = 0; i < posAttr.count; i++) {
                    tempPos.fromBufferAttribute(posAttr, i);

                    // If planet, calculate masks for this vertex
                    let maskV = 1.0, maskO = 1.0, maskD = 1.0, maskF = 0.0;
                    if (isPlanet) {
                        const aV = getGrowthAlpha(tempPos, seedQ1, intenVolcano);
                        const aO = getGrowthAlpha(tempPos, seedQ1, intenOcean);
                        const aD = getGrowthAlpha(tempPos, seedQ2, intenDesert);
                        const aF = getGrowthAlpha(tempPos, seedQ2, intenForest);

                        maskD = aD * (1.0 - aF);
                        maskO = aO * (1.0 - aV) * (1.0 - aD) * (1.0 - aF);
                        maskV = aV * (1.0 - aO) * (1.0 - aD) * (1.0 - aF);
                        maskF = aF;
                    }

                    for (let j = 0; j < mesh.morphTargetInfluences.length; j++) {
                        const influence = mesh.morphTargetInfluences[j];
                        if (influence > 0.001 || isPlanet) {
                            let weight = influence;
                            const type = typeMap[j];

                            if (isPlanet && type !== undefined) {
                                if (type === 0) weight = maskD;
                                else if (type === 1) weight = maskO;
                                else if (type === 2) weight = maskV;
                                else if (type === 3) weight = maskF;
                                weight *= 1.8; // Match shader boost
                            }

                            if (weight > 0.001) {
                                morphPos.fromBufferAttribute(morphTargets[j], i);
                                tempPos.addScaledVector(morphPos, weight);
                            }
                        }
                    }
                    posAttr.setXYZ(i, tempPos.x, tempPos.y, tempPos.z);
                }
            }

            // 2. Apply World Transforms (Scaling, Position, Rotation)
            mesh.updateMatrixWorld(true);
            geometry.applyMatrix4(mesh.matrixWorld);

            // 3. Bake Masking (Forest, Clouds, etc.) 
            // Forest Port with Natural Cut (Island Detection)
            if (mesh.name === 'planet_forest_mesh' || mesh.name === 'planet_forest') {
                const seedPoint = new THREE.Vector3(0.8, -0.5, 0.3);
                const s2 = (elementValues['Q2'] ?? 50) / 100;
                const intenForest = s2 > 0.5 ? (s2 - 0.5) * 2.0 : 0.0;

                const count = posAttr.count;
                const triCount = count / 3;

                // 1. Group triangles by shared vertex positions
                const vertexToTris: { [key: string]: number[] } = {};
                for (let i = 0; i < count; i++) {
                    const vx = posAttr.getX(i).toFixed(4);
                    const vy = posAttr.getY(i).toFixed(4);
                    const vz = posAttr.getZ(i).toFixed(4);
                    const key = `${vx},${vy},${vz}`;
                    const triIdx = Math.floor(i / 3);
                    if (!vertexToTris[key]) vertexToTris[key] = [];
                    vertexToTris[key].push(triIdx);
                }

                const triVisited = new Uint8Array(triCount);
                const islands: number[][] = [];

                for (let t = 0; t < triCount; t++) {
                    if (triVisited[t]) continue;

                    const island: number[] = [];
                    const queue: number[] = [t];
                    triVisited[t] = 1;

                    while (queue.length > 0) {
                        const currTri = queue.shift()!;
                        island.push(currTri);

                        // Check all vertices of this triangle
                        for (let v = 0; v < 3; v++) {
                            const idx = currTri * 3 + v;
                            const vx = posAttr.getX(idx).toFixed(4);
                            const vy = posAttr.getY(idx).toFixed(4);
                            const vz = posAttr.getZ(idx).toFixed(4);
                            const key = `${vx},${vy},${vz}`;

                            const sharedTris = vertexToTris[key];
                            if (sharedTris) {
                                for (const sharedTri of sharedTris) {
                                    if (!triVisited[sharedTri]) {
                                        triVisited[sharedTri] = 1;
                                        queue.push(sharedTri);
                                    }
                                }
                            }
                        }
                    }
                    islands.push(island);
                }

                // 2. Apply Alpha to entire Islands
                const islandCentroid = new THREE.Vector3();
                const tempV = new THREE.Vector3();

                for (const island of islands) {
                    islandCentroid.set(0, 0, 0);
                    let vCount = 0;
                    for (const triIdx of island) {
                        for (let v = 0; v < 3; v++) {
                            tempV.fromBufferAttribute(posAttr, triIdx * 3 + v);
                            islandCentroid.add(tempV);
                            vCount++;
                        }
                    }
                    if (vCount > 0) islandCentroid.divideScalar(vCount);

                    const relPos = islandCentroid.clone().normalize();
                    const alpha = getGrowthAlpha(relPos, seedPoint, intenForest);

                    // Decision across the line: keep if alpha > 0.05
                    if (alpha < 0.05) {
                        for (const triIdx of island) {
                            for (let v = 0; v < 3; v++) {
                                posAttr.setXYZ(triIdx * 3 + v, 0, 0, 0);
                            }
                        }
                    }
                }
            }

            // Clouds/Comets hidden logic (simple center collapse if mesh hidden by logic)
            if (!mesh.visible) {
                for (let i = 0; i < posAttr.count; i++) {
                    posAttr.setXYZ(i, 0, 0, 0);
                }
            }

            geometry.computeVertexNormals();
            if (mesh.geometry.index) rawGeo.dispose();
            return geometry;
        };

        const geometries: THREE.BufferGeometry[] = [];
        scene.traverse((child) => {
            // Include everything that is a Mesh and not explicitly excluded
            if ((child as THREE.Mesh).isMesh && !child.name.startsWith('exclusion_')) {
                const meshChild = child as THREE.Mesh;
                const baked = bakeMesh(meshChild);
                if (baked) geometries.push(baked);
            }
        });

        if (geometries.length === 0) return;

        const merged = BufferGeometryUtils.mergeGeometries(geometries);
        const finalMesh = new THREE.Mesh(merged);

        const exporter = new STLExporter();
        const result = exporter.parse(finalMesh, { binary: true });

        const blob = new Blob([result], { type: 'application/octet-stream' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `YourWorld3D_${new Date().getTime()}.stl`;
        link.click();

        geometries.forEach(g => g.dispose());
        merged.dispose();
    };


    const handleNextQuestion = () => {
        setIsTitleFading(true);

        setTimeout(() => {
            const nextIndex = currentQuestionIndex + 1;
            const isEndOfTraitGroup = nextIndex % 5 === 0;

            setAllAnswers({ ...allAnswers, [currentQuestion.id]: sliderValue });

            if (currentQuestionIndex < quizQuestions.length - 1) {
                setCurrentQuestionIndex(nextIndex);

                // If the element changes (new trait group), reset to 50
                // For 3 questions per trait, element changes every 3 questions
                const nextQuestion = quizQuestions[nextIndex];
                if (nextQuestion.element.id !== currentQuestion.element.id) {
                    setSliderValue(50);
                }

                setShowIdleOverlay(false);
            } else {
                setView('email');
            }
            setIsTitleFading(false);
        }, 400); // Duration of fade out
    };

    const handleStartQuiz = () => {
        // Finalize assignments based on orderedTraits
        const finalAssignments: Record<string, string> = {};
        orderedTraits.forEach((trait, index) => {
            finalAssignments[trait] = `Q${index + 1}`;
        });
        setAssignments(finalAssignments);

        // Start 10 second loader
        setPlanetLoading(true);
        setPlanetProgress(0);
        const startTime = Date.now();
        const duration = 7000;
        // Reduced from 10000 to accelerate transition by 3s

        const interval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(100, Math.floor((elapsed / duration) * 100));
            setPlanetProgress(progress);

            if (elapsed >= duration) {
                clearInterval(interval);
                setPlanetLoading(false);
            }
        }, 16); // Increased frequency for 60fps smoothness

        setView('quiz');
        // Anchor to the quiz section instead of document top to avoid showing Hero again
        const quizEl = document.getElementById('quiz');
        if (quizEl) {
            quizEl.scrollIntoView({ behavior: 'smooth' });
        }
    };

    const nextArtifact = () => {
        setCarouselIndex((prev) => (prev + 1) % artifactOptions.length);
        setSelectedArtifact(artifactOptions[(carouselIndex + 1) % artifactOptions.length].id);
    };

    const prevArtifact = () => {
        setCarouselIndex((prev) => (prev - 1 + artifactOptions.length) % artifactOptions.length);
        setSelectedArtifact(artifactOptions[(carouselIndex - 1 + artifactOptions.length) % artifactOptions.length].id);
    };

    const handleEmailSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) return;
        setView('artifact');
    };

    const handleSubmit = async () => {
        if (!email || !selectedArtifact) return;

        setSubmitting(true);

        // Final Score Calculation
        const traitScores: Record<string, number> = {};
        quizQuestions.forEach(q => {
            const rawScore = allAnswers[q.id] ?? 50;
            const finalScore = q.direction.includes('Standard') ? rawScore : (100 - rawScore);
            if (!traitScores[q.trait]) traitScores[q.trait] = 0;
            traitScores[q.trait] += finalScore;
        });

        const percentages = Object.entries(traitScores).reduce((acc, [trait, score]) => {
            acc[trait] = Math.round(score / 3); // Updated from /5 to /3 for 3 questions per trait
            return acc;
        }, {} as Record<string, number>);

        try {
            const res = await fetch('/api/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email,
                    traitPercentages: percentages,
                    assignments,
                    selectedProduct: selectedArtifact,
                    format: artifactOptions.find(a => a.id === selectedArtifact)?.format,
                    price: selectedPrices[selectedArtifact],
                    wishlistedItems: Array.from(wishlisted).map(id => artifactOptions.find(a => a.id === id)?.format),
                    type: 'quiz_complete_v4_personality',
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

    // 3D Preview interpolation
    const currentGlowColor = useMemo(() => {
        if (!currentQuestion) return '#ffffff';
        const colors = elementColors[currentQuestion.element.id];
        return interpolateColor(colors.low, colors.high, sliderValue / 100);
    }, [currentQuestion, sliderValue]);

    const tintInfo = useMemo(() => {
        if (!currentQuestion) return { color: 'transparent', opacity: 0 };
        const colors = elementColors[currentQuestion.element.id];
        const delta = Math.abs(sliderValue - 50);
        let opacity = 0;
        if (delta > 5) opacity = (delta / 25) * 0.3;
        const isLow = sliderValue < 50;
        return {
            color: isLow ? colors.low : colors.high,
            opacity: Math.min(0.6, opacity)
        };
    }, [currentQuestion, sliderValue]);

    // Render Trait Selection View
    const renderTraitSelection = () => {
        const selectedElement = elementOptions.find(e => e.id === tempSelection);

        return (
            <div className={styles.traitSelectionContainer}>
                <h2 className={styles.traitTitle}>Choose the elements that best represents how you imagine...</h2>
                <h3 className={styles.traitSubtitle} key={`sub-${assignmentStep}`}>{currentTrait}</h3>

                <div className={styles.previewGrid} key={`grid-${assignmentStep}`}>
                    {selectedElement ? (
                        <>
                            <div className={styles.previewImageWrapper}>
                                <div className={styles.lowHighLabelContainer}>
                                    <Image src={getAssetPath('/1_Quiz Planet Images/minus.png')} alt="" width={16} height={16} className={styles.logicIcon} />
                                    <span className={styles.lowHighLabel}>&nbsp;Low&nbsp;</span>
                                </div>
                                <Image src={getAssetPath(selectedElement.low)} alt="Low" width={250} height={250} className={styles.previewImage} />
                            </div>
                            <div className={styles.previewImageWrapper}>
                                <div className={styles.lowHighLabelContainer}>
                                    <span className={styles.lowHighLabel}>&nbsp;High&nbsp;</span>
                                    <Image src={getAssetPath('/1_Quiz Planet Images/plus.png')} alt="" width={16} height={16} className={styles.logicIcon} />
                                </div>
                                <Image src={getAssetPath(selectedElement.high)} alt="High" width={250} height={250} className={styles.previewImage} />
                            </div>
                            <div className={styles.elementGroupTextContainer}>
                                <div className={styles.elementGroupText}>{selectedElement.title}</div>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className={styles.previewImageWrapper}>
                                <div className={styles.lowHighLabelContainer}>
                                    <Image src={getAssetPath('/1_Quiz Planet Images/minus.png')} alt="" width={16} height={16} className={styles.logicIcon} />
                                    <span className={styles.lowHighLabel}>&nbsp;Low&nbsp;</span>
                                </div>
                                <Image src={getAssetPath('/1_Quiz Planet Images/empty_space_planet.png')} alt="Empty" width={250} height={250} className={styles.previewImage} />
                            </div>
                            <div className={styles.previewImageWrapper}>
                                <div className={styles.lowHighLabelContainer}>
                                    <span className={styles.lowHighLabel}>&nbsp;High&nbsp;</span>
                                    <Image src={getAssetPath('/1_Quiz Planet Images/plus.png')} alt="" width={16} height={16} className={styles.logicIcon} />
                                </div>
                                <Image src={getAssetPath('/1_Quiz Planet Images/empty_space_planet.png')} alt="Empty" width={250} height={250} className={styles.previewImage} />
                            </div>
                        </>
                    )}
                </div>


                <div className={styles.selectionArea}>
                    <div className={styles.selectionTextContainer}>
                        {/* Title is now moved inside previewGrid for better centering */}
                    </div>

                    <div className={styles.elementButtons}>
                        {elementOptions.map(opt => {
                            const isAssigned = isElementAssigned(opt.id);
                            const isSelected = tempSelection === opt.id;

                            return (
                                <button
                                    key={opt.id}
                                    className={`${styles.elementBtn} ${isSelected ? styles.elementBtnSelected : ''} ${isAssigned ? styles.elementBtnDisabled : ''}`}
                                    onClick={() => handleElementSelect(opt.id)}
                                    disabled={isAssigned}
                                >
                                    <Image src={getAssetPath(opt.icon)} alt={opt.title} width={60} height={60} className={styles.elementIcon} />
                                    {isAssigned && <div className={styles.checkMark}>✓</div>}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className={styles.centeredNavContainer}>
                    <button
                        className={`${styles.navActionBtn} ${styles.nextBtn}`}
                        onClick={handleTraitNext}
                        disabled={!tempSelection}
                    >
                        Confirm
                    </button>
                </div>

                <div className={styles.skipButtonContainer}>
                    <button
                        className={styles.decideSkipBtn}
                        onClick={handleDecideForMe}
                    >
                        DECIDE FOR ME AND SKIP
                    </button>
                </div>
            </div>
        );
    };

    // Render Summary View
    const renderTraitSummary = () => {
        const traitPool = ['Agreeableness', 'Extraversion', 'Conscientiousness', 'Openness', 'Neuroticism'];

        const handleTraitSwap = (elementId: string, newTrait: string) => {
            const currentIdx = parseInt(elementId.replace('Q', '')) - 1;
            const oldTrait = orderedTraits[currentIdx];
            if (oldTrait === newTrait) return;

            const targetIdx = orderedTraits.indexOf(newTrait);
            const newOrderedTraits = [...orderedTraits];

            // Swap traits in the ordered array
            newOrderedTraits[targetIdx] = oldTrait;
            newOrderedTraits[currentIdx] = newTrait;

            setOrderedTraits(newOrderedTraits);

            // Sync with assignments record
            setAssignments(prev => {
                const next = { ...prev };
                next[newTrait] = elementId;
                next[oldTrait] = `Q${targetIdx + 1}`;
                return next;
            });
        };

        return (
            <div className={styles.summaryContainer}>
                <h2 className={styles.summaryTitle}>Choose the personality traits that best represent this elements:</h2>
                <div className={styles.summaryList}>
                    {['Q1', 'Q2', 'Q3', 'Q4', 'Q5'].map((elementId, index) => {
                        const element = elementOptions.find(e => e.id === elementId)!;
                        const assignedTrait = orderedTraits[index];

                        return (
                            <div key={elementId} className={styles.summaryRow}>
                                <span className={styles.summaryElementName}>{element.title}</span>
                                <div className={styles.summaryRowControls}>
                                    <div className={styles.summaryIconWrapper}>
                                        <Image
                                            src={getAssetPath(element.icon)}
                                            alt={element.title}
                                            width={120}
                                            height={120}
                                            className={styles.summaryIcon}
                                        />
                                    </div>
                                    <div className={styles.traitSelectorWrapper}>
                                        <select
                                            className={styles.traitDropdown}
                                            value={assignedTrait}
                                            onChange={(e) => handleTraitSwap(elementId, e.target.value)}
                                        >
                                            {traitPool.map(t => (
                                                <option key={t} value={t}>{t}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
                <button className={styles.continueBtn} onClick={handleStartQuiz}>
                    Confirm
                </button>
            </div>
        );
    };

    const renderInitialLoader = () => {
        // SVG circle properties
        const radius = 60;
        const circumference = 2 * Math.PI * radius;
        const offset = circumference - (loaderProgress / 100) * circumference;

        return (
            <div className={styles.initialLoaderOverlay}>
                <div className={styles.loaderContent}>
                    <svg className={styles.circularLoader} width="160" height="160">
                        <circle
                            className={styles.loaderTrack}
                            cx="80"
                            cy="80"
                            r={radius}
                        />
                        <circle
                            className={styles.loaderProgress}
                            cx="80"
                            cy="80"
                            r={radius}
                            style={{ strokeDasharray: circumference, strokeDashoffset: offset }}
                        />
                    </svg>
                    <div className={styles.loaderPercentage}>{loaderProgress}%</div>
                </div>
            </div>
        );
    };

    const renderPlanetLoader = () => {
        const radius = 60;
        const circumference = 2 * Math.PI * radius;
        const offset = circumference - (planetProgress / 100) * circumference;

        return (
            <div className={styles.planetLoaderOverlay}>
                <div className={styles.loaderContent}>
                    <svg className={styles.circularLoader} width="160" height="160">
                        <circle
                            className={styles.loaderTrack}
                            cx="80"
                            cy="80"
                            r={radius}
                        />
                        <circle
                            className={styles.loaderProgress}
                            cx="80"
                            cy="80"
                            r={radius}
                            style={{ strokeDasharray: circumference, strokeDashoffset: offset }}
                        />
                    </svg>
                    <div className={styles.loaderPercentage}>{planetProgress}%</div>
                </div>
            </div>
        );
    };

    return (
        <section className={styles.quizSection} id="quiz">
            {showInitialLoader && renderInitialLoader()}
            {planetLoading && renderPlanetLoader()}
            <div className={styles.container}>
                {/* Global Planet Visual: Visible during quiz (normal) and email/artifact (blurred) */}
                {(view === 'quiz' || view === 'email' || view === 'artifact') && (
                    <div
                        className={`
                            ${styles.globalPlanetContainer} 
                            ${styles.globalPlanetVisible}
                            ${(view === 'email' || view === 'artifact') ? styles.globalPlanetBlurred : ''}
                        `}
                        style={{ '--glow-color': currentGlowColor } as React.CSSProperties}
                    >
                        <div className={styles.planetVisual}>
                            <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                                <Suspense fallback={<div className={styles.planetLoaderPlaceholder}>Establishing Connection...</div>}>
                                    <Planet3D
                                        ref={planet3DRef}
                                        values={elementOptions.map(opt => elementValues[opt.id])}
                                        currentSection={(view === 'email' || view === 'artifact') ? 4 : (currentQuestion ? elementOptions.findIndex(e => e.id === currentQuestion.element.id) : -1)}
                                        tintColor={tintInfo.color}
                                        tintOpacity={tintInfo.opacity}
                                    />
                                </Suspense>
                            </div>
                        </div>

                        {(view === 'email' || view === 'artifact') && (
                            <div className={styles.emailSymbolOverlay}>
                                <Mail size={80} strokeWidth={1.5} />
                            </div>
                        )}
                    </div>
                )}

                {view === 'traitSelection' && renderTraitSelection()}
                {view === 'traitSummary' && renderTraitSummary()}

                {view === 'quiz' && (
                    <>
                        <div className={`${styles.progressContainer} ${isQuizReady ? styles.quizFadeIn : ''}`} style={{ opacity: isQuizReady ? 1 : 0 }}>
                            {quizQuestions.map((_, index) => (
                                <div
                                    key={index}
                                    className={`${styles.progressLine} ${index <= currentQuestionIndex ? styles.active : ''}`}
                                />
                            ))}
                        </div>
                        {showIdleOverlay && isQuizReady && (
                            <div className={styles.instructionOverlay}>
                                Choose how little <Image src={getAssetPath('/1_Quiz Planet Images/minus.png')} alt="" width={16} height={16} className={styles.instructionIcon} /> or how much <Image src={getAssetPath('/1_Quiz Planet Images/plus.png')} alt="" width={16} height={16} className={styles.instructionIcon} /> the sentence represents you.
                            </div>
                        )}
                        <h2
                            className={`${styles.questionTitle} ${isTitleFading ? styles.questionTitleFading : ''} ${isQuizReady ? styles.quizFadeIn : ''}`}
                            style={{
                                fontSize: (currentQuestion?.statement?.length || 0) > 80 ? '1.2rem' : '1.5rem',
                                transition: 'opacity 0.4s ease',
                                opacity: isQuizReady ? 1 : 0
                            }}
                        >
                            {currentQuestion.statement}
                        </h2>

                        <div
                            className={styles.activeOptionDisplay}
                            style={{ '--glow-color': currentGlowColor } as React.CSSProperties}
                        >
                            {/* The planet visual is now handled by globalPlanetContainer */}
                        </div>

                        <div className={styles.overlayContainer}>
                            {/* Drag to start overlay removed as per user request */}
                        </div>

                        <div className={styles.quizInstructionsContainer} style={{ opacity: 0, height: 0, overflow: 'hidden' }}>
                            {/* Hidden slider logic remains for state preservation */}
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
                                            '--thumb-image': `url('${getAssetPath('/Logo color.png')}')`
                                        } as React.CSSProperties}
                                        aria-label="Select your intensity"
                                    />
                                    <div className={styles.sliderTrackLine} />
                                </div>
                            </div>
                        </div>

                        <div className={`${styles.quizControlsContainer} ${isQuizReady ? styles.quizFadeIn : ''}`} style={{ opacity: isQuizReady ? 1 : 0 }}>
                            <div className={styles.quizButtonGroup}>
                                <button className={styles.quizControlBtn} onClick={() => handleQuizButtonClick('minusminus')} aria-label="Large Decrease">
                                    <Image src={getAssetPath('/1_Quiz Planet Images/minusminus.png')} alt="--" width={60} height={60} />
                                </button>
                                <button className={styles.quizControlBtn} onClick={() => handleQuizButtonClick('minus')} aria-label="Decrease">
                                    <Image src={getAssetPath('/1_Quiz Planet Images/minus.png')} alt="-" width={60} height={60} />
                                </button>
                                <button className={styles.quizControlBtn} onClick={() => handleQuizButtonClick('middle')} aria-label="Center">
                                    <Image src={getAssetPath('/1_Quiz Planet Images/middle.png')} alt="o" width={60} height={60} />
                                </button>
                                <button className={styles.quizControlBtn} onClick={() => handleQuizButtonClick('plus')} aria-label="Increase">
                                    <Image src={getAssetPath('/1_Quiz Planet Images/plus.png')} alt="+" width={60} height={60} />
                                </button>
                                <button className={styles.quizControlBtn} onClick={() => handleQuizButtonClick('plusplus')} aria-label="Large Increase">
                                    <Image src={getAssetPath('/1_Quiz Planet Images/plusplus.png')} alt="++" width={60} height={60} />
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
                                <input
                                    type="text"
                                    required
                                    placeholder="Your Name"
                                    value={userName}
                                    onChange={(e) => setUserName(e.target.value)}
                                    className={styles.emailInput}
                                    autoFocus
                                />
                                <input
                                    type="number"
                                    required
                                    placeholder="Age"
                                    value={userAge}
                                    onChange={(e) => setUserAge(e.target.value)}
                                    className={styles.emailInput}
                                />
                                <input
                                    type="email"
                                    required
                                    placeholder="enter@email.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className={styles.emailInput}
                                />
                                <button
                                    type="submit"
                                    className={styles.continueBtn}
                                    style={{ marginTop: '0.5rem' }}
                                >
                                    Save your planet
                                </button>
                                <button
                                    type="button"
                                    onClick={handleDownloadSTL}
                                    className={styles.secondaryDownloadBtn}
                                >
                                    <Download size={20} />
                                    Download 3D Model (.STL)
                                </button>
                            </form>
                        </div>
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
