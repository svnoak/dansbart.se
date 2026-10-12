import { hasLocalCopy, readLocalCopy, writeLocalCopy } from './localCopies';

export interface PickedFile {
  file: File;
  handle?: FileSystemFileHandle;
}

interface OpenFilePickerOptions {
  multiple: boolean;
  types: { description: string; accept: Record<string, string[]> }[];
}

/** The folder entries a directory handle yields. TypeScript's DOM library leaves out its async iterator. */
interface IterableDirectoryHandle {
  values(): AsyncIterable<FileSystemFileHandle | FileSystemDirectoryHandle>;
}

declare global {
  interface Window {
    showOpenFilePicker?: (options: OpenFilePickerOptions) => Promise<FileSystemFileHandle[]>;
    showDirectoryPicker?: (options: { mode: 'read' }) => Promise<FileSystemDirectoryHandle>;
  }
}

const AUDIO_EXTENSIONS = ['.mp3', '.flac', '.m4a', '.ogg', '.wav'];

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

/** True when the browser can pick a folder and keep a handle for each of its files. */
export const canKeepFolderHandles = () => typeof window.showDirectoryPicker === 'function';

/** True when the browser can pick a folder in some way. */
export const canPickFolder = () =>
  canKeepFolderHandles() || 'webkitdirectory' in HTMLInputElement.prototype;

const hasAudioExtension = (name: string) =>
  AUDIO_EXTENSIONS.some((extension) => name.toLowerCase().endsWith(extension));

export const isAudioFile = (file: File) =>
  file.type.startsWith('audio/') || hasAudioExtension(file.name);

/** Keeps the audio files of a picked folder, in the order of their paths in the folder. */
export function audioFilesOf(files: Iterable<File>): PickedFile[] {
  return Array.from(files)
    .filter(isAudioFile)
    .sort((a, b) => (a.webkitRelativePath || a.name).localeCompare(b.webkitRelativePath || b.name))
    .map((file) => ({ file }));
}

async function collectFolder(
  directory: FileSystemDirectoryHandle,
  path: string,
  found: (PickedFile & { path: string })[],
) {
  for await (const entry of (directory as unknown as IterableDirectoryHandle).values()) {
    const entryPath = `${path}/${entry.name}`;
    if (entry.kind === 'directory') {
      await collectFolder(entry as FileSystemDirectoryHandle, entryPath, found);
    } else if (hasAudioExtension(entry.name)) {
      const handle = entry as FileSystemFileHandle;
      found.push({ file: await handle.getFile(), handle, path: entryPath });
    }
  }
}

/**
 * Picks a folder and returns its audio files with their handles, subfolders included.
 * Returns null when the person closes the picker. Needs `canKeepFolderHandles()`.
 */
export async function pickAudioFolder(): Promise<PickedFile[] | null> {
  let directory: FileSystemDirectoryHandle;
  try {
    directory = await window.showDirectoryPicker!({ mode: 'read' });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return null;
    throw error;
  }
  const found: (PickedFile & { path: string })[] = [];
  await collectFolder(directory, directory.name, found);
  return found
    .sort((a, b) => a.path.localeCompare(b.path))
    .map(({ file, handle }) => ({ file, handle }));
}

function readAllEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => {
    const all: FileSystemEntry[] = [];
    // readEntries returns the entries in batches and an empty batch at the end.
    const readBatch = () =>
      reader.readEntries((batch) => {
        if (batch.length === 0) {
          resolve(all);
          return;
        }
        all.push(...batch);
        readBatch();
      }, reject);
    readBatch();
  });
}

async function collectEntry(entry: FileSystemEntry, found: { file: File; path: string }[]) {
  if (entry.isDirectory) {
    const children = await readAllEntries((entry as FileSystemDirectoryEntry).createReader());
    for (const child of children) await collectEntry(child, found);
  } else if (entry.isFile) {
    const file = await new Promise<File>((resolve, reject) =>
      (entry as FileSystemFileEntry).file(resolve, reject),
    );
    found.push({ file, path: entry.fullPath });
  }
}

/**
 * Returns the audio files of dropped files and folders, subfolders included.
 * Call it inside the drop handler: the browser empties the dropped items after the event.
 */
export function audioFilesFromDrop(dataTransfer: DataTransfer): Promise<PickedFile[]> {
  const entries = Array.from(dataTransfer.items)
    .filter((item) => item.kind === 'file')
    .map((item) => item.webkitGetAsEntry?.() ?? item.getAsFile());
  return (async () => {
    const found: { file: File; path: string }[] = [];
    for (const entry of entries) {
      if (entry instanceof File) found.push({ file: entry, path: entry.name });
      else if (entry) await collectEntry(entry, found);
    }
    return found
      .filter(({ file }) => isAudioFile(file))
      .sort((a, b) => a.path.localeCompare(b.path))
      .map(({ file }) => ({ file }));
  })();
}

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
          accept: { 'audio/*': AUDIO_EXTENSIONS },
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
      // The local copy or the session map holds the file when IndexedDB is unavailable.
    }
  }
  if (await writeLocalCopy(trackId, file)) {
    sessionFiles.delete(sourceId);
    return;
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
    // Without IndexedDB the local copy is the only source.
  }
  const file = match && (await readHandle(match.handle, askPermission).catch(() => undefined));
  if (file) return file;
  const copy = await readLocalCopy(trackId);
  if (!copy && match && askPermission) throw new LocalFilePermissionDenied();
  return copy;
}

/** True when the browser stores a file or a handle for the track. Never asks for permission. */
export async function hasLocalFileForTrack(trackId: string): Promise<boolean> {
  for (const entry of sessionFiles.values()) {
    if (entry.trackId === trackId) return true;
  }
  try {
    const stored = await runRequest<StoredFile[]>('readonly', (store) => store.getAll());
    if (stored.some((entry) => entry.trackId === trackId)) return true;
  } catch {
    // Without IndexedDB the local copy is the only source.
  }
  return hasLocalCopy(trackId);
}
