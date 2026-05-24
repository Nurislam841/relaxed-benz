'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRegister } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/form-elements';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { GraduationCap, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Eyebrow } from '@/components/ds/eyebrow';
import { registerSchema, formatZodErrors } from '@/lib/validation';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const reg = useRegister();

  const go = (ev: React.FormEvent) => {
    ev.preventDefault();
    const parsed = registerSchema.safeParse({ email, password, fullName, role: 'STUDENT' });
    const fieldErrors = formatZodErrors(parsed);
    if (fieldErrors) {
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    reg.mutate(
      { email, password, fullName },
      { onError: (err) => toast({ title: 'Failed', description: err.message, variant: 'destructive' }) },
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--bg)] relative overflow-hidden">
      {/* Background glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at 30% 20%, color-mix(in oklch, var(--accent-500), transparent 88%), transparent 50%)',
        }}
      />
      <Card className="w-full max-w-md relative">
        <CardHeader className="text-center pt-8">
          <div
            className="mx-auto mb-3 h-14 w-14 rounded-[12px] flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, var(--accent-500), var(--accent-700))',
              boxShadow: 'var(--shadow-md), inset 0 1px 0 rgba(255,255,255,0.2)',
            }}
          >
            <GraduationCap className="h-7 w-7 text-white" />
          </div>
          <Eyebrow>Get started</Eyebrow>
          <CardTitle className="font-serif text-[26px] tracking-[-0.015em] mt-2">Create account</CardTitle>
          <CardDescription>Register for UniLMS</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={go} noValidate className="space-y-3.5">
            <div className="space-y-1.5">
              <Label>Full name</Label>
              <Input
                value={fullName}
                onChange={(x) => {
                  setFullName(x.target.value);
                  if (errors.fullName) setErrors({ ...errors, fullName: '' });
                }}
                aria-invalid={!!errors.fullName}
              />
              {errors.fullName && <p className="text-[12px] text-[var(--danger)]">{errors.fullName}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(x) => {
                  setEmail(x.target.value);
                  if (errors.email) setErrors({ ...errors, email: '' });
                }}
                aria-invalid={!!errors.email}
              />
              {errors.email && <p className="text-[12px] text-[var(--danger)]">{errors.email}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(x) => {
                  setPassword(x.target.value);
                  if (errors.password) setErrors({ ...errors, password: '' });
                }}
                aria-invalid={!!errors.password}
              />
              {errors.password && <p className="text-[12px] text-[var(--danger)]">{errors.password}</p>}
            </div>
            <Button type="submit" variant="primary" size="lg" className="w-full mt-1" disabled={reg.isPending}>
              {reg.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Register
            </Button>
          </form>
          <div className="mt-5 text-center text-[13px] text-[var(--fg-muted)]">
            Have an account?{' '}
            <Link href="/login" className="text-[var(--accent-700)] hover:underline font-medium">
              Sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
