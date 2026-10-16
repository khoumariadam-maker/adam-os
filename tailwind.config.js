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
        // Theme tokens are CSS variables (RGB channels) so the whole OS can switch themes.
        // See :root and [data-theme='classic'] in src/app/globals.css.
        base:     'rgb(var(--c-base) / <alpha-value>)',      // desktop / deepest layer
        panel:    'rgb(var(--c-panel) / <alpha-value>)',     // window body, cards
        panel2:   'rgb(var(--c-panel2) / <alpha-value>)',    // secondary surfaces
        spidey:   'rgb(var(--c-spidey) / <alpha-value>)',    // primary accent
        text:     'rgb(var(--c-text) / <alpha-value>)',      // headings, primary text
        textDim:  'rgb(var(--c-text-dim) / <alpha-value>)',  // body text
        lavender: 'rgb(var(--c-lavender) / <alpha-value>)',  // labels, captions
        green:    'rgb(var(--c-green) / <alpha-value>)',     // success, online
        red:      'rgb(var(--c-red) / <alpha-value>)',       // error, danger
        yellow:   'rgb(var(--c-yellow) / <alpha-value>)',    // warning, highlight
        slate:    'rgb(var(--c-slate) / <alpha-value>)',     // borders, dividers
        onAccent: 'rgb(var(--c-on-accent) / <alpha-value>)', // text on spidey/title bars
        hilite:   'rgb(var(--c-hilite) / <alpha-value>)',    // bevel light edge
        shade:    'rgb(var(--c-shade) / <alpha-value>)',     // bevel dark edge
      },

      fontFamily: {
        // Stacks switch to Arabic faces when <html lang="ar"> (see globals.css).
        pixel: ['var(--stack-pixel)'],
        body:  ['var(--stack-body)'],
        mono:  ['var(--font-mono)', 'monospace'],
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
