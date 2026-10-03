#!/usr/bin/env bun
// Checks BEND_CACHE (bend2/main.ts, Cache; docs in bend2/docs/CACHE.md) on
// four modules in a temp dir: main imports b, b imports c, c imports a, and a
// holds a proof by computation (a second of checking). A warm run skips it
// and prints what a cold run prints; an edit to a (three imports deep), to c,
// to b, to the checker or to the stack limit is checked again, and the edit's
// error found; a failed run writes no entry; a corrupt, truncated, foreign or
// misnamed entry is ignored; many runs at once leave only whole entries.

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

const BAD = A.replace("28657n", "28658n");

const C = "import Base\nimport ./a.bend as A\n\ndef c.two() -> Nat:\n  2n\n";

const B = "import Base\nimport ./c.bend as C\n\ndef b.two() -> Nat:\n  C.c.two()\n";

const MAIN = "import Base\nimport ./b.bend as B\n\ndef main() -> Nat:\n  B.b.two()\n";

const LAW = "\ndef c.bad() -> {1n == 2n : Nat}:\n  {==}\n";

const DIR = fs.mkdtempSync(path.join(os.tmpdir(), "bend-cache-"));

const CACHE = path.join(DIR, "cache");

// runs at once in the concurrency test ($CACHE_JOBS)
const JOBS = Number(process.env.CACHE_JOBS ?? 16);

const MAIN_TS = path.join(lib.ROOT, "bend2", "main.ts");

// Cache
// =====

type Run = { pass: boolean; ms: number; n: number; out: string; code: number };

// one --check-only run of main.bend; cache = false is the control with no cache
async function check(bend = MAIN_TS, env: Record<string, string> = {},
  cache = true): Promise<Run> {
  const t = performance.now();
  const got = await lib.exec(process.execPath, [bend, "main.bend", "--check-only"],
    undefined, 120_000, { BEND_NO_TELEMETRY: "1", BEND_CACHE: cache ? CACHE : "",
      BUN_JSC_maxPerThreadStackUsage: "33554432", ...env }, DIR);
  const ms = performance.now() - t;
  return { pass: got.code === 0, ms, n: entries().length, out: got.out + got.err,
    code: got.code };
}

