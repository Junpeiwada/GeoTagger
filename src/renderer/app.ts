import '../../styles.css';
import { parseGpx, gpxSummary } from './gpxParser';
import { normalizeExif } from './exifReader';
import { matchAll, fmtDiff } from './matcher';
import { initMap, drawGpxTrack, drawPhotoPins, highlightPin, toggleMapTile } from './mapHandler';
import { GpxData, MatchResult, PhotoItem, WriteGpsPayload } from './types';

// ===== 状態 =====
let gpxData: GpxData | null = null;
let photoItems: PhotoItem[] = [];
let matchResults: MatchResult[] = [];
let selectedIndex = -1;

// ===== DOM ヘルパー =====
function $<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

// ===== 起動 =====
window.addEventListener('DOMContentLoaded', () => { init(); });

async function init(): Promise<void> {
  buildTzSelect();
  initMap('map');
  setupResizeHandle();

  const ver = await window.api.checkExiftool();
  if (!ver) $('exiftool-warning').classList.remove('hidden');

  const [folder, tzMode, tzOffset, overwrite, maxDiff, paneH] = await Promise.all([
    window.api.getSetting('photoFolder'),
    window.api.getSetting('tzMode'),
    window.api.getSetting('tzOffset'),
    window.api.getSetting('overwriteGps'),
    window.api.getSetting('maxTimeDiff'),
    window.api.getSetting('previewPaneHeight'),
  ]);

  const tzModeVal = (tzMode as string) ?? 'auto';
  const tzOffsetVal = (tzOffset as number) ?? -8;

  (document.querySelector(`input[name="tz-mode"][value="${tzModeVal}"]`) as HTMLInputElement).checked = true;
  ($<HTMLSelectElement>('tz-offset-select')).value = String(tzOffsetVal);
  ($<HTMLInputElement>('overwrite-gps')).checked = (overwrite as boolean) ?? false;
  ($<HTMLInputElement>('max-time-diff')).value = String((maxDiff as number) ?? 3600);
  if (paneH) $('preview-panel').style.height = `${paneH}px`;
  toggleTzSelect(tzModeVal === 'manual');

  if (folder) await loadPhotoFolder(folder as string);

  setupEvents();
}

// ===== イベント設定 =====
function setupEvents(): void {
  // GPX D&D
  let dragCounter = 0;
  document.addEventListener('dragenter', e => {
    e.preventDefault();
    dragCounter++;
    const dt = (e as DragEvent).dataTransfer;
    if (dt?.items.length === 1) $('gpx-drop-zone').classList.add('drag-over');
  });
  document.addEventListener('dragover', e => { e.preventDefault(); });
  document.addEventListener('dragleave', () => {
    dragCounter--;
    if (dragCounter <= 0) {
      dragCounter = 0;
      $('gpx-drop-zone').classList.remove('drag-over');
    }
  });
  document.addEventListener('drop', async e => {
    e.preventDefault();
    dragCounter = 0;
    $('gpx-drop-zone').classList.remove('drag-over');
    const file = (e as DragEvent).dataTransfer?.files[0];
    if (file && /\.gpx$/i.test(file.name)) {
      await loadGpxFile((file as File & { path: string }).path);
    }
  });

  $('btn-select-gpx').addEventListener('click', async () => {
    const p = await window.api.selectGpx();
    if (p) await loadGpxFile(p);
  });

  $('btn-select-folder').addEventListener('click', async () => {
    const p = await window.api.selectFolder();
    if (p) {
      await window.api.setSetting('photoFolder', p);
      await loadPhotoFolder(p);
    }
  });

  document.querySelectorAll<HTMLInputElement>('input[name="tz-mode"]').forEach(r => {
    r.addEventListener('change', () => {
      toggleTzSelect(r.value === 'manual');
      window.api.setSetting('tzMode', r.value);
    });
  });

  $<HTMLSelectElement>('tz-offset-select').addEventListener('change', (e) => {
    window.api.setSetting('tzOffset', parseFloat((e.target as HTMLSelectElement).value));
  });
  $<HTMLInputElement>('overwrite-gps').addEventListener('change', (e) => {
    window.api.setSetting('overwriteGps', (e.target as HTMLInputElement).checked);
  });
  $<HTMLInputElement>('max-time-diff').addEventListener('change', (e) => {
    window.api.setSetting('maxTimeDiff', parseInt((e.target as HTMLInputElement).value, 10));
  });

  $('btn-apply').addEventListener('click', runApply);
  $('btn-tile').addEventListener('click', () => {
    const btn = $<HTMLButtonElement>('btn-tile');
    const isSat = btn.dataset['tile'] === 'satellite';
    toggleMapTile();
    btn.dataset['tile'] = isSat ? 'street' : 'satellite';
    btn.textContent = isSat ? '衛星' : '地図';
  });
}

