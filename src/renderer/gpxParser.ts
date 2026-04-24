import { GpxData, GpxPoint } from './types';

export function parseGpx(xmlText: string): GpxData {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'application/xml');
  const trkpts = Array.from(doc.querySelectorAll('trkpt'));
  const points: GpxPoint[] = [];

  for (const pt of trkpts) {
    const lat = parseFloat(pt.getAttribute('lat') ?? '');
    const lon = parseFloat(pt.getAttribute('lon') ?? '');
    const timeEl = pt.querySelector('time');
    const eleEl  = pt.querySelector('ele');
    if (isNaN(lat) || isNaN(lon) || !timeEl) continue;

    const time = new Date(timeEl.textContent!.trim());
    if (isNaN(time.getTime())) continue;

    const eleVal = eleEl ? parseFloat(eleEl.textContent ?? '') : NaN;
    points.push({ lat, lon, ele: isNaN(eleVal) ? null : eleVal, time });
  }

  points.sort((a, b) => a.time.getTime() - b.time.getTime());

  return {
    points,
    dateMin: points.length ? points[0].time : null,
    dateMax: points.length ? points[points.length - 1].time : null,
  };
}

export function gpxSummary({ points, dateMin, dateMax }: GpxData): string {
  if (!points.length) return 'ポイントなし';
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return `${points.length.toLocaleString()} ポイント / ${fmt(dateMin!)} 〜 ${fmt(dateMax!)}`;
}
