# Closed Nat terms over big literals

## Problem

A Nat literal (`4294967294n`) is one node: `lit_step` unfolds it one `Succ`
at a time, and `compare_go` treats `Lit` and a `Succ` chain as equal. Base
defines `Nat.add`, `Nat.sub`, `Nat.mul`, `Nat.divmod` and `Nat.cmp` by
recursion on successors, so the machine reduces `Nat.add(4294967294n, 1n)` to
`Succ(Nat.add(4294967293n, 1n))`, and conversion against `4294967295n` then
walks `Succ` against `Succ`, one JS stack level (`compare_go`, `every`) per
unit. At 16384 KB of stack and a JSC budget of 10485760 bytes that
overflows at about 58800 (`RangeError`, reported as "the machine stack
overflowed"). A lemma stated for a variable and applied at the literal does
not hit it, because no value is ever expanded.

## Change

`term_wnf`, at a saturated call of one of five Base defs, first tries
`nat_fast`: it reduces the arguments to whnf and, when they are Nat
literals, returns the result directly:

| def | result on literals a, b |
| --- | --- |
| `Nat.add(a, b)` | `Lit(a + b)` |
| `Nat.sub(a, b)` | `Lit(max(a - b, 0))` (truncated) |
| `Nat.mul(a, b)` | `Lit(a * b)` |
| `Nat.divmod(a, b)`, b > 0 | `(Lit(floor(a / b)), Lit(a mod b))` as the `Tuple` Base builds |
| `Nat.cmp(a, b)` | `LT{}`, `EQ{}` or `GT{}` |

`Nat.div`, `Nat.mod`, `Nat.is_lt`, ... reach these through their Base
bodies. Everything else takes the unchanged path.

## Why it is sound

1. Same value. Reading the Base definitions (bend2/base.bend), by induction
   on the first argument: `add(a, b)` is `Succ^a(b)`; `sub` removes
   `min(a, b)` successors from each side and returns `a - b` or 0; `mul(a, b)`
   is `b` added `a` times; `divmod(a, b)` for `b = bp + 1` runs `go(a, bp, 0, 0)`,
   which counts `r` up to `b` and increments `d` at each wrap, so it returns
   `(floor(a / b), a mod b)`; `cmp` compares successor counts. The result
   literal is the numeral the unary reduction reaches.
2. Same normal form up to conversion. The unary path leaves a `Succ` chain
   (or a `Succ` over a literal); the fast path leaves a literal. `compare_go`
   already identifies a literal with its chain (`lit_step`), so every
   conversion, and every verdict, is the same.
3. Same domain. A literal is a JS number up to 0xffffffff (the parser's
   limit, `nat_from_term`). The fast path returns only when the result is at
   most 0xffffffff; sums and products past it keep the unary path, so no
   literal outside the domain is created. Arithmetic on values below 2^32 is
   exact in IEEE doubles (a product above 2^53 is rounded but is still above
   the limit and is refused; division is `(a - a % b) / b`, an exact quotient).
4. Zero divisor and truncation. `b = 0` in `divmod` keeps the unary path
   (`(0, a)`, as Base defines); `sub` truncates at 0 as Base does.
5. Only Base's defs. `NAT_FAST` is a WeakMap from the `Def` objects loaded
   from base.bend (identity, not name) to the operation, filled in
   `book_load`. A program that does not import Base, or defines its own
   `Nat.add`, never reaches it. `RIGID` has no defs, so the rigid pass is
   unchanged. The pin in toolchain.lock.json fixes base.bend by hash; if
   Base's Nat defs change, this table must be re-checked.
6. Laziness. The fast path forces the arguments in the order the unary def
   does. It forces the second argument of `add`, `sub`, `mul` (which the
   unary def may not need yet) only when the first is a literal above
   NAT_FAST_MIN = 256, where the unary path would take over 256 steps
   anyway; `divmod` and `cmp` need both arguments in the unary def too, and
   `divmod` by 0 and calls below NAT_FAST_MIN keep the unary path. Forcing
   fills the shared cell with its whnf, as the machine always does. Calls
   with non-literal arguments are untouched.

## Evidence

tests/check/nat_literals_big.bend (passes; stack overflow before),
nat_literals_big_mismatch.bend (still fails, same message). Differential:
363 equations over 0..20000 for the five ops (including b = 0), accepted
by both the unary and the fast checker, and 363 wrong equations rejected
with byte-identical output by both.
