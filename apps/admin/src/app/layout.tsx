import type { Metadata } from 'next';
import '../styles/admin.css';
import '../styles/moh-interior.css';

export const metadata: Metadata = {
  title: 'Ministry of Health, Akwa Ibom State • State Health Command & Oversight',
  description: 'Akwa Ibom State Ministry of Health command console: live hospital census telemetry, disease surveillance, public finance, and regulatory compliance.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Outfit:wght@500;600;700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
