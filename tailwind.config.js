/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class', // we'll toggle 'dark' class on <html>
  content: [
    "./src/views/**/*.ejs",
    "./public/**/*.js"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          orange: "#ff7a18",
          purple: "#6a00ff"
        }
      },
      boxShadow: {
        soft: "0 10px 30px rgba(0,0,0,0.10)"
      }
    }
  },
  plugins: []
}
