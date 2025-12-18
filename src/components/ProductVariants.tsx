import styles from './ProductVariants.module.css';

const products = [
    {
        title: "Planet Lamp",
        description: "A mesmerizing 3D printed lithophane lamp. When lit, your personality terrain glows, revealing the hidden depths of your character.",
        icon: "💡"
    },
    {
        title: "Cosmic Jewelry",
        description: "Wear your world. High-detail resin prints plated in silver or gold, turning your unique topography into a stunning pendant or ring.",
        icon: "💎"
    },
    {
        title: "Pocket World (Keychain)",
        description: "A durable, tactile sphere you can carry everywhere. a constant reminder of your unique psychological landscape.",
        icon: "🔑"
    }
];

export default function ProductVariants() {
    return (
        <section className={styles.container}>
            <h2 className={styles.heading}>Bring Your World to Life</h2>
            <p className={styles.subheading}>Choose how you want to manifest your personality.</p>

            <div className={styles.grid}>
                {products.map((p, i) => (
                    <div key={i} className={styles.card}>
                        <div className={styles.icon}>{p.icon}</div>
                        <h3 className={styles.title}>{p.title}</h3>
                        <p className={styles.description}>{p.description}</p>
                    </div>
                ))}
            </div>
        </section>
    );
}
