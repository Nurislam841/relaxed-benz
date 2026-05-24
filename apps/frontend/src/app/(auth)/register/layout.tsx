import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Create account',
  description: 'Register for a UniLMS account to join courses, take live quizzes, and track your academic progress.',
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
