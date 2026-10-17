# Dodo Payments setup for Paper Stish

Dodo Payments is wired into the Paper Stish Pro upgrade flow, subscription status, customer portal, and signed webhook handler. **Checkout intentionally stays disabled until the API key, Pro product ID, and webhook signing key are all configured.** Missing or invalid configuration cannot grant Pro access.

Official references:
- [Dodo checkout sessions](https://docs.dodopayments.com/api-reference/checkout-sessions/create)
- [Dodo webhooks and signature verification](https://docs.dodopayments.com/developer-resources/webhooks)
- [Dodo subscription webhook events](https://docs.dodopayments.com/developer-resources/webhooks/intents/webhook-events-guide)

## 1. Create the Pro subscription product

In the Dodo Payments dashboard, create a **subscription** product for **Pro — USD $4.99 every month**. Do not create a one-time payment product.

Create the test-mode product first. Copy its product ID; the test product ID is different from the live product ID.

## 2. Add Dodo secrets in Vercel

In the Paper Stish Vercel project, open **Settings → Environment Variables** and add these server-side values:

| Variable | Value |
| --- | --- |
| `DODO_PAYMENTS_API_KEY` | Dodo API key from the same mode as the product |
| `DODO_PAYMENTS_PRODUCT_ID` | Pro monthly subscription product ID for that mode |
| `DODO_PAYMENTS_WEBHOOK_KEY` | Signing secret for the webhook endpoint in that mode |
| `DODO_PAYMENTS_ENVIRONMENT` | `test_mode` first; `live_mode` only when switching to live credentials |

Keep the three credentials and product ID in the same Dodo mode. Do not use `NEXT_PUBLIC_*` names, commit real values, or paste secrets into client-side code.

The integration defaults to `test_mode` if `DODO_PAYMENTS_ENVIRONMENT` is unset. Any other value except `test_mode` or `live_mode` is treated as misconfiguration. After changing environment variables, redeploy Paper Stish so the running deployment receives them.

## 3. Create the webhook endpoint

In Dodo Payments, go to **Developer → Webhooks → Add endpoint** and use this URL:

```text
https://www.paperstish.online/api/webhooks/dodo
```

Subscribe to these events:

- `subscription.active`
- `subscription.updated`
- `subscription.on_hold`
- `subscription.past_due`
- `subscription.renewed`
- `subscription.plan_changed`
- `subscription.update_payment_method`
- `subscription.cancelled`
- `subscription.expired`
- `subscription.failed`
- `subscription.paused`
- `subscription.unpaused`

Copy the endpoint's **webhook signing secret** (not its endpoint ID) to `DODO_PAYMENTS_WEBHOOK_KEY`. The handler verifies Dodo's signature against the raw request body, handles duplicate deliveries idempotently, checks the configured product ID, and updates Pro status only from verified webhook events.

## 4. Database readiness

The subscription columns and webhook idempotency table are already defined in the Prisma schema and migration history. Before enabling checkout on the production database, run:

```bash
bunx prisma migrate deploy
```

Use the production database's protected environment values for this command. The normal Vercel build generates Prisma Client but does **not** apply production database migrations.

## 5. Test before going live

With matching test-mode credentials:

1. Open `/upgrade`, sign in, and start checkout.
2. Complete a Dodo test checkout for the Pro monthly product.
3. In Dodo's webhook delivery log, confirm `subscription.active` was delivered successfully to `/api/webhooks/dodo`.
4. Check `/subscription`: the account should show Pro and a billing date.
5. Open the customer portal, then test a scheduled cancellation and the related webhook updates.

If checkout remains unavailable, verify all three required variables are set and the environment is exactly `test_mode` or `live_mode`. If payment succeeds but Pro does not activate, inspect the Dodo webhook delivery log and check that the signing secret, product ID, and environment match.

When testing is complete, switch all three values to their matching **live-mode** credentials/product/signing secret, set `DODO_PAYMENTS_ENVIRONMENT=live_mode`, redeploy, and run one controlled live checkout.

## Current keyless behavior

No keys are included in the repository. Until the required settings are added in Vercel, the plan page stays on Free and checkout, portal actions, and webhook processing return a safe configuration error. A browser return URL by itself never grants Pro access.
