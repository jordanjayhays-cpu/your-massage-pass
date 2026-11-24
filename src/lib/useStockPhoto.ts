import { useEffect, useSyncExternalStore } from "react";
import { loadStockPhotos, stockPhotoFor, stockPhotosSettled, subscribeStockPhotos } from "@/lib/supabase";

/**
 * A studio's stock photo by id, for pages that hold one studio (the studio
 * page, "Book again"). The slots are loaded once per visit and shared, so it
 * is the same photo the list, map and compare pages show.
 * Returns undefined while loading, null when there is none.
 */
export function useStockPhoto(id?: string | null): string | null | undefined {
  const url = useSyncExternalStore(subscribeStockPhotos, () => stockPhotoFor(id), () => null);
  const settled = useSyncExternalStore(subscribeStockPhotos, stockPhotosSettled, () => false);
  // Start at mount, before the page knows its studio id, so the list loads
  // alongside the studio's own data. Cached: one request per visit.
  useEffect(() => {
    loadStockPhotos();
  }, []);
  if (url) return url;
  return settled ? null : undefined;
}
