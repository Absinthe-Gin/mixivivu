import { useCallback, useEffect, useRef, useState } from 'react';
import { assistantApi } from '../services/assistantApi';
import type { Conversation } from '../types';

/** Sidebar list: recent/pinned or archived conversations, with debounced search. */
export function useConversations() {
  const [items, setItems] = useState<Conversation[]>([]);
  const [query, setQuery] = useState('');
  const [archived, setArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  const refresh = useCallback(async () => {
    const mine = ++seq.current;
    try {
      const { conversations } = await assistantApi.listConversations({ q: query.trim() || undefined, archived });
      if (mine === seq.current) {
        setItems(conversations);
        setError(null);
      }
    } catch (e) {
      if (mine === seq.current) setError(e instanceof Error ? e.message : 'Không tải được danh sách.');
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, [query, archived]);

  useEffect(() => {
    const t = setTimeout(() => void refresh(), query ? 250 : 0);
    return () => clearTimeout(t);
  }, [refresh, query]);

  const update = useCallback(
    async (id: string, patch: { title?: string; pinned?: boolean; archived?: boolean }) => {
      await assistantApi.updateConversation(id, patch);
      await refresh();
    },
    [refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      await assistantApi.deleteConversation(id);
      await refresh();
    },
    [refresh],
  );

  return { items, query, setQuery, archived, setArchived, loading, error, refresh, update, remove };
}
