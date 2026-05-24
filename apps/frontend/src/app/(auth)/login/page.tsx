'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useLogin } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/form-elements';
import { GraduationCap, Loader2, BookOpen, BarChart3, Sparkles, ShieldCheck, ArrowLeft } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Eyebrow } from '@/components/ds/eyebrow';
import { HDisplay } from '@/components/ds/h-display';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { loginSchema, formatZodErrors } from '@/lib/validation';
import { ApiError } from '@/lib/api';

const DEMO = [
  { roleKey: 'roleAdmin', email: 'admin@uni.kz', pass: 'Admin123!' },
  { roleKey: 'roleTeacher', email: 'teacher1@uni.kz', pass: 'Teacher123!' },
  { roleKey: 'roleStudent', email: 'student1@uni.kz', pass: 'Student123!' },
] as const;

export default function LoginPage() {
  const t = useT();
  const lp = (t as any).loginPage;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [requires2fa, setRequires2fa] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const login = useLogin();

  const submitWithTotp = (code: string) => {
    login.mutate(
      { email, password, totpCode: code },
      {
        onError: (err) => {
          if (err instanceof ApiError && err.body?.requires2fa) {
            setRequires2fa(true);
            return;
          }
          toast({ title: lp.loginFailed, description: err.message, variant: 'destructive' });
        },
      },
    );
  };

  const go = (e: React.FormEvent) => {
    e.preventDefault();
    if (requires2fa) {
      if (!/^\d{6}$/.test(totpCode)) {
        setErrors({ totp: 'Enter the 6-digit code from your authenticator app' });
        return;
      }
      setErrors({});
      submitWithTotp(totpCode);
      return;
    }
    const parsed = loginSchema.safeParse({ email, password });
    const fieldErrors = formatZodErrors(parsed);
    if (fieldErrors) {
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    login.mutate(
      { email, password },
      {
        onError: (err) => {
          if (err instanceof ApiError && err.body?.requires2fa) {
            setRequires2fa(true);
            return;
          }
          toast({ title: lp.loginFailed, description: err.message, variant: 'destructive' });
        },
      },
    );
  };

  const backToPassword = () => {
    setRequires2fa(false);
    setTotpCode('');
    setErrors({});
  };

  const fill = (e: string, p: string) => {
    setEmail(e);
    setPassword(p);
    setErrors({});
    setRequires2fa(false);
    setTotpCode('');
  };

  return (
    <div className="min-h-screen flex bg-[var(--bg)]">
      {/* Left hero panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden bg-[var(--bg-subtle)]">
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
          <span className="font-serif italic text-[24px] tracking-[-0.01em] text-[var(--fg)]">UniLMS</span>
          <Eyebrow className="ml-1">{lp.brand}</Eyebrow>
        </div>

        <div className="relative space-y-6">
          <Eyebrow>{lp.tagline}</Eyebrow>
          <HDisplay size="xl">
            {lp.heroLine1}
            <br />
            <em>{lp.heroLine2}</em>
            <br />
            {lp.heroLine3}
          </HDisplay>
          <p className="text-[var(--fg-muted)] text-[16px] leading-[1.55] max-w-md">
            {lp.heroSubtitle1}
            <br />
            {lp.heroSubtitle2}
          </p>
          <div className="flex gap-6 pt-3">
            {[
              { icon: BookOpen, label: lp.featureCourse },
              { icon: Sparkles, label: lp.featureAi },
              { icon: BarChart3, label: lp.featureInsights },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex flex-col items-center gap-2">
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
          {lp.copyright}
        </p>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-8 bg-[var(--bg)]">
        <div className="w-full max-w-sm space-y-7">
          <div className="lg:hidden flex items-center justify-center gap-3">
            <div
              className="w-8 h-8 rounded-[7px]"
              style={{ background: 'linear-gradient(135deg, var(--accent-500), var(--accent-700))' }}
            />
            <span className="font-serif italic text-[22px] text-[var(--fg)]">UniLMS</span>
          </div>

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
                {lp.welcomeBack}
              </h2>
              <p className="text-[13px] text-[var(--fg-muted)]">{lp.welcomeBackSubtitle}</p>
            </div>
          </div>

          <form onSubmit={go} noValidate className="space-y-3.5">
            {!requires2fa ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="email">{lp.emailLabel}</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder={lp.emailPlaceholder}
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (errors.email) setErrors({ ...errors, email: '' });
                    }}
                    aria-invalid={!!errors.email}
                    aria-describedby={errors.email ? 'email-error' : undefined}
                  />
                  {errors.email && (
                    <p id="email-error" className="text-[12px] text-[var(--danger)]">
                      {errors.email}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pw">{lp.passwordLabel}</Label>
                  <Input
                    id="pw"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errors.password) setErrors({ ...errors, password: '' });
                    }}
                    aria-invalid={!!errors.password}
                    aria-describedby={errors.password ? 'pw-error' : undefined}
                  />
                  {errors.password && (
                    <p id="pw-error" className="text-[12px] text-[var(--danger)]">
                      {errors.password}
                    </p>
                  )}
                </div>
                <Button type="submit" variant="primary" size="lg" className="w-full mt-1" disabled={login.isPending}>
                  {login.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {lp.accessButton}
                </Button>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 p-3 rounded-[8px] bg-[var(--bg-subtle)] border border-[var(--border-color)]">
                  <ShieldCheck className="h-4 w-4 text-[var(--accent-700)]" />
                  <p className="text-[13px] text-[var(--fg)]">Two-factor authentication is enabled for this account</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="totp">Authenticator code</Label>
                  <Input
                    id="totp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="123456"
                    maxLength={6}
                    value={totpCode}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setTotpCode(v);
                      if (errors.totp) setErrors({ ...errors, totp: '' });
                    }}
                    autoFocus
                    aria-invalid={!!errors.totp}
                    className="font-mono tracking-[0.4em] text-center text-lg"
                  />
                  {errors.totp && <p className="text-[12px] text-[var(--danger)]">{errors.totp}</p>}
                  <p className="text-[11px] text-[var(--fg-muted)]">
                    Open Google Authenticator, Authy, or 1Password and enter the current 6-digit code.
                  </p>
                </div>
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="w-full mt-1"
                  disabled={login.isPending || totpCode.length !== 6}
                >
                  {login.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Verify and sign in
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={backToPassword}
                  disabled={login.isPending}
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back to password
                </Button>
              </>
            )}
          </form>

          <p className="text-center text-[13px] text-[var(--fg-muted)]">
            {lp.newHere}{' '}
            <Link href="/register" className="text-[var(--accent-700)] hover:underline font-medium">
              {lp.createAccount}
            </Link>
          </p>

          <div
            className="rounded-[10px] border border-[var(--border-color)] p-4 space-y-3"
            style={{ background: 'var(--bg-subtle)' }}
          >
            <Eyebrow>{lp.demoCredentials}</Eyebrow>
            <div className="space-y-1.5">
              {DEMO.map(({ roleKey, email: e, pass: p }) => (
                <button
                  key={roleKey}
                  type="button"
                  onClick={() => fill(e, p)}
                  className={cn(
                    'w-full flex items-center justify-between rounded-[7px] px-3 py-2',
                    'bg-[var(--surface)] hover:bg-[var(--bg-muted)]',
                    'border border-[var(--border-color)] hover:border-[var(--accent-300)]',
                    'transition-colors duration-ds-fast text-left',
                  )}
                >
                  <span className="text-[13px] font-medium text-[var(--fg)]">{lp[roleKey]}</span>
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
