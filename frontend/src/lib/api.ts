import { supabase } from "./supabase";

async function authHeaders(): Promise<HeadersInit> {
  const token = await getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Raw token accessor for contexts that can't use `apiFetch`
 *  (e.g. `XMLHttpRequest` upload progress). */
export async function getAuthToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

function mergeHeaders(a: HeadersInit | undefined, b: HeadersInit): HeadersInit {
  const out = new Headers(a);
  new Headers(b).forEach((value, key) => out.set(key, value));
  return out;
}

/** JSON-friendly authenticated fetch. Use for every call to the Icarus backend. */
export async function apiFetch(
  input: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = mergeHeaders(init.headers, await authHeaders());
  const res = await fetch(input, { ...init, headers });
  if (res.status === 401) {
    // JWT expired or revoked — drop the session so the LoginGate re-renders.
    await supabase.auth.signOut();
  }
  return res;
}

/** Fetch a binary asset (image / GLB / splat) as a blob URL that `<img>`,
 *  `TextureLoader`, and `useGLTF` can consume. Returned URL must be revoked
 *  with `URL.revokeObjectURL` when no longer needed to avoid leaks. */
export async function apiBlobUrl(input: string): Promise<string> {
  const res = await apiFetch(input);
  if (!res.ok) {
    throw new Error(`Failed to load asset ${input}: ${res.status}`);
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
