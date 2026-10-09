import { NextResponse } from "next/server";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const email = typeof body?.email === "string" ? body.email.trim() : "";
    const company = typeof body?.company === "string" ? body.company.trim() : "";

    // Silently ignore honeypot submissions.
    if (company) {
      return NextResponse.json({ ok: true, message: "Thanks." });
    }

    if (!EMAIL_RE.test(email) || email.length > 254) {
      return NextResponse.json(
        { ok: false, error: "Enter a valid email address." },
        { status: 400 },
      );
    }

    // No mailing provider is configured. Do not store or falsely acknowledge
    // a subscription until a real opt-in flow is connected.
    return NextResponse.json(
      {
        ok: false,
        error: "Newsletter sign-ups are not open yet. Your email has not been saved.",
      },
      { status: 503 },
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: "Something went wrong. Please try again later." },
      { status: 500 },
    );
  }
}
