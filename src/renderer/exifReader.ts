import { PhotoItem } from './types';

export function normalizeExif(rawList: Record<string, unknown>[]): PhotoItem[] {
  return rawList.map(item => {
    const filePath   = (item['SourceFile'] as string) ?? '';
    const dtoRaw     = (item['DateTimeOriginal'] as string) ?? '';
    // OffsetTimeOriginal がない場合（Lightroom書き出しJPGなど）は OffsetTime にフォールバック
    // 新しいタグを参照する場合は main.ts の readExifBatch にも追加すること
    const offsetStr  = (item['OffsetTimeOriginal'] as string) ?? (item['OffsetTime'] as string) ?? null;
    const datetime   = parseSonyDateTime(dtoRaw, offsetStr);
    const hasGps     = !!(item['GPSLatitude'] && item['GPSLongitude']);
    return { filePath, datetimeRaw: dtoRaw, offsetStr, datetime, hasGps };
  });
}

// "2026:04:13 04:52:50" + "-08:00" → UTC の Date（変換不能なら null）
export function parseSonyDateTime(dtoRaw: string, offsetStr: string | null): Date | null {
  if (!dtoRaw) return null;
  const iso = dtoRaw.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
  if (!offsetStr) return null;
  const d = new Date(`${iso}${offsetStr}`);
  return isNaN(d.getTime()) ? null : d;
}

export function formatDatetimeDisplay(item: PhotoItem): string {
  if (!item.datetimeRaw) return '—';
  const d = item.datetimeRaw.slice(0, 16).replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
  return item.offsetStr ? `${d} (${item.offsetStr})` : d;
}
