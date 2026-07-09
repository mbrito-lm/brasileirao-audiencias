// Administradores do app. Adicione e-mails @livemode.com aqui.
export const ADMIN_EMAILS = new Set<string>([
  "mbrito@livemode.com",
]);

export function isAdmin(email?: string | null): boolean {
  return !!email && ADMIN_EMAILS.has(email.toLowerCase());
}
