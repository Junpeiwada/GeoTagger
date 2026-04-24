# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

GPXトラックログを使って写真にジオタグを付与する macOS Electron アプリ。

## ドキュメント

| ファイル | 内容 |
|---------|------|
| [Docs/仕様.md](Docs/仕様.md) | 機能仕様・画面構成・マッチングロジック |
| [Docs/計画-実装計画.md](Docs/計画-実装計画.md) | フェーズ別実装計画（フェーズ1〜4） |
| [DESIGN.md](DESIGN.md) | デザインシステム（カラー・タイポ・コンポーネント） |

## 技術スタック

- **Electron 34** + **TypeScript 5.4**（フレームワークなし、Vanilla JS UI）
- **Leaflet.js 1.9.4 + OpenStreetMap**（地図表示、CDN経由でバンドル外部化）
- **exiftool**（Homebrew導入済み前提、GPS書き込み・EXIF一括読み取り）
- **electron-store**（設定永続化）
- **Webpack 5** + **electron-builder**（ビルド・DMG生成）

## 開発コマンド

```bash
npm run dev          # 全バンドルビルド + Electron起動
npm run build        # main / preload / renderer を全ビルド
npm run typecheck    # 型チェック（tsconfig.json, .main.json, .preload.json）
npm run dist         # macOS DMG生成
npm run watch:renderer  # レンダラーのみウォッチビルド
```

## アーキテクチャ

### ファイル構成

```
index.html          # UI HTML（Leaflet CDN読み込み、dist/renderer/renderer.js 参照）
styles.css          # CSS変数でトークン管理（ダークテーマ）
src/
├── main/
│   ├── main.ts     # メインプロセス：BrowserWindow・IPC・exiftool呼び出し
│   └── preload.ts  # contextBridge で window.api を公開
└── renderer/
    ├── app.ts      # グローバル状態・UIイベント・フロー制御（エントリポイント）
    ├── types.ts    # 型定義（GpxPoint, PhotoItem, MatchResult, MatchOptions）
    ├── gpxParser.ts   # DOMParser で <trkpt> を抽出しUTC昇順ソート
    ├── exifReader.ts  # exiftool JSON → PhotoItem 正規化
    ├── matcher.ts     # バイナリサーチで最近傍GPXポイントを検索
    └── mapHandler.ts  # Leaflet 操作（トラック描画・ピン・ハイライト）
```

### データフロー

```
GPX → parseGpx() → GpxData.points[] (UTC昇順)
                              ↓
JPEG → listJpegs() → readExifBatch() → normalizeExif() → PhotoItem[]
                                                              ↓
                                  matchAll(gpxPoints, photos, opts) → MatchResult[]
                                                              ↓
                                          renderPhotoList() + drawPhotoPins()
```

### IPC通信

レンダラーは `window.api.*` のみでメインと通信する（`nodeIntegration: false`）。

| API | 実装 | 用途 |
|-----|------|------|
| `checkExiftool()` | `which exiftool` 相当 | 起動時の存在確認 |
| `readExifBatch(paths)` | `exiftool -json -n ...` | EXIF一括読み取り（maxBuffer 50MB）|
| `writeGps(args)` | `exiftool -GPSLatitude=... -overwrite_original` | GPS書き込み |
| `listJpegs(folder)` | `fs.readdirSync` | フォルダ内JPEG列挙 |
| `getSetting/setSetting` | electron-store | 設定永続化 |

新しいIPCチャネルを追加する手順：
1. `src/main/main.ts` で `ipcMain.handle('channel-name', ...)` を登録
2. `src/main/preload.ts` で `contextBridge.exposeInMainWorld` に追加
3. `src/renderer/` から `window.api.xxx()` として呼び出す

### レンダラーのグローバル状態（app.ts）

```typescript
let gpxData: GpxData | null;
let photoItems: PhotoItem[];
let matchResults: MatchResult[];
let selectedIndex: number;
```

### マッチングロジック（matcher.ts）

- `MatchStatus`: `'pending' | 'ok' | 'done' | 'warning' | 'skip' | 'error'`
- `ok` → GPS書き込み対象。それ以外は `runApply()` でスキップ
- 時刻変換: `DateTimeOriginal + OffsetTimeOriginal → UTC`（手動モード時は `tzOffsetHours` で上書き）
- `maxTimeDiff` 超過 or GPXなし → `warning`（書き込まない）

### Leaflet（mapHandler.ts）

- `leaflet` は webpack で `externals: { leaflet: 'L' }` によりバンドル外部化
- `index.html` の CDN `<script>` で `window.L` として事前ロード
- ピンは赤/青のカスタムSVGアイコン。`highlightPin()` でクリック行と連動

## デザインルール

**UI を変更・追加する際は必ず [DESIGN.md](DESIGN.md) を参照すること。**

- カラーは `styles.css` の CSS 変数（`--bg`, `--accent` 等）を使う。新しい色を追加しない
- フォントサイズは 11px 未満にしない
- ボタンは `btn-secondary` / `btn-primary` / `btn-accent` の3種類のみ
- `border-radius` は最大 8px まで

## 主要な制約

- exiftool が存在しない場合は起動時に警告バナーを表示し、付与ボタンを無効化する
- GPXのタイムスタンプは常にUTC（末尾Z）前提。GPXファイル名のオフセット情報は無視する
- 写真のUTC変換は `OffsetTimeOriginal` を使う。存在しない場合のみ手動モードにフォールバック
- `⚠ 警告` ステータスのファイルは「付与」実行時に自動スキップ（書き込まない）
- `strict: false` で型チェックを運用中（プロジェクト方針）
