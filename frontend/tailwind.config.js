/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1c2218",
        olive: "#3c4636",
        moss: "#3c4636",
        canopy: "#4e6248",
        sage: "#7d8a68",
        slate: "#5e7486",
        bronze: "#8f734c",
        honey: "#9a7544",
        crit: "#8d4a40",
        ivory: "#f3f0e7",
        lime: "#e7e2d4",
        paper: "#e6e3da",
        surface: "#f4f2eb",
        mist: "#5e6558",
        line: "#d5d1c6",
      },
      fontFamily: {
        display: ["Syne", "sans-serif"],
        sans: ["Outfit", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(28, 34, 24, 0.04), 0 10px 24px rgba(28, 34, 24, 0.05)",
      },
    },
  },
  plugins: [],
};
