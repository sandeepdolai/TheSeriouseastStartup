/* ───────────────────────────────────────────────────────────────────────────
   Paper Stish — Smart Edit
   Client-side API helpers for the server-backed persistence + publication
   endpoints. All calls are same-origin; the session cookie authorizes the
   request, ownership is resolved server-side.
─────────────────────────────────────────────────────────────────────────── */

import type { AssetRecord, SmartEditDocument } from "./types";
import { type PublishedRecord, type SmartEditPublishedPayload, buildPublicUrl } from "./publish";

export interface ServerPublishedInfo {
  username: string;
  viewerName: string;
  templateId: string;
  publishedAt: string;
}

export interface ServerProject {
  id: string;
  title: string;
  templateSlug: "smart-edit";
  createdAt: string;
  updatedAt: string;
  data: {
    kind: "smart-edit";
    document: SmartEditDocument;
    assets: Record<string, AssetRecord>;
    published: ServerPublishedInfo | null;
  };
}

export interface SaveProjectBody {
  title: string;
  document: SmartEditDocument;
  assets: Record<string, AssetRecord>;
}

export interface PublishProjectBody {
  title: string;
  username: string;
  viewerName: string;
  document: SmartEditDocument;
}

export interface PublishResult {
  templateId: string;
  username: string;
  viewerName: string;
  title: string;
  publishedAt: string;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch {
    throw new Error("Could not reach the Paper Stish server. Check your connection and try again.");
  }
  if (res.ok) {
    const text = await res.text();
    return (text ? JSON.parse(text) : null) as T;
  }
  let message = "";
  try {
    const body = (await res.json()) as { error?: string };
    message = typeof body.error === "string" ? body.error : "";
  } catch {
    // non-JSON error body
  }
  if (res.status === 401) {
    throw new Error("Please sign in to save Smart Edit projects.");
  }
  throw new Error(message || `Request failed (${res.status}).`);
}

/** Create a project. The client-generated id is adopted when valid, keeping
 *  local mirrors, drafts and the server row under one id. */
export function createProject(body: SaveProjectBody & { id: string }): Promise<ServerProject> {
  return request<ServerProject>("/api/smart-edit/projects", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function saveProject(id: string, body: SaveProjectBody): Promise<{ id: string; updatedAt: string }> {
  return request<{ id: string; updatedAt: string }>(`/api/smart-edit/projects/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export function getProject(id: string): Promise<ServerProject> {
  return request<ServerProject>(`/api/smart-edit/projects/${encodeURIComponent(id)}`);
}

export function listProjects(): Promise<ServerProject[]> {
  return request<ServerProject[]>("/api/smart-edit/projects");
}

export function deleteProject(id: string): Promise<void> {
  return request<void>(`/api/smart-edit/projects/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function publishProject(id: string, body: PublishProjectBody): Promise<PublishResult> {
  return request<PublishResult>(`/api/smart-edit/projects/${encodeURIComponent(id)}/publish`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** Public: fetch a published document by its templateId (no auth). */
export function fetchPublication(templateId: string): Promise<SmartEditPublishedPayload> {
  return request<SmartEditPublishedPayload>(`/api/smart-edit/published/${encodeURIComponent(templateId)}`);
}

/** Build the PublishedRecord shown in the editor from a publish result or a
 *  stored publication (the url is composed client-side from the origin). */
export function publishResultToRecord(result: ServerPublishedInfo): PublishedRecord {
  return {
    username: result.username,
    viewerName: result.viewerName,
    templateId: result.templateId,
    url: buildPublicUrl(result.username, result.viewerName, result.templateId),
    publishedAt: result.publishedAt,
  };
}
