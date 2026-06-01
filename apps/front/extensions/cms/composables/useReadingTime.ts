export function useReadingTime(content: string, wordsPerMinute = 180): number {
  if (!content) return 0;
  const text = content.replace(/<[^>]+>/g, '').trim();
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / wordsPerMinute));
}
