import { useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';

/**
 * Hook to reload data when active BAN changes
 *
 * Usage:
 * ```typescript
 * const fetchData = useCallback(async () => {
 *   if (!activeBan) return;
 *   // Fetch data for activeBan
 * }, [activeBan]);
 *
 * useEffect(() => { fetchData(); }, [fetchData]);
 * useBanReload(fetchData); // Reload on BAN switch
 * ```
 */
export function useBanReload(reloadFn: () => void) {
  const { activeBan } = useAuth();
  const prevBanRef = useRef(activeBan?.customer_id);

  useEffect(() => {
    // Skip initial mount
    if (!prevBanRef.current) {
      prevBanRef.current = activeBan?.customer_id;
      return;
    }

    // BAN changed - trigger reload
    if (prevBanRef.current !== activeBan?.customer_id) {
      console.log('BAN switched - reloading data', {
        from: prevBanRef.current,
        to: activeBan?.customer_id,
      });

      reloadFn();
      prevBanRef.current = activeBan?.customer_id;
    }
  }, [activeBan?.customer_id, reloadFn]);
}
