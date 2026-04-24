---
name: GeoTagger
description: GPX ジオタガー macOS デスクトップアプリのデザインシステム
colors:
  primary: "#1e1e1e"
  surface: "#2a2a2a"
  surface-raised: "#333333"
  border: "#444444"
  text: "#e0e0e0"
  text-muted: "#888888"
  accent: "#4a9eff"
  accent-dim: "#1a4a7a"
  success: "#4caf50"
  warning: "#ff9800"
  danger: "#f44336"
  success-surface: "#2a5a2a"
  warning-surface: "#5a3000"
typography:
  body:
    fontFamily: -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif
    fontSize: 13px
    lineHeight: 1.5
  small:
    fontFamily: -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif
    fontSize: 12px
    lineHeight: 1.5
  label-caps:
    fontFamily: -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif
    fontSize: 11px
    fontWeight: 600
    letterSpacing: 0.05em
rounded:
  sm: 4px
  md: 6px
  lg: 8px
spacing:
  xs: 4px
  sm: 6px
  md: 8px
  lg: 12px
  xl: 16px
components:
  button-secondary:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
    padding: 5px 12px
  button-primary:
    backgroundColor: "{colors.accent-dim}"
    textColor: "#6ec4ff"
    rounded: "{rounded.sm}"
    padding: 5px 12px
  button-primary-hover:
    backgroundColor: "#245a9a"
  button-accent:
    backgroundColor: "{colors.success-surface}"
    textColor: "#6ed972"
    rounded: "{rounded.sm}"
    padding: 5px 12px
  drop-zone:
    backgroundColor: "transparent"
    textColor: "{colors.accent}"
    rounded: "{rounded.md}"
    padding: 10px 8px
  drop-zone-active:
    backgroundColor: "{colors.accent-dim}"
  sidebar:
    backgroundColor: "{colors.surface}"
    width: 260px
  photo-list:
    backgroundColor: "{colors.surface}"
    height: 220px
  preview-panel:
    backgroundColor: "{colors.surface}"
    height: 200px
  status-ok:
    textColor: "{colors.success}"
  status-warning:
    textColor: "{colors.warning}"
  status-error:
    textColor: "{colors.danger}"
  banner-warning:
    backgroundColor: "{colors.warning-surface}"
    textColor: "{colors.warning}"
  input:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
  section-divider:
    backgroundColor: "{colors.border}"
  placeholder:
    textColor: "{colors.text-muted}"
  window:
    backgroundColor: "{colors.primary}"
---

## Overview

GeoTagger は macOS ネイティブ感を意識したダークテーマのデスクトップツールです。地図・写真・リストを同時に表示する情報密度の高いレイアウトが特徴で、UI はワークフローの流れ（GPX読込 → マッチング確認 → タグ付与）を左から右・上から下で自然に追えるように設計されています。

## Colors

ダークテーマをベースに、1色のアクセントカラーで操作の焦点を示します。

- **primary (#1e1e1e)**: ウィンドウ全体の背景。純黒より柔らかく目に優しい。
- **surface (#2a2a2a)**: サイドバー・プレビューパネル・写真リストの背景。背景より一段明るい。
- **surface-raised (#333333)**: テーブルヘッダー・select・number input など、surface 上に浮かぶ要素の背景。
- **border (#444444)**: セクション区切り・入力フィールド・ドロップゾーンの枠線。
- **text (#e0e0e0)**: 主要テキスト。白に近いが純白ではなくコントラストを抑える。
- **text-muted (#888888)**: セクションラベル・メタデータ・プレースホルダーなど補助情報。
- **accent (#4a9eff)**: インタラクションの焦点色。リンク・フォーカス・btn-primary のテキスト・ドロップゾーンのハイライト・マップの選択ピン。
- **accent-dim (#1a4a7a)**: accent の背景バージョン。btn-primary の背景・選択行のハイライト・ドロップゾーンのアクティブ背景。
- **success (#4caf50)**: ✓ 完了ステータス・btn-accent のテキスト。
- **warning (#ff9800)**: ⚠ 警告ステータス・警告バナーのテキスト。
- **danger (#f44336)**: ✗ エラーステータス。
- **success-surface (#2a5a2a)**: btn-accent の背景（「付与」ボタン）。
- **warning-surface (#5a3000)**: 警告バナーの背景。

## Typography

システムフォント（-apple-system / Helvetica Neue）を全面使用し、macOS ネイティブの読みやすさを優先します。フォントサイズは 11px〜13px の狭い範囲に収め、情報密度を保ちます。

- **body (13px)**: テーブル行・プレビューメタ・一般テキスト。
- **small (12px)**: ボタン・ラジオ・チェックボックス・select・ドロップゾーンのヒント文。
- **label-caps (11px, weight 600, 0.05em)**: セクションラベル（大文字表記）・テーブルヘッダー・ヘッダーバーのサマリ。

## Layout

3ペイン構成（左サイドバー / 右上マップ / 右下プレビュー）＋ 下部写真リストの固定レイアウトです。

- サイドバー幅: 260px（固定）
- 写真リスト高さ: 220px（固定）
- プレビューパネル高さ: 200px（ドラッグリサイズ可能、最小 80px）
- マップエリア: 残余スペースをすべて使用
- リサイズハンドル: 高さ 6px、hover 時に accent 色に変化

## Components

### Buttons

3種のボタンが共存します。すべて `border-radius: 5px`、`font-size: 12px`、`padding: 5px 12px`。

- **btn-secondary**: surface-raised 背景 + border 枠線。ファイル選択・フォルダ選択など補助操作。
- **btn-primary**: accent-dim 背景 + accent 色テキスト・枠線。「プレビュー」ボタン。操作の主動線。
- **btn-accent**: success-surface 背景 + success 色テキスト・枠線。「付与」ボタン。最終確定操作を緑で区別。

無効状態（`:disabled`）は `opacity: 0.35`、カーソルを `not-allowed` に変更。

### Drop Zone

GPX ファイルのドラッグ&ドロップ受付エリア。border-dashed + border(#444) でアウトラインを示す。ドラッグオーバー時に accent-dim 背景と accent 色枠線に切り替え。

### Photo Table

写真リストのテーブル。行クリックで accent-dim 背景に変化（selected 状態）。hover で surface-raised 背景に変化。状態列は success / warning / text-muted / danger で色分け。

### Status Indicators

- ✓ 完了: `color: success`
- ⚠ 警告: `color: warning`
- スキップ: `color: text-muted`
- エラー: `color: danger`

## Do's and Don'ts

- **Do**: アクセントカラー（accent / accent-dim）はインタラクションと選択状態にのみ使う。情報のハイライトには使わない。
- **Do**: セクションラベルは必ず label-caps スタイル（大文字・11px・letter-spacing）で統一する。
- **Don't**: 新しいカラーを追加しない。状態表現はすべて success / warning / danger / text-muted で表現する。
- **Don't**: フォントサイズを 11px 未満にしない。情報密度を上げたい場合はスペーシングで調整する。
- **Don't**: border-radius を rounded.lg（8px）より大きくしない。ツールとしての精密感を保つ。
