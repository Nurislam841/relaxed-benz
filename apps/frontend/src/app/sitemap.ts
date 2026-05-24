import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const lastModified = new Date();
  return [
    { url: base, lastModified, changeFrequency: 'monthly', priority: 1.0 },
    { url: `${base}/login`, lastModified, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/register`, lastModified, changeFrequency: 'monthly', priority: 0.7 },
  ];
}
