'use client';

import Image from 'next/image';
import { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import styles from './WorldQuiz.module.css';
import { Planet3D, Planet3DHandle } from './Planet3D';
import { UnifiedArtifactRenderer, ARTIFACT_TRANSFORMS } from './UnifiedArtifactRenderer';
import { useProgress } from '@react-three/drei';
import { ArrowLeft, ArrowRight, Download, Mail, RotateIcon } from './Icons';
import * as THREE from 'three';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Evaluator, Brush, ADDITION, SUBTRACTION } from 'three-bvh-csg';
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
    'Ocean': { low: '#3B82F6', high: '#3B82F6' },   // Blue
    'Volcano': { low: '#FF4444', high: '#FF4444' }, // Red
    'Desert': { low: '#B45309', high: '#B45309' },  // Ocre
    'Forest': { low: '#16A34A', high: '#16A34A' },  // Green
    'Q3': { low: '#A855F7', high: '#FACC15' },      // Purple -> Yellow
    'Q4': { low: '#3B82F6', high: '#22D3EE' },      // Blue -> Cyan
    'Q5': { low: '#FDE047', high: '#FFFFFF' },      // Yellow -> White
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
    { id: 'Desert', title: 'Desert Expansion', icon: '/1_Quiz Planet Images/each_element/desert.png', low: '/1_Quiz Planet Images/each_element/empty.png', high: '/1_Quiz Planet Images/each_element/desert.png', folder: '2_How introverted are you_', lowPrefix: '2_low', highPrefix: '2_high' },
    { id: 'Volcano', title: 'Volcanic Activity', icon: '/1_Quiz Planet Images/each_element/volcanos.png', low: '/1_Quiz Planet Images/each_element/empty.png', high: '/1_Quiz Planet Images/each_element/volcanos.png', folder: '1_How energetic are you_', lowPrefix: '1_low', highPrefix: '1_high' },
    { id: 'Ocean', title: 'Ocean Depth', icon: '/1_Quiz Planet Images/each_element/oceans.png', low: '/1_Quiz Planet Images/each_element/empty.png', high: '/1_Quiz Planet Images/each_element/oceans.png', folder: '1_How empathetic are you_', lowPrefix: '1_low', highPrefix: '1_high' },
    { id: 'Forest', title: 'Forest Growth', icon: '/1_Quiz Planet Images/each_element/forest.png', low: '/1_Quiz Planet Images/each_element/empty.png', high: '/1_Quiz Planet Images/each_element/forest.png', folder: '2_How sociable are you_', lowPrefix: '2_low', highPrefix: '2_high' },
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

const SLIDER_COLORS = [
    '#d3bca8', // Q1
    '#e37565', // Q2
    '#77c6db', // Q3
    '#7fc8b1', // Q4
    '#d4af96', // Q5
    '#324e81', // Q6
    '#98b1a3'  // Q7
];

