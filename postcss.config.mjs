import { fileURLToPath } from 'node:url';

const tailwindConfig = fileURLToPath(new URL('./tailwind.config.ts', import.meta.url));

/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    tailwindcss: { config: tailwindConfig },
  },
};

export default config;
