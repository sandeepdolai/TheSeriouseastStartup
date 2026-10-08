/* ───────────────────────────────────────────────────────────────────────────
   Paper Stish — Smart Edit
   Asset abstraction layer.

   The editor only ever works with AssetRecord objects; where the bytes live
   (bundled public files, the browser's IndexedDB, or Cloudinary) is decided
   here behind a provider boundary, so the media provider can be replaced
   later (e.g. a paid Cloudinary plan or another CDN) without touching the
   editor.

   Normal user media is DEVICE-FIRST: selecting an image never uploads it to
   Cloudinary or the Paper Stish server. Image bytes remain in IndexedDB (or
   in-memory object URLs when IndexedDB is unavailable) until a publish flow
   explicitly uploads the assets required by the published website.

   Cloudinary is still available as a publish-time/template asset provider:
     NEXT_PUBLIC_SMART_EDIT_CLOUDINARY_CLOUD_NAME
     NEXT_PUBLIC_SMART_EDIT_CLOUDINARY_UPLOAD_PRESET   (unsigned preset)
─────────────────────────────────────────────────────────────────────────── */

import {
  type AssetRecord,
  type AssetType,
  type LibraryManifest,
  type SmartEditDocument,
  isImageLike,
  newAssetId,
} from "./types";

/* ── Environment / config ───────────────────────────────────────────────── */

export function getBasePath(): string {
  return process.env.NEXT_PUBLIC_BASE_PATH ?? "";
}

export function cloudinaryConfig(): { cloudName: string; uploadPreset: string } | null {
  const cloudName = process.env.NEXT_PUBLIC_SMART_EDIT_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_SMART_EDIT_CLOUDINARY_UPLOAD_PRESET;
  if (!cloudName || !uploadPreset) return null;
  return { cloudName, uploadPreset };
}

export function libraryManifestUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SMART_EDIT_LIBRARY_URL ??
    `${getBasePath()}/smart-edit/library/manifest.json`
  );
}

/** Turn a manifest/root-relative path into a runtime URL (adds basePath). */
export function resolvePublicPath(path: string): string {
  if (/^(https?:|data:|blob:)/.test(path)) return path;
  const base = getBasePath();
  if (path.startsWith(base + "/")) return path;
  return base + (path.startsWith("/") ? path : "/" + path);
}

/* ── IndexedDB (durable browser storage for blobs + drafts) ─────────────── */

const DB_NAME = "paper-stish-smart-edit";
const DB_VERSION = 1;
const STORE_ASSETS = "assets";
const STORE_DRAFTS = "drafts";

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === "undefined") {
      resolve(null);
      return;
    }
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_ASSETS)) db.createObjectStore(STORE_ASSETS);
        if (!db.objectStoreNames.contains(STORE_DRAFTS)) db.createObjectStore(STORE_DRAFTS);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

async function idbRun<T>(
  store: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest,
): Promise<T | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(store, mode);
      const req = fn(tx.objectStore(store));
      req.onsuccess = () => resolve(req.result as T);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export interface StoredBlob {
  id: string;
  blob: Blob;
  type: string;
  createdAt: number;
}

export const idb = {
  getBlob: (key: string) =>
    idbRun<StoredBlob>(STORE_ASSETS, "readonly", (s) => s.get(key)),
  putBlob: (value: StoredBlob) =>
    idbRun<IDBValidKey>(STORE_ASSETS, "readwrite", (s) => s.put(value, value.id)),
  deleteBlob: (key: string) =>
    idbRun<undefined>(STORE_ASSETS, "readwrite", (s) => s.delete(key)),
  allBlobKeys: () =>
    idbRun<IDBValidKey[]>(STORE_ASSETS, "readonly", (s) => s.getAllKeys()),
  getDraft: <T>(key: string) =>
    idbRun<T>(STORE_DRAFTS, "readonly", (s) => s.get(key)),
  putDraft: (key: string, value: unknown) =>
    idbRun<IDBValidKey>(STORE_DRAFTS, "readwrite", (s) => s.put(value, key)),
  deleteDraft: (key: string) =>
    idbRun<undefined>(STORE_DRAFTS, "readwrite", (s) => s.delete(key)),
};

/* ── Asset registry (id → record + resolved url) ────────────────────────── */

const objectUrls = new Map<string, string>();
const registry = new Map<string, AssetRecord>();
/** asset id → data url — cached so repeated server saves stay cheap */
const dataUrls = new Map<string, string>();

export function registerAsset(record: AssetRecord) {
  registry.set(record.id, record);
}

export function getAsset(id: string): AssetRecord | undefined {
  return registry.get(id);
}

