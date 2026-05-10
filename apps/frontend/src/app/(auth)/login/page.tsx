'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useLogin } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/form-elements';
import { GraduationCap, Loader2, BookOpen, Users, BarChart3, Sparkles } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Eyebrow } from '@/components/ds/eyebrow';
import { HDisplay } from '@/components/ds/h-display';
import { cn } from '@/lib/utils';

const DEMO = [
  { role: 'Admin',   email: 'admin@uni.kz',    pass: 'Admin123!' },
  { role: 'Teacher', email: 'teacher1@uni.kz', pass: 'Teacher123!' },
  { role: 'Student', email: 'student1@uni.kz', pass: 'Student123!' },
];

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const login = useLogin();

  const go = (e: React.FormEvent) => {
    e.preventDefault();
    login.mutate({ email, password }, {
      onError: (err) => toast({ title: 'Login failed', description: err.message, variant: 'destructive' }),
    });
  };

  const fill = (e: string, p: string) => { setEmail(e); setPassword(p); };

  return (
    <div className="min-h-screen flex bg-[var(--bg)]">
      {/* Left hero panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden bg-[var(--bg-subtle)]">
        {/* Background decoration */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(circle at 20% 80%, color-mix(in oklch, var(--accent-500), transparent 80%), transparent 50%), radial-gradient(circle at 80% 20%, color-mix(in oklch, var(--accent-700), transparent 88%), transparent 50%)',
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(var(--grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--grid-line) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />

        {/* Brand */}
        <div className="relative flex items-center gap-3">
          <div
            className="relative w-9 h-9 rounded-[8px]"
            style={{
              background: 'linear-gradient(135deg, var(--accent-500), var(--accent-700))',
              boxShadow: 'var(--shadow-md), inset 0 1px 0 rgba(255,255,255,0.2)',
            }}
          >
            <span
              aria-hidden
              className="absolute inset-[7px] rounded-[5px] mix-blend-overlay"
              style={{
                background:
                  'radial-gradient(circle at 30% 30%, rgba(255,255,255,.85), transparent 50%), conic-gradient(from 200deg, transparent, rgba(255,255,255,.4), transparent)',
              }}
            />
          </div>
          <span className="font-serif italic text-[24px] tracking-[-0.01em] text-[var(--fg)]">
            UniLMS
          </span>
          <Eyebrow className="ml-1">Learning OS</Eyebrow>
        </div>

        {/* Hero text */}
        <div className="relative space-y-6">
          <Eyebrow>Trilingual · AI-native · Self-hosted</Eyebrow>
          <HDisplay size="xl">
            Learning<br />
            <em>Operating</em>
            <br />
            System
          </HDisplay>
          <p className="text-[var(--fg-muted)] text-[16px] leading-[1.55] max-w-md">
            Intelligent. Connected. Adaptive.
            <br />
            The future of education is here — built for Kazakhstan, ready for the world.
          </p>
          <div className="flex gap-6 pt-3">
            {[
              { icon: BookOpen, label: 'Course Management' },
              { icon: Sparkles, label: 'AI-powered' },
              { icon: BarChart3, label: 'Insights' },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex flex-col items-start gap-2">
                <div
                  className="h-10 w-10 rounded-[10px] flex items-center justify-center border"
                  style={{
                    background: 'var(--accent-100)',
                    borderColor: 'var(--accent-200)',
                  }}
                >
                  <Icon className="h-4 w-4 text-[var(--accent-700)]" />
                </div>
                <span className="text-[11px] text-[var(--fg-muted)] font-mono uppercase tracking-[0.06em]">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-[11px] font-mono text-[var(--fg-subtle)] uppercase tracking-[0.06em]">
          © 2026 UniLMS · all rights reserved
        </p>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-8 bg-[var(--bg)]">
        <div className="w-full max-w-sm space-y-7">
          {/* Mobile brand */}
          <div className="lg:hidden flex items-center justify-center gap-3">
            <div
              className="w-8 h-8 rounded-[7px]"
              style={{ background: 'linear-gradient(135deg, var(--accent-500), var(--accent-700))' }}
            />
            <span className="font-serif italic text-[22px] text-[var(--fg)]">UniLMS</span>
          </div>

          {/* Header */}
          <div className="flex flex-col items-center gap-3">
            <div
              className="h-14 w-14 rounded-full border flex items-center justify-center"
              style={{
                background: 'var(--accent-100)',
                borderColor: 'var(--accent-300)',
              }}
            >
              <GraduationCap className="h-7 w-7 text-[var(--accent-700)]" />
            </div>
            <div className="text-center space-y-1">
              <h2 className="font-serif text-[28px] tracking-[-0.015em] text-[var(--fg)] leading-tight">
                Welcome back
              </h2>
              <p className="text-[13px] text-[var(--fg-muted)]">
                Sign in to access your learning environment
              </p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={go} className="space-y-3.5">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@university.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pw">Password</Label>
              <Input
                id="pw"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full mt-1"
              disabled={login.isPending}
            >
              {login.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Access System
            </Button>
          </form>

          <p className="text-center text-[13px] text-[var(--fg-muted)]">
            New here?{' '}
            <Link
              href="/register"
              className="text-[var(--accent-700)] hover:underline font-medium"
            >
              Create an account
            </Link>
          </p>

          {/* Demo credentials */}
          <div
            className="rounded-[10px] border border-[var(--border-color)] p-4 space-y-3"
            style={{ background: 'var(--bg-subtle)' }}
          >
            <Eyebrow>Demo credentials</Eyebrow>
            <div className="space-y-1.5">
              {DEMO.map(({ role, email: e, pass: p }) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => fill(e, p)}
                  className={cn(
                    'w-full flex items-center justify-between rounded-[7px] px-3 py-2',
                    'bg-[var(--surface)] hover:bg-[var(--bg-muted)]',
                    'border border-[var(--border-color)] hover:border-[var(--accent-300)]',
                    'transition-colors duration-ds-fast text-left'
                  )}
                >
                  <span className="text-[13px] font-medium text-[var(--fg)]">{role}</span>
                  <span className="text-[11px] text-[var(--fg-muted)] font-mono">{e}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
