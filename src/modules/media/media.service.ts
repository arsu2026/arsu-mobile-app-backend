import * as storage from '../../common/storage/storage.service';

export async function uploadImage(
  userId: string,
  file: { buffer: Buffer; mimetype: string },
): Promise<{ url: string }> {
  const url = await storage.uploadImage(file.buffer, file.mimetype, userId, 'uploads');
  return { url };
}
