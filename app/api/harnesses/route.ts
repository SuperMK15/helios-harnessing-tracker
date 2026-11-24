import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../../db";
import { harnessTracking } from "../../../db/schema";
import { harnesses } from "../../../lib/harnesses";

export const dynamic = "force-dynamic";
const knownIds = new Set(harnesses.map(({ id }) => id));
const updateSchema = z.object({
  id: z.string().refine((id) => knownIds.has(id)),
  length: z.number().positive().nullable(),
  mechReady: z.boolean(),
  soldered: z.boolean(),
  installed: z.boolean(),
  solderedBy: z.string().trim().max(100),
  inspectedBy: z.string().trim().max(100),
  revision: z.number().int().nonnegative(),
});

export async function GET() {
  const rows = await getDb().select().from(harnessTracking);
  return Response.json(rows, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request) {
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    return Response.json({ error: "Cross-site updates are unavailable." }, { status: 403 });
  }
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Enter a valid positive length and names up to 100 characters." }, { status: 400 });
  }

  const { id, revision, ...changes } = parsed.data;
  const db = getDb();
  const values = { ...changes, revision: revision + 1 };
  const [row] = revision === 0
    ? await db.insert(harnessTracking).values({ id, ...values }).onConflictDoNothing().returning()
    : await db.update(harnessTracking).set(values).where(
      and(eq(harnessTracking.id, id), eq(harnessTracking.revision, revision)),
    ).returning();

  if (!row) {
    return Response.json({ error: "This harness changed while you were editing it. Reopen it to see the latest values." }, { status: 409 });
  }
  return Response.json(row);
}