// ---------------------------------------------------------
// STL EXPORT CONFIGURATION (Adjust these to tweak STL sizes)
// ---------------------------------------------------------
const EXPORT_SCALES = {
    PLANET_BASE: 0.004 * 1.3,      // Matches live 0.004 * planetScale (1.3)
    FOREST_MOSS: 0.385 * 1.3,      // Matches live 0.385 * planetScale (1.3)
    CLOUDS: 0.0039 * 1.14 * 1.18, // Matches live 0.004 * cloudScale (1.14) * planetScale (1.3)
    RINGS: 0.004 * 1.1 * 1.0,  // Matches live 0.004 * ringScale (1.1) * planetScale (1.3)
    COMETS: 0.004 * 1.3,      // Matches live 0.004 * cometScale (1.3)
    ANILLA: 0.008 * 1.5,        // Necklace bail (matches planet scale)
    ANILLA_OFFSET_Y: 4.75,           // Extra height above the planet surface (approx 1.3)
    ANILLA_ROT_X: Math.PI / 2,       // Stand upright rotation
    HOLE_MAJOR_R: 400.80,              // Radius of the tunnel arc
    HOLE_MINOR_R: 280,              // Diameter of the tunnel hole (optimized for cord)
    HOLE_X_OFFSET: 5.30                  // Sideways position (ensures bridge through 1.3R planet)
};

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
    const [sliderValue, setSliderValue] = useState(0);
    const [allAnswers, setAllAnswers] = useState<Record<string, number>>({});

    // UI State
    const [showIdleOverlay, setShowIdleOverlay] = useState(false); // Commented out/disabled for now
    const [hasInteracted, setHasInteracted] = useState(false);
    const [hasRotatedPlanet, setHasRotatedPlanet] = useState(false);
    const idleTimerRef = useMemo(() => ({ current: null as NodeJS.Timeout | null }), []);
    const [email, setEmail] = useState('');
    const [userName, setUserName] = useState('');
    const [userAge, setUserAge] = useState('');
    const [isQuestionTransitioning, setIsQuestionTransitioning] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);

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
        'Ocean': 0, 'Volcano': 0, 'Desert': 0, 'Forest': 0, 'Q3': 0, 'Q4': 0, 'Q5': 0
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

        // Save current answer before going back
        const currentQuestion = personalityLanding[currentQuestionIndex];
        setAllAnswers(prev => ({
            ...prev,
            [currentQuestion.id]: sliderValue
        }));

        setIsQuestionTransitioning(true);
        setTimeout(() => {
            const prevIndex = currentQuestionIndex - 1;
            const prevQuestion = personalityLanding[prevIndex];
            setCurrentQuestionIndex(prevIndex);

            // Restore saved answer or use default
            const savedValue = allAnswers[prevQuestion.id];
            if (savedValue !== undefined) {
                setSliderValue(savedValue);
            } else {
                const isPersonalitySplit = ['Ocean', 'Volcano', 'Desert', 'Forest'].includes(prevQuestion.elementId);
                setSliderValue(0);
            }

            setIsQuestionTransitioning(false);
        }, 800);
    };

    const handleNextQuestion = () => {
        if (isQuestionTransitioning) return;

        // Capture current answer
        const currentQuestion = personalityLanding[currentQuestionIndex];
        setAllAnswers(prev => ({
            ...prev,
            [currentQuestion.id]: sliderValue
        }));

        if (currentQuestionIndex < personalityLanding.length - 1) {
            setIsQuestionTransitioning(true);
            setIsTitleFading(true);

            setTimeout(() => {
                const nextIndex = currentQuestionIndex + 1;
                const nextQuestion = personalityLanding[nextIndex];
                setCurrentQuestionIndex(nextIndex);

                // Restore saved answer or use default
                const savedValue = allAnswers[nextQuestion.id];
                if (savedValue !== undefined) {
                    setSliderValue(savedValue);
                } else {
                    setSliderValue(0);
                }

                setIsQuestionTransitioning(false);
                setIsTitleFading(false);
            }, 500);
        } else {
            setView('artifact');
        }
    };

    // Simplex Noise Generator
    const createSimplexNoise = () => {
        const p = new Uint8Array(256);
        for (let i = 0; i < 256; i++) p[i] = i;
        for (let i = 255; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[p[i], p[j]] = [p[j], p[i]]; }
        const perm = new Uint8Array(512);
        for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
        const grad3 = [[1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0], [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1], [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1]];
        const dot = (g: number[], x: number, y: number, z: number) => g[0] * x + g[1] * y + g[2] * z;
        const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
        const lerp = (a: number, b: number, t: number) => a + t * (b - a);
        return (x: number, y: number, z: number) => {
            let X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
            x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
            const u = fade(x), v = fade(y), w = fade(z);
            const A = perm[X] + Y, AA = perm[A] + Z, AB = perm[A + 1] + Z, B = perm[X + 1] + Y, BA = perm[B] + Z, BB = perm[B + 1] + Z;
            return lerp(lerp(lerp(dot(grad3[perm[AA] % 12], x, y, z), dot(grad3[perm[BA] % 12], x - 1, y, z), u), lerp(dot(grad3[perm[AB] % 12], x, y - 1, z), dot(grad3[perm[BB] % 12], x - 1, y - 1, z), u), v), lerp(lerp(dot(grad3[perm[AA + 1] % 12], x, y, z - 1), dot(grad3[perm[BA + 1] % 12], x - 1, y, z - 1), u), lerp(dot(grad3[perm[AB + 1] % 12], x, y - 1, z - 1), dot(grad3[perm[BB + 1] % 12], x - 1, y - 1, z - 1), u), v), w);
        };
    };

    const bakeMeshHollow = async (values: Record<string, number>, mode: 'lamp' | 'necklace' | 'bracelet' = 'lamp'): Promise<Blob> => {
        // --- TOPOLOGY & EXPORT CONFIGURATION VARIABLES ---
        // Exposing these parameters for easy tweaking of the resulting STL models
        const LAMP_FLAT_CUT_PERCENTAGE = 0.88;  // percentage (from top) to preserve. 0.92 cleanly preserves the top 92% and creates a flawless slice at the bottom 8%.
        const baseScale = EXPORT_SCALES.PLANET_BASE;
        const NECKLACE_TUNNEL_RADIUS = 240 * baseScale; // Adjust how FAT the connection hole is through the center of the planet
        const NECKLACE_TUNNEL_Y_OFFSET = 0; // Vertical offset if you decide the tunnel needs to be higher/lower than the dead center
        // -------------------------------------------------

        const fbxLoader = new FBXLoader();
        const gltfLoader = new GLTFLoader();
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
        gltfLoader.setDRACOLoader(dracoLoader);

        const noise = createSimplexNoise();
        const getGrowthValue = (pos: THREE.Vector3, seed: THREE.Vector3, intensity: number) => {
            const posNorm = pos.clone().normalize();
            if (intensity <= 1e-4) return 0.0;
            if (intensity >= 0.999) return 1.0;
            const align = posNorm.dot(seed.clone().normalize());
            const grad = align * 0.5 + 0.5;
            const n = noise(posNorm.x * 3.5, posNorm.y * 3.5, posNorm.z * 3.5) * 0.5 + 0.5;
            const growthMap = grad * 0.85 + n * 0.15;
            const threshold = 1.05 - (intensity * 1.10);
            return THREE.MathUtils.smoothstep(growthMap, threshold, threshold + 0.15);
        };

        const [baseFBX, forestGLTF, ringFBX, cometsFBX, cloudsFBX] = await Promise.all([
            fbxLoader.loadAsync(getAssetPath('/models/base.fbx')),
            gltfLoader.loadAsync(getAssetPath('/models/forest.glb')),
            fbxLoader.loadAsync(getAssetPath('/models/Ring.fbx')),
            fbxLoader.loadAsync(getAssetPath('/models/Comets.fbx')),
            fbxLoader.loadAsync(getAssetPath('/models/Clouds.fbx'))
        ]);

        const evaluator = new Evaluator();
        evaluator.useGroups = false;
        evaluator.attributes = ['position', 'normal'];
        let finalBrush: any = null;
        const geometriesToMerge: THREE.BufferGeometry[] = [];

        const ensureIndexed = (geom: THREE.BufferGeometry) => {
            let processedGeom = geom;
            if (!processedGeom.index) {
                processedGeom = BufferGeometryUtils.mergeVertices(processedGeom);
            }
            if (!processedGeom.index) {
                processedGeom.setIndex([]);
            }
            if (!processedGeom.attributes.normal) {
                processedGeom.computeVertexNormals();
            }
            return processedGeom;
        };

        const forestScale = EXPORT_SCALES.FOREST_MOSS;
        const cloudScale = EXPORT_SCALES.CLOUDS;
        const ringScale = EXPORT_SCALES.RINGS;
        const cometScale = EXPORT_SCALES.COMETS;
        const anillaScale = EXPORT_SCALES.ANILLA;

        // Upright Neutral Rotation (Rotate -90 in X as requested)
        const neutralRotation = new THREE.Euler(Math.PI / -2, 0, 0);

        // Spatial Biome Seeds
        const pD = new THREE.Vector3(0.0, 0.4, -1.0).normalize();
        const pV = new THREE.Vector3(1.0, 0.4, 0.0).normalize();
        const pO = new THREE.Vector3(0.0, 0.4, 1.0).normalize();
        const pF = new THREE.Vector3(-1.0, 0.4, 0.0).normalize();

        const iD = (values['Desert'] || 0) / 100, iV = (values['Volcano'] || 0) / 100, iO = (values['Ocean'] || 0) / 100, iF = (values['Forest'] || 0) / 100;
        const iQ3 = (values['Q3'] || 0) / 100, iQ4 = (values['Q4'] || 0) / 100, iQ5 = (values['Q5'] || 0) / 100;

        const planetActualRadius = 250 * EXPORT_SCALES.PLANET_BASE * 0.98;
        const planetCullRadiusSq = Math.pow(250 * EXPORT_SCALES.PLANET_BASE * 0.88, 2); // Deletes floating geometry at 88% depth
        const planetActualRadiusSq = Math.pow(planetActualRadius, 2);
        const planetCenter = new THREE.Vector3(0, -250 * baseScale, 0); // Temporary fallback, updated dynamically

        let extractedBasePlanet = false;

        const processGroup = (group: THREE.Group, scale: number, rotation: THREE.Euler | undefined, influences: Record<string, number> | undefined, isForest: boolean, innerShell: boolean, vMap?: (n: string, p: number, m: Record<string, number[]>) => boolean, mapping?: Record<string, number[]>, isBasePlanet: boolean = false) => {
            group.updateMatrixWorld(true);
            group.traverse((child: any) => {
                if (child.isMesh) {
                    // Prevent hidden morph target duplicates from bloating BoundingBoxes or generating phantom artifact shells
                    if (isBasePlanet && extractedBasePlanet) return;
                    if (isBasePlanet) extractedBasePlanet = true;
                    if (vMap && mapping && influences && !vMap(child.name, influences['vVal'] || 0, mapping)) return;
                    // CLONE GEOMETRY to prevent damaging the original mesh data across multiple shell calls
                    const geom = child.geometry.clone() as THREE.BufferGeometry;
                    const pos = geom.getAttribute('position');
                    const morphTargets = geom.morphAttributes.position;
                    // Apply morph targets first
                    if (morphTargets && influences) {
                        for (let i = 0; i < pos.count; i++) {
                            const v = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
                            const aD = getGrowthValue(v, pD, iD), aV = getGrowthValue(v, pV, iV), aO = getGrowthValue(v, pO, iO), aF = getGrowthValue(v, pF, iF);
                            const mD = aD * (1.0 - aV) * (1.0 - aO) * (1.0 - aF), mV = aV * (1.0 - aO) * (1.0 - aF), mO = aO * (1.0 - aF), mF = aF;
                            let x = v.x, y = v.y, z = v.z;
                            morphTargets.forEach((attr, idx) => {
                                const mName = child.morphTargetDictionary ? Object.keys(child.morphTargetDictionary).find(k => child.morphTargetDictionary[k] === idx) : '';
                                const k = mName?.toLowerCase() || '';
                                const cName = child.name.toLowerCase();
                                let w = 0;

                                if (k.includes('desert')) w = mD;
                                else if (k.includes('volcan')) w = mV;
                                else if (k.includes('ocean')) w = mO;
                                else if (k.includes('forest') || (k === 'high' && influences['isCC'] !== 1.0)) w = mF;

                                // Handle Sequential Morph Weights for Comets and Clouds
                                if (influences['isCC'] === 1.0 && k === 'high' && mapping) {
                                    const p = influences['vVal'] || 0;
                                    const matchK = Object.keys(mapping).find(mk => cName.includes(mk.toLowerCase()));
                                    if (matchK) {
                                        const [start, end] = mapping[matchK];
                                        const growth = Math.min(1.0, Math.max(0.0, (p - start) / (end - start)));
                                        w = 1.0 - growth;
                                    }
                                }

                                if (cName.includes('ring_0')) w = iQ3;
                                else if (cName.includes('ring_1')) w = iQ3 > 0.5 ? Math.min(1.0, (iQ3 - 0.5) / 0.15) : 0;
                                else if (cName.includes('ring_2')) w = iQ3 > 0.65 ? Math.min(1.0, (iQ3 - 0.65) / 0.20) : 0;
                                else if (cName.includes('ring_3')) w = iQ3 > 0.85 ? Math.min(1.0, (iQ3 - 0.85) / 0.15) : 0;

                                // Restore boost for rings if they feel small
                                const boost = k.includes('ring') ? 1.4 : 1.8;

                                // Determine if morph target is relative or absolute per-mesh
                                // We check first vertex magnitude to decide (base vertices are ~250 units from origin)
                                const mX = attr.getX(i), mY = attr.getY(i), mZ = attr.getZ(i);
                                const isAbsolute = (mX * mX + mY * mY + mZ * mZ) > 2500; // > 50 units squared

                                const dx = isAbsolute ? (mX - v.x) : mX;
                                const dy = isAbsolute ? (mY - v.y) : mY;
                                const dz = isAbsolute ? (mZ - v.z) : mZ;

                                x += dx * w * boost;
                                y += dy * w * boost;
                                z += dz * w * boost;
                            });
                            pos.setXYZ(i, x, y, z);
                        }
                    }

                    // Construct final matrix in correct order: Scale * (InternalTransforms)
                    const currentScale = innerShell ? scale * 0.95 : scale;
                    const matrix = new THREE.Matrix4().makeScale(currentScale, currentScale, currentScale);

                    // Apply optional internal rotation (like the Forest tilt)
                    if (rotation) matrix.multiply(new THREE.Matrix4().makeRotationFromEuler(rotation));

                    // Apply mesh's inherent world matrix (Translation/Rotation from FBX)
                    matrix.multiply(child.matrixWorld);

                    // Track Negative Determinant indicating a Mirrored Geometry!
                    // This is the EXACT cause of the "Cloud Holes" bug: Mirrored geometries invert Normal Winding (CCW to CW).
                    const isMirrored = matrix.determinant() < 0;

                    geom.applyMatrix4(matrix);

                    const niGeom = geom.toNonIndexed();
                    const niPos = niGeom.getAttribute('position');
                    const cleanV: number[] = [];

                    // Triangle Pruning
                    for (let i = 0; i < niPos.count; i += 3) {
                        const v1 = new THREE.Vector3(niPos.getX(i), niPos.getY(i), niPos.getZ(i));
                        const v2 = new THREE.Vector3(niPos.getX(i + 1), niPos.getY(i + 1), niPos.getZ(i + 1));
                        const v3 = new THREE.Vector3(niPos.getX(i + 2), niPos.getY(i + 2), niPos.getZ(i + 2));

                        if (isForest) {
                            const iRot = neutralRotation.clone();
                            iRot.x *= -1; iRot.y *= -1; iRot.z *= -1;

                            const checkGrowth = (v: THREE.Vector3) => {
                                const originalPos = v.clone().applyEuler(iRot);
                                return getGrowthValue(originalPos, pF, iF) >= 0.2;
                            };

                            const keep1 = checkGrowth(v1);
                            const keep2 = checkGrowth(v2);
                            const keep3 = checkGrowth(v3);

                            if (!keep1 && !keep2 && !keep3) continue; // Fully transparent triangle, safe to drop natively

                            // Topological Edge Capper v3 (Micro-Skirt Sealing)!
                            // Instead of crashing canopy boundaries deep downwards (which created ugly stalactite geometries bleeding visibly towards 0,0 inside hollow bases),
                            // we mathematically drop the severed leaf vertices JUST beneath the lowest possible point of the planetary crust (85% depth, below the 88% ocean floor).
                            // This seamlessly stitches a miniature closed "skirt" that disappears harmlessly into the dirt, keeping the inner planet volume perfectly clean!
                            const plunge = (v: THREE.Vector3) => v.normalize().multiplyScalar(250 * baseScale * 0.85);
                            if (!keep1) plunge(v1);
                            if (!keep2) plunge(v2);
                            if (!keep3) plunge(v3);
                        }

                        // Ensure STRICT Standard Output Normals!
                        if (isMirrored) {
                            // Physically Reverse the Winding Order to force the mathematically negative normals back OUTWARD!
                            // This comprehensively prevents CSG Addition from treating negative objects as Subtractive Holes!
                            cleanV.push(v1.x, v1.y, v1.z, v3.x, v3.y, v3.z, v2.x, v2.y, v2.z);
                        } else {
                            cleanV.push(v1.x, v1.y, v1.z, v2.x, v2.y, v2.z, v3.x, v3.y, v3.z);
                        }
                    }
                    if (cleanV.length >= 9) {
                        const finalGeom = new THREE.BufferGeometry();
                        finalGeom.setAttribute('position', new THREE.Float32BufferAttribute(cleanV, 3));

                        const indexedGeom = ensureIndexed(finalGeom);

                        // Prevent CSG failure by skipping empty geometries
                        if (!indexedGeom.attributes.position || indexedGeom.attributes.position.count === 0 || !indexedGeom.index || indexedGeom.index.count === 0) {
                            return; // Return from traverse callback, safely skipping this mesh
                        }

                        const brush = new Brush(indexedGeom);
                        brush.updateMatrixWorld();

                        if (!finalBrush) {
                            finalBrush = brush;
                        } else {
                            if (finalBrush.geometry && finalBrush.geometry.index && finalBrush.geometry.index.count > 0) {
                                // Progressive Unified Welding natively deletes inner intersecting shells while perfectly stitching the surface!
                                finalBrush = evaluator.evaluate(finalBrush, brush, ADDITION);
                                finalBrush.geometry = ensureIndexed(finalBrush.geometry);
                            }
                        }
                    }
                }
            });
        };

        const vLogic = (n: string, p: number, m: Record<string, number[]>) => {
            const k = Object.keys(m).find(k => n.toLowerCase().includes(k.toLowerCase()));
            return k ? p > m[k][0] : false;
        };

        const cometMap = { 'optimized_1': [0.00, 0.15], 'optimized_2': [0.10, 0.30], 'optimized_3': [0.20, 0.45], 'optimized_4': [0.35, 0.60], 'optimized_5': [0.50, 0.75], 'optimized_6': [0.65, 0.85], 'optimized_7': [0.75, 0.95], 'optimized_8': [0.85, 1.00] };
        const cloudMap = { 'Cloud_1': [0.00, 0.15], 'Cloud_2': [0.10, 0.30], 'Cloud_3': [0.20, 0.40], 'Cloud_4': [0.35, 0.55], 'Cloud_5': [0.50, 0.70], 'Cloud_6': [0.65, 0.85], 'Cloud_7': [0.75, 0.95], 'Cloud_8': [0.85, 1.00] };

        // Process Outer Shell and Elements
        processGroup(baseFBX, baseScale, undefined, { 'Ocean': iO, 'Desert': iD, 'Volcano': iV, 'Forest': iF }, false, false, undefined, undefined, true);

        // Retrieve exactly measured crust Box to perform slice parameters algorithmically without helpers interfering
        let basePlanetBBox = new THREE.Box3();
        if (finalBrush && finalBrush.geometry) {
            finalBrush.geometry.computeBoundingBox();
            basePlanetBBox.copy(finalBrush.geometry.boundingBox!);
            basePlanetBBox.getCenter(planetCenter); // Pin exact spatial center!
        }

        processGroup(forestGLTF.scene, forestScale, new THREE.Euler(-1.5, 0, 0.05), { 'vVal': iF }, true, false, undefined, undefined, false);
        processGroup(ringFBX, ringScale, undefined, { 'vVal': iQ3 }, false, false, undefined, undefined, false);
        processGroup(cometsFBX, cometScale, undefined, { 'vVal': iQ4, 'isCC': 1.0 }, false, false, vLogic, cometMap, false);
        processGroup(cloudsFBX, cloudScale, undefined, { 'vVal': iQ5, 'isCC': 1.0 }, false, false, vLogic, cloudMap, false);

        if (mode === 'bracelet') {
            if (finalBrush && finalBrush.geometry && finalBrush.geometry.index && finalBrush.geometry.index.count > 0) {
                // Dynamically establish the exact geometric center using the model's actual Bounding Box
                finalBrush.geometry.computeBoundingBox();
                const bbox = finalBrush.geometry.boundingBox!;
                const centerY = ((bbox.max.y + bbox.min.y) / 2) + NECKLACE_TUNNEL_Y_OFFSET;

                // Optimized cylinder bounds (Pierces through even the most distant external Planetary Rings!)
                const cylinderGeom = new THREE.CylinderGeometry(NECKLACE_TUNNEL_RADIUS, NECKLACE_TUNNEL_RADIUS, 1000000 * baseScale, 32);
                cylinderGeom.rotateZ(Math.PI / 2); // Make horizontal
                
                // CSG Anti-aliasing! Roll the cylinder slightly by half a topological segment.
                // This violently solves mathematical topological gaps natively because it guarantees the cylinder faces never exactly geometrically align with horizontal/vertical universe grids!
                cylinderGeom.rotateX(Math.PI / 64); 
                
                cylinderGeom.translate(0, centerY, 0); // Parametrically translate center to exact target

                const indexedCylinder = ensureIndexed(cylinderGeom);
                const tunnelBrush = new Brush(indexedCylinder);
                tunnelBrush.updateMatrixWorld();

                finalBrush = evaluator.evaluate(finalBrush, tunnelBrush, SUBTRACTION);
                finalBrush.geometry = ensureIndexed(finalBrush.geometry);
            }
        }

        if (mode === 'necklace') {
            if (finalBrush && finalBrush.geometry && finalBrush.geometry.index && finalBrush.geometry.index.count > 0) {
                // Feature Pivot: Retire external Anilla mesh in favor of parametrically carving a dual-hole U-tube tunnel!
                const tunnelRadius = EXPORT_SCALES.HOLE_MAJOR_R * baseScale;
                const tunnelTube = EXPORT_SCALES.HOLE_MINOR_R * baseScale;

                // Torus dynamically generates a sweeping circular path perfectly engineered for necklace cords.
                const torusGeom = new THREE.TorusGeometry(tunnelRadius, tunnelTube, 32, 64);

                // Shift perfectly to the crust apex! The top arc exposes the holes, the lower arc hollows the crust.
                torusGeom.translate(
                    EXPORT_SCALES.HOLE_X_OFFSET * baseScale,
                    basePlanetBBox.max.y,
                    0
                );

                const indexedTorus = ensureIndexed(torusGeom);
                const torusBrush = new Brush(indexedTorus);
                torusBrush.updateMatrixWorld();

                // Natively subtract the Torus volume exactly like the 2Holes cylinder!
                finalBrush = evaluator.evaluate(finalBrush, torusBrush, SUBTRACTION);
                finalBrush.geometry = ensureIndexed(finalBrush.geometry);
            }
        }


        if (mode === 'lamp') {
            const height = basePlanetBBox.max.y - basePlanetBBox.min.y;
            const cutY = basePlanetBBox.max.y - (height * LAMP_FLAT_CUT_PERCENTAGE);

            const boxGeom = new THREE.BoxGeometry(1000 * baseScale, 500 * baseScale, 1000 * baseScale);
            // Lower the massive box so its top plane rests precisely flush on the mathematical parameter cut line
            boxGeom.translate(0, cutY - (250 * baseScale), 0);

            const boxBrush = new Brush(boxGeom);
            boxBrush.updateMatrixWorld();

            // Run CSG ONLY on the perfectly manifold base crust! Attempting this on open clouds corrupts them.
            if (finalBrush) {
                finalBrush = evaluator.evaluate(finalBrush, boxBrush, SUBTRACTION);

                // Compute the literal geometric footprint of the cut against the base sphere crust 
                const center = new THREE.Vector3();
                basePlanetBBox.getCenter(center);
                const radius = (basePlanetBBox.max.x - basePlanetBBox.min.x) / 2;
                const h = Math.abs(cutY - center.y);
                const actualCutRadius = Math.sqrt(Math.max(0, radius * radius - h * h));

                // THE USER OBLITERATOR: Subtract an explicit WIDER cylinder to organically consume/merge inner cloud tips globally natively!
                const widenerRadius = actualCutRadius + (32.0 * baseScale);
                const widenerHeight = 25.0 * baseScale;
                const widenerCeilY = cutY + widenerHeight;

                const widenerGeom = new THREE.CylinderGeometry(widenerRadius, widenerRadius, widenerHeight, 128);
                widenerGeom.translate(0, cutY + (widenerHeight / 2), 0);
                const widenerBrush = new Brush(widenerGeom);
                widenerBrush.updateMatrixWorld();

                finalBrush = evaluator.evaluate(finalBrush, widenerBrush, SUBTRACTION);

                // Strip the base faces entirely to satisfy the user's request for a 100% open hole without constructed CSG flat faces
                const flatRemovedGeom = finalBrush.geometry.toNonIndexed();
                const pos = flatRemovedGeom.getAttribute('position');
                const newPos = [];
                for (let i = 0; i < pos.count; i += 3) {
                    const v1x = pos.getX(i); const v1y = pos.getY(i); const v1z = pos.getZ(i);
                    const v2x = pos.getX(i + 1); const v2y = pos.getY(i + 1); const v2z = pos.getZ(i + 1);
                    const v3x = pos.getX(i + 2); const v3y = pos.getY(i + 2); const v3z = pos.getZ(i + 2);

                    // Drop CSG generated flat geometric cap loops natively.
                    if (Math.abs(v1y - cutY) < 1e-4 && Math.abs(v2y - cutY) < 1e-4 && Math.abs(v3y - cutY) < 1e-4) continue;

                    // Unconditionally drop the ceiling generated by the Widener Cylinder mathematically opening the hollow dome structurally
                    if (Math.abs(v1y - widenerCeilY) < 1e-4 && Math.abs(v2y - widenerCeilY) < 1e-4 && Math.abs(v3y - widenerCeilY) < 1e-4) continue;

                    // Perfect Flat Array Slicer:
                    // If three-bvh-csg failed to Boolean slice open non-manifold husks (like 2D clouds or forest leaves), they leak down beneath the plane!
                    const eps = 1e-4;
                    if (v1y >= cutY - eps && v2y >= cutY - eps && v3y >= cutY - eps) {
                        // Completely above the floor, keep natively!
                        newPos.push(v1x, v1y, v1z, v2x, v2y, v2z, v3x, v3y, v3z);
                        continue;
                    }
                    if (v1y <= cutY + eps && v2y <= cutY + eps && v3y <= cutY + eps) {
                        // Completely beneath the floor, eradicate!
                        continue;
                    }

                    // Overlapping Sub-triangle Intersection Extractor! 
                    // Guarantees an invincible, flawlessly flat boundary slice cut identical to a top-tier Boolean subtractor without needing complex edge-graphs!
                    const v = [
                        { x: v1x, y: v1y, z: v1z },
                        { x: v2x, y: v2y, z: v2z },
                        { x: v3x, y: v3y, z: v3z }
                    ];
                    let aboveCount = 0;
                    if (v1y >= cutY) aboveCount++;
                    if (v2y >= cutY) aboveCount++;
                    if (v3y >= cutY) aboveCount++;

                    const intersect = (p1: any, p2: any) => {
                        const t = (cutY - p1.y) / (p2.y - p1.y);
                        return { x: p1.x + t * (p2.x - p1.x), y: cutY, z: p1.z + t * (p2.z - p1.z) };
                    };

                    if (aboveCount === 1) {
                        // Creates 1 clipped triangle natively on the upper bounds conserving winding
                        let A, B, C;
                        if (v[0].y >= cutY) { A = v[0]; B = v[1]; C = v[2]; }
                        else if (v[1].y >= cutY) { A = v[1]; B = v[2]; C = v[0]; }
                        else { A = v[2]; B = v[0]; C = v[1]; }

                        const iAB = intersect(A, B);
                        const iAC = intersect(A, C);
                        newPos.push(A.x, A.y, A.z, iAB.x, iAB.y, iAB.z, iAC.x, iAC.y, iAC.z);
                    } else if (aboveCount === 2) {
                        // Creates 2 clipped triangles natively on the upper bounds conserving winding
                        let C, A, B; // C is the singular below vertex
                        if (v[0].y < cutY) { C = v[0]; A = v[1]; B = v[2]; }
                        else if (v[1].y < cutY) { C = v[1]; A = v[2]; B = v[0]; }
                        else { C = v[2]; A = v[0]; B = v[1]; }

                        const iCA = intersect(C, A);
                        const iCB = intersect(C, B);
                        newPos.push(A.x, A.y, A.z, B.x, B.y, B.z, iCA.x, iCA.y, iCA.z);
                        newPos.push(B.x, B.y, B.z, iCB.x, iCB.y, iCB.z, iCA.x, iCA.y, iCA.z);
                    }
                }
                const newGeom = new THREE.BufferGeometry();
                newGeom.setAttribute('position', new THREE.Float32BufferAttribute(newPos, 3));
                finalBrush.geometry = ensureIndexed(newGeom);
            }
        }

        const finalGeometries: THREE.BufferGeometry[] = [];
        if (finalBrush && finalBrush.geometry) {
            finalGeometries.push(finalBrush.geometry.clone());
        }

        const exportGroup = new THREE.Group();

        finalGeometries.forEach(geom => {
            // Apply the global layout rotation uniformly to every independent mesh!
            geom.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(neutralRotation));
            geom.computeVertexNormals();
            exportGroup.add(new THREE.Mesh(geom, new THREE.MeshStandardMaterial()));
        });

        exportGroup.updateMatrixWorld(true);

        const exporter = new STLExporter();
        const stlBinary = exporter.parse(exportGroup, { binary: true });
        return new Blob([stlBinary], { type: 'application/octet-stream' });
    };

    const handleDownloadSTL = async (mode: 'lamp' | 'necklace' | 'bracelet' = 'lamp') => {
        setIsGenerating(true);
        try {
            const blob = await bakeMeshHollow(elementValues, mode);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `planet_artifact_${mode}.stl`;
            a.click();
        } catch (e) {
            console.error(e);
        }
        setIsGenerating(false);
    };

    const handleEmailSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        handleSubmit();
    };

    const handleSubmit = async () => {
        if (submitting) return;
        setSubmitting(true);
        try {
            const answersArray = quizQuestions.map(q => ({
                questionId: q.id,
                statement: q.statement,
                score: allAnswers[q.id] || 0
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
        <section id="quiz" className={`${styles.quizSection} ${(view === 'email' || view === 'success') ? styles.emailViewLayout : ''}`}>
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
                            {/* Planet Drag Instruction */}
                            <div className={`${styles.dragInstructionOverlay} ${(showIdleOverlay && isQuizReady && !hasRotatedPlanet) ? styles.active : styles.hidden}`}>
                                <RotateIcon className={`${styles.instructionIcon} ${styles.spinIcon}`} />
                                <span className={styles.dragText}>Drag to rotate<br />the planet</span>
                            </div>

                            <div
                                className={`${styles.globalPlanetContainer} ${styles.globalPlanetVisible}`}
                                style={{ '--glow-color': currentGlowColor } as React.CSSProperties}
                            >
                                {/* Dual STL Export Buttons */}
                                <div className={styles.exportButtonsContainer}>
                                    <button
                                        className={styles.exportPlanetBtn}
                                        onClick={() => handleDownloadSTL('lamp')}
                                        disabled={isGenerating}
                                        title="Export as Lamp (Flat Base)"
                                    >
                                        <Download size={14} />
                                        <span>{isGenerating ? 'Baking...' : 'Export Lamp'}</span>
                                    </button>
                                    <button
                                        className={styles.exportPlanetBtn}
                                        onClick={() => handleDownloadSTL('necklace')}
                                        disabled={isGenerating}
                                        title="Export as Necklace (Full Sphere + Bail)"
                                    >
                                        <Download size={14} />
                                        <span>{isGenerating ? 'Baking...' : 'Export Necklace'}</span>
                                    </button>
                                    <button
                                        className={styles.exportPlanetBtn}
                                        onClick={() => handleDownloadSTL('bracelet')}
                                        disabled={isGenerating}
                                        title="Export Bracelet"
                                    >
                                        <Download size={14} />
                                        <span>{isGenerating ? 'Baking...' : 'Export Bracelet'}</span>
                                    </button>
                                </div>

                                <div className={styles.planetVisual} onPointerDown={() => setHasRotatedPlanet(true)}>
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
                                            '--thumb-bg': SLIDER_COLORS[currentQuestionIndex] || '#6366f1',
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
                                    {currentQuestionIndex === quizQuestions.length - 1 ? 'Next question' : 'Next question'} <ArrowRight />
                                </button>
                            </div>
                        </div>
                    </>
                )}

                {view === 'email' && (
                    <>
                        {/* 🕹️ ADJUST THE EMAILS BACKGROUND PLANET HERE */}
                        <div
                            className={styles.emailPlanetBackground}
                            style={{
                                '--bg-planet-scale': '0.9',
                                '--bg-planet-scale-mobile': '0.7', // Synced with latest CSS edit
                                '--bg-planet-blur': '12px'
                            } as React.CSSProperties}
                        >
                            <Suspense fallback={null}>
                                <UnifiedArtifactRenderer
                                    values={elementOptions.map(opt => elementValues[opt.id])}
                                    materialOverride={'digital'}
                                />
                            </Suspense>
                        </div>
                        <div className={styles.emailForm}>
                            <div className={styles.emailHeader}>
                                <h1 className={styles.almostDoneTitle}>Almost done!</h1>
                                <p className={styles.emailSubtitle}>Get your Digital planet + your test results!</p>
                            </div>
                            <div className={styles.emailBottom}>
                                <form onSubmit={handleEmailSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1.5rem', alignItems: 'center' }}>
                                    <input type="text" required placeholder="Your Name" value={userName} onChange={(e) => setUserName(e.target.value)} className={styles.emailInput} />
                                    <input type="number" required placeholder="Age" value={userAge} onChange={(e) => setUserAge(e.target.value)} className={styles.emailInput} />
                                    <input type="email" required placeholder="enter@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className={styles.emailInput} />
                                    <button type="submit" className={`${styles.continueBtn} ${styles.emailSubmitBtn}`} disabled={submitting}>
                                        {submitting ? 'Transmitting...' : 'Get my Plan3d!'}
                                    </button>
                                </form>
                            </div>
                        </div>
                    </>
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
                                let matOverride: 'lamp' | 'necklace' | 'bracelet' | undefined = undefined;
                                if (artifact.label.toLowerCase().includes('lamp')) matOverride = 'lamp';
                                if (artifact.label.toLowerCase().includes('necklace')) matOverride = 'necklace';
                                if (artifact.label.toLowerCase().includes('bracelet')) matOverride = 'bracelet';

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
                                                <UnifiedArtifactRenderer
                                                    values={elementOptions.map(opt => elementValues[opt.id])}
                                                    materialOverride={matOverride || 'digital'}
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

                        <div className={styles.quizNavigationButtons}>
                            <button
                                className={styles.navControlBtn}
                                onClick={() => setView('quiz')}
                            >
                                <ArrowLeft /> Back
                            </button>
                            <button
                                className={`${styles.navControlBtn} ${styles.primary}`}
                                onClick={() => setView('email')}
                                disabled={submitting}
                            >
                                {submitting ? 'Transmitting...' : 'Finish'} <ArrowRight />
                            </button>
                        </div>
                    </div>
                )}

                {view === 'success' && (
                    <>
                        <div
                            className={styles.emailPlanetBackground}
                            style={{
                                '--bg-planet-scale': '0.9',
                                '--bg-planet-scale-mobile': '0.7',
                                '--bg-planet-blur': '12px'
                            } as React.CSSProperties}
                        >
                            <Suspense fallback={null}>
                                <UnifiedArtifactRenderer
                                    values={elementOptions.map(opt => elementValues[opt.id])}
                                    materialOverride={'digital'}
                                />
                            </Suspense>
                        </div>
                        <div className={styles.emailForm}>
                            <div className={styles.emailHeader}>
                                <h1 className={styles.almostDoneTitle}>Thanks, Transmission Received!</h1>
                                <p className={styles.emailSubtitle}>We will send you an email with your planet when is ready!</p>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '2rem' }}>

                            </div>
                        </div>
                    </>
                )}
            </div>

            {isGenerating && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexDirection: 'column' }}>
                    <div style={{ width: '40px', height: '40px', border: '3px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                    <h3 style={{ marginTop: '1rem', letterSpacing: '2px', fontFamily: 'monospace' }}>BAKING HOLLOW GEOMETRY...</h3>
                    <p style={{ opacity: 0.7, fontSize: '0.9rem' }}>This may take ~10 seconds. Slicing dual-shells for LED insertion.</p>
                </div>
            )}
        </section >
    );
}
