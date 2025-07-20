// tailwind.config.ts (例)
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}', // これが重要
    './src/**/*.{js,ts,jsx,tsx,mdx}', // srcディレクトリを使っている場合
  ],
  theme: {
    extend: {
      // ...
    },
  },
  plugins: [],
}
export default config