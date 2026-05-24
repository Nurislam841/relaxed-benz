'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, ShieldOff, Loader2, Copy, Check } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/form-elements';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';

interface SetupResponse {
  secret: string;
  otpauthUrl: string;
  qrCodeDataUrl: string;
}

/**
 * Self-contained 2FA management card for the profile page.
 *
 * Flow:
 *  1. Idle (2FA off)        → "Set up 2FA" button → calls /setup
 *  2. Configuring           → shows QR + secret; user scans, enters code → /enable
 *  3. Enabled               → shows "ON" badge + disable form (current code required)
 */
export function TwoFactorCard() {
  const qc = useQueryClient();
  const { data: status } = useQuery<{ enabled: boolean }>({
    queryKey: ['2fa-status'],
    queryFn: () => api.get('/auth/2fa/status'),
  });

  const [setup, setSetup] = useState<SetupResponse | null>(null);
  const [enableCode, setEnableCode] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [copied, setCopied] = useState(false);

  const beginSetup = useMutation({
    mutationFn: () => api.post<SetupResponse>('/auth/2fa/setup', {}),
    onSuccess: (r) => setSetup(r),
    onError: (e: Error) => toast({ title: 'Setup failed', description: e.message, variant: 'destructive' }),
  });

  const enable2fa = useMutation({
    mutationFn: (code: string) => api.post('/auth/2fa/enable', { code }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['2fa-status'] });
      setSetup(null);
      setEnableCode('');
      toast({ title: '2FA enabled', description: 'You will be asked for a code next time you log in.' });
    },
    onError: (e: Error) => toast({ title: 'Invalid code', description: e.message, variant: 'destructive' }),
  });

  const disable2fa = useMutation({
    mutationFn: (code: string) => api.post('/auth/2fa/disable', { code }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['2fa-status'] });
      setDisableCode('');
      toast({ title: '2FA disabled' });
    },
    onError: (e: Error) => toast({ title: 'Could not disable', description: e.message, variant: 'destructive' }),
  });

  const copySecret = async () => {
    if (!setup) return;
    try {
      await navigator.clipboard.writeText(setup.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ title: 'Copy failed', variant: 'destructive' });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {status?.enabled ? (
            <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <ShieldOff className="h-4 w-4 text-[var(--fg-muted)]" />
          )}
          Two-factor authentication
          {status?.enabled && (
            <span className="ml-1 text-[10px] font-mono uppercase tracking-wide px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30">
              ON
            </span>
          )}
        </CardTitle>
        <CardDescription>
          {status?.enabled
            ? 'Your account requires a 6-digit code from your authenticator app at every login.'
            : 'Add an extra layer of security by requiring a 6-digit code from your phone at login.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Disabled state — show "Set up" button */}
        {!status?.enabled && !setup && (
          <Button onClick={() => beginSetup.mutate()} disabled={beginSetup.isPending}>
            {beginSetup.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <ShieldCheck className="h-3.5 w-3.5" />
            Set up 2FA
          </Button>
        )}

        {/* Mid-setup — show QR + code input */}
        {!status?.enabled && setup && (
          <div className="space-y-4">
            <p className="text-sm">
              <strong>Step 1.</strong> Scan this QR code with Google Authenticator, Authy, 1Password, or any RFC
              6238-compatible app:
            </p>
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
              {/* QR is server-rendered into a data URI so we don't ship a QR lib to the browser */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={setup.qrCodeDataUrl}
                alt="2FA setup QR code"
                width={192}
                height={192}
                className="rounded-lg border border-[var(--border-color)] bg-white p-2"
              />
              <div className="flex-1 space-y-2">
                <Label className="text-xs">Or enter this secret manually:</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 font-mono text-[11px] break-all bg-[var(--bg-subtle)] rounded p-2 border border-[var(--border-color)]">
                    {setup.secret}
                  </code>
                  <Button type="button" size="sm" variant="ghost" onClick={copySecret} title="Copy">
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
                <p className="text-[11px] text-[var(--fg-muted)]">Algorithm: TOTP · SHA-1 · 6 digits · 30 seconds</p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm">
                <strong>Step 2.</strong> Enter the 6-digit code your app is showing right now:
              </p>
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="123456"
                  value={enableCode}
                  onChange={(e) => setEnableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="font-mono tracking-[0.4em] text-center max-w-[160px]"
                  autoFocus
                />
                <Button
                  onClick={() => enable2fa.mutate(enableCode)}
                  disabled={enable2fa.isPending || enableCode.length !== 6}
                >
                  {enable2fa.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Enable
                </Button>
                <Button variant="ghost" onClick={() => setSetup(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Enabled state — show disable form */}
        {status?.enabled && (
          <div className="space-y-2">
            <Label htmlFor="disable-2fa">Disable 2FA</Label>
            <div className="flex items-center gap-2">
              <Input
                id="disable-2fa"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="Current code"
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="font-mono tracking-[0.4em] text-center max-w-[160px]"
              />
              <Button
                variant="destructive"
                onClick={() => disable2fa.mutate(disableCode)}
                disabled={disable2fa.isPending || disableCode.length !== 6}
              >
                {disable2fa.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Disable
              </Button>
            </div>
            <p className="text-[11px] text-[var(--fg-muted)]">
              Enter the current code from your app to confirm. We require this so a compromised session cannot silently
              turn off your protection.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
