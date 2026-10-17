/**
 * Shared entitlement rules for Paper Stish Free and Pro features.
 * Only verified Dodo subscription webhooks should write the User subscription
 * fields consumed here. A missing/invalid period end never extends an
 * explicitly dated subscription.
 */
export interface SubscriptionSnapshot {
  subscriptionStatus?: string | null;
  subscriptionPeriodEnd?: Date | string | null;
}

export function hasProAccess(
  subscription: SubscriptionSnapshot | null | undefined,
  now = Date.now(),
): boolean {
  if (!subscription || subscription.subscriptionStatus !== "active") return false;

  const end = subscription.subscriptionPeriodEnd;
  if (end === null || end === undefined || end === "") return true;

  const timestamp = end instanceof Date ? end.getTime() : Date.parse(end);
  return Number.isFinite(timestamp) && timestamp > now;
}

/** Free users may keep editing, but may have at most this many uploaded photo
 * layers in one Smart Edit design. Removing a photo frees the slot again. */
export const FREE_SMART_EDIT_PHOTO_LIMIT = 10;

/** Admin-only template publishing and internal QA can bypass paid-plan gates. */
export function hasProOrAdminAccess(
  subscription: SubscriptionSnapshot | null | undefined,
  isAdmin: boolean,
  now = Date.now(),
): boolean {
  return isAdmin || hasProAccess(subscription, now);
}
