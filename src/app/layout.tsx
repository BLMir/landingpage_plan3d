import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Planet 5 | Your Personality in 3D',
  description: 'Generate a unique 3D printed planet based on your Big 5 personality traits.',
  icons: {
    icon: '/Logo color.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
