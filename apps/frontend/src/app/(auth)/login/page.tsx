'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useLogin } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/form-elements';
import { GraduationCap, Loader2, BookOpen, Users, BarChart3 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
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
    <div className="min-h-screen flex bg-[#0d1117]">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 bg-[#0d1117] relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent pointer-events-none" />
        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
            <GraduationCap className="h-6 w-6 text-white" />
          </div>
          <span className="text-white font-semibold text-lg">UniLMS</span>
        </div>
        {/* Hero text */}
        <div className="relative space-y-6">
          <h1 className="text-5xl font-bold text-white leading-tight">
            Learning<br />Operating<br />System
          </h1>
          <p className="text-muted-foreground text-lg leading-relaxed max-w-sm">
            Intelligent. Connected. Adaptive.<br />The future of education is here.
          </p>
          <div className="flex gap-8 pt-2">
            {[
              { icon: BookOpen, label: 'Course Management' },
              { icon: Users,    label: 'Collaboration' },
              { icon: BarChart3, label: 'Progress Tracking' },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex flex-col items-center gap-2">
                <div className="h-11 w-11 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <span className="text-xs text-muted-foreground text-center leading-tight">{label}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-muted-foreground">© 2025 UniLMS. All rights reserved.</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8 bg-[#111827]">
        <div className="w-full max-w-sm space-y-8">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
              <GraduationCap className="h-6 w-6 text-white" />
            </div>
            <span className="text-white font-semibold text-lg">UniLMS</span>
          </div>

          {/* Icon */}
          <div className="flex flex-col items-center gap-3">
            <div className="h-16 w-16 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
              <GraduationCap className="h-8 w-8 text-primary" />
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-bold text-white">Sign in to your system</h2>
              <p className="text-sm text-muted-foreground mt-1">Access your personalized learning environment</p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={go} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm text-gray-300">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@university.edu"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-primary"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pw" className="text-sm text-gray-300">Password</Label>
              <Input
                id="pw"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-primary"
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90 text-white font-semibold h-11"
              disabled={login.isPending}
            >
              {login.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Access System
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            New here?{' '}
            <Link href="/register" className="text-primary hover:underline font-medium">Create an account</Link>
          </p>

          {/* Demo credentials */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Demo Credentials</p>
            <div className="space-y-2">
              {DEMO.map(({ role, email: e, pass: p }) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => fill(e, p)}
                  className={cn(
                    'w-full flex items-center justify-between rounded-lg px-3 py-2',
                    'bg-white/5 hover:bg-white/10 border border-white/10 hover:border-primary/40',
                    'transition-colors text-left',
                  )}
                >
                  <span className="text-sm font-medium text-white">{role}</span>
                  <span className="text-xs text-muted-foreground font-mono">{e}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
