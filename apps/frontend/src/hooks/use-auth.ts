'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import type { User, AuthResponse } from '@/lib/types';

export function useMe() {
  return useQuery<User>({
    queryKey: ['me'],
    queryFn: () => api.get<User>('/auth/me'),
    retry: false,
    staleTime: 5 * 60_000,
  });
}

/**
 * Login mutation. Accepts an optional `totpCode` for accounts with 2FA enabled.
 * If the backend responds with `requires2fa: true`, the calling component
 * should re-call mutate() with the 6-digit code from the user's authenticator.
 */
export function useLogin() {
  const qc = useQueryClient();
  const r = useRouter();
  return useMutation({
    mutationFn: (d: { email: string; password: string; totpCode?: string }) => api.post<AuthResponse>('/auth/login', d),
    onSuccess: (d) => {
      qc.setQueryData(['me'], d.user);
      r.push('/dashboard');
    },
  });
}

export function useRegister() {
  const qc = useQueryClient();
  const r = useRouter();
  return useMutation({
    mutationFn: (d: { email: string; password: string; fullName: string }) =>
      api.post<AuthResponse>('/auth/register', d),
    onSuccess: (d) => {
      qc.setQueryData(['me'], d.user);
      r.push('/dashboard');
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  const r = useRouter();
  return useMutation({
    mutationFn: () => api.post('/auth/logout'),
    onSuccess: () => {
      qc.clear();
      r.push('/login');
    },
  });
}
