import { useState, useEffect } from 'react';

export interface UniraMahasiswaAttributes {
  thumbnail?: string | null;
  totalSks?: number;
  status?: number;
  nama?: string;
  kelas?: string;
  peminatan?: number;
  hp?: string | null;
  alamat?: string | null;
}

export interface UniraMahasiswaData {
  id: number | string;
  type: string;
  attributes: UniraMahasiswaAttributes;
}

export interface UniraMahasiswaResponse {
  jsonapi?: { version: string };
  meta?: {
    count: number;
    [key: string]: any;
  };
  data?: UniraMahasiswaData[];
}

const photoMemoryCache = new Map<string, string | null>();

/**
 * Menentukan apakah peserta merupakan mahasiswa (bukan kategori umum)
 */
export function isMahasiswa(
  role?: string | null,
  identifier?: string | null,
  institution?: string | null
): boolean {
  if (role === 'mahasiswa') return true;
  if (role === 'umum') return false;
  if (institution && institution.toLowerCase().trim() === 'umum') return false;
  if (identifier && identifier.toUpperCase().startsWith('UMUM')) return false;

  // Jika identifier terdiri dari angka (format NIM UNIRA)
  if (identifier && /^\d+$/.test(identifier.trim())) {
    return true;
  }

  return false;
}

/**
 * Mengambil URL foto mahasiswa dari API UNIRA berdasarkan NIM
 */
export async function fetchMahasiswaPhotoUrl(nim?: string | null): Promise<string | null> {
  if (!nim) return null;
  const cleanNim = nim.trim();
  if (!cleanNim || !/^\d+$/.test(cleanNim)) return null;

  // 1. Cek memory cache
  if (photoMemoryCache.has(cleanNim)) {
    return photoMemoryCache.get(cleanNim) || null;
  }

  // 2. Cek localStorage cache
  try {
    const cached = localStorage.getItem(`cat_photo_${cleanNim}`);
    if (cached) {
      photoMemoryCache.set(cleanNim, cached);
      return cached;
    }
  } catch {}

  const rawBaseUrl = import.meta.env.VITE_UNIRA_API_BASE_URL || 'https://api.unira.ac.id';
  const baseUrl = rawBaseUrl.replace(/\/$/, '');
  const url = `${baseUrl}/v1/mahasiswa?filter[nim]=${encodeURIComponent(cleanNim)}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      photoMemoryCache.set(cleanNim, null);
      return null;
    }

    const json: UniraMahasiswaResponse = await res.json();
    if (json.data && json.data.length > 0 && json.data[0].attributes?.thumbnail) {
      const thumb = json.data[0].attributes.thumbnail.trim();
      const photoUrl =
        thumb.startsWith('http://') || thumb.startsWith('https://')
          ? thumb
          : `${baseUrl}/${thumb.replace(/^\//, '')}`;

      photoMemoryCache.set(cleanNim, photoUrl);
      try {
        localStorage.setItem(`cat_photo_${cleanNim}`, photoUrl);
      } catch {}
      return photoUrl;
    }

    photoMemoryCache.set(cleanNim, null);
    return null;
  } catch (err) {
    console.warn(`[UNIRA API] Gagal memuat foto mahasiswa untuk NIM ${cleanNim}:`, err);
    return null;
  }
}

/**
 * Hook React untuk mengambil foto mahasiswa secara reaktif
 */
export function useStudentPhoto(
  identifier?: string | null,
  role?: string | null,
  institution?: string | null
): { photoUrl: string | null; loading: boolean } {
  const [photoUrl, setPhotoUrl] = useState<string | null>(() => {
    if (identifier && /^\d+$/.test(identifier.trim())) {
      try {
        return localStorage.getItem(`cat_photo_${identifier.trim()}`);
      } catch {
        return null;
      }
    }
    return null;
  });
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;

    if (!identifier || !isMahasiswa(role, identifier, institution)) {
      setPhotoUrl(null);
      setLoading(false);
      return;
    }

    const cleanNim = identifier.trim();
    const cached = photoMemoryCache.get(cleanNim);
    if (cached !== undefined) {
      setPhotoUrl(cached);
      return;
    }

    setLoading(true);
    fetchMahasiswaPhotoUrl(cleanNim)
      .then((url) => {
        if (isMounted) {
          setPhotoUrl(url);
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [identifier, role, institution]);

  return { photoUrl, loading };
}
