import { randomUUID } from 'crypto';
import { env } from '../../config/env.config';
import { supabaseAdmin } from '../../config/supabase.config';

const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

/** Upload image bytes to the post-media bucket and return the public URL. */
export async function uploadImage(
  buffer: Buffer,
  mimetype: string,
  userId: string,
  folder = 'posts',
): Promise<string> {
  const ext = MIME_EXT[mimetype] ?? 'bin';
  const path = `${userId}/${folder}/${randomUUID()}.${ext}`;
  const bucket = env.SUPABASE_POST_MEDIA_BUCKET;

  const { error } = await supabaseAdmin.storage
    .from(bucket)
    .upload(path, buffer, { contentType: mimetype, upsert: false });
  if (error) throw new Error(`Image upload failed: ${error.message}`);

  const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

/** Best-effort removal of stored images, given their public URLs. */
export async function deleteImages(urls: string[]): Promise<void> {
  if (urls.length === 0) return;
  const bucket = env.SUPABASE_POST_MEDIA_BUCKET;
  const marker = `/object/public/${bucket}/`;

  const paths = urls
    .map((url) => {
      const i = url.indexOf(marker);
      return i === -1 ? null : url.slice(i + marker.length);
    })
    .filter((p): p is string => p !== null);

  if (paths.length === 0) return;
  await supabaseAdmin.storage.from(bucket).remove(paths);
}
