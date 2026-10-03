const DIRECTORY_NAME = 'mina-latar';
let persistentStorageRequested = false;

export const canKeepLocalCopies = () =>
  typeof navigator.storage?.getDirectory === 'function' &&
  typeof FileSystemFileHandle !== 'undefined' &&
  'createWritable' in FileSystemFileHandle.prototype;

async function getDirectory(create: boolean) {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(DIRECTORY_NAME, { create });
}

async function findFileHandle(trackId: string): Promise<FileSystemFileHandle | undefined> {
  if (!canKeepLocalCopies()) return undefined;
  try {
    const directory = await getDirectory(false);
    return await directory.getFileHandle(trackId);
  } catch {
    return undefined;
  }
}

const typeEntryName = (trackId: string) => `${trackId}.type`;

async function entryExists(directory: FileSystemDirectoryHandle, name: string) {
  try {
    await directory.getFileHandle(name);
    return true;
  } catch {
    return false;
  }
}

async function writeEntry(directory: FileSystemDirectoryHandle, name: string, blob: Blob) {
  const handle = await directory.getFileHandle(name, { create: true });
  await blob.stream().pipeTo(await handle.createWritable());
}

export async function writeLocalCopy(trackId: string, file: File): Promise<boolean> {
  if (!canKeepLocalCopies()) return false;
  let directory: FileSystemDirectoryHandle | undefined;
  let existed = false;
  try {
    directory = await getDirectory(true);
    existed = await entryExists(directory, trackId);
    await writeEntry(directory, trackId, file);
    if (file.type) await writeEntry(directory, typeEntryName(trackId), new Blob([file.type]));
    return true;
  } catch {
    if (!existed) await deleteLocalCopy(trackId);
    return false;
  }
}

export async function readLocalCopy(trackId: string): Promise<File | undefined> {
  try {
    const copy = await (await findFileHandle(trackId))?.getFile();
    if (!copy) return undefined;
    const directory = await getDirectory(false);
    const type = await directory
      .getFileHandle(typeEntryName(trackId))
      .then((handle) => handle.getFile())
      .then((typeFile) => typeFile.text())
      .catch(() => '');
    return type ? new File([copy], copy.name, { type }) : copy;
  } catch {
    return undefined;
  }
}

export async function hasLocalCopy(trackId: string): Promise<boolean> {
  return (await findFileHandle(trackId)) !== undefined;
}

export async function deleteLocalCopy(trackId: string): Promise<void> {
  try {
    const directory = await getDirectory(false);
    await Promise.all(
      [trackId, typeEntryName(trackId)].map((name) => directory.removeEntry(name).catch(() => {})),
    );
  } catch {
    // A copy that cannot be removed is treated as already gone.
  }
}

export function requestPersistentStorage(): void {
  if (persistentStorageRequested) return;
  persistentStorageRequested = true;
  navigator.storage?.persist?.()?.catch(() => {});
}
