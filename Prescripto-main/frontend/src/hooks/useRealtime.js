import { useEffect, useRef } from 'react';
import { supabase } from '../config/supabase';

export function useRealtimeSubscription(tables = [], onDataChange, enabled = true) {
  const callbackRef = useRef(onDataChange);

  // Always keep reference to latest callback without re-subscribing
  useEffect(() => {
    callbackRef.current = onDataChange;
  }, [onDataChange]);

  const tablesKey = Array.isArray(tables) ? tables.slice().sort().join(',') : '';

  // 1. Supabase Realtime Channels Subscription with Controlled Error Handling & Reconnect Prevention
  useEffect(() => {
    if (!enabled || !tablesKey) return;

    if (!supabase) {
      console.info(`[Realtime] Realtime client not active for [${tablesKey}]. Window focus/visibility refresh active as primary fallback.`);
      return;
    }

    const channelName = `rt_${tablesKey.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    let channel = null;

    try {
      channel = supabase.channel(channelName);

      const tableList = tablesKey.split(',').filter(Boolean);
      tableList.forEach((table) => {
        channel = channel.on(
          'postgres_changes',
          { event: '*', schema: 'public', table },
          (payload) => {
            if (typeof callbackRef.current === 'function') {
              callbackRef.current(payload, table);
            }
          }
        );
      });

      channel.subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[Realtime] Subscribed to tables: [${tablesKey}]`);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn(`[Realtime] Channel subscription paused for [${tablesKey}] (${status}). Window focus/visibility refresh active.`);
          if (channel) {
            try {
              supabase.removeChannel(channel);
            } catch (_) {}
          }
        }
      });
    } catch (err) {
      console.warn(`[Realtime] Setup exception for [${tablesKey}]: ${err.message}. Window focus/visibility refresh active.`);
    }

    return () => {
      if (channel && supabase) {
        try {
          supabase.removeChannel(channel);
        } catch (_) {}
      }
    };
  }, [enabled, tablesKey]);

  // 2. Automatic Data Refresh on Window Focus & Tab Visibility Change (Graceful Fallback)
  useEffect(() => {
    if (!enabled) return;

    const handleFocusOrVisible = () => {
      if (document.visibilityState === 'visible' && typeof callbackRef.current === 'function') {
        callbackRef.current();
      }
    };

    window.addEventListener('focus', handleFocusOrVisible);
    document.addEventListener('visibilitychange', handleFocusOrVisible);

    return () => {
      window.removeEventListener('focus', handleFocusOrVisible);
      document.removeEventListener('visibilitychange', handleFocusOrVisible);
    };
  }, [enabled]);
}
