/* ───────────────────────────────────────────────────────────────────────────
   Paper Stish — device-first local project storage.

   The user's device is the working workspace: unpublished editable projects
   (Smart Edit, Birthday, Love of My Life, future templates) live in
   IndexedDB, scoped to the signed-in account. The server only ever sees a
   project when the user presses Publish. localStorage is used solely for
   lightweight account metadata (username, migration flags) and as a
   fallback when IndexedDB is unavailable (e.g. locked-down browsers).

   Legacy records written by the earlier localStorage-based version are
   migrated into IndexedDB once per account — non-destructively: the old
   keys are left in place, they are simply no longer read afterwards.
─────────────────────────────────────────────────────────────────────────── */

import { GUEST_ACCOUNT_KEY, getAccountKey } from "@/lib/accountStorage";

export interface StoredLocalProject {
  id: string;
  /** account scope (getAccountKey of the owner's email, or "guest") */
  account: string;
  title: string;
  templateSlug: string;
  thumbnail?: string;
  createdAt?: string;
  updatedAt?: string;
  /** template-specific editable data (document/assets for Smart Edit,
   *  heading/message/photoUrl values for normal templates) */
  data?: Record<string, unknown>;
}

const DB_NAME = "paper-stish-projects";
const DB_VERSION = 1;
const STORE = "projects";
const LEGACY_KEY = "paper-stish-projects";
const MIGRATION_FLAG_PREFIX = "paper-stish-projects-idb:";

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
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
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
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest,
): Promise<T | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      req.onsuccess = () => resolve(req.result as T);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function recordKey(account: string, id: string): string {
  return `${account}::${id}`;
}

/* ── localStorage fallback (only used when IndexedDB is unavailable) ────── */

function fallbackKey(account: string): string {
  return `${LEGACY_KEY}-idb:${account}`;
}

function fallbackRead(account: string): StoredLocalProject[] {
  try {
    const raw = localStorage.getItem(fallbackKey(account));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function fallbackWrite(account: string, projects: StoredLocalProject[]): boolean {
  try {
    localStorage.setItem(fallbackKey(account), JSON.stringify(projects));
    return true;
  } catch {
    return false;
  }
}

let usingFallback: boolean | null = null;

async function idbAvailable(): Promise<boolean> {
  if (usingFallback !== null) return !usingFallback;
  const db = await openDb();
  usingFallback = db === null;
  return !usingFallback;
}

function normalizeRecord(raw: unknown, account: string): StoredLocalProject | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || !r.id || r.id.length > 100) return null;
  return {
    id: r.id,
    account,
    title: typeof r.title === "string" ? r.title.slice(0, 120) : "Untitled",
    templateSlug: typeof r.templateSlug === "string" ? r.templateSlug.slice(0, 60) : "",
    thumbnail: typeof r.thumbnail === "string" ? r.thumbnail : undefined,
    createdAt: typeof r.createdAt === "string" ? r.createdAt : undefined,
    updatedAt: typeof r.updatedAt === "string" ? r.updatedAt : undefined,
    data:
      r.data && typeof r.data === "object" && !Array.isArray(r.data)
        ? (r.data as Record<string, unknown>)
        : undefined,
  };
}

function sortByNewest(projects: StoredLocalProject[]): StoredLocalProject[] {
  return projects.sort((a, b) => {
    const at = Date.parse(a.updatedAt ?? a.createdAt ?? "") || 0;
    const bt = Date.parse(b.updatedAt ?? b.createdAt ?? "") || 0;
    return bt - at;
  });
}

/* ── Legacy localStorage migration (one-time per account) ───────────────── */

function readLegacyList(account: string): StoredLocalProject[] {
  try {
    const raw = localStorage.getItem(`${LEGACY_KEY}:${account}`);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => normalizeRecord(item, account))
      .filter((item): item is StoredLocalProject => item !== null);
  } catch {
    return [];
  }
}

/**
 * Fold legacy localStorage records (guest + account keys) into IndexedDB.
 * Runs at most once per account (flagged); records already present in
 * IndexedDB always win, and the legacy data itself is never deleted.
 */
