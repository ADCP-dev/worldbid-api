export function sanitizeRedirect(redirect: unknown): string | null {
  if (typeof redirect !== "string") return null;
  if (!redirect.startsWith("/")) return null;
  if (redirect.startsWith("//")) return null;
  return redirect;
}

export function buildLoginRedirectUrl(
  localePath: string,
  redirectTo: string,
): string {
  const url = new URL(localePath, window.location.origin);
  url.searchParams.set("redirect", redirectTo);
  return url.pathname + url.search;
}
