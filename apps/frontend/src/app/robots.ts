import type { MetadataRoute } from 'next';

/**
 * Public crawl policy. Only the marketing-style pages (login/register) and the
 * landing root are indexable; everything inside (app)/ is gated behind auth
 * and the root layout already sets robots: { index: false } as a default.
 */
export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/login', '/register'],
        disallow: ['/api/', '/admin/', '/dashboard', '/courses/', '/profile', '/settings/'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
