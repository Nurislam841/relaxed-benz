import type { Metadata } from 'next';

/**
 * Public-facing auth routes can be indexed by search engines.
 * Overrides the global `robots: { index: false }` from the root layout.
 */
export const metadata: Metadata = {
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: 'website',
    siteName: 'UniLMS',
    title: 'Sign in to UniLMS',
    description: 'AI-native learning management system. Sign in or create a new account.',
  },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
