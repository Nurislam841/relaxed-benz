import type { Announcement } from './types';

export function getAnnouncementContent(
  announcement: Announcement,
  _lang?: string,
): { title: string; body: string } {
  return {
    title: announcement.title,
    body: announcement.body,
  };
}
