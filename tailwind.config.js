/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
    './src/**/*.css',
    './index.html',
  ],
  theme: {
    extend: {
      fontFamily: { sans: ['var(--font-main)'] },
      fontSize: {
        xs: ['var(--text-xs)', { lineHeight: '1rem' }],
        sm: ['var(--text-sm)', { lineHeight: '1.25rem' }],
        base: ['var(--text-md)', { lineHeight: '1.5rem' }],
        lg: ['var(--text-lg)', { lineHeight: '1.75rem' }],
        xl: ['1.125rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
        '5xl': ['3rem', { lineHeight: '1' }],
      },
      spacing: {
        1: 'var(--space-1)',
        2: 'var(--space-2)',
        3: 'var(--space-3)',
        4: 'var(--space-4)',
        5: 'var(--space-5)',
        6: 'var(--space-6)',
        8: 'var(--space-8)',
      },
      colors: {
        background: 'var(--bg)',
        surface: 'var(--surface)',
        surfaceAlt: 'var(--surface-2)',
        border: 'var(--border)',
        textPrimary: 'var(--text)',
        textSecondary: 'var(--text-muted)',
        textMuted: 'var(--text-faint)',
        accentSuccess: 'var(--accent-success)',
        accentWarning: 'var(--accent-warning)',
        accentError: 'var(--accent-error)',
        accentInfo: 'var(--accent-info)',
        brandAccent: 'var(--brand-accent)',
      },
      borderRadius: {
        card: 'var(--radius-card)',
        input: 'var(--radius-control)',
        button: 'var(--radius-control)',
        modal: 'var(--radius-modal)',
      },
      boxShadow: {
        layer: 'var(--shadow-layer)',
      },
      transitionDuration: {
        DEFAULT: '150',
      },
      scale: {
        98: '0.98',
      },
    },
  },
  plugins: [],
};
