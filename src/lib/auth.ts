import type { Env } from "../types";

type TokenPayload = {
  typ: "magic" | "session";
  email: string;
  exp?: number; // seconds since epoch
  iat?: number; // seconds since epoch
  nonce?: string;
};

const encoder = new TextEncoder();

function b64url(bytes: ArrayBuffer | Uint8Array) {
  const binary = String.fromCharCode(...new Uint8Array(bytes as ArrayBuffer));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function b64urlDecodeToBytes(input: string) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((input.length + 3) % 4);
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function importHmacKey(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function hmacSign(secret: string, data: string) {
  const key = await importHmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return b64url(sig);
}

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

export async function createMagicToken(env: Env, email: string, ttlSeconds = 15 * 60) {
  const secret = env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET not set");
  const payload: TokenPayload = {
    typ: "magic",
    email,
    exp: nowSec() + ttlSeconds,
    nonce: crypto.randomUUID(),
  };
  const body = b64url(encoder.encode(JSON.stringify(payload)));
  const sig = await hmacSign(secret, body);
  return `${body}.${sig}`;
}

export async function verifyMagicToken(env: Env, token: string) {
  const secret = env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET not set");
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = await hmacSign(secret, body);
  if (expected !== sig) return null;
  const json = new TextDecoder().decode(b64urlDecodeToBytes(body));
  const payload = JSON.parse(json) as TokenPayload;
  if (payload.typ !== "magic") return null;
  if (!payload.exp || payload.exp < nowSec()) return null;
  return payload.email;
}

export async function createSessionToken(env: Env, email: string) {
  const secret = env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET not set");
  const payload: TokenPayload = { typ: "session", email, iat: nowSec() };
  const body = b64url(encoder.encode(JSON.stringify(payload)));
  const sig = await hmacSign(secret, body);
  return `${body}.${sig}`;
}

export async function parseSessionToken(env: Env, token: string | null | undefined) {
  if (!token) return null;
  const secret = env.SESSION_SECRET;
  if (!secret) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = await hmacSign(secret, body);
  if (expected !== sig) return null;
  const json = new TextDecoder().decode(b64urlDecodeToBytes(body));
  const payload = JSON.parse(json) as TokenPayload;
  if (payload.typ !== "session" || !payload.email) return null;
  return payload.email;
}

export function buildSetCookie(name: string, value: string, maxAgeSec: number) {
  const parts = [
    `${name}=${value}`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
    `Max-Age=${maxAgeSec}`,
  ];
  return parts.join("; ");
}

export function clearCookie(name: string) {
  return `${name}=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax`;
}

