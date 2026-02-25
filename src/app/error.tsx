'use client';

import { useEffect } from 'react';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log the error to an error reporting service
        console.error(error);
    }, [error]);

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            backgroundColor: '#050505',
            color: '#fff',
            fontFamily: 'system-ui, sans-serif',
            textAlign: 'center',
            padding: '20px'
        }}>
            <h2 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Something went wrong!</h2>
            <p style={{ color: '#888', marginBottom: '2rem' }}>
                {error.message || 'An unexpected error occurred.'}
            </p>
            <button
                onClick={() => reset()}
                style={{
                    padding: '12px 24px',
                    backgroundColor: '#fff',
                    color: '#000',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    fontWeight: '600'
                }}
            >
                Try again
            </button>
            <div style={{ marginTop: '2rem' }}>
                <a href="/yourplan3d" style={{ color: '#3b82f6', textDecoration: 'none' }}>Return to Home</a>
            </div>
        </div>
    );
}
