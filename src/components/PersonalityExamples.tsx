import styles from './PersonalityExamples.module.css';

type Example = {
    name: string;
    role: string;
    traits: string[];
    description: string;
    planetColor: string;
    planetTexture: string; // CSS value for texture/gradient
};

const examples: Example[] = [
    {
        name: "The Visionary",
        role: "High Openness & Extraversion",
        traits: ["Creative", "Curious", "Outgoing"],
        description: "A planet with soaring crystalline peaks and vibrant, shifting auroras. Reflects a mind that is always exploring new heights.",
        planetColor: "linear-gradient(135deg, #a855f7, #ec4899)",
        planetTexture: "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.4) 0%, transparent 10%)"
    },
    {
        name: "The Guardian",
        role: "High Conscientiousness & Agreeableness",
        traits: ["Organized", "Empathetic", "Reliable"],
        description: "A stable, lush world with calm oceans and geometric landmasses. Represents harmony, structure, and nurturing energy.",
        planetColor: "linear-gradient(135deg, #10b981, #3b82f6)",
        planetTexture: "repeating-linear-gradient(45deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 10px, transparent 10px, transparent 20px)"
    },
    {
        name: "The Analyst",
        role: "High Neuroticism & Conscientiousness",
        traits: ["Detail-oriented", "Cautious", "Precise"],
        description: "A complex, stormy world with deep canyons and intricate cave systems. Symbolizes depth of thought and intense internal processing.",
        planetColor: "linear-gradient(135deg, #f59e0b, #ef4444)",
        planetTexture: "linear-gradient(transparent 50%, rgba(0,0,0,0.2) 50%)"
    }
];

export default function PersonalityExamples() {
    return (
        <section className={styles.container}>
            <h2 className={styles.title}>Every Personality creates a <span className={styles.highlight}>Unique World</span></h2>
            <div className={styles.grid}>
                {examples.map((ex, i) => (
                    <div key={i} className={styles.card}>
                        <div className={styles.planetPreview}>
                            <div
                                className={styles.planet}
                                style={{ background: ex.planetColor }}
                            >
                                <div className={styles.texture} style={{ background: ex.planetTexture }}></div>
                            </div>
                        </div>
                        <div className={styles.content}>
                            <h3 className={styles.name}>{ex.name}</h3>
                            <p className={styles.role}>{ex.role}</p>
                            <div className={styles.tags}>
                                {ex.traits.map(t => <span key={t} className={styles.tag}>{t}</span>)}
                            </div>
                            <p className={styles.description}>{ex.description}</p>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}