/** Resolve a record to a usable URL immediately (may be undefined for pending locals). */
export function assetUrl(id: string): string | undefined {
  const record = registry.get(id);
  if (!record) return undefined;
  if (record.provider !== "local") return record.url ? resolvePublicPath(record.url) : undefined;
  const cached = objectUrls.get(id);
  if (cached) return cached;
  // Local asset not yet hydrated — kick off async resolution.
  void hydrateLocalAsset(record);
  return undefined;
}

async function hydrateLocalAsset(record: AssetRecord) {
  if (objectUrls.has(record.id) || !record.storeKey) return;
  const stored = await idb.getBlob(record.storeKey);
  if (!stored) {
    // Blob missing (storage cleared) — mark with a placeholder.
    objectUrls.set(record.id, missingPlaceholder());
    notifyAssetListeners();
    return;
  }
  const url = URL.createObjectURL(stored.blob);
  objectUrls.set(record.id, url);
  notifyAssetListeners();
}

function missingPlaceholder(): string {
  // 1×1 transparent gif — keeps rendering stable when a blob is gone.
  return "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
}

export function setAssetObjectUrl(id: string, url: string) {
  objectUrls.set(id, url);
}

const assetListeners = new Set<() => void>();

export function onAssetsChanged(cb: () => void): () => void {
  assetListeners.add(cb);
  return () => assetListeners.delete(cb);
}

function notifyAssetListeners() {
  assetListeners.forEach((fn) => fn());
}

/** Hydrate every local asset in the given registry snapshot. */
export async function hydrateAssets(records: AssetRecord[]) {
  records.forEach((record) => {
    if (!registry.has(record.id)) registry.set(record.id, record);
  });
  await Promise.all(
    records
      .filter((record) => record.provider === "local" && !objectUrls.has(record.id))
      .map((record) => hydrateLocalAsset(record)),
  );
}

/* ── Image upload pipeline ──────────────────────────────────────────────── */

export const IMAGE_MAX_INPUT_BYTES = 15 * 1024 * 1024;
export const IMAGE_MAX_EDGE = 1600;

export interface UploadedImage {
  record: AssetRecord;
}

export async function importImageFile(file: File): Promise<UploadedImage> {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") {
    throw new Error("Only image files can be added.");
  }
  if (file.size > IMAGE_MAX_INPUT_BYTES) {
    throw new Error("That image is too large (15 MB max).");
  }

  // IMPORTANT: normal user uploads stay on the device. This function is
  // called during editing, so it must never perform a remote upload.
  const bitmap = await loadBitmap(file);
  const { blob, width, height } = await compressBitmap(bitmap.bitmap);
  bitmap.close();

  const id = newAssetId();
  const record: AssetRecord = {
    id,
    type: "image",
    provider: "local",
    storeKey: id,
    name: sanitizeName(file.name),
    width,
    height,
    format: blob.type,
  };

  const ok = await idb.putBlob({ id, blob, type: blob.type, createdAt: Date.now() });
  if (!ok && typeof URL !== "undefined") {
    // IndexedDB unavailable (private mode) — keep an in-memory object URL.
    record.url = URL.createObjectURL(blob);
    record.provider = "local";
  }

  registry.set(id, record);
  objectUrls.set(id, record.url ?? URL.createObjectURL(blob));
  return { record };
}
async function loadBitmap(
  file: File,
): Promise<{ bitmap: ImageBitmap; close: () => void }> {
  try {
    const bitmap = await createImageBitmap(file);
    return { bitmap, close: () => bitmap.close() };
  } catch {
    // Fallback for browsers without createImageBitmap for this format.
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error("Could not read that image."));
        el.src = url;
      });
      return {
        bitmap: img as unknown as ImageBitmap,
        close: () => URL.revokeObjectURL(url),
      };
    } catch (err) {
      URL.revokeObjectURL(url);
      throw err;
    }
  }
}

async function compressBitmap(
  source: ImageBitmap | HTMLImageElement,
): Promise<{ blob: Blob; width: number; height: number }> {
  const natural = {
    width: "naturalWidth" in source ? source.naturalWidth : source.width,
    height: "naturalHeight" in source ? source.naturalHeight : source.height,
  };
  if (!natural.width || !natural.height) throw new Error("Could not read that image.");

  const scale = Math.min(1, IMAGE_MAX_EDGE / Math.max(natural.width, natural.height));
  const width = Math.max(1, Math.round(natural.width * scale));
  const height = Math.max(1, Math.round(natural.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process that image.");
  ctx.drawImage(source as CanvasImageSource, 0, 0, width, height);

  // Prefer WebP (alpha + small); fall back to JPEG.
  const blob =
    (await canvasToBlob(canvas, "image/webp", 0.85)) ??
    (await canvasToBlob(canvas, "image/jpeg", 0.85));
  if (!blob) throw new Error("Could not process that image.");

  return { blob, width, height };
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob), type, quality);
    } catch {
      resolve(null);
    }
  });
}

