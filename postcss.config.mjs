// postcss-dark.cjs runs after Tailwind and adds the dark theme (see that file).
export default { plugins: { tailwindcss: {}, "./postcss-dark.cjs": {}, autoprefixer: {} } };
