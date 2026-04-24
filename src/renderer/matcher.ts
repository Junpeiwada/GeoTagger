import { GpxPoint, MatchOptions, MatchResult, PhotoItem } from './types';

export function matchAll(
  gpxPoints: GpxPoint[],
  photos: PhotoItem[],
  opts: MatchOptions,
): MatchResult[] {
  const { maxTimeDiff, overwriteGps, tzMode, tzOffsetHours } = opts;

  return photos.map(photo => {
    let utcTime = photo.datetime;

    if (tzMode === 'manual' || !photo.offsetStr) {
      if (!photo.datetimeRaw) {
        return { ...photo, utcTime: null, status: 'error', statusLabel: '⚠ EXIF なし', match: null } as MatchResult;
      }
      const iso  = photo.datetimeRaw.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
      const sign = tzOffsetHours >= 0 ? '+' : '-';
      const abs  = Math.abs(tzOffsetHours);
      const hh   = String(Math.floor(abs)).padStart(2, '0');
      const mm   = String(Math.round((abs % 1) * 60)).padStart(2, '0');
      utcTime    = new Date(`${iso}${sign}${hh}:${mm}`);
    }

    if (!utcTime || isNaN(utcTime.getTime())) {
      return { ...photo, utcTime: null, status: 'error', statusLabel: '⚠ 時刻不明', match: null } as MatchResult;
    }

    if (photo.hasGps && !overwriteGps) {
      return { ...photo, utcTime, status: 'skip', statusLabel: '— スキップ', match: null } as MatchResult;
    }

    const nearest = binarySearchNearest(gpxPoints, utcTime);
    if (!nearest) {
      return { ...photo, utcTime, status: 'warning', statusLabel: '⚠ GPXなし', match: null } as MatchResult;
    }

    const diffSec = Math.abs((utcTime.getTime() - nearest.time.getTime()) / 1000);
    const matchPt = { ...nearest, diffSec };

    if (diffSec > maxTimeDiff) {
      return { ...photo, utcTime, status: 'warning', statusLabel: `⚠ 時間差 ${fmtDiff(diffSec)}`, match: matchPt } as MatchResult;
    }

    return { ...photo, utcTime, status: 'ok', statusLabel: '✓ 完了', match: matchPt } as MatchResult;
  });
}

function binarySearchNearest(points: GpxPoint[], target: Date): GpxPoint | null {
  if (!points.length) return null;
  const t = target.getTime();
  let lo = 0, hi = points.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (points[mid].time.getTime() < t) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0) {
    const dLo   = Math.abs(points[lo].time.getTime()     - t);
    const dPrev = Math.abs(points[lo - 1].time.getTime() - t);
    if (dPrev < dLo) return points[lo - 1];
  }
  return points[lo];
}

export function fmtDiff(sec: number): string {
  if (sec < 60)   return `${Math.round(sec)}秒`;
  if (sec < 3600) return `${Math.round(sec / 60)}分`;
  return `${(sec / 3600).toFixed(1)}時間`;
}
