import type { System } from "../lib/harnesses";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const harnessTracking = sqliteTable("harness_tracking", {
  id: text("id").primaryKey().notNull(),
  length: real("length_mm"),
  // The original checkbox values now represent Length final. Keep the column for older deployments.
  lengthFinal: integer("mech_ready", { mode: "boolean" }).notNull(),
  soldered: integer("soldered", { mode: "boolean" }).notNull(),
  mechanicalReady: integer("mechanical_ready", { mode: "boolean" }).notNull().default(false),
  installed: integer("installed", { mode: "boolean" }).notNull(),
  solderedBy: text("soldered_by").notNull(),
  inspectedBy: text("inspected_by").notNull(),
  revision: integer("revision").notNull(),
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
  system: text("system").$type<System>(),
  name: text("name"),
  endpoints: text("endpoints"),
  connector: text("connector"),
});
