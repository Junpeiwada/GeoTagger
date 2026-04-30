declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

import { app, BrowserWindow, ipcMain, dialog, session } from 'electron';
import * as path from 'path';
import { execFile, spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import Store from 'electron-store';
import { find as findTz, preCache as preCacheTz } from 'geo-tz';

// ===== exiftool 常駐デーモン =====
class ExiftoolDaemon {
  private proc: ChildProcess | null = null;
  private buf = '';
  private queue: Array<{ resolve: (v: Record<string, unknown>[]) => void }> = [];

  start(): void {
    if (this.proc) return;
    this.proc = spawn('exiftool', ['-stay_open', 'True', '-@', '-'], {
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    this.proc.stdout!.setEncoding('utf-8');
    this.proc.stdout!.on('data', (chunk: string) => {
      this.buf += chunk;
      // exiftool は各 -execute の応答末尾に "{ready}\n" を出力する
      const readyMarker = '{ready}\n';
      let pos: number;
      while ((pos = this.buf.indexOf(readyMarker)) !== -1) {
        const block = this.buf.slice(0, pos).trim();
        this.buf = this.buf.slice(pos + readyMarker.length);
        const waiter = this.queue.shift();
        if (!waiter) continue;
        try {
          waiter.resolve(block ? JSON.parse(block) : []);
        } catch {
          waiter.resolve([]);
        }
      }
    });
    this.proc.on('exit', () => {
      this.proc = null;
      // 未処理の待機者を空配列で解決して詰まらせない
      for (const w of this.queue) w.resolve([]);
      this.queue = [];
    });
  }

  readExifBatch(filePaths: string[]): Promise<Record<string, unknown>[]> {
    if (!this.proc || !this.proc.stdin) {
      return Promise.resolve([]);
    }
    return new Promise((resolve) => {
      this.queue.push({ resolve });
      try {
        const lines = [
          '-json',
          '-DateTimeOriginal',
          '-OffsetTimeOriginal',
          '-GPSLatitude',
          '-GPSLongitude',
          '-GPSAltitude',
          '-n',
          ...filePaths,
          '-execute',
          '',
        ].join('\n');
        this.proc!.stdin!.write(lines);
      } catch {
        this.queue.pop();
        resolve([]);
      }
    });
  }

  terminate(): void {
    const proc = this.proc;
    if (!proc) return;
    this.proc = null;
    try {
      proc.stdin?.write('-stay_open\nFalse\n');
      proc.stdin?.end();
    } catch {
      proc.kill();
    }
  }
}

const exiftoolDaemon = new ExiftoolDaemon();

interface StoreSchema {
  photoFolder: string;
  windowBounds: { x?: number; y?: number; width: number; height: number };
  tzMode: 'auto' | 'manual';
  tzOffset: number;
  overwriteGps: boolean;
  maxTimeDiff: number;
  previewPaneHeight: number;
}

const store = new Store<StoreSchema>({
  defaults: {
    photoFolder: '/Users/junpeiwada/Documents/LightroomOutput',
    windowBounds: { width: 1280, height: 800 },
    tzMode: 'auto',
    tzOffset: -8,
    overwriteGps: false,
    maxTimeDiff: 3600,
    previewPaneHeight: 200,
  },
});

let mainWindow: BrowserWindow;

function createWindow(): void {
  const bounds = store.get('windowBounds');

  mainWindow = new BrowserWindow({
    ...bounds,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
    titleBarStyle: 'hiddenInset',
    title: 'GeoTagger',
  });

  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  mainWindow.on('resize', () => store.set('windowBounds', mainWindow.getBounds()));
  mainWindow.on('move',   () => store.set('windowBounds', mainWindow.getBounds()));
  mainWindow.on('closed', () => app.quit());

  mainWindow.webContents.on('before-input-event', (_event, input) => {
    if (input.type === 'keyDown' && input.key === 'F12') {
      if (mainWindow.webContents.isDevToolsOpened()) {
        mainWindow.webContents.closeDevTools();
      } else {
        mainWindow.webContents.openDevTools();
      }
    }
  });
}

const CSP_DEV  = "default-src 'self' http://localhost:* ws://localhost:*; img-src 'self' file: data: https://*.tile.openstreetmap.org https://server.arcgisonline.com blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:*;";
const CSP_PROD = "default-src 'self'; img-src 'self' file: data: https://*.tile.openstreetmap.org https://server.arcgisonline.com blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline';";

// geo-tz の地理データを起動時にウォームアップ（初回 GPS 書き込みのレイテンシを回避）
preCacheTz();

app.whenReady().then(() => {
  const csp = process.env.NODE_ENV === 'development' ? CSP_DEV : CSP_PROD;
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp],
      },
    });
  });

  exiftoolDaemon.start();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('will-quit', () => exiftoolDaemon.terminate());


// exiftool の存在確認
ipcMain.handle('check-exiftool', async (): Promise<string | null> => {
  return new Promise((resolve) => {
    execFile('exiftool', ['-ver'], (err, stdout) => {
      resolve(err ? null : stdout.trim());
    });
  });
});

// フォルダ選択ダイアログ
ipcMain.handle('select-folder', async (): Promise<string | null> => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  });
  return result.canceled ? null : result.filePaths[0];
});

