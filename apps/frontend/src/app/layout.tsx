import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { Instrument_Serif } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';
import { Toaster } from '@/components/ui/toaster';
import { TelegramWebAppBootstrap } from '@/components/telegram-webapp-bootstrap';
import Script from 'next/script';

const instrumentSerif = Instrument_Serif({
  subsets: ['latin', 'latin-ext'],
  weight: '400',
  style: ['normal', 'italic'],
  variable: '--font-serif',
  display: 'swap',
  // Next.js 14 doesn't ship font metrics for Instrument Serif and `next build`
  // bombs with "Failed to find font override values" at build time. Disabling
  // adjust-font-fallback skips that computation — the font still renders fine
  // in browsers; we just lose the CLS-optimised system-font fallback layer.
  adjustFontFallback: false,
});

// Site-wide metadata. Per-page metadata in (auth)/login etc. extends this.
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: {
    default: 'UniLMS — Academic Management Platform',
    template: '%s · UniLMS',
  },
  description:
    'Trilingual learning management system with AI study coach, live quizzes, plagiarism detection, and academic transcripts.',
  applicationName: 'UniLMS',
  keywords: ['LMS', 'university', 'AI study coach', 'quiz', 'gradebook', 'academic'],
  authors: [{ name: 'UniLMS' }],
  openGraph: {
    type: 'website',
    siteName: 'UniLMS',
    title: 'UniLMS — Academic Management Platform',
    description: 'AI-native learning management system with live quizzes, plagiarism detection, and gradebooks.',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'UniLMS — Academic Management Platform',
    description: 'AI-native LMS with live quizzes and trilingual UI.',
  },
  robots: {
    // Authenticated app pages shouldn't be indexed; (auth) login pages should.
    // Per-route overrides handle the exceptions.
    index: false,
    follow: false,
  },
  icons: {
    icon: '/favicon.ico',
  },
};

// Inline script prevents flash of wrong theme on first load
const themeScript = `
  (function(){
    try {
      var t = localStorage.getItem('theme');
      if (t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
      }
      var d = localStorage.getItem('density');
      if (d) document.documentElement.setAttribute('data-density', d);
    } catch(e){}
  })();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable} ${instrumentSerif.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="font-sans">
        {/* Telegram WebApp script — Phase 4.1. Loads from telegram.org so
            window.Telegram.WebApp is available before the bootstrap runs.
            Cheap (~5KB) and a no-op outside a Mini App context, so we don't
            gate it on a query param. */}
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="afterInteractive" />
        <Providers>
          <TelegramWebAppBootstrap />
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
