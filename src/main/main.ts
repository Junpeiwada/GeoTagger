declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

import { app, BrowserWindow, ipcMain, dialog, session } from 'electron';
import * as path from 'path';
import { execFile } from 'child_process';
import * as fs from 'fs';
import Store from 'electron-store';

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

  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});


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

// GPX ファイル選択ダイアログ
ipcMain.handle('select-gpx', async (): Promise<string | null> => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'GPX Files', extensions: ['gpx'] }],
  });
  return result.canceled ? null : result.filePaths[0];
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

// EXIF 一括取得（exiftool -json）
ipcMain.handle('read-exif-batch', (_event, filePaths: string[]): Promise<Record<string, unknown>[]> => {
  if (!filePaths.length) return Promise.resolve([]);
  return new Promise((resolve) => {
    const args = [
      '-json',
      '-DateTimeOriginal',
      '-OffsetTimeOriginal',
      '-GPSLatitude',
      '-GPSLongitude',
      '-GPSAltitude',
      '-n',
      ...filePaths,
    ];
    execFile('exiftool', args, { maxBuffer: 50 * 1024 * 1024 }, (err, stdout) => {
      if (err && !stdout) return resolve([]);
      try { resolve(JSON.parse(stdout)); } catch { resolve([]); }
    });
  });
});

// GPS タグ書き込み
interface WriteGpsPayload {
  filePath: string;
  lat: number;
  lon: number;
  ele: number | null;
  overwrite: boolean;
}

ipcMain.handle('write-gps', (_event, payload: WriteGpsPayload): Promise<boolean> => {
  const { filePath, lat, lon, ele, overwrite } = payload;

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
  if (overwrite) args.push('-overwrite_original');
  args.push(resolved);

  return new Promise((resolve) => {
    execFile('exiftool', args, (err) => resolve(!err));
  });
});

// 設定の読み書き
ipcMain.handle('get-setting', (_event, key: keyof StoreSchema) => store.get(key));
ipcMain.handle('set-setting', (_event, key: keyof StoreSchema, value: unknown) => store.set(key, value as StoreSchema[typeof key]));
