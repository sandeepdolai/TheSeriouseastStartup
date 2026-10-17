import { getDodoPaymentsClient, isDodoPaymentsConfigured } from "@/lib/dodoPayments";
import { requireUser, jsonError } from "@/lib/publicationServer";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return jsonError(401, "Sign in to manage your subscription.");
  if (!isDodoPaymentsConfigured()) {
    return jsonError(503, "Subscription management is not fully configured yet.");
  }
  if (!user.dodoCustomerId) {
    return jsonError(409, "No Dodo customer is linked to this account yet. Refresh and try again.");
  }

  try {
    const client = getDodoPaymentsClient();
    const origin = new URL(request.url).origin;
    const portal = await client.customers.customerPortal.create(user.dodoCustomerId, {
      return_url: new URL("/subscription", origin).toString(),
    });
    return Response.json({ url: portal.link });
  } catch (error) {
    console.error("Dodo customer portal creation failed:", error);
    return jsonError(502, "Could not open subscription management. Please try again.");
  }
}
