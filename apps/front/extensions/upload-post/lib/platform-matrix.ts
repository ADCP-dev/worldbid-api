import type {
  UpAspectRatio,
  UpMediaType,
} from '@upload-post/types';

/**
 * CLIENT-SIDE single source of truth for composer gating (design D, FR,
 * spec C1/C16). Mirrors backend PLATFORM_CAPABILITIES — composer must
 * filter selectable platforms by ratio × mediaType; document ⇒ LinkedIn only.
 */
export const UP_MEDIA_TYPES: UpMediaType[] = [
  'video',
  'photos',
  'text',
  'document',
];

export const UP_ASPECT_RATIOS: UpAspectRatio[] = [
  '9:16',
  '16:9',
  '1:1',
  '4:5',
];

export const PLATFORM_MATRIX: Record<
  string,
  { aspectRatios: UpAspectRatio[]; mediaTypes: UpMediaType[] }
> = {
  tiktok: {
    aspectRatios: ['9:16', '1:1'],
    mediaTypes: ['video', 'photos'],
  },
  instagram: {
    aspectRatios: ['9:16', '1:1', '4:5'],
    mediaTypes: ['video', 'photos'],
  },
  youtube: { aspectRatios: ['16:9', '9:16', '1:1'], mediaTypes: ['video'] },
  facebook: {
    aspectRatios: ['9:16', '16:9', '1:1', '4:5'],
    mediaTypes: ['video', 'photos', 'text'],
  },
  linkedin: {
    aspectRatios: ['16:9', '1:1', '4:5'],
    mediaTypes: ['video', 'photos', 'text', 'document'],
  },
  x: { aspectRatios: ['16:9', '1:1'], mediaTypes: ['video', 'photos', 'text'] },
  threads: {
    aspectRatios: ['9:16', '1:1', '4:5'],
    mediaTypes: ['video', 'photos', 'text'],
  },
  pinterest: {
    aspectRatios: ['9:16', '1:1'],
    mediaTypes: ['video', 'photos'],
  },
  reddit: { aspectRatios: ['16:9'], mediaTypes: ['video', 'photos', 'text'] },
  bluesky: { aspectRatios: ['16:9', '1:1'], mediaTypes: ['text', 'photos'] },
};

/** Platforms accepting text content (feed/text platforms). */
export function platformsFor(
  ratio: UpAspectRatio,
  mediaType: UpMediaType,
): string[] {
  if (mediaType === 'document') return ['linkedin'];
  return Object.entries(PLATFORM_MATRIX)
    .filter(
      ([, cap]) =>
        cap.mediaTypes.includes(mediaType) && cap.aspectRatios.includes(ratio),
    )
    .map(([platform]) => platform);
}

/** Platforms requiring explicit destination selection. */
export const PLATFORM_DESTINATION: Partial<Record<string, string>> = {
  facebook: 'facebook_page',
  linkedin: 'linkedin_page',
  pinterest: 'pinterest_board',
};