import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    container: { center: true, padding: '2rem', screens: { '2xl': '1400px' } },
    extend: {
      colors: {
        // shadcn/ui compat (HSL-shaped)
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },

        // ── Design system tokens (OKLCH via CSS vars) ──
        ds: {
          bg: 'var(--bg)',
          'bg-subtle': 'var(--bg-subtle)',
          'bg-muted': 'var(--bg-muted)',
          surface: 'var(--surface)',
          'surface-2': 'var(--surface-2)',
          'surface-raised': 'var(--surface-raised)',
          fg: 'var(--fg)',
          'fg-muted': 'var(--fg-muted)',
          'fg-subtle': 'var(--fg-subtle)',
          'fg-on-accent': 'var(--fg-on-accent)',
          border: 'var(--border-color)',
          'border-strong': 'var(--border-strong)',
          success: 'var(--success)',
          warning: 'var(--warning)',
          danger: 'var(--danger)',
          info: 'var(--info)',
        },
        violet: {
          50: 'var(--accent-50)',
          100: 'var(--accent-100)',
          200: 'var(--accent-200)',
          300: 'var(--accent-300)',
          400: 'var(--accent-400)',
          500: 'var(--accent-500)',
          600: 'var(--accent-600)',
          700: 'var(--accent-700)',
          800: 'var(--accent-800)',
          900: 'var(--accent-900)',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['var(--font-serif)', 'Georgia', 'Cambria', 'serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SF Mono', 'Menlo', 'monospace'],
      },
      fontSize: {
        'ds-xs': ['11px', { lineHeight: '1.4' }],
        'ds-sm': ['12px', { lineHeight: '1.5' }],
        'ds-base': ['13px', { lineHeight: '1.5' }],
        'ds-md': ['14px', { lineHeight: '1.5' }],
        'ds-lg': ['16px', { lineHeight: '1.55' }],
        'ds-xl': ['19px', { lineHeight: '1.4' }],
        'ds-2xl': ['24px', { lineHeight: '1.3' }],
        'ds-3xl': ['30px', { lineHeight: '1.2' }],
        'ds-4xl': ['38px', { lineHeight: '1.1' }],
        'ds-5xl': ['48px', { lineHeight: '1.05' }],
        'ds-6xl': ['64px', { lineHeight: '1.0' }],
      },
      borderRadius: {
        // shadcn compat
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        // DS tokens
        'ds-xs': 'var(--radius-xs)',
        'ds-sm': 'var(--radius-sm)',
        'ds-md': 'var(--radius-md)',
        'ds-lg': 'var(--radius-lg)',
        'ds-xl': 'var(--radius-xl)',
        'ds-2xl': 'var(--radius-2xl)',
      },
      boxShadow: {
        card: '0 1px 3px 0 rgb(0 0 0 / 0.06)',
        lift: '0 4px 16px 0 rgb(0 0 0 / 0.08)',
        'ds-xs': 'var(--shadow-xs)',
        'ds-sm': 'var(--shadow-sm)',
        'ds-md': 'var(--shadow-md)',
        'ds-lg': 'var(--shadow-lg)',
        'ds-xl': 'var(--shadow-xl)',
        'ds-glow': 'var(--shadow-glow)',
      },
      transitionTimingFunction: {
        'ds-out': 'cubic-bezier(0.22, 1, 0.36, 1)',
        'ds-in-out': 'cubic-bezier(0.65, 0, 0.35, 1)',
        'ds-spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      transitionDuration: {
        'ds-fast': '120ms',
        'ds-base': '200ms',
        'ds-slow': '320ms',
      },
      keyframes: {
        shimmer: {
          '100%': { transform: 'translateX(200%)' },
        },
        'ai-blink': {
          '0%, 50%': { opacity: '1' },
          '51%, 100%': { opacity: '0' },
        },
        'ai-pulse': {
          '0%, 80%, 100%': { opacity: '0.3', transform: 'scale(0.7)' },
          '40%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.6s infinite',
        'ai-blink': 'ai-blink 0.9s infinite',
        'ai-pulse': 'ai-pulse 1.2s infinite ease-in-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
