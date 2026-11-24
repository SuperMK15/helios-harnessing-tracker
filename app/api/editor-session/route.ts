import { z } from "zod";
import {
  canEdit, credentialsMatch, editorConfigured, expiredSessionCookie, newSessionCookie, isEditorJsonRequest,
} from "../../../lib/editor-session";

export const dynamic = "force-dynamic";

const loginSchema = z.object({
  username: z.string().max(80),
  password: z.string().max(256),
});

function result(editable: boolean, status = 200, error?: string, cookie?: string) {
  const headers = new Headers({ "Cache-Control": "no-store" });
  if (cookie) headers.set("Set-Cookie", cookie);
  return Response.json({ editable, error }, { headers, status });
}

export async function GET(request: Request) {
  return result(await canEdit(request));
}

export async function POST(request: Request) {
  if (!isEditorJsonRequest(request)) return result(false, 403, "Login requests must come from the tracker.");
  if (!editorConfigured()) return result(false, 503, "Editor login is unavailable.");
  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !await credentialsMatch(parsed.data.username, parsed.data.password)) {
    return result(false, 401, "Incorrect username or password.");
  }
  return result(true, 200, undefined, await newSessionCookie());
}

export async function DELETE(request: Request) {
  if (!isEditorJsonRequest(request)) return result(false, 403, "Logout requests must come from the tracker.");
  return result(false, 200, undefined, expiredSessionCookie());
}
