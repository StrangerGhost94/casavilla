import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "cv_session";
const secret = () => new TextEncoder().encode(process.env.AUTH_SECRET || "dev-secret-change-me-dev-secret-change-me");

export type SessionPayload = { uid: number; role: "tenant" | "landlord" | "provider" | "manager" | "caretaker" };

export async function signSession(p: SessionPayload) {
  return new SignJWT(p).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("30d").sign(secret());
}

export async function verifySession(token?: string): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return { uid: Number(payload.uid), role: payload.role as SessionPayload["role"] };
  } catch {
    return null;
  }
}
