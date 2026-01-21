import Hero from '@/components/Hero';
import PersonalityForm from '@/components/PersonalityForm';
import WorldQuiz from '@/components/WorldQuiz';

export default function Home() {
  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Hero />
      <WorldQuiz />
      <PersonalityForm />
      <footer style={{
        textAlign: 'center',
        padding: '2rem',
        borderTop: '1px solid var(--border)',
        marginTop: 'auto',
        color: '#666'
      }}>
        <p>© 2024 Planet 5 Labs. Bringing your personality to the physical world.</p>
      </footer>
    </main>
  );
}
