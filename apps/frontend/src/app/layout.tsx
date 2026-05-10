import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { Instrument_Serif } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';
import { Toaster } from '@/components/ui/toaster';

const instrumentSerif = Instrument_Serif({
  subsets: ['latin', 'latin-ext'],
  weight: '400',
  style: ['normal', 'italic'],
  variable: '--font-serif',
  display: 'swap',
});

export const metadata: Metadata = { title: 'UniLMS', description: 'Academic Management Platform' };

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
        <Providers>{children}<Toaster /></Providers>
      </body>
    </html>
  );
}
