import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Avatars live in a private bucket. Stored profile values may be legacy
 * public URLs or plain storage paths — both resolve to a signed URL here.
 */
export function avatarStoragePath(value?: string | null): string | null {
  if (!value) return null;
  const marker = "/avatars/";
  const idx = value.indexOf(marker);
  if (idx >= 0) return value.slice(idx + marker.length).split("?")[0];
  if (value.startsWith("http")) return null;
  return value;
}

const cache = new Map<string, string>();

export async function resolveAvatarUrl(value?: string | null): Promise<string | null> {
  const path = avatarStoragePath(value);
  if (!path) return null;
  const cached = cache.get(path);
  if (cached) return cached;
  const { data } = await supabase.storage.from("avatars").createSignedUrl(path, 3600);
  if (data?.signedUrl) {
    cache.set(path, data.signedUrl);
    return data.signedUrl;
  }
  return null;
}

export function useAvatarSrc(value?: string | null): string | null {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    resolveAvatarUrl(value).then((url) => {
      if (active) setSrc(url);
    });
    return () => {
      active = false;
    };
  }, [value]);
  return src;
}
