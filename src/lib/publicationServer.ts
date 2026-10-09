/* ───────────────────────────────────────────────────────────────────────────
   Paper Stish — publication server helpers.
   Session → owner resolution and request-body reading shared by the
   publish API and the public viewer page. Ownership always comes from the
   NextAuth session — client-provided owner data is never trusted.
─────────────────────────────────────────────────────────────────────────── */

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

/** Resolve the signed-in user, creating the account row on first use. */
export async function requireUser() {
  const session = await getServerSession(authOptions);
  const userEmail = session?.user?.email;
  if (!session || !userEmail) return null;
  const email = userEmail.trim().toLowerCase();
  if (!email || email.length > 200) return null;
  const userName = session.user?.name;
  const user = await db.user.upsert({
    where: { email },
    update: {},
    create: { email, name: typeof userName === "string" ? userName.slice(0, 120) : null },
  });
  return user;
}

export function jsonError(status: number, error: string) {
  return Response.json({ error }, { status });
}

/** Read + size-limit + parse a JSON request body. */
export async function readJsonBody(req: Request, maxBytes: number): Promise<Record<string, unknown> | null> {
  const lengthHeader = req.headers.get("content-length");
  if (lengthHeader && Number(lengthHeader) > maxBytes + 64 * 1024) {
    return null;
  }
  let text: string;
  try {
    text = await req.text();
  } catch {
    return null;
  }
  if (new TextEncoder().encode(text).byteLength > maxBytes + 64 * 1024) return null;
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
