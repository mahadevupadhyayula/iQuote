import type { Config } from 'tailwindcss';
import tailwindcssAnimate from 'tailwindcss-animate';

const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
          soft: 'hsl(var(--destructive-soft))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
          soft: 'hsl(var(--success-soft))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
          soft: 'hsl(var(--warning-soft))',
        },
        badge: {
          success: 'hsl(var(--badge-success))',
          'success-foreground': 'hsl(var(--badge-success-foreground))',
          'success-border': 'hsl(var(--badge-success-border))',
          warning: 'hsl(var(--badge-warning))',
          'warning-foreground': 'hsl(var(--badge-warning-foreground))',
          'warning-border': 'hsl(var(--badge-warning-border))',
          destructive: 'hsl(var(--badge-destructive))',
          'destructive-foreground': 'hsl(var(--badge-destructive-foreground))',
          'destructive-border': 'hsl(var(--badge-destructive-border))',
          info: 'hsl(var(--badge-info))',
          'info-foreground': 'hsl(var(--badge-info-foreground))',
          'info-border': 'hsl(var(--badge-info-border))',
          muted: 'hsl(var(--badge-muted))',
          'muted-foreground': 'hsl(var(--badge-muted-foreground))',
          'muted-border': 'hsl(var(--badge-muted-border))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        enterprise: 'var(--shadow-enterprise)',
        'enterprise-lg': 'var(--shadow-enterprise-lg)',
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
