import crypto from "crypto";

const SECRET = process.env.AUTH_SECRET ?? "dev-secret-change-in-prod";

export function signToken(email: string): string {
  const payload = Buffer.from(JSON.stringify({ email })).toString("base64url");
  const sig = crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyToken(token: string): string | null {
  const dot = token.lastIndexOf(".");
  if (dot < 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
  if (expected !== sig) return null;
  try {
    const { email } = JSON.parse(Buffer.from(payload, "base64url").toString());
    return typeof email === "string" ? email : null;
  } catch {
    return null;
  }
}
