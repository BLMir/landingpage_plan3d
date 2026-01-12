'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import styles from './Carousel.module.css';

interface CarouselProps {
    images: string[];
    interval?: number;
    onIndexChange?: (index: number) => void;
}

export default function Carousel({ images, interval = 5000, onIndexChange }: CarouselProps) {
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        if (images.length <= 1) return;

        const timer = setInterval(() => {
            setCurrentIndex((prevIndex) => (prevIndex + 1) % images.length);
        }, interval);

        return () => clearInterval(timer);
    }, [images.length, interval]);

    useEffect(() => {
        onIndexChange?.(currentIndex);
    }, [currentIndex, onIndexChange]);

    const goToIndex = (index: number) => {
        setCurrentIndex(index);
        onIndexChange?.(index);
    };

    if (!images || images.length === 0) {
        return null;
    }

    return (
        <div className={styles.carousel}>
            {images.map((src, index) => (
                <div
                    key={src}
                    className={`${styles.imageContainer} ${index === currentIndex ? styles.active : ''}`}
                >
                    <Image
                        src={src}
                        alt={`Carousel image ${index + 1}`}
                        fill
                        style={{ objectFit: 'cover' }}
                        priority={index === 0}
                        sizes="(max-width: 768px) 300px, 400px"
                    />
                </div>
            ))}

            {images.length > 1 && (
                <div className={styles.dots}>
                    {images.map((_, index) => (
                        <button
                            key={index}
                            className={`${styles.dot} ${index === currentIndex ? styles.active : ''}`}
                            onClick={() => goToIndex(index)}
                            aria-label={`Go to image ${index + 1}`}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
