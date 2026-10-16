import type { MetadataRoute } from 'next';
import { PROFILE } from '@/lib/profile';

export const dynamic = 'force-static';

const SITE = PROFILE.siteUrl.replace(/\/+$/, '');

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/' }],
    sitemap: `${SITE}/sitemap.xml`,
  };
}
