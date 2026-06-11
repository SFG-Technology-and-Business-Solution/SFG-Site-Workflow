import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Fluent-style communication blue ramp
        primary: {
          50: '#eff6fc',
          100: '#deecf9',
          200: '#c7e0f4',
          300: '#a3ccec',
          400: '#71afe5',
          500: '#2b88d8',
          600: '#0078d4', // Brand
          700: '#005a9e',
          800: '#004578',
          900: '#0a2e4d',
        },
        neutral: {
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          900: '#111827',
        },
        accent: {
          red: '#d13438',
          'red-light': '#fdf3f4',
        },
        success: {
          DEFAULT: '#107c10',
          light: '#dff6dd',
        },
        warning: {
          DEFAULT: '#d83b01',
          light: '#fdf0e7',
        },
        info: {
          DEFAULT: '#038387',
          light: '#e4f5f5',
        },
      },
      fontFamily: {
        sans: ['"Segoe UI"', '"Segoe UI Variable Text"', 'system-ui', '-apple-system', '"Helvetica Neue"', 'Arial', 'sans-serif'],
        // All UI text renders sans-serif, including numeric/ID text
        mono: ['"Segoe UI"', 'system-ui', '-apple-system', 'Arial', 'sans-serif'],
      },
      borderRadius: {
        xl: '0.5rem',
        '2xl': '0.625rem',
      },
    },
  },
  plugins: [],
};
export default config;
