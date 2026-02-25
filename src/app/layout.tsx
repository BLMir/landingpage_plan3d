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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Outfit:ital,wght@0,300;0,400;0,600;0,700;1,300;1,400;1,600;1,700&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
