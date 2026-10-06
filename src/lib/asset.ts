// Prefixes public/ asset paths with the deploy base path (e.g. "/adam-os" on GitHub Pages).
// Always use this for anything under /public so the site works at a sub-path.
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '';

export const asset = (path: string): string =>
  `${BASE_PATH}${path.startsWith('/') ? path : `/${path}`}`;