// GPX ファイル選択ダイアログ（複数選択対応）
ipcMain.handle('select-gpx', async (): Promise<string[] | null> => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'GPX Files', extensions: ['gpx'] }],
  });
  return result.canceled ? null : result.filePaths;
});

// ファイルをテキストとして読み込み（.gpx のみ許可）
ipcMain.handle('read-file', (_event, filePath: string): string | null => {
  if (!/\.gpx$/i.test(filePath)) return null;
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
});

// フォルダ内の JPEG リストアップ
ipcMain.handle('list-jpegs', (_event, folderPath: string): string[] => {
  try {
    return fs.readdirSync(folderPath)
      .filter(f => /\.(jpg|jpeg)$/i.test(f))
      .map(f => path.join(folderPath, f));
  } catch {
    return [];
  }
});

// EXIF 一括取得（exiftool -stay_open デーモン経由）
ipcMain.handle('read-exif-batch', (_event, filePaths: string[]): Promise<Record<string, unknown>[]> => {
  if (!filePaths.length) return Promise.resolve([]);
  return exiftoolDaemon.readExifBatch(filePaths);
});

// GPS タグ書き込み
interface WriteGpsPayload {
  filePath: string;
  lat: number;
  lon: number;
  ele: number | null;
  overwrite: boolean;
  utcTime: string | null;
  datetimeRaw: string; // 空文字の場合は DateTimeOriginal 書き換えをスキップ
}

function calcOffsetStr(lat: number, lon: number, utcIso: string): { offsetStr: string; localDto: string } | null {
  try {
    const tzNames = findTz(lat, lon);
    if (!tzNames.length) return null;
    const tzName = tzNames[0];
    const utcDate = new Date(utcIso);
    if (isNaN(utcDate.getTime())) return null;
    // sv ロケールは "YYYY-MM-DD HH:MM:SS" 形式を返す（T区切りなし）
    const locStr = utcDate.toLocaleString('sv', { timeZone: tzName });
    const offsetMs = new Date(locStr + 'Z').getTime() - utcDate.getTime();
    const offsetTotalMin = Math.round(offsetMs / 60000);
    const sign = offsetTotalMin >= 0 ? '+' : '-';
    const absMin = Math.abs(offsetTotalMin);
    const hh = String(Math.floor(absMin / 60)).padStart(2, '0');
    const mm = String(absMin % 60).padStart(2, '0');
    const offsetStr = `${sign}${hh}:${mm}`;
    // exiftool 形式: "YYYY:MM:DD HH:MM:SS"（ハイフンをコロンに統一）
    const localDto = locStr.replace(/-/g, ':');
    return { offsetStr, localDto };
  } catch {
    return null;
  }
}

ipcMain.handle('write-gps', (_event, payload: WriteGpsPayload): Promise<boolean> => {
  const { filePath, lat, lon, ele, overwrite, utcTime, datetimeRaw } = payload;

  // filePath がフォルダとして登録済みのパスの下にあるか確認
  const resolved = path.resolve(filePath);
  const photoFolder = store.get('photoFolder');
  if (!resolved.startsWith(path.resolve(photoFolder) + path.sep)) {
    return Promise.resolve(false);
  }

  const args: string[] = [
    `-GPSLatitude=${Math.abs(lat)}`,
    `-GPSLatitudeRef=${lat >= 0 ? 'N' : 'S'}`,
    `-GPSLongitude=${Math.abs(lon)}`,
    `-GPSLongitudeRef=${lon >= 0 ? 'E' : 'W'}`,
  ];
  if (ele !== null && !isNaN(ele)) {
    args.push(`-GPSAltitude=${Math.abs(ele)}`, `-GPSAltitudeRef=${ele >= 0 ? '0' : '1'}`);
  }

  // GPS 座標と UTC 時刻から OffsetTimeOriginal と DateTimeOriginal を算出して書き換える
  // datetimeRaw がない写真は DateTimeOriginal 自体が存在しないため書き換え対象外とする
  if (utcTime && datetimeRaw) {
    const tzResult = calcOffsetStr(lat, lon, utcTime);
    if (tzResult) {
      args.push(
        `-DateTimeOriginal=${tzResult.localDto}`,
        `-OffsetTimeOriginal=${tzResult.offsetStr}`,
        `-OffsetTime=${tzResult.offsetStr}`,
        `-OffsetTimeDigitized=${tzResult.offsetStr}`,
      );
    }
  }

  if (overwrite) args.push('-overwrite_original');
  args.push(resolved);

  return new Promise((resolve) => {
    execFile('exiftool', args, (err) => resolve(!err));
  });
});

// 写真サムネイル取得（Base64）
ipcMain.handle('read-image-base64', (_event, filePath: string): string | null => {
  const resolved = path.resolve(filePath);
  const photoFolder = store.get('photoFolder');
  if (!resolved.startsWith(path.resolve(photoFolder) + path.sep)) return null;
  try {
    const data = fs.readFileSync(resolved);
    return `data:image/jpeg;base64,${data.toString('base64')}`;
  } catch {
    return null;
  }
});

// 設定の読み書き
ipcMain.handle('get-setting', (_event, key: keyof StoreSchema) => store.get(key));
ipcMain.handle('set-setting', (_event, key: keyof StoreSchema, value: unknown) => store.set(key, value as StoreSchema[typeof key]));
