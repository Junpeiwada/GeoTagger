import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  checkExiftool: ()                         => ipcRenderer.invoke('check-exiftool'),
  selectFolder:  ()                         => ipcRenderer.invoke('select-folder'),
  selectGpx:     ()                         => ipcRenderer.invoke('select-gpx'),
  readFile:      (p: string)                => ipcRenderer.invoke('read-file', p),
  listJpegs:     (folder: string)           => ipcRenderer.invoke('list-jpegs', folder),
  readExifBatch: (paths: string[])          => ipcRenderer.invoke('read-exif-batch', paths),
  writeGps:      (payload: unknown)          => ipcRenderer.invoke('write-gps', payload),
  readImageBase64: (p: string)              => ipcRenderer.invoke('read-image-base64', p),
  getSetting:    (key: string)              => ipcRenderer.invoke('get-setting', key),
  setSetting:    (key: string, val: unknown) => ipcRenderer.invoke('set-setting', key, val),
});
