export interface PickedFile {
  file: File;
  handle?: FileSystemFileHandle;
}

interface OpenFilePickerOptions {
  multiple: boolean;
  types: { description: string; accept: Record<string, string[]> }[];
}

declare global {
  interface Window {
    showOpenFilePicker?: (options: OpenFilePickerOptions) => Promise<FileSystemFileHandle[]>;
  }
}

const DATABASE_NAME = 'dansbart-library';
const STORE_NAME = 'handles';
const sessionFiles = new Map<string, { trackId: string; file: File }>();

interface StoredFile {
  trackId: string;
  handle: FileSystemFileHandle;
}

interface PermissionHandle {
  queryPermission(descriptor: { mode: 'read' }): Promise<PermissionState>;
  requestPermission(descriptor: { mode: 'read' }): Promise<PermissionState>;
}

export class LocalFilePermissionDenied extends Error {}

export const canKeepHandles = () => typeof window.showOpenFilePicker === 'function';

function pickWithFileInput(): Promise<PickedFile[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.multiple = true;
    const finish = (files: PickedFile[]) => {
      input.remove();
      resolve(files);
    };
    input.addEventListener('change', () =>
      finish(Array.from(input.files ?? [], (file) => ({ file }))),
    );
    input.addEventListener('cancel', () => finish([]));
    input.click();
  });
}

export async function pickAudioFiles(): Promise<PickedFile[]> {
  if (!window.showOpenFilePicker) return pickWithFileInput();
  try {
    const handles = await window.showOpenFilePicker({
      multiple: true,
      types: [
        {
          description: 'Ljudfiler',
          accept: { 'audio/*': ['.mp3', '.flac', '.m4a', '.ogg', '.wav'] },
        },
      ],
    });
    return await Promise.all(
      handles.map(async (handle) => ({ file: await handle.getFile(), handle })),
    );
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return [];
    throw error;
  }
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function runRequest<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = action(database.transaction(STORE_NAME, mode).objectStore(STORE_NAME));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveLocalFile(sourceId: string, { file, handle }: PickedFile, trackId: string) {
  if (handle) {
    try {
      await runRequest('readwrite', (store) => store.put({ trackId, handle }, sourceId));
      return;
    } catch {
      // The session map holds the file when IndexedDB is unavailable.
    }
  }
  sessionFiles.set(sourceId, { trackId, file });
}

/** Reads the file of a stored handle. The browser asks the person for access only when `askPermission` is true. */
async function readHandle(handle: FileSystemFileHandle, askPermission: boolean) {
  const descriptor = { mode: 'read' } as const;
  const permissionHandle = handle as unknown as PermissionHandle;
  let state = await permissionHandle.queryPermission(descriptor);
  if (state !== 'granted' && askPermission) {
    state = await permissionHandle.requestPermission(descriptor);
  }
  return state === 'granted' ? handle.getFile() : undefined;
}

export async function getLocalFile(sourceId: string): Promise<File | undefined> {
  const sessionFile = sessionFiles.get(sourceId);
  if (sessionFile) return sessionFile.file;
  try {
    const stored = await runRequest<StoredFile | undefined>('readonly', (store) =>
      store.get(sourceId),
    );
    return stored && (await readHandle(stored.handle, false));
  } catch {
    return undefined;
  }
}

export async function getLocalFileForTrack(
  trackId: string,
  { askPermission = false } = {},
): Promise<File | undefined> {
  for (const entry of sessionFiles.values()) {
    if (entry.trackId === trackId) return entry.file;
  }
  let match: StoredFile | undefined;
  try {
    const stored = await runRequest<StoredFile[]>('readonly', (store) => store.getAll());
    match = stored.find((entry) => entry.trackId === trackId);
  } catch {
    return undefined;
  }
  if (!match) return undefined;
  const file = await readHandle(match.handle, askPermission).catch(() => undefined);
  if (!file && askPermission) throw new LocalFilePermissionDenied();
  return file;
}

/** True when the browser stores a file or a handle for the track. Never asks for permission. */
export async function hasLocalFileForTrack(trackId: string): Promise<boolean> {
  for (const entry of sessionFiles.values()) {
    if (entry.trackId === trackId) return true;
  }
  try {
    const stored = await runRequest<StoredFile[]>('readonly', (store) => store.getAll());
    return stored.some((entry) => entry.trackId === trackId);
  } catch {
    return false;
  }
}
