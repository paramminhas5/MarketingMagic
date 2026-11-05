// One interface, two backends. FileStore needs nothing and keeps each client's
// data in clients/<slug>/data/<collection>.json. SupabaseStore writes the same
// records to Postgres (see supabase/migrations) so Mission Control and
// event-driven functions can read them.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { clientDir } from "./workspace.ts";

export type Collection =
  | "assets"
  | "leads"
  | "metrics"
  | "learnings"
  | "runs"
  | "documents";

export type Rec = { id: string; client: string; [k: string]: unknown };

export interface Store {
  insert<T extends Rec>(col: Collection, rec: T): Promise<T>;
  insertMany<T extends Rec>(col: Collection, recs: T[]): Promise<T[]>;
  list<T extends Rec>(col: Collection, where?: (r: T) => boolean): Promise<T[]>;
  get<T extends Rec>(col: Collection, id: string): Promise<T | undefined>;
  update<T extends Rec>(col: Collection, id: string, patch: Partial<T>): Promise<T>;
}

export const newId = (prefix: string) => `${prefix}_${randomUUID().slice(0, 8)}`;

class FileStore implements Store {
  constructor(private slug: string) {}
  private path(col: Collection) {
    return clientDir(this.slug, "data", `${col}.json`);
  }
  private read<T>(col: Collection): T[] {
    const p = this.path(col);
    return existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as T[]) : [];
  }
  private write(col: Collection, rows: unknown[]) {
    const p = this.path(col);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, JSON.stringify(rows, null, 2));
  }
  async insert<T extends Rec>(col: Collection, rec: T) {
    const rows = this.read<T>(col);
    rows.push(rec);
    this.write(col, rows);
    return rec;
  }
  async insertMany<T extends Rec>(col: Collection, recs: T[]) {
    const rows = this.read<T>(col);
    rows.push(...recs);
    this.write(col, rows);
    return recs;
  }
  async list<T extends Rec>(col: Collection, where?: (r: T) => boolean) {
    const rows = this.read<T>(col);
    return where ? rows.filter(where) : rows;
  }
  async get<T extends Rec>(col: Collection, id: string) {
    return this.read<T>(col).find((r) => r.id === id);
  }
  async update<T extends Rec>(col: Collection, id: string, patch: Partial<T>) {
    const rows = this.read<T>(col);
    const i = rows.findIndex((r) => r.id === id);
    if (i < 0) throw new Error(`${col}/${id} not found`);
    rows[i] = { ...rows[i], ...patch };
    this.write(col, rows);
    return rows[i];
  }
}

// Every collection is a table `mm_<collection>` with (id, client, data jsonb, created_at).
// Typed columns for querying are generated from `data` in the migration.
class SupabaseStore implements Store {
  private db: SupabaseClient;
  constructor(private slug: string) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("MM_STORE=supabase needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
    this.db = createClient(url, key, { auth: { persistSession: false } });
  }
  private t(col: Collection) {
    return this.db.from(`mm_${col}`);
  }
  async insert<T extends Rec>(col: Collection, rec: T) {
    const { error } = await this.t(col).insert({ id: rec.id, client: rec.client, data: rec });
    if (error) throw new Error(`supabase insert ${col}: ${error.message}`);
    return rec;
  }
  async insertMany<T extends Rec>(col: Collection, recs: T[]) {
    if (!recs.length) return recs;
    const { error } = await this.t(col).insert(recs.map((r) => ({ id: r.id, client: r.client, data: r })));
    if (error) throw new Error(`supabase insert ${col}: ${error.message}`);
    return recs;
  }
  async list<T extends Rec>(col: Collection, where?: (r: T) => boolean) {
    const { data, error } = await this.t(col).select("data").eq("client", this.slug).order("created_at");
    if (error) throw new Error(`supabase list ${col}: ${error.message}`);
    const rows = (data ?? []).map((r) => r.data as T);
    return where ? rows.filter(where) : rows;
  }
  async get<T extends Rec>(col: Collection, id: string) {
    const { data, error } = await this.t(col).select("data").eq("id", id).maybeSingle();
    if (error) throw new Error(`supabase get ${col}: ${error.message}`);
    return data?.data as T | undefined;
  }
  async update<T extends Rec>(col: Collection, id: string, patch: Partial<T>) {
    const cur = await this.get<T>(col, id);
    if (!cur) throw new Error(`${col}/${id} not found`);
    const next = { ...cur, ...patch };
    const { error } = await this.t(col).update({ data: next }).eq("id", id);
    if (error) throw new Error(`supabase update ${col}: ${error.message}`);
    return next;
  }
}

export function openStore(slug: string): Store {
  return (process.env.MM_STORE ?? "file") === "supabase" ? new SupabaseStore(slug) : new FileStore(slug);
}
