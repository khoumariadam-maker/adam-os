import type { MetadataRoute } from 'next';
import { PROFILE } from '@/lib/profile';

export const dynamic = 'force-static';

const SITE = PROFILE.siteUrl.replace(/\/+$/, '');

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: `${SITE}/`, lastModified, changeFrequency: 'monthly', priority: 1 },
    { url: `${SITE}/resume/`, lastModified, changeFrequency: 'monthly', priority: 0.8 },
  ];
}
