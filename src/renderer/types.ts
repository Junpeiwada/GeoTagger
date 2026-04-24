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
}

export interface MatchOptions {
  maxTimeDiff: number;
  overwriteGps: boolean;
  tzMode: 'auto' | 'manual';
  tzOffsetHours: number;
}

// window.api の型定義
export interface Api {
  checkExiftool: () => Promise<string | null>;
  selectFolder:  () => Promise<string | null>;
  selectGpx:     () => Promise<string | null>;
  readFile:      (path: string) => Promise<string | null>;
  listJpegs:     (folder: string) => Promise<string[]>;
  readExifBatch: (paths: string[]) => Promise<Record<string, unknown>[]>;
  writeGps:      (payload: WriteGpsPayload) => Promise<boolean>;
  getSetting:    (key: string) => Promise<unknown>;
  setSetting:    (key: string, val: unknown) => Promise<void>;
}

declare global {
  interface Window { api: Api; }
}