/** Read an image file as a compressed, self-contained data URL (≤1600px,
 *  WebP/JPEG) — used by the normal template editors so local projects and
 *  published websites stay reasonably sized. */
export async function compressedPhotoDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") {
    throw new Error("Only image files can be added.");
  }
  if (file.size > IMAGE_MAX_INPUT_BYTES) {
    throw new Error("That image is too large (15 MB max).");
  }
  const bitmap = await loadBitmap(file);
  const { blob } = await compressBitmap(bitmap.bitmap);
  bitmap.close();
  return blobToDataUrl(blob);
}

function sanitizeName(name: string): string {
  return name.replace(/[^\w\s.\-()]/g, "").slice(0, 60) || "image";
}

/* ── Publish-time helpers (template workflow) ──────────────────────────── */

/** Read a LOCAL asset's stored blob (for one-time Cloudinary uploads).
 *  Covers both the IndexedDB path and the private-mode in-memory object URL. */
export async function assetBlob(id: string): Promise<Blob | undefined> {
  const record = registry.get(id);
  if (!record || record.provider !== "local") return undefined;
  const stored = await idb.getBlob(record.storeKey ?? record.id);
  if (stored) return stored.blob;
  const url = objectUrls.get(id);
  if (url?.startsWith("blob:")) {
    try {
      const res = await fetch(url);
      return await res.blob();
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/** Collect the asset records a document currently references (images,
 *  stickers and user fonts) — the snapshot saved with projects/templates. */
export function snapshotDocumentAssets(
  document: SmartEditDocument,
): Record<string, AssetRecord> {
  const out: Record<string, AssetRecord> = {};
  for (const layer of document.layers) {
    if (isImageLike(layer)) {
      const record = getAsset(layer.assetId);
      if (record) out[record.id] = record;
    }
  }
  for (const font of document.fonts ?? []) {
    if (font.source !== "user") continue;
    const record = getAsset(font.id);
    if (record) out[record.id] = record;
  }
  return out;
}

/** Validate + normalize an admin-chosen custom preview image: raster image
 *  files only, ≤15 MB, downscaled to ≤1600px like every other image in the
 *  app — the result is a bounded blob safe to display and upload. */
export async function preparePreviewImage(
  file: File,
): Promise<{ blob: Blob; width: number; height: number }> {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") {
    throw new Error("Preview images must be image files.");
  }
  if (file.size > IMAGE_MAX_INPUT_BYTES) {
    throw new Error("That image is too large (15 MB max).");
  }
  const bitmap = await loadBitmap(file);
  try {
    return await compressBitmap(bitmap.bitmap);
  } finally {
    bitmap.close();
  }
}

/* ── Cloudinary adapter (unsigned upload — free plan) ───────────────────── */

export interface CloudinaryUpload {
  url: string;
  width: number;
  height: number;
  publicId: string | null;
}

/** Upload an image blob to Cloudinary under `folder` (unsigned preset).
 *  User uploads default to the shared user-assets folder; template assets
 *  pass their own template namespace so the two stay logically separated. */
export async function uploadToCloudinary(
  blob: Blob,
  config: { cloudName: string; uploadPreset: string },
  folder = "paper-stish/user-assets",
): Promise<CloudinaryUpload> {
  const form = new FormData();
  form.append("file", blob);
  form.append("upload_preset", config.uploadPreset);
  form.append("folder", folder);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloudName)}/image/upload`,
    { method: "POST", body: form },
  );
  if (!res.ok) throw new Error("Cloudinary upload failed");
  const data = (await res.json()) as {
    secure_url?: string;
    url?: string;
    width?: number;
    height?: number;
    public_id?: string;
  };
  const url = data.secure_url ?? data.url;
  if (!url) throw new Error("Cloudinary upload failed");
  return {
    url,
    width: data.width ?? 0,
    height: data.height ?? 0,
    publicId: data.public_id ?? null,
  };
}

/** Read a local asset as a data url (self-contained save/publish payloads).
 *  Results are cached per asset so repeated saves don't re-read the blob. */
export async function assetDataUrl(id: string): Promise<string | undefined> {
  const record = registry.get(id);
  if (!record) return undefined;
  if (record.provider !== "local") return record.url;
  const key = record.storeKey ?? record.id;
  const cached = dataUrls.get(key);
  if (cached) return cached;
  const stored = await idb.getBlob(key);
  if (!stored) return undefined;
  const url = await blobToDataUrl(stored.blob);
  dataUrls.set(key, url);
  return url;
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(blob);
  });
}

/* ── Library manifest ───────────────────────────────────────────────────── */

let manifestCache: LibraryManifest | null = null;

export async function loadLibraryManifest(): Promise<LibraryManifest> {
  if (manifestCache) return manifestCache;
  try {
    const res = await fetch(libraryManifestUrl());
    if (!res.ok) throw new Error("no manifest");
    const data = (await res.json()) as LibraryManifest;
    if (data && data.version === 1 && Array.isArray(data.stickers) && Array.isArray(data.photos)) {
      manifestCache = data;
      return data;
    }
    throw new Error("bad manifest");
  } catch {
    return { version: 1, stickers: [], photos: [] };
  }
}

export function libraryItemToAsset(
  item: LibraryManifest["stickers"][number],
): AssetRecord {
  return {
    id: item.id,
    type: item.type as AssetType,
    provider: "bundled",
    url: item.path,
    name: item.name,
    width: item.width,
    height: item.height,
  };
}

/** Previously uploaded images (for the "My uploads" library tab). */
export function listUploads(): AssetRecord[] {
  return Array.from(registry.values()).filter(
    (record) => record.type === "image" && record.provider !== "bundled",
  );
}

/* ── User-imported fonts ────────────────────────────────────────────────── */

export const FONT_MAX_BYTES = 8 * 1024 * 1024;
export const FONT_EXTENSIONS = [".ttf", ".otf", ".woff", ".woff2"];

export interface ImportedFont {
  id: string;
  family: string;
  record: AssetRecord;
}

const fontFaces = new Map<string, FontFace>();

export async function importFontFile(file: File): Promise<ImportedFont> {
  const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  if (!FONT_EXTENSIONS.includes(ext)) {
    throw new Error("Supported font files: .ttf, .otf, .woff, .woff2");
  }
  if (file.size > FONT_MAX_BYTES) throw new Error("That font is too large (8 MB max).");

  const buffer = await file.arrayBuffer();
  const id = newAssetId();
  const family = `se-user-${id}`;
  const format = ext.slice(1);

  const face = new FontFace(family, buffer, { weight: "400" });
  try {
    await face.load();
  } catch {
    throw new Error("That font file could not be loaded.");
  }
  document.fonts.add(face);
  fontFaces.set(id, face);

  const record: AssetRecord = {
    id,
    type: "font",
    provider: "local",
    storeKey: id,
    name: sanitizeName(file.name.replace(/\.[^.]+$/, "")) || "My font",
    width: 0,
    height: 0,
    family,
    format,
  };
  registry.set(id, record);
  await idb.putBlob({ id, blob: new Blob([buffer], { type: file.type }), type: file.type, createdAt: Date.now() });
  return { id, family, record };
}

/** Re-register a persisted user font from IndexedDB (draft/project restore). */
export async function restoreUserFont(record: AssetRecord): Promise<string | null> {
  if (fontFaces.has(record.id)) return record.family ?? null;
  const stored = await idb.getBlob(record.storeKey ?? record.id);
  if (!stored) return null;
  try {
    const buffer = await stored.blob.arrayBuffer();
    const family = record.family ?? `se-user-${record.id}`;
    const face = new FontFace(family, buffer, { weight: "400" });
    await face.load();
    document.fonts.add(face);
    fontFaces.set(record.id, face);
    registry.set(record.id, { ...record, family });
    return family;
  } catch {
    return null;
  }
}

/** Register a font from a data url (published viewer payloads). */
export async function registerFontFromDataUrl(
  id: string,
  family: string,
  dataUrl: string,
): Promise<void> {
  if (fontFaces.has(id)) return;
  try {
    const res = await fetch(dataUrl);
    const buffer = await res.arrayBuffer();
    const face = new FontFace(family, buffer, { weight: "400" });
    await face.load();
    document.fonts.add(face);
    fontFaces.set(id, face);
  } catch {
    // Viewer falls back to the next family in the stack.
  }
}

export function userFontLoaded(id: string): boolean {
  return fontFaces.has(id);
}

/* ── Maintenance ────────────────────────────────────────────────────────── */

/** Remove stored blobs that no project references anymore. */
export async function pruneOrphanAssets(referencedIds: Set<string>) {
  const keys = await idb.allBlobKeys();
  if (!keys) return;
  for (const key of keys) {
    const id = String(key);
    if (!id.startsWith("a-")) continue;
    if (!referencedIds.has(id)) {
      // Only delete records we can see are assets (not fonts of open docs —
      // fonts are referenced through documents too).
      const record = registry.get(id);
      if (record && record.type === "font") continue;
      await idb.deleteBlob(id);
      const url = objectUrls.get(id);
      if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
      objectUrls.delete(id);
      dataUrls.delete(id);
      registry.delete(id);
    }
  }
}

export function resetAssetRuntime() {
  objectUrls.forEach((url) => {
    if (url.startsWith("blob:")) URL.revokeObjectURL(url);
  });
  objectUrls.clear();
  registry.clear();
  dataUrls.clear();
}
