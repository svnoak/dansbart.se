import { vi } from 'vitest';

interface FakeOpfsOptions {
  getDirectoryRejects?: DOMException;
  createWritableRejects?: DOMException;
}

type Bytes = Uint8Array<ArrayBuffer>;

const notFound = (name: string) => new DOMException(name, 'NotFoundError');

class FakeFileHandle {
  private name: string;
  private entries: Map<string, Bytes>;
  private createWritableRejects?: DOMException;

  constructor(name: string, entries: Map<string, Bytes>, createWritableRejects?: DOMException) {
    this.name = name;
    this.entries = entries;
    this.createWritableRejects = createWritableRejects;
  }

  async getFile(): Promise<File> {
    return new File([this.entries.get(this.name) ?? new Uint8Array()], this.name);
  }

  async createWritable(): Promise<WritableStream<Uint8Array>> {
    if (this.createWritableRejects) throw this.createWritableRejects;
    const chunks: Uint8Array[] = [];
    return new WritableStream<Uint8Array>({
      write: (chunk) => {
        chunks.push(chunk);
      },
      close: () => {
        this.entries.set(this.name, new Uint8Array(chunks.flatMap((chunk) => [...chunk])));
      },
      abort: () => {
        chunks.length = 0;
      },
    });
  }
}

class FakeDirectoryHandle {
  private files = new Map<string, Bytes>();
  private directories = new Map<string, FakeDirectoryHandle>();

  private createWritableRejects?: DOMException;

  constructor(createWritableRejects?: DOMException) {
    this.createWritableRejects = createWritableRejects;
  }

  setCreateWritableRejects(error?: DOMException) {
    this.createWritableRejects = error;
    for (const directory of this.directories.values()) directory.setCreateWritableRejects(error);
  }

  async getDirectoryHandle(name: string, options?: { create?: boolean }) {
    if (!this.directories.has(name)) {
      if (!options?.create) throw notFound(name);
      this.directories.set(name, new FakeDirectoryHandle(this.createWritableRejects));
    }
    return this.directories.get(name)!;
  }

  async getFileHandle(name: string, options?: { create?: boolean }) {
    if (!this.files.has(name)) {
      if (!options?.create) throw notFound(name);
      this.files.set(name, new Uint8Array());
    }
    return new FakeFileHandle(name, this.files, this.createWritableRejects);
  }

  async removeEntry(name: string) {
    if (!this.files.delete(name) && !this.directories.delete(name)) throw notFound(name);
  }
}

const readBlob = (blob: Blob) =>
  new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });

const blobMethods: Record<string, (this: Blob) => unknown> = {
  arrayBuffer() {
    return readBlob(this);
  },
  async text() {
    return new TextDecoder().decode(await readBlob(this));
  },
  stream() {
    const bytes = readBlob(this).then((buffer) => new Uint8Array(buffer));
    return new ReadableStream<Uint8Array>({
      async start(controller) {
        controller.enqueue(await bytes);
        controller.close();
      },
    });
  },
};

export function installFakeOpfs(options: FakeOpfsOptions = {}) {
  const root = new FakeDirectoryHandle(options.createWritableRejects);
  const globals = globalThis as Record<string, unknown>;
  const originalStorage = Object.getOwnPropertyDescriptor(navigator, 'storage');
  const originalHandle = globals.FileSystemFileHandle;
  const addedMethods = Object.keys(blobMethods).filter((name) => !(name in Blob.prototype));

  for (const name of addedMethods) {
    Object.defineProperty(Blob.prototype, name, {
      value: blobMethods[name],
      configurable: true,
      writable: true,
    });
  }

  Object.defineProperty(navigator, 'storage', {
    configurable: true,
    writable: true,
    value: {
      getDirectory: async () => {
        if (options.getDirectoryRejects) throw options.getDirectoryRejects;
        return root;
      },
      persist: vi.fn().mockResolvedValue(true),
    },
  });
  globals.FileSystemFileHandle = FakeFileHandle;

  return {
    root,
    restore() {
      for (const name of addedMethods) delete (Blob.prototype as unknown as Record<string, unknown>)[name];
      if (originalStorage) Object.defineProperty(navigator, 'storage', originalStorage);
      else delete (navigator as unknown as Record<string, unknown>).storage;
      if (originalHandle) globals.FileSystemFileHandle = originalHandle;
      else delete globals.FileSystemFileHandle;
    },
  };
}
