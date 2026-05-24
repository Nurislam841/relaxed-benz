import { z } from 'zod';

/**
 * Centralized client-side validation schemas.
 * Mirrors the backend DTO constraints (auth/auth.dto.ts).
 * Used by login, register, and other forms — see /lib/zod-form.ts helper.
 */

export const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters').max(120, 'Full name is too long'),
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password is too long'),
  role: z.enum(['ADMIN', 'TEACHER', 'STUDENT']).default('STUDENT'),
});

export type RegisterInput = z.infer<typeof registerSchema>;

/**
 * Flatten a ZodError into a `field → message` map for inline form errors.
 * Returns null if no issues.
 */
export function formatZodErrors<T>(result: z.SafeParseReturnType<unknown, T>): Record<string, string> | null {
  if (result.success) return null;
  const out: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const path = issue.path.join('.') || '_root';
    if (!out[path]) out[path] = issue.message;
  }
  return out;
}
