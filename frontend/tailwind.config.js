/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#13261c",
        moss: "#1c7a4a",
        lime: "#dff56a",
        paper: "#e7efe8",
        mist: "#5c6d63",
        line: "#d5e0d8",
        honey: "#b7791f",
        crit: "#c83c3c",
      },
      fontFamily: {
        display: ["Syne", "sans-serif"],
        sans: ["Outfit", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(19, 38, 28, 0.04), 0 16px 40px rgba(19, 38, 28, 0.06)",
      },
    },
  },
  plugins: [],
};
