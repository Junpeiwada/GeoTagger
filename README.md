# GeoTagger

GPXトラックログを使って写真（JPEG）にジオタグ（GPS座標）を付与する macOS デスクトップアプリケーション。

![Platform](https://img.shields.io/badge/platform-macOS-lightgrey)
![Electron](https://img.shields.io/badge/Electron-28-47848F)
![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178C6)
![License](https://img.shields.io/badge/license-MIT-green)

## 概要

GeoShutter（iPhoneアプリ）で記録したGPXファイルと、Sony α1 / α7RV 等のカメラで撮影した写真を組み合わせ、EXIF の `OffsetTimeOriginal` を使って正確にUTC変換を行いジオタグを付与します。Lightroomのジオタグ機能より確実なタイムゾーン処理が特徴です。

## 機能

- **GPXファイル読み込み** — D&Dまたはファイルダイアログで読み込み、トラックポイントを地図に表示
- **写真フォルダ自動読み込み** — 起動時にデフォルトフォルダを自動スキャン
- **正確なUTC変換** — `OffsetTimeOriginal` を参照し、カメラのタイムゾーン設定を正しく処理
- **手動オフセット指定** — `OffsetTimeOriginal` がないJPEGへのフォールバックモード
- **バイナリサーチによる高速マッチング** — GPXポイントが数十万件あっても高速
- **プレビュー確認** — 書き込み前に全写真のマッチング結果（座標・時間差・状態）を確認
- **一括タグ付与** — `exiftool -overwrite_original` で ✓ 完了ファイルを一括書き込み
- **既存GPS上書き制御** — チェックボックスで既存タグの上書き可否を切り替え
- **OpenStreetMapによる地図表示** — GPXトラック（青線）と写真ピン（赤/青）をLeafletで表示

## 動作要件

| 項目 | 要件 |
|------|------|
| OS | macOS |
| Node.js | v18.0.0 以上 |
| exiftool | Homebrew でインストール済みであること |

```bash
brew install exiftool
```

## セットアップ

```bash
# リポジトリをクローン
git clone https://github.com/yourname/GeoTagger.git
cd GeoTagger

# 依存関係をインストール
npm install

# 開発モードで起動
npm run dev
```

## 開発コマンド

```bash
npm run dev          # 開発モード（ホットリロード）
npm run build        # main / preload / renderer をビルド
npm run typecheck    # 型チェック
npm run dist         # macOS DMG生成
```

## ワークフロー

```
① GPXファイルをウィンドウにドラッグ&ドロップ
② 写真フォルダを選択（または起動時の自動読み込みを使用）
③ 「プレビュー」でマッチング結果を確認
   → ✓ 完了 / ⚠ 警告 の状態をリストとマップで確認
④ 問題なければ「付与」で一括書き込み
   → ⚠ 警告のファイルは自動スキップ
```

## マッチングロジック

1. `DateTimeOriginal` + `OffsetTimeOriginal` でUTC変換
2. GPXトラックポイント（すべてUTC）からバイナリサーチで最近傍ポイントを検索
3. 時間差がしきい値（デフォルト3600秒）以内であれば座標を採用
4. `exiftool` で `GPSLatitude` / `GPSLongitude` / `GPSAltitude` を書き込み

## 技術スタック

- **Electron 28** + **TypeScript 5.4**（Vanilla JS UI）
- **Leaflet.js 1.9.4** + **OpenStreetMap**（APIキー不要）
- **exiftool**（GPS書き込み・EXIF一括読み取り）
- **electron-store**（設定永続化）
- **Webpack 5** + **electron-builder**

## ライセンス

MIT
