/** PostCSS pipeline — Tailwind CSS v4 via the dedicated PostCSS plugin.
 *  Tailwind v4 is CSS-first: theme tokens live in globals.css under `@theme`,
 *  so no tailwind.config.js is required. Source scanning is declared with
 *  `@source` in globals.css. */
const config = {
  plugins: {
    "@tailwindcss/postcss": {}
  }
};

export default config;