function entries(): string[] {
  return fs.existsSync(CACHE) ? fs.readdirSync(CACHE) : [];
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
  const reset = (): void => {
    fs.rmSync(CACHE, { recursive: true, force: true });
    put("a.bend", A);
    put("b.bend", B);
    put("c.bend", C);
    put("main.bend", MAIN);
  };
  reset();
  const ctl = await check(MAIN_TS, {}, false);
  say("control, no cache: pass, writes nothing", ctl.pass && ctl.n === 0, ctl);
  const cold = await check();
  say("cold", cold.pass && cold.n > 0 && cold.out === ctl.out, cold);
  const warm = await check();
  say("a hit prints what a cold run prints and skips a", warm.pass
    && warm.out === ctl.out && warm.n === cold.n && warm.ms * 2 < cold.ms, warm);

  // a failing proof is never cached, and a hit never hides it
  reset();
  put("a.bend", BAD);
  let r = await check();
  const badctl = await check(MAIN_TS, {}, false);
  say("a failing run writes nothing", !r.pass && r.n === 0 && r.out === badctl.out, r);
  r = await check();
  say("and a second failing run still fails", !r.pass && r.n === 0, r);

  // an edit to an import, three levels deep, in the middle, at the top
  reset();
  await check();
  put("a.bend", BAD);
  r = await check();
  say("a failing edit to a (3 deep) is found", !r.pass && r.out === badctl.out, r);
  put("a.bend", A + "\n# a comment\n");
  r = await check();
  say("a passing edit to a (3 deep) misses the cache", r.pass && r.ms * 2 > cold.ms
    && r.n > cold.n, r);
  put("a.bend", A);
  put("c.bend", C + LAW);
  r = await check();
  say("an edit to c is checked", !r.pass && r.out.includes("c.bad"), r);
  put("c.bend", C);
  put("b.bend", B + LAW.replace("c.bad", "b.bad"));
  r = await check();
  say("an edit to b is checked", !r.pass && r.out.includes("b.bad"), r);
  put("b.bend", B);
  r = await check();
  say("undone, warm again", r.pass && r.ms * 2 < cold.ms, r);

  // the checker: a copy of bend2/ with one byte added to bend.ts
  const self = path.join(DIR, "bend2");
  fs.cpSync(path.join(lib.ROOT, "bend2"), self, { recursive: true,
    filter: (f) => !f.includes("/docs") && !f.includes("/node_modules") });
  fs.appendFileSync(path.join(self, "bend.ts"), "\n");
  const n0 = entries().length;
  r = await check(path.join(self, "main.ts"));
  say("a changed checker checks again", r.pass && r.n > n0 && r.ms > 2 * warm.ms, r);

  // the settings a verdict depends on
  const n1 = entries().length;
  r = await check(MAIN_TS, { BUN_JSC_maxPerThreadStackUsage: "50331648" });
  say("another stack setting checks again", r.pass && r.n > n1 && r.ms > 2 * warm.ms, r);
  r = await check();
  say("the first setting still hits", r.pass && r.ms * 2 < cold.ms, r);

  // a corrupt, truncated, foreign or misnamed entry is no entry
  const damage: [string, (f: string, t: string, other: string) => void][] = [
    ["truncated", (f, t) => fs.writeFileSync(f, t.slice(0, t.length >> 1))],
    ["empty", (f) => fs.writeFileSync(f, "")],
    ["garbage", (f) => fs.writeFileSync(f, "\u0000\u0001 not json")],
    ["foreign", (f) => fs.writeFileSync(f, JSON.stringify({ taint: [] }))],
    ["altered", (f, t) => fs.writeFileSync(f, t.replace('"taint":[', '"taint":["x",'))],
    ["misnamed", (f, _t, other) => fs.writeFileSync(f, other)],
  ];
  for (const [what, dmg] of damage) {
    reset();
    await check();
    const fs_ = entries().map((f) => path.join(CACHE, f));
    const texts = fs_.map((f) => fs.readFileSync(f, "utf8"));
    fs_.forEach((f, i) => dmg(f, texts[i], texts[(i + 1) % texts.length]));
    r = await check();
    say("a " + what + " entry is ignored: cold check, same output", r.pass
      && r.out === ctl.out && r.ms * 2 > cold.ms, r);
    r = await check();
    say("and the next run repairs it", r.pass && r.ms * 2 < cold.ms, r);
  }
  // a damaged entry never turns a failure into a pass
  reset();
  await check();
  for (const f of entries()) {
    fs.writeFileSync(path.join(CACHE, f), JSON.stringify({ v: 1, key: f,
      taint: [], sum: "0" }));
  }
  put("a.bend", BAD);
  r = await check();
  say("a forged entry does not hide a failing proof", !r.pass && r.out === badctl.out, r);

  // many runs at once on one fresh dir: all agree, every entry is whole
  reset();
  const many = await Promise.all(Array.from({ length: JOBS }, () => check()));
  const whole = entries().every((f) => !f.endsWith(".tmp") && f.length === 64
    && JSON.parse(fs.readFileSync(path.join(CACHE, f), "utf8")).key === f);
  say(String(JOBS) + " runs at once: same verdict and output, whole entries", whole
    && many.every((x) => x.pass && x.out === ctl.out) && entries().length === cold.n,
    many[0]);
  r = await check();
  say("and warm after them", r.pass && r.ms * 2 < cold.ms, r);

  fs.rmSync(DIR, { recursive: true, force: true });
  lib.verdict(oks.filter(([, ok]) => ok).length, oks.length);
}
