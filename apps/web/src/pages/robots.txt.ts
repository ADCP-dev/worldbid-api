// robots.txt endpoint — dynamic so we can inject the site URL (task 3.27).
import type { APIRoute } from 'astro';

export const GET: APIRoute = () => {
  const siteUrl =
    import.meta.env.PUBLIC_SITE_URL || 'http://localhost:4321';

  const body = `# robots.txt — Foundation public web app
User-agent: *
Allow: /

# Admin/app routes are not public
Disallow: /app/
Disallow: /admin/
Disallow: /api/revalidate

Sitemap: ${siteUrl}/sitemap-index.xml
`;

  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};