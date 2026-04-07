/** @type {import('tailwindcss').Config} */
module.exports = {
  // ... tu configuración actual (content, etc.)
  theme: {
    extend: {
      colors: {
        rp: {
          navy: {
            DEFAULT: "#0f2b5a",
            light: "#2a4a82",
          },
          red: {
            DEFAULT: "#cf142b",
            light: "#eb3b50",
          },
        },
      },
      animation: {
        "fade-in-down": "fade-in-down 0.5s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
        "subtle-bob": "subtle-bob 3s ease-in-out infinite",
      },
      keyframes: {
        "fade-in-down": {
          "0%": { opacity: "0", transform: "translateY(-10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "subtle-bob": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-5px)" },
        },
      },
    },
  },
  plugins: [],
};
