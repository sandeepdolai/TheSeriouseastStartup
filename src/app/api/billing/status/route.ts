import { isDodoPaymentsConfigured } from "@/lib/dodoPayments";
import { hasProAccess } from "@/lib/planAccess";
import { requireUser, jsonError } from "@/lib/publicationServer";

export const dynamic = "force-dynamic";

export async function GET() {
  // Before Dodo is set up, the account should calmly stay on Free instead of
  // showing a retrying/error card or querying subscription columns that may
  // not yet have been migrated in production.
  const billingConfigured = isDodoPaymentsConfigured();

  if (!billingConfigured) {
    return Response.json(
      {
        isPremium: false,
        status: "unconfigured",
        billingConfigured: false,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }

  try {
    const user = await requireUser();
    if (!user) return jsonError(401, "Sign in to check your subscription.");

    const currentPeriodEnd = user.subscriptionPeriodEnd?.toISOString() ?? null;
    const isPremium = hasProAccess(user);

    return Response.json(
      {
        isPremium,
        status: user.subscriptionStatus,
        billingConfigured: true,
        currentPeriodEnd,
        cancelAtPeriodEnd: user.subscriptionCancelAtPeriodEnd,
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    console.error("Subscription status lookup failed:", error);
    return jsonError(500, "Could not verify your subscription status.");
  }
}
