export const ADMIN_EMAIL = "sandeepdolai.info@gmail.com";

export function isAdminEmail(email?: string | null): boolean {
  return !!email && email.trim().toLowerCase() === ADMIN_EMAIL;
}
