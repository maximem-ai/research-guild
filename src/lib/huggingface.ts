// Hugging Face public profile counts (research signal). Non-blocking; cached for a day.
export type HfCounts = { models: number; datasets: number; spaces: number };

export async function fetchHfCounts(username: string): Promise<HfCounts | null> {
  try {
    const res = await fetch(`https://huggingface.co/api/users/${encodeURIComponent(username)}/overview`, {
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { numModels?: number; numDatasets?: number; numSpaces?: number };
    return { models: j.numModels ?? 0, datasets: j.numDatasets ?? 0, spaces: j.numSpaces ?? 0 };
  } catch {
    return null;
  }
}

export function hfPaperUrl(arxivId: string) {
  return `https://huggingface.co/papers/${arxivId}`;
}
