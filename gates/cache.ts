#!/usr/bin/env bun
// Checks BEND_CACHE (bend2/main.ts, Cache) on three modules in a temp dir:
// main imports b, b imports a, and a holds a proof by computation (a second
// of checking). A warm run skips it; an edit to a, to b or to the checker is
// checked again, and the edit's error found; a failed run writes no entry.

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import * as lib from "./_lib";

// Constants
// =========

const A = `import Base

def a.fib(+n: Nat) -> Nat:
  match n:
    case 0n:
      0n
    case 1n+p:
      match p:
        case 0n:
          1n
        case 1n+q:
          Nat.add(a.fib(p), a.fib(q))

def a.slow() -> {a.fib(23n) == 28657n : Nat}:
  {==}
`;

const B = "import Base\nimport ./a.bend as A\n\ndef b.two() -> Nat:\n  2n\n";

const MAIN = "import Base\nimport ./b.bend as B\n\ndef main() -> Nat:\n  B.b.two()\n";

const DIR = fs.mkdtempSync(path.join(os.tmpdir(), "bend-cache-"));

const CACHE = path.join(DIR, "cache");

// Cache
// =====

type Run = { pass: boolean; ms: number; n: number };

async function check(bend = path.join(lib.ROOT, "bend2", "main.ts")): Promise<Run> {
  const t = performance.now();
  const got = await lib.exec(process.execPath, [bend, "main.bend", "--check-only"],
    undefined, 60_000, { BEND_CACHE: CACHE, BEND_NO_TELEMETRY: "1" }, DIR);
  const ms = performance.now() - t;
  const n = fs.existsSync(CACHE) ? fs.readdirSync(CACHE).length : 0;
  return { pass: got.code === 0, ms, n };
}

function put(file: string, text: string): void {
  fs.writeFileSync(path.join(DIR, file), text);
}

// Main
// ====

if (import.meta.main) {
  const oks: [string, boolean][] = [];
  const say = (what: string, ok: boolean, r: Run): void => {
    oks.push([what, ok]);
    console.log((ok ? "ok   " : "FAIL ") + what + ": " + (r.pass ? "pass" : "fail")
      + ", " + r.ms.toFixed(0) + " ms, " + String(r.n) + " entries");
  };
  put("a.bend", A.replace("28657n", "28658n"));
  put("b.bend", B);
  put("main.bend", MAIN);
  let r = await check();
  say("a failing run writes nothing", !r.pass && r.n === 0, r);
  put("a.bend", A);
  const cold = await check();
  say("cold", cold.pass && cold.n > 0, cold);
  const warm = await check();
  say("warm skips a", warm.pass && warm.n === cold.n && warm.ms * 2 < cold.ms, warm);
  put("a.bend", A.replace("28657n", "28658n"));
  r = await check();
  say("an edit to a is checked", !r.pass && r.n === cold.n, r);
  put("a.bend", A);
  put("b.bend", B + "\ndef b.bad() -> {1n == 2n : Nat}:\n  {==}\n");
  r = await check();
  say("an edit to b is checked", !r.pass && r.n === cold.n, r);
  put("b.bend", B);
  r = await check();
  say("undone, warm again", r.pass && r.ms * 2 < cold.ms, r);
  const self = path.join(DIR, "bend2");
  fs.cpSync(path.join(lib.ROOT, "bend2"), self, { recursive: true,
    filter: (f) => !f.includes("/docs") && !f.includes("/node_modules") });
  fs.appendFileSync(path.join(self, "bend.ts"), "\n");
  r = await check(path.join(self, "main.ts"));
  say("a changed checker checks again", r.pass && r.n > cold.n && r.ms > 2 * warm.ms, r);
  fs.rmSync(DIR, { recursive: true, force: true });
  lib.verdict(oks.filter(([, ok]) => ok).length, oks.length);
}
