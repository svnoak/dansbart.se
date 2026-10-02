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
const sessionFiles = new Map<string, File>();

export const canKeepHandles = () => typeof window.showOpenFilePicker === 'function';

export async function pickAudioFiles(): Promise<PickedFile[]> {
  const handles = await window.showOpenFilePicker!({
    multiple: true,
    types: [
      {
        description: 'Ljudfiler',
        accept: { 'audio/*': ['.mp3', '.flac', '.m4a', '.ogg', '.wav'] },
      },
    ],
  });
  return Promise.all(handles.map(async (handle) => ({ file: await handle.getFile(), handle })));
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

export async function saveLocalFile(sourceId: string, { file, handle }: PickedFile) {
  if (handle) {
    try {
      await runRequest('readwrite', (store) => store.put(handle, sourceId));
      return;
    } catch {
      // The session map holds the file when IndexedDB is unavailable.
    }
  }
  sessionFiles.set(sourceId, file);
}

export async function getLocalFile(sourceId: string): Promise<File | undefined> {
  const sessionFile = sessionFiles.get(sourceId);
  if (sessionFile) return sessionFile;
  try {
    const handle = await runRequest<FileSystemFileHandle | undefined>('readonly', (store) =>
      store.get(sourceId),
    );
    return await handle?.getFile();
  } catch {
    return undefined;
  }
}
