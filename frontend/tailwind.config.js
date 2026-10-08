/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      screens: { xs: "480px" },
        colors: {
        charcoal: {
          DEFAULT: "rgb(var(--color-bg) / <alpha-value>)",
          light: "rgb(var(--color-surface) / <alpha-value>)",
          lighter: "rgb(var(--color-border) / <alpha-value>)",
          secondary: "rgb(var(--color-surface-secondary) / <alpha-value>)",
        },
        cream: "rgb(var(--color-text) / <alpha-value>)",
        muted: "rgb(var(--color-muted) / <alpha-value>)",
        saffron: {
          DEFAULT: "rgb(var(--color-accent) / <alpha-value>)",
          dark: "rgb(var(--color-accent-dark) / <alpha-value>)",
        },
        sage: "rgb(var(--color-positive) / <alpha-value>)",
        brick: "rgb(var(--color-danger) / <alpha-value>)",
        gold: "rgb(var(--color-warning) / <alpha-value>)",
        "border-strong": "rgb(var(--color-border-strong) / <alpha-value>)",
      },
      fontFamily: {
        display: ["Fraunces", "serif"],
        body: ["Manrope", "sans-serif"],
      },
    },
  },
  plugins: [],
};