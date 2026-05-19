import React, { useMemo, useState } from 'react';
import type { MessageType } from './ChatWindow';
import { resolveChatMediaUrl } from './ProfileSidePanel';

export type SharedMediaTab = 'media' | 'files' | 'links';

const URL_REGEX = /https?:\/\/[^\s<>"'`]+/gi;

const IMAGE_EXT_IN_PATH = /\.(jpe?g|png|gif|webp|bmp|svg)(\?|$)/i;
const VIDEO_EXT_IN_PATH = /\.(mp4|webm|mov|mkv|avi|m4v)(\?|$)/i;
const DOC_EXT_IN_PATH = /\.(pdf|doc|docx|txt|xlsx?|pptx?|zip|rar|csv)(\?|$)/i;

export type MediaRow = { id: string; url: string; label?: string; messageId: string };
export type LinkRow = { id: string; url: string; messageId: string };

function collectUrlsFromText(content: string): string[] {
  const raw = content.match(URL_REGEX);
  if (!raw) return [];
  return raw.map((u) => u.replace(/[),.;]+$/, ''));
}

function messagePrimaryUrl(m: MessageType): string | undefined {
  const raw = m.fileUrl || m.content;
  if (!raw) return undefined;
  if (/^https?:\/\//i.test(raw) || raw.startsWith('/')) return raw;
  return undefined;
}

function isImageVideoUrl(url: string, type: MessageType['type'], fileName?: string): boolean {
  const lower = url.toLowerCase();
  const name = (fileName || '').toLowerCase();
  if (type === 'image' || type === 'video') return true;
  if (name.startsWith('image/') || name.startsWith('video/')) return true;
  if (IMAGE_EXT_IN_PATH.test(lower) || VIDEO_EXT_IN_PATH.test(lower)) return true;
  return false;
}

function isDocFile(url: string, type: MessageType['type'], fileName?: string): boolean {
  if (type === 'audio') return false;
  if (type === 'image' || type === 'video') return false;
  const lower = (fileName || url).toLowerCase();
  if (type === 'file') {
    if (lower.startsWith('image/') || lower.startsWith('video/')) return false;
    return true;
  }
  if (DOC_EXT_IN_PATH.test(url)) return true;
  return false;
}

function buildBuckets(messages: MessageType[]) {
  const media: MediaRow[] = [];
  const files: MediaRow[] = [];
  const links: LinkRow[] = [];
  const seenMedia = new Set<string>();

  for (const m of messages) {
    if (m.isDeletedForEveryone) continue;
    const url = messagePrimaryUrl(m);
    const label = m.fileName || m.content?.split('/').pop();

    if (m.type === 'audio') {
      const u = url || m.content;
      if (u && !seenMedia.has(m.id)) {
        seenMedia.add(m.id);
        media.push({ id: m.id, url: u, label: label || 'Voice', messageId: m.id });
      }
      continue;
    }

    if (url && (m.type === 'image' || m.type === 'video' || m.type === 'file')) {
      const resolved = resolveChatMediaUrl(url);
      if (isImageVideoUrl(resolved, m.type, m.fileName)) {
        if (!seenMedia.has(m.id)) {
          seenMedia.add(m.id);
          media.push({ id: m.id, url: resolved, label, messageId: m.id });
        }
        continue;
      }
      if (m.type === 'file' || isDocFile(resolved, m.type, m.fileName)) {
        files.push({ id: m.id, url: resolved, label: label || 'File', messageId: m.id });
        continue;
      }
    }

    if (m.content && (m.type === 'text' || !url)) {
      const urls = collectUrlsFromText(m.content);
      urls.forEach((u, i) => {
        links.push({ id: `${m.id}-link-${i}`, url: u, messageId: m.id });
      });
    }
  }

  return { media, files, links };
}

interface SharedMediaSidePanelProps {
  messages: MessageType[];
  onClose: () => void;
}

/** Right chat sidebar: shared media / files / links from current thread messages (no mock data). */
export const SharedMediaSidePanel: React.FC<SharedMediaSidePanelProps> = ({ messages, onClose }) => {
  const [tab, setTab] = useState<SharedMediaTab>('media');

  const { media, files, links } = useMemo(() => buildBuckets(messages), [messages]);

  const list =
    tab === 'media' ? media : tab === 'files' ? files : links;

  const shell =
    'w-85 min-w-[19rem] max-w-[22rem] bg-white dark:bg-[#262626] border-l border-gray-200 dark:border-gray-800 flex flex-col h-full shrink-0 shadow-xl z-20 animate-in slide-in-from-right duration-200';

  return (
    <aside className={shell}>
      <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between shrink-0 bg-gray-50 dark:bg-gray-900">
        <h2 className="font-bold text-base text-[#171717] dark:text-[#F5F5F5]">Media, links &amp; docs</h2>
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
          aria-label="Close shared media panel"
        >
          <span className="material-icons text-[22px]">close</span>
        </button>
      </div>

      <div className="flex border-b border-gray-100 dark:border-gray-800 shrink-0 bg-[#FAFAFA] dark:bg-gray-900/90">
        {(
          [
            { key: 'media' as const, label: 'Media', count: media.length },
            { key: 'files' as const, label: 'Files', count: files.length },
            { key: 'links' as const, label: 'Links', count: links.length }
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`flex-1 py-3 text-xs font-semibold transition-colors border-b-2 -mb-px ${
              tab === t.key
                ? 'border-[#7C3AED] text-[#7C3AED] dark:text-[#a78bfa] dark:border-[#a78bfa]'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {t.label}
            <span className="ml-1 opacity-70">({t.count})</span>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto hide-scrollbar p-4 bg-[#FAFAFA] dark:bg-[#171717]">
        {list.length === 0 ? (
          <p className="text-sm text-center text-gray-500 dark:text-gray-400 py-12">
            No {tab === 'media' ? 'images or videos' : tab === 'files' ? 'documents' : 'links'} in this chat yet.
          </p>
        ) : tab === 'links' ? (
          <ul className="flex flex-col gap-2">
            {(list as LinkRow[]).map((row) => (
              <li key={row.id}>
                <a
                  href={row.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-3 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-sm text-[#7C3AED] dark:text-[#a78bfa] break-all hover:border-[#7C3AED]/40 transition-colors"
                >
                  {row.url}
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="grid grid-cols-2 gap-2">
            {(list as MediaRow[]).map((row) => {
              const href = resolveChatMediaUrl(row.url);
              const isImg =
                tab === 'media' &&
                (IMAGE_EXT_IN_PATH.test(href) ||
                  (row.label && row.label.toLowerCase().startsWith('image/')));
              return (
                <li key={row.id} className="min-w-0">
                  {isImg ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block aspect-square rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-800 border border-gray-200 dark:border-gray-800"
                    >
                      <img src={href} alt="" className="w-full h-full object-cover hover:opacity-90 transition-opacity" />
                    </a>
                  ) : (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-col gap-1 p-2 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-[#7C3AED]/40 text-xs break-all min-h-[4.5rem]"
                    >
                      <span className="material-icons-round text-[#7C3AED] dark:text-[#a78bfa] text-lg">
                        {tab === 'media' ? 'play_circle' : 'description'}
                      </span>
                      <span className="line-clamp-3 text-gray-800 dark:text-gray-200">{row.label || href.split('/').pop() || 'File'}</span>
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
};
