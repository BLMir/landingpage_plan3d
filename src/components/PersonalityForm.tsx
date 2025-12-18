'use client';

import { useState } from 'react';
import styles from './PersonalityForm.module.css';

const productOptions = [
    { id: 'lamp', label: 'Planet Lamp', icon: '💡' },
    { id: 'jewelry', label: 'Cosmic Jewelry', icon: '💎' },
    { id: 'keychain', label: 'Pocket World', icon: '🔑' },
];

export default function PersonalityForm() {
    const [email, setEmail] = useState('');
    const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [completed, setCompleted] = useState(false);
    const [error, setError] = useState('');

    const isEmailValid = email.includes('@') && email.includes('.');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedProduct) {
            setError('Please select a product format.');
            return;
        }

        setSubmitting(true);
        setError('');

        try {
            const res = await fetch('/api/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email,
                    selectedProduct,
                    type: 'interest_signup',
                    timestamp: new Date().toISOString(),
                }),
            });

            if (!res.ok) throw new Error('Failed to submit');
            setCompleted(true);
        } catch (err) {
            setError('Something went wrong. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    if (completed) {
        return (
            <div className={styles.container}>
                <div className={styles.successCard}>
                    <h2>You're on the list!</h2>
                    <p>We've saved your spot for the <strong>{productOptions.find(p => p.id === selectedProduct)?.label}</strong>.</p>
                    <p>Watch your inbox ({email}) for the launch.</p>
                </div>
            </div>
        );
    }

    return (
        <section className={styles.container} id="form">
            <div className={styles.splitLayout}>
                <div className={styles.infoSide}>
                    <h2 className={styles.heading}>How it Works</h2>
                    <p className={styles.description}>
                        We use the scientific <strong>Big 5 Personality Model</strong> to map your mind onto a physical sphere.
                    </p>
                    <ul className={styles.steps}>
                        <li>
                            <span className={styles.stepNum}>1</span>
                            <div>
                                <strong>The Questionnaire</strong>
                                <p>You answer a set of questions designed to measure Openness, Conscientiousness, Extraversion, Agreeableness, and Neuroticism.</p>
                            </div>
                        </li>
                        <li>
                            <span className={styles.stepNum}>2</span>
                            <div>
                                <strong>The Algorithm</strong>
                                <p>Our engine translates your trait scores into terrain features. High Openness creates tall peaks; High Agreeableness forms smooth valleys.</p>
                            </div>
                        </li>
                        <li>
                            <span className={styles.stepNum}>3</span>
                            <div>
                                <strong>The Artifact</strong>
                                <p>We 3D print your unique world into a lamp, jewelry, or keepsake.</p>
                            </div>
                        </li>
                    </ul>
                </div>

                <div className={styles.formSide}>
                    <div className={styles.formCard}>
                        <h3>Start Your Journey</h3>
                        <p>Enter your email to reveal product options.</p>
                        <form onSubmit={handleSubmit} className={styles.form}>
                            <div className={styles.emailSection}>
                                <label className={styles.label}>Email Address</label>
                                <input
                                    type="email"
                                    required
                                    placeholder="your@email.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className={styles.input}
                                />
                            </div>

                            <div className={`${styles.productSelection} ${isEmailValid ? styles.visible : ''}`}>
                                <p className={styles.selectionLabel}>Which format do you prefer?</p>
                                <div className={styles.optionsGrid}>
                                    {productOptions.map((option) => (
                                        <div
                                            key={option.id}
                                            className={`${styles.optionCard} ${selectedProduct === option.id ? styles.selected : ''}`}
                                            onClick={() => setSelectedProduct(option.id)}
                                        >
                                            <span className={styles.optionIcon}>{option.icon}</span>
                                            <span className={styles.optionLabel}>{option.label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {error && <p className={styles.error}>{error}</p>}

                            <button
                                type="submit"
                                disabled={submitting || !isEmailValid || !selectedProduct}
                                className={styles.submitBtn}
                            >
                                {submitting ? 'Joining...' : 'Get Early Access'}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </section>
    );
}
