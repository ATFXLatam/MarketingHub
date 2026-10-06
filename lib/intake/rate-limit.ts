// Rate limit en memoria por clave (ventana deslizante de timestamps). En Vercel serverless el Map
// vive por isolate, así que el límite no es hermético entre instancias frías/regiones: es un freno de
// bursts y doble-submit, no un control fuerte (eso pediría Redis/KV, deuda registrada). Se purgan
// buckets muertos al escribir para que el Map no crezca con cada clave única.

export function createRateLimiter(max: number, windowMs: number): (key: string) => boolean {
  const buckets = new Map<string, number[]>();

  return function isRateLimited(key: string): boolean {
    const now = Date.now();
    const cutoff = now - windowMs;
    for (const [k, hits] of buckets) {
      if (hits.length === 0 || hits[hits.length - 1] <= cutoff) buckets.delete(k);
    }
    const hits = (buckets.get(key) ?? []).filter((t) => t > cutoff);
    if (hits.length >= max) {
      buckets.set(key, hits);
      return true;
    }
    buckets.set(key, [...hits, now]);
    return false;
  };
}
