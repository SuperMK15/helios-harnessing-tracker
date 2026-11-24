import { env } from "cloudflare:workers";

const COOKIE = "__Host-warg-editor";
const TTL_SECONDS = 8 * 60 * 60;
const encoder = new TextEncoder();

export function editorConfigured() {
  return Boolean(env.WARG_EDITOR_PASSWORD);
}

async function editorKey() {
  if (!env.WARG_EDITOR_PASSWORD) return null;
  return crypto.subtle.importKey(
    "raw", encoder.encode(env.WARG_EDITOR_PASSWORD), { name: "HMAC", hash: "SHA-256" },
    false, ["sign", "verify"],
  );
}

export async function credentialsMatch(username: string, password: string) {
  const key = await editorKey();
  if (!key || !env.WARG_EDITOR_PASSWORD) return false;
  const expected = await crypto.subtle.sign("HMAC", key, encoder.encode("password:" + env.WARG_EDITOR_PASSWORD));
  const matches = await crypto.subtle.verify("HMAC", key, expected, encoder.encode("password:" + password));
  return matches && username === "warg";
}

function sessionCookie(value: string, age: number) {
  return COOKIE + "=" + value + "; Max-Age=" + age + "; Path=/; HttpOnly; Secure; SameSite=Strict";
}

export async function newSessionCookie() {
  const key = await editorKey();
  if (!key) throw new Error("Editor login is unavailable.");
  const expires = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode("session:" + expires)));
  const tag = Array.from(signature, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return sessionCookie(expires + "." + tag, TTL_SECONDS);
}

export function expiredSessionCookie() {
  return sessionCookie("", 0);
}

export async function canEdit(request: Request) {
  const value = request.headers.get("cookie")?.split(";").map((entry) => entry.trim())
    .find((entry) => entry.startsWith(COOKIE + "="))?.slice(COOKIE.length + 1);
  const token = value?.match(/^(\d{10,12})\.([0-9a-f]{64})$/);
  if (!token || Number(token[1]) <= Date.now() / 1000) return false;
  const key = await editorKey();
  if (!key) return false;
  const signature = Uint8Array.from(token[2].match(/../g)!, (byte) => Number.parseInt(byte, 16));
  return crypto.subtle.verify("HMAC", key, signature, encoder.encode("session:" + token[1]));
}

export function isEditorJsonRequest(request: Request) {
  const site = request.headers.get("sec-fetch-site");
  return (site === null || site === "same-origin" || site === "none") &&
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() === "application/json";
}
