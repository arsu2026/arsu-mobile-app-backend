jest.mock('../../config/supabase.config');

import { supabaseAdmin } from '../../config/supabase.config';
import { deleteImages, uploadImage } from './storage.service';

const bucket = (supabaseAdmin.storage.from as jest.Mock)('post-media');
const mockUpload = bucket.upload as jest.Mock;
const mockGetPublicUrl = bucket.getPublicUrl as jest.Mock;
const mockRemove = bucket.remove as jest.Mock;

const USER_ID = '11111111-1111-4111-8111-111111111111';

describe('storage.service', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('uploadImage', () => {
    it('uploads the bytes and returns the public URL', async () => {
      mockUpload.mockResolvedValue({ data: { path: 'p' }, error: null });
      mockGetPublicUrl.mockReturnValue({
        data: { publicUrl: 'https://x.supabase.co/storage/v1/object/public/post-media/u/a.jpg' },
      });

      const url = await uploadImage(Buffer.from('img'), 'image/jpeg', USER_ID);

      expect(url).toBe(
        'https://x.supabase.co/storage/v1/object/public/post-media/u/a.jpg',
      );
      expect(mockUpload).toHaveBeenCalledTimes(1);
      const [path, , opts] = mockUpload.mock.calls[0];
      expect(path).toMatch(new RegExp(`^${USER_ID}/.+\\.jpg$`));
      expect(opts).toMatchObject({ contentType: 'image/jpeg' });
    });

    it('throws when the upload fails', async () => {
      mockUpload.mockResolvedValue({ data: null, error: { message: 'boom' } });
      await expect(
        uploadImage(Buffer.from('img'), 'image/png', USER_ID),
      ).rejects.toThrow(/upload failed/i);
    });
  });

  describe('deleteImages', () => {
    it('maps public URLs back to object paths and removes them', async () => {
      mockRemove.mockResolvedValue({ data: [], error: null });
      await deleteImages([
        'https://x.supabase.co/storage/v1/object/public/post-media/user1/a.jpg',
      ]);
      expect(mockRemove).toHaveBeenCalledWith(['user1/a.jpg']);
    });

    it('does nothing for an empty list', async () => {
      await deleteImages([]);
      expect(mockRemove).not.toHaveBeenCalled();
    });
  });
});
