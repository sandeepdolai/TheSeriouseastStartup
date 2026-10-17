import { getDodoPaymentsClient, isDodoPaymentsConfigured } from "@/lib/dodoPayments";
import { requireUser, jsonError } from "@/lib/publicationServer";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return jsonError(401, "Sign in before upgrading to Pro.");

  const productId = process.env.DODO_PAYMENTS_PRODUCT_ID?.trim();
  if (!isDodoPaymentsConfigured() || !productId) {
    return jsonError(503, "Subscription checkout is not fully configured yet. Please try again later.");
  }

  const alreadyPremium =
    user.subscriptionStatus === "active" &&
    (!user.subscriptionPeriodEnd || user.subscriptionPeriodEnd.getTime() > Date.now());
  if (alreadyPremium) return jsonError(409, "Your account already has an active subscription.");

  try {
    const client = getDodoPaymentsClient();
    const origin = new URL(request.url).origin;
    const session = await client.checkoutSessions.create({
      product_cart: [{ product_id: productId, quantity: 1 }],
      customer: {
        email: user.email,
        name: user.name ?? undefined,
      },
      metadata: { app_user_id: user.id },
      return_url: new URL("/subscription?billing=return", origin).toString(),
      cancel_url: new URL("/upgrade?billing=cancelled", origin).toString(),
    });

    if (!session.checkout_url) {
      return jsonError(502, "Dodo Payments did not return a checkout link.");
    }

    return Response.json({ checkoutUrl: session.checkout_url });
  } catch (error) {
    console.error("Dodo checkout session creation failed:", error);
    return jsonError(502, "Could not start checkout. Please try again.");
  }
}
