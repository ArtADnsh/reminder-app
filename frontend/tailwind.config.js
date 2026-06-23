/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // در اینجا می‌توانیم رنگ‌بندی‌های سازمانی یا فونت‌ها را اضافه کنیم
      colors: {
        primary: "#3498db",
        secondary: "#2c3e50",
        accent: "#2ecc71"
      }
    },
  },
  plugins: [],
}