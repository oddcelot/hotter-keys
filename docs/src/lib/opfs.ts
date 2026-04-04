const FILENAME = "hotter-keys-keymap.json";

export interface KeymapEntry {
  id: string;
  name: string;
  description: string;
  shortcut: string;
}

export function isOpfsAvailable(): boolean {
  return (
    typeof navigator !== "undefined" &&
    "storage" in navigator &&
    "getDirectory" in navigator.storage
  );
}

export async function loadKeymap(): Promise<KeymapEntry[]> {
  try {
    const root = await navigator.storage.getDirectory();
    const fileHandle = await root.getFileHandle(FILENAME);
    const file = await fileHandle.getFile();
    const text = await file.text();
    return JSON.parse(text) as KeymapEntry[];
  } catch {
    return [];
  }
}

export async function saveKeymap(entries: KeymapEntry[]): Promise<void> {
  const root = await navigator.storage.getDirectory();
  const fileHandle = await root.getFileHandle(FILENAME, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(entries, null, 2));
  await writable.close();
}
