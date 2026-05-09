export interface GpxPoint {
  lat: number;
  lon: number;
  ele: number | null;
  time: Date;
}

export interface GpxData {
  points: GpxPoint[];
  dateMin: Date | null;
  dateMax: Date | null;
}

export interface PhotoItem {
  filePath: string;
  datetimeRaw: string;
  offsetStr: string | null;
  datetime: Date | null;
  hasGps: boolean;
}

export type MatchStatus = 'pending' | 'ok' | 'done' | 'warning' | 'skip' | 'error';

export interface MatchResult extends PhotoItem {
  utcTime: Date | null;
  status: MatchStatus;
  statusLabel: string;
  match: (GpxPoint & { diffSec: number }) | null;
}

export interface WriteGpsPayload {
  filePath: string;
  lat: number;
  lon: number;
  ele: number | null;
  overwrite: boolean;
  utcTime: string | null; // ISO 8601 UTC（DTO+Offset書き換え用）
  datetimeRaw: string;    // 元の DateTimeOriginal 文字列（空文字の場合は書き換えスキップ）
}

export interface MatchOptions {
  maxTimeDiff: number;
  overwriteGps: boolean;
  tzMode: 'auto' | 'manual';
  tzOffsetHours: number;
  stationaryGapFill: boolean;
  stationaryGapMaxDist: number; // meters
}

// window.api の型定義
export interface Api {
  checkExiftool: () => Promise<string | null>;
  selectFolder:  () => Promise<string | null>;
  selectGpx:     () => Promise<string[] | null>;
  readFile:      (path: string) => Promise<string | null>;
  listJpegs:     (folder: string) => Promise<string[]>;
  readExifBatch: (paths: string[]) => Promise<Record<string, unknown>[]>;
  writeGps:        (payload: WriteGpsPayload) => Promise<boolean>;
  readImageBase64: (path: string) => Promise<string | null>;
  getSetting:        (key: string) => Promise<unknown>;
  setSetting:        (key: string, val: unknown) => Promise<void>;
  listGeoShutterGpx: () => Promise<string[]>;
}

declare global {
  interface Window { api: Api; }
}
