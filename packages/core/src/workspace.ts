// Client workspaces. Every client is a folder: clients/<slug>/
//   client.yaml     who they are (ClientProfile)
//   machine.yaml    which products run for them, when, with what autonomy (Machine)
//   voice/<id>.md   writing samples for each named voice
//   inputs/<product>/   evidence gathered by connectors (Ahrefs exports, Clay lists...)
//   research/       market brief + strategy (human-readable and JSON)
//   out/            everything products produce
//   data/           the file store (when MM_STORE=file)
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, cpSync } from "node:fs";
import { dirname, join, resolve, extname } from "node:path";
import YAML from "yaml";
import { ClientProfile, Machine } from "./schemas.ts";

export function repoRoot(): string {
  if (process.env.MM_ROOT) return resolve(process.env.MM_ROOT);
  let dir = process.cwd();
  for (;;) {
    if (existsSync(join(dir, "clients")) && existsSync(join(dir, "playbooks"))) return dir;
    const up = dirname(dir);
    if (up === dir) throw new Error("Can't find the MarketingMagic repo root (no clients/ + playbooks/). Set MM_ROOT.");
    dir = up;
  }
}

export const clientsDir = () => join(repoRoot(), "clients");
export const clientDir = (slug: string, ...rest: string[]) => join(clientsDir(), slug, ...rest);

export function listClients(): string[] {
  return readdirSync(clientsDir())
    .filter((d) => !d.startsWith("_") && !d.startsWith("."))
    .filter((d) => existsSync(join(clientsDir(), d, "client.yaml")));
}

const activeFile = () => join(repoRoot(), ".mm", "active-client");

export function setActiveClient(slug: string) {
  if (!listClients().includes(slug)) throw new Error(`Unknown client "${slug}". Known: ${listClients().join(", ")}`);
  mkdirSync(dirname(activeFile()), { recursive: true });
  writeFileSync(activeFile(), slug);
}

export function activeClient(explicit?: string): string {
  const slug = explicit ?? process.env.MM_CLIENT ?? (existsSync(activeFile()) ? readFileSync(activeFile(), "utf8").trim() : "");
  if (!slug) throw new Error("No client selected. Use --client <slug> or `mm use <slug>`.");
  if (!listClients().includes(slug)) throw new Error(`Unknown client "${slug}". Known: ${listClients().join(", ")}`);
  return slug;
}

export function loadClient(slug: string): ClientProfile {
  const raw = YAML.parse(readFileSync(clientDir(slug, "client.yaml"), "utf8"));
  return ClientProfile.parse({ ...raw, slug });
}

export function loadMachine(slug: string): Machine | undefined {
  const p = clientDir(slug, "machine.yaml");
  if (!existsSync(p)) return undefined;
  return Machine.parse(YAML.parse(readFileSync(p, "utf8")));
}

export function writeYaml(path: string, data: unknown) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, YAML.stringify(data, { lineWidth: 0 }));
}

export function writeFile(path: string, content: string) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

export function readJson<T>(path: string): T | undefined {
  return existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as T) : undefined;
}

/** Read every text-ish file under clients/<slug>/inputs/<product>/, truncated per file. */
export function readInputs(slug: string, product: string, maxCharsPerFile = 8000): Record<string, string> {
  const dir = clientDir(slug, "inputs", product);
  if (!existsSync(dir)) return {};
  const out: Record<string, string> = {};
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (!statSync(p).isFile()) continue;
    if (![".json", ".md", ".txt", ".csv", ".yaml", ".yml"].includes(extname(f))) continue;
    out[f] = readFileSync(p, "utf8").slice(0, maxCharsPerFile);
  }
  return out;
}

export function readVoiceCorpus(slug: string, voiceId: string): string {
  const p = clientDir(slug, "voice", `${voiceId}.md`);
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}

/** Create a new client folder from clients/_template. */
export function scaffoldClient(slug: string, fields: { name: string; url?: string; playbook: string; description?: string }) {
  const dest = clientDir(slug);
  if (existsSync(dest)) throw new Error(`clients/${slug} already exists`);
  cpSync(join(clientsDir(), "_template"), dest, { recursive: true });
  const tmpl = YAML.parse(readFileSync(join(dest, "client.yaml"), "utf8"));
  writeYaml(join(dest, "client.yaml"), {
    ...tmpl,
    slug,
    name: fields.name,
    url: fields.url ?? tmpl.url,
    playbook: fields.playbook,
    description: fields.description ?? tmpl.description,
  });
  return dest;
}

export const today = () => new Date().toISOString().slice(0, 10);
export const stamp = () => new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