// ===== GPX 読み込み =====
async function loadGpxFile(filePath: string): Promise<void> {
  const xml = await window.api.readFile(filePath);
  if (!xml) return;
  gpxData = parseGpx(xml);
  $('gpx-path-display').textContent = filePath.split('/').pop() ?? filePath;
  const info = $('gpx-info');
  info.textContent = gpxSummary(gpxData);
  info.classList.remove('hidden');
  drawGpxTrack(gpxData.points);
  updateActionButtons();
  if (photoItems.length) await runPreview();
}

// ===== 写真フォルダ読み込み =====
async function loadPhotoFolder(folderPath: string): Promise<void> {
  $('photo-folder-display').textContent = folderPath;
  const info = $('photo-info');
  info.textContent = '読み込み中…';
  info.classList.remove('hidden');

  const paths = await window.api.listJpegs(folderPath);
  if (!paths.length) {
    info.textContent = 'JPEGファイルが見つかりませんでした';
    photoItems = [];
    renderPhotoList([]);
    updateActionButtons();
    return;
  }

  const raw = await window.api.readExifBatch(paths);
  photoItems = normalizeExif(raw);
  matchResults = photoItems.map(p => ({ ...p, utcTime: null, status: 'pending' as const, statusLabel: '—', match: null }));

  const noOffset = photoItems.filter(p => !p.offsetStr);
  $('tz-warning').classList.toggle('hidden', noOffset.length === 0);

  info.textContent = `${photoItems.length} 枚`;
  renderPhotoList(matchResults);
  updateActionButtons();
  if (gpxData) await runPreview();
}

// ===== プレビュー =====
async function runPreview(): Promise<void> {
  if (!gpxData || !photoItems.length) return;
  setBusy(true);

  const tzMode    = (document.querySelector<HTMLInputElement>('input[name="tz-mode"]:checked'))?.value ?? 'auto';
  const tzOffset  = parseFloat($<HTMLSelectElement>('tz-offset-select').value);
  const maxDiff   = parseInt($<HTMLInputElement>('max-time-diff').value, 10);
  const overwrite = $<HTMLInputElement>('overwrite-gps').checked;

  matchResults = matchAll(gpxData.points, photoItems, {
    maxTimeDiff: maxDiff,
    overwriteGps: overwrite,
    tzMode: tzMode as 'auto' | 'manual',
    tzOffsetHours: tzOffset,
  });

  renderPhotoList(matchResults);
  drawPhotoPins(matchResults, filePath => {
    const idx = matchResults.findIndex(r => r.filePath === filePath);
    if (idx >= 0) selectRow(idx);
  });

  const okCount   = matchResults.filter(r => r.status === 'ok').length;
  const warnCount = matchResults.filter(r => r.status === 'warning').length;
  $('photo-info').textContent = `${photoItems.length} 枚  ✓ ${okCount}件  ⚠ ${warnCount}件`;

  setBusy(false);
  $<HTMLButtonElement>('btn-apply').disabled = okCount === 0;
}

// ===== タグ付与 =====
async function runApply(): Promise<void> {
  const targets = matchResults.filter(r => r.status === 'ok');
  if (!targets.length) return;

  if (!confirm(`✓ 完了 ${targets.length} 件に GPS タグを書き込みます。よろしいですか？`)) return;

  setBusy(true);
  let success = 0, failed = 0;

  try {
    const overwrite = $<HTMLInputElement>('overwrite-gps').checked;
    for (const r of targets) {
      if (!r.match) continue;
      const payload: WriteGpsPayload = {
        filePath: r.filePath,
        lat: r.match.lat,
        lon: r.match.lon,
        ele: r.match.ele,
        overwrite,
      };

      const ok = await window.api.writeGps(payload);
      if (ok) { r.status = 'done'; r.statusLabel = '✓ 書込済'; success++; }
      else    { r.status = 'error'; r.statusLabel = '⚠ 書込失敗'; failed++; }
    }

    renderPhotoList(matchResults);
    alert(`完了：成功 ${success} 件 / 失敗 ${failed} 件`);
  } finally {
    setBusy(false);
  }
}