async function migrateLegacy(account: string): Promise<void> {
  if (typeof localStorage === "undefined") return;
  const flagKey = `${MIGRATION_FLAG_PREFIX}${account}`;
  try {
    if (localStorage.getItem(flagKey)) return;
  } catch {
    return;
  }

  if (!(await idbAvailable())) {
    // Fallback mode reads legacy data transparently — nothing to move.
    try {
      localStorage.setItem(flagKey, new Date().toISOString());
    } catch {
      // Flag is best-effort only.
    }
    return;
  }

  const legacyAccounts = account === GUEST_ACCOUNT_KEY ? [GUEST_ACCOUNT_KEY] : [GUEST_ACCOUNT_KEY, account];
  const existing = new Set(
    ((await idbRun<IDBValidKey[]>("readonly", (s) => s.getAllKeys())) ?? [])
      .map(String)
      .filter((key) => key.startsWith(`${account}::`))
      .map((key) => key.slice(account.length + 2)),
  );

  for (const legacyAccount of legacyAccounts) {
    for (const record of readLegacyList(legacyAccount)) {
      if (existing.has(record.id)) continue;
      record.account = account;
      await idbRun<IDBValidKey>("readwrite", (s) =>
        s.put(record, recordKey(account, record.id)),
      );
      existing.add(record.id);
    }
  }

  try {
    localStorage.setItem(flagKey, new Date().toISOString());
  } catch {
    // Flag is best-effort only.
  }
}

/* ── Public API ─────────────────────────────────────────────────────────── */

/** List the account's local projects (newest first), migrating legacy
 *  localStorage data on first use. */
export async function listLocalProjects(account: string): Promise<StoredLocalProject[]> {
  await migrateLegacy(account);
  if (!(await idbAvailable())) {
    return sortByNewest(fallbackRead(account));
  }
  const all = (await idbRun<StoredLocalProject[]>("readonly", (s) => s.getAll())) ?? [];
  return sortByNewest(all.filter((record) => record && record.account === account));
}

/** List every local project on this device, across accounts (used only for
 *  conservative housekeeping such as asset pruning). */
export async function listAllLocalProjects(): Promise<StoredLocalProject[]> {
  if (!(await idbAvailable())) {
    const accounts = new Set<string>();
    try {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith(`${LEGACY_KEY}-idb:`)) accounts.add(key.slice(`${LEGACY_KEY}-idb:`.length));
      }
    } catch {
      // enumeration is best-effort
    }
    return [...accounts].flatMap((account) => fallbackRead(account));
  }
  const all = (await idbRun<StoredLocalProject[]>("readonly", (s) => s.getAll())) ?? [];
  return all.filter((record) => record && record.account);
}

/** Read one local project. */
export async function getLocalProject(
  account: string,
  id: string,
): Promise<StoredLocalProject | null> {
  if (!id || id.length > 100) return null;
  await migrateLegacy(account);
  if (!(await idbAvailable())) {
    return fallbackRead(account).find((record) => record.id === id) ?? null;
  }
  const record = await idbRun<StoredLocalProject>(
    "readonly",
    (s) => s.get(recordKey(account, id)),
  );
  return record && record.account === account ? record : null;
}

/**
 * Upsert a local project. Fields not provided (createdAt, thumbnail, …)
 * are preserved from the stored record when it exists; `data` is
 * shallow-merged so untouched fields survive plain saves.
 */
export async function putLocalProject(
  record: Omit<StoredLocalProject, "account" | "createdAt" | "title"> & {
    account?: string;
    createdAt?: string;
    title?: string;
  },
): Promise<boolean> {
  const account = record.account ?? GUEST_ACCOUNT_KEY;
  const existing = await getLocalProject(account, record.id);
  const full: StoredLocalProject = {
    id: record.id,
    account,
    title: record.title ?? existing?.title ?? "Untitled",
    templateSlug: record.templateSlug ?? existing?.templateSlug ?? "",
    thumbnail: record.thumbnail ?? existing?.thumbnail,
    createdAt: record.createdAt ?? existing?.createdAt ?? new Date().toISOString(),
    updatedAt: record.updatedAt ?? existing?.updatedAt,
    // Shallow-merge data so fields the caller leaves out (e.g. the
    // `published` publication info during a plain save) are preserved.
    data: { ...(existing?.data ?? {}), ...(record.data ?? {}) },
  };

  if (!(await idbAvailable())) {
    const list = fallbackRead(account);
    const index = list.findIndex((item) => item.id === record.id);
    if (index >= 0) list[index] = full;
    else list.unshift(full);
    return fallbackWrite(account, list);
  }
  const ok = await idbRun<IDBValidKey>("readwrite", (s) =>
    s.put(full, recordKey(account, record.id)),
  );
  return ok !== null;
}

/** Remove a local project. */
export async function deleteLocalProject(account: string, id: string): Promise<boolean> {
  if (!(await idbAvailable())) {
    const list = fallbackRead(account);
    const next = list.filter((item) => item.id !== id);
    if (next.length === list.length) return false;
    return fallbackWrite(account, next);
  }
  const ok = await idbRun<undefined>("readwrite", (s) =>
    s.delete(recordKey(account, id)),
  );
  return ok !== null;
}

export { getAccountKey };
