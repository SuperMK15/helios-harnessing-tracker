import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { canEdit, isEditorJsonRequest } from "../../../lib/editor-session";
import { getDb } from "../../../db";
import { harnessTracking } from "../../../db/schema";
import { blankTracking, harnesses, systems, type Harness, type Wire } from "../../../lib/harnesses";

export const dynamic = "force-dynamic";

const catalog = new Map(harnesses.map((wire) => [wire.id, wire]));
type StoredWire = typeof harnessTracking.$inferSelect;

const detailsSchema = z.object({
  name: z.string().trim().min(1).max(120),
  endpoints: z.string().trim().max(200),
  connector: z.string().trim().max(120),
});

const trackingSchema = z.object({
  length: z.number().positive().nullable(),
  mechReady: z.boolean(),
  soldered: z.boolean(),
  installed: z.boolean(),
  solderedBy: z.string().trim().max(100),
  inspectedBy: z.string().trim().max(100),
});

const createSchema = z.object({
  action: z.literal("create"),
  id: z.string().regex(/^wire-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/),
  system: z.enum(systems),
  details: detailsSchema,
  tracking: trackingSchema,
});

const updateBase = z.object({
  id: z.string().min(1).max(64),
  revision: z.number().int().nonnegative(),
});

const mutationSchema = z.discriminatedUnion("action", [
  createSchema,
  updateBase.extend({ action: z.literal("edit"), tracking: trackingSchema, details: detailsSchema.partial().optional() }),
  updateBase.extend({ action: z.literal("archive"), archived: z.boolean() }),
]);

function wireFrom(row: StoredWire | undefined, original?: Harness): Wire | null {
  if (original) {
    return {
      ...original,
      name: row?.name ?? original.name,
      endpoints: row?.endpoints ?? original.endpoints,
      connector: row?.connector ?? original.connector,
      ...(row ? {
        length: row.length,
        mechReady: row.mechReady,
        soldered: row.soldered,
        installed: row.installed,
        solderedBy: row.solderedBy,
        inspectedBy: row.inspectedBy,
        revision: row.revision,
      } : blankTracking),
      archived: row?.archived ?? false,
      custom: false,
    };
  }
  if (!row || !row.system || !row.name) return null;
  return { ...row, system: row.system, name: row.name, endpoints: row.endpoints ?? "", connector: row.connector ?? "", custom: true };
}

export async function GET() {
  const rows = await getDb().select().from(harnessTracking);
  const byId = new Map(rows.map((row) => [row.id, row]));
  const wires = [
    ...harnesses.map((original) => wireFrom(byId.get(original.id), original)),
    ...rows.filter((row) => !catalog.has(row.id)).map((row) => wireFrom(row)),
  ].filter((wire) => wire !== null);
  return Response.json(wires, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request) {
  if (!isEditorJsonRequest(request)) {
    return Response.json({ error: "Cross-site updates are unavailable." }, { status: 403 });
  }
  if (!await canEdit(request)) {
    return Response.json({ error: "Log in to edit the wire register." }, { status: 401 });
  }
  const parsed = mutationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Check the wire name, length, and field limits." }, { status: 400 });
  }

  const data = parsed.data;
  const db = getDb();
  const original = catalog.get(data.id);

  if (data.action === "create") {
    const [created] = await db.insert(harnessTracking).values({
      id: data.id, system: data.system, ...data.details, ...data.tracking, revision: 1,
    }).onConflictDoNothing().returning();
    if (created) return Response.json(wireFrom(created), { status: 201 });

    // A retry after a lost response uses the same ID.
    const [existing] = await db.select().from(harnessTracking).where(eq(harnessTracking.id, data.id));
    return Response.json(wireFrom(existing));
  }

  const changes = data.action === "archive"
    ? { archived: data.archived }
    : { ...data.tracking, ...data.details };
  const values = { ...changes, revision: data.revision + 1 };
  const [row] = data.revision === 0 && original
    ? await db.insert(harnessTracking).values({ id: data.id, ...blankTracking, ...values }).onConflictDoNothing().returning()
    : await db.update(harnessTracking).set(values).where(
      and(eq(harnessTracking.id, data.id), eq(harnessTracking.revision, data.revision), ...(
        data.action === "edit" ? [eq(harnessTracking.archived, false)] : []
      )),
    ).returning();

  if (!row) {
    return Response.json({ error: "This wire changed. Close and reopen it to see the latest values." }, { status: 409 });
  }
  return Response.json(wireFrom(row, original));
}
