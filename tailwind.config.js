/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        base:     '#0B0B10',  // page background, deepest layer
        panel:    '#171722',  // window body, cards
        panel2:   '#1f1f2e',  // title bars, secondary surfaces
        spidey:   '#212CF4',  // cobalt blue — primary accent
        text:     '#FFFFFF',  // headings, primary text
        textDim:  '#E1E2E7',  // body text
        lavender: '#C3C6ED',  // labels, captions, halftone dots
        green:    '#72FFB4',  // success, online, confirm
        red:      '#FF3A66',  // error, close button, danger
        yellow:   '#FFE55C',  // warning, minimize, highlight
        slate:    '#B0B3BC',  // borders, disabled, dividers
      },
      fontFamily: {
        pixel: ['"PixelAE"', '"Press Start 2P"', 'monospace'],
        body:  ['Geist', 'Inter', 'sans-serif'],
        mono:  ['"JetBrains Mono"', 'monospace'],
      },
      spacing: {
        px: '2px',   // hairline borders
        1:  '4px',   // tight gaps
        2:  '8px',   // base unit
        4:  '16px',  // standard padding
        6:  '24px',  // section gaps
        8:  '32px',  // large gaps
      },
    }
  },
  plugins: [],
}
