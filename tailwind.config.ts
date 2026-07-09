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
        bg: "#0a0e1a",
        surface: "#111827",
        border: "#1f2937",
        // "white" passa a ser a cor de tinta temática: no escuro = branco,
        // no claro = tinta escura. Faz todos os text-white/bg-white/border-white
        // virarem temáticos automaticamente.
        white: "rgb(var(--ink) / <alpha-value>)",
      },
    },
  },
  plugins: [],
};

export default config;
