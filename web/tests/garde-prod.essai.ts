/** Le garde-fou des commandes (hook PreToolUse) : ce qu'il bloque, ce qu'il laisse passer. */
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const HOOK = join(import.meta.dirname, "../.claude/hooks/garde-prod.mjs");
const verdict = (command: string) =>
  spawnSync("node", [HOOK], { input: JSON.stringify({ tool_input: { command } }), encoding: "utf8" }).status;

describe("garde-prod.mjs", () => {
  it.each([
    "npx supabase db push",
    "cd .. && supabase db query --linked -f supabase/migrations/x.sql",
    "psql postgres://postgres@db.abcdefgh.supabase.co:5432/postgres",
    "npx supabase functions deploy extraire-bc",
    "./scripts/deployer.sh",
    "git push --force origin claude/x",
    "git push origin main",
    "rm -rf /",
    "rm -rf ..",
    "docker exec db psql -c 'DROP TABLE devis'",
  ])("bloque : %s", (c) => expect(verdict(c)).toBe(2));

  it.each(["npm run check", "npm run test:rls", "npx supabase start", "git push -u origin claude/erp-chantier-react-rewrite-zvhro4", "rm -rf dist"])(
    "laisse passer : %s",
    (c) => expect(verdict(c)).toBe(0)
  );
});