// ===== 写真リスト描画 =====
function renderPhotoList(results: MatchResult[]): void {
  const ok   = results.filter(r => r.status === 'ok' || r.status === 'done').length;
  const warn = results.filter(r => r.status === 'warning').length;
  $('photo-list-summary').textContent = results.length
    ? `${results.length} 枚${ok ? `  ✓ ${ok}` : ''}${warn ? `  ⚠ ${warn}` : ''}`
    : '';

  const tbody = $('photo-tbody');
  tbody.innerHTML = '';

  results.forEach((r, i) => {
    const tr = document.createElement('tr');
    tr.dataset['index'] = String(i);
    if (i === selectedIndex) tr.classList.add('selected');

    const dtStr  = r.datetimeRaw ? r.datetimeRaw.slice(0, 16).replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3') + (r.offsetStr ? ` ${r.offsetStr}` : '') : '—';
    const utcStr = r.utcTime ? r.utcTime.toISOString().replace('T', ' ').slice(0, 19) : '—';
    const coord  = r.match ? `${r.match.lat.toFixed(4)}, ${r.match.lon.toFixed(4)}` : '—';
    const diff   = r.match ? fmtDiff(r.match.diffSec) : '—';
    const cls    = statusClass(r.status);

    const cells: [string, string][] = [
      [basename(r.filePath), r.filePath],
      [dtStr, ''],
      [utcStr, ''],
      [coord, ''],
      [diff, ''],
      [r.statusLabel, ''],
    ];
    cells.forEach(([text, title], ci) => {
      const td = document.createElement('td');
      td.textContent = text;
      if (title) td.title = title;
      if (ci === cells.length - 1) td.className = cls;
      tr.appendChild(td);
    });

    tr.addEventListener('click', () => selectRow(i));
    tbody.appendChild(tr);
  });
}

// ===== 行選択 =====
function selectRow(index: number): void {
  selectedIndex = index;
  document.querySelectorAll<HTMLTableRowElement>('#photo-tbody tr').forEach((tr, i) => {
    tr.classList.toggle('selected', i === index);
  });
  const r = matchResults[index];
  if (!r) return;
  showPreview(r);
  if (r.match) highlightPin(r.filePath);
}

// ===== プレビューパネル =====
function showPreview(r: MatchResult): void {
  $('preview-placeholder').classList.add('hidden');
  $('preview-content').classList.remove('hidden');

  ($<HTMLImageElement>('preview-img')).src = `file://${r.filePath}`;
  $('meta-filename').textContent  = basename(r.filePath);
  $('meta-datetime').textContent  = r.datetimeRaw
    ? r.datetimeRaw.slice(0, 16).replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3') + (r.offsetStr ? ` (${r.offsetStr})` : '')
    : '—';
  $('meta-utc').textContent       = r.utcTime ? r.utcTime.toISOString().replace('T', ' ').slice(0, 19) + ' UTC' : '—';
  $('meta-coords').textContent    = r.match ? `${r.match.lat.toFixed(5)}, ${r.match.lon.toFixed(5)}` : '—';
  $('meta-alt').textContent       = r.match?.ele != null ? `${r.match.ele.toFixed(1)} m` : '—';
  $('meta-diff').textContent      = r.match ? fmtDiff(r.match.diffSec) : '—';
  const statusEl = $('meta-status');
  statusEl.textContent = r.statusLabel;
  statusEl.className   = statusClass(r.status);
}

// ===== ユーティリティ =====
function buildTzSelect(): void {
  const sel = $<HTMLSelectElement>('tz-offset-select');
  for (let h = -12; h <= 14; h++) {
    const opt = document.createElement('option');
    opt.value = String(h);
    opt.textContent = `UTC${h >= 0 ? '+' : ''}${h}`;
    sel.appendChild(opt);
  }
  sel.value = '-8';
}

function toggleTzSelect(manual: boolean): void {
  $<HTMLSelectElement>('tz-offset-select').disabled = !manual;
}

function updateActionButtons(): void {
  $<HTMLButtonElement>('btn-apply').disabled = true;
}

function setBusy(busy: boolean): void {
  $<HTMLButtonElement>('btn-apply').disabled = busy;
}

function statusClass(status: string): string {
  const map: Record<string, string> = { ok: 'status-ok', done: 'status-ok', warning: 'status-warning', skip: 'status-skip', error: 'status-error' };
  return map[status] ?? '';
}

function basename(p: string): string { return p.split('/').pop() ?? p; }

function setupResizeHandle(): void {
  const handle = $('resize-handle');
  const panel  = $('preview-panel');
  let startY = 0, startH = 0;

  handle.addEventListener('mousedown', (e: MouseEvent) => {
    startY = e.clientY;
    startH = panel.offsetHeight;
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
  });

  function onMove(e: MouseEvent): void {
    const h = Math.max(60, Math.min(500, startH - (e.clientY - startY)));
    panel.style.height = `${h}px`;
  }

  function onUp(): void {
    window.api.setSetting('previewPaneHeight', panel.offsetHeight);
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup',   onUp);
  }
}
