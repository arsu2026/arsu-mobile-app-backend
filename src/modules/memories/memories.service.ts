import { mapPostToView } from '../../common/utils/post-mapper.util';
import * as repo from './memories.repository';
import type { MemoryView } from './memories.types';

function todayMonthDay(): string {
  const now = new Date();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  return `${mm}-${dd}`;
}

export async function getMemories(userId: string, date?: string): Promise<MemoryView[]> {
  const monthDay = date ?? todayMonthDay();
  const currentYear = new Date().getUTCFullYear();
  const ids = await repo.findMemoryPostIds(userId, monthDay, currentYear);
  const posts = await repo.findPostsByIds(ids);
  return posts.map((post) => ({
    yearsAgo: currentYear - post.createdAt.getUTCFullYear(),
    post: mapPostToView(post),
  }));
}
