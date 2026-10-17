import { getDodoPaymentsClient, isDodoPaymentsConfigured } from "@/lib/dodoPayments";
import { db } from "@/lib/db";
import { jsonError } from "@/lib/publicationServer";

export const runtime = "nodejs";

const SUBSCRIPTION_EVENT_TYPES = new Set([
  "subscription.active",
  "subscription.updated",
  "subscription.on_hold",
  "subscription.past_due",
  "subscription.renewed",
  "subscription.plan_changed",
  "subscription.update_payment_method",
  "subscription.cancelled",
  "subscription.expired",
  "subscription.failed",
  "subscription.paused",
  "subscription.unpaused",
]);

const SUBSCRIPTION_STATUSES = new Set([
  "pending",
  "active",
  "on_hold",
  "past_due",
  "paused",
  "cancelled",
  "expired",
  "failed",
]);

type SubscriptionPayload = {
  subscription_id: string;
  product_id: string;
  status: string;
  customer: {
    customer_id: string;
    email: string;
  };
  metadata?: Record<string, string>;
  next_billing_date?: string | null;
  cancel_at_next_billing_date?: boolean;
};

type DodoEvent = {
  type: string;
  timestamp: string;
  data: unknown;
};

function parseSubscriptionPayload(value: unknown): SubscriptionPayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  const customer = data.customer;
  if (!customer || typeof customer !== "object" || Array.isArray(customer)) return null;
  const customerData = customer as Record<string, unknown>;
  if (
    typeof data.subscription_id !== "string" ||
    typeof data.product_id !== "string" ||
    typeof data.status !== "string" ||
    typeof customerData.customer_id !== "string" ||
    typeof customerData.email !== "string"
  ) return null;

  let metadata: Record<string, string> | undefined;
  if (data.metadata && typeof data.metadata === "object" && !Array.isArray(data.metadata)) {
    metadata = Object.fromEntries(
      Object.entries(data.metadata as Record<string, unknown>)
        .filter((entry): entry is [string, string] => typeof entry[1] === "string"),
    );
  }

  return {
    subscription_id: data.subscription_id,
    product_id: data.product_id,
    status: data.status,
    customer: {
      customer_id: customerData.customer_id,
      email: customerData.email,
    },
    metadata,
    next_billing_date: typeof data.next_billing_date === "string" ? data.next_billing_date : null,
    cancel_at_next_billing_date: data.cancel_at_next_billing_date === true,
  };
}

function fallbackStatusForEvent(type: string): string {
  switch (type) {
    case "subscription.active":
    case "subscription.renewed":
    case "subscription.unpaused":
      return "active";
    case "subscription.on_hold":
      return "on_hold";
    case "subscription.past_due":
      return "past_due";
    case "subscription.paused":
      return "paused";
    case "subscription.cancelled":
      return "cancelled";
    case "subscription.expired":
      return "expired";
    case "subscription.failed":
      return "failed";
    default:
      return "free";
  }
}

export async function POST(request: Request) {
  const productId = process.env.DODO_PAYMENTS_PRODUCT_ID?.trim();
  if (!isDodoPaymentsConfigured() || !productId) {
    return jsonError(503, "Dodo Payments webhooks are not fully configured.");
  }

  const webhookId = request.headers.get("webhook-id");
  const signature = request.headers.get("webhook-signature");
  const timestamp = request.headers.get("webhook-timestamp");
  if (!webhookId || !signature || !timestamp) {
    return jsonError(400, "Missing Dodo webhook signature headers.");
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return jsonError(400, "Could not read webhook body.");
  }
  if (new TextEncoder().encode(rawBody).byteLength > 1_000_000) {
    return jsonError(413, "Webhook body is too large.");
  }

  let event: DodoEvent;
  try {
    const client = getDodoPaymentsClient();
    event = client.webhooks.unwrap(rawBody, {
      headers: {
        "webhook-id": webhookId,
        "webhook-signature": signature,
        "webhook-timestamp": timestamp,
      },
    }) as unknown as DodoEvent;
  } catch {
    return jsonError(401, "Invalid Dodo webhook signature.");
  }

  if (!SUBSCRIPTION_EVENT_TYPES.has(event.type)) {
    return Response.json({ received: true });
  }

  const payload = parseSubscriptionPayload(event.data);
  if (!payload) return jsonError(400, "Invalid subscription event payload.");
  if (payload.product_id !== productId) return Response.json({ received: true });

  const eventAt = new Date(event.timestamp);
  if (Number.isNaN(eventAt.getTime())) return jsonError(400, "Invalid webhook event timestamp.");

  try {
    await db.$transaction(async (tx) => {
      const claim = await tx.dodoWebhookEvent.createMany({
        data: [{ id: webhookId, eventType: event.type }],
        skipDuplicates: true,
      });
      if (claim.count === 0) return;

      const metadataUserId = payload.metadata?.app_user_id;
      let user = metadataUserId
        ? await tx.user.findUnique({ where: { id: metadataUserId } })
        : null;
      if (!user) {
        user = await tx.user.findUnique({
          where: { email: payload.customer.email.trim().toLowerCase() },
        });
      }
      if (!user) throw new Error("No matching Paper Stish account for Dodo subscription.");

      // Dodo retries and delivery order are not guaranteed. Ignore older states.
      if (user.subscriptionEventAt && eventAt.getTime() <= user.subscriptionEventAt.getTime()) return;

      // Ignore delayed events from an older subscription after a newer one replaced it.
      if (
        user.dodoSubscriptionId &&
        user.dodoSubscriptionId !== payload.subscription_id &&
        event.type !== "subscription.active"
      ) return;

      let nextStatus = SUBSCRIPTION_STATUSES.has(payload.status)
        ? payload.status
        : fallbackStatusForEvent(event.type);
      const nextPeriodEnd = payload.next_billing_date ? new Date(payload.next_billing_date) : null;
      const hasValidPeriodEnd = !!nextPeriodEnd && !Number.isNaN(nextPeriodEnd.getTime());
      const cancelAtPeriodEnd = payload.cancel_at_next_billing_date === true;

      // A period-end cancellation remains paid through the already-paid period.
      if (
        nextStatus === "cancelled" &&
        cancelAtPeriodEnd &&
        hasValidPeriodEnd &&
        nextPeriodEnd!.getTime() > Date.now()
      ) {
        nextStatus = "active";
      }

      await tx.user.updateMany({
        where: {
          id: user.id,
          OR: [
            { subscriptionEventAt: null },
            { subscriptionEventAt: { lt: eventAt } },
          ],
        },
        data: {
          subscriptionStatus: nextStatus,
          dodoSubscriptionId: payload.subscription_id,
          dodoCustomerId: payload.customer.customer_id,
          subscriptionProductId: payload.product_id,
          subscriptionPeriodEnd: hasValidPeriodEnd ? nextPeriodEnd : null,
          subscriptionCancelAtPeriodEnd: cancelAtPeriodEnd,
          subscriptionEventAt: eventAt,
        },
      });
    });
  } catch (error) {
    console.error("Could not apply verified Dodo subscription webhook:", error);
    return jsonError(500, "Could not apply subscription event.");
  }

  return Response.json({ received: true });
}
