import { prisma } from '../../prisma';

export interface PostPreview {
  postId: string;
  thumbnailUrl: string | null;
  snippet: string | null;
}

const previewSelect = {
  id: true,
  content: true,
  thumbnailUrl: true,
  mediaUrl: true,
  media: { select: { url: true }, orderBy: { position: 'asc' as const }, take: 1 },
};

/**
 * Batch-fetches lightweight post previews for notification / activity-log
 * enrichment. Dedupes ids and returns a map keyed by post id. Thumbnail
 * resolution: explicit thumbnailUrl → first media url → mediaUrl → null.
 */
export async function fetchPostPreviews(postIds: string[]): Promise<Map<string, PostPreview>> {
  const unique = [...new Set(postIds)].filter(Boolean);
  if (unique.length === 0) return new Map();

  const posts = await prisma.post.findMany({
    where: { id: { in: unique } },
    select: previewSelect,
  });

  return new Map(
    posts.map((p) => [
      p.id,
      {
        postId: p.id,
        thumbnailUrl: p.thumbnailUrl ?? p.media[0]?.url ?? p.mediaUrl ?? null,
        snippet: p.content,
      },
    ]),
  );
}
