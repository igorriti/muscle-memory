import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'muscle-memory',
  description: 'Agents that learn',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body style={{ margin: 0, fontFamily: "'Geist', sans-serif", color: '#1a1a1a', background: '#fff' }}>
        {children}
      </body>
    </html>
  );
}
