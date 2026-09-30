# U32.mul_hi is the high word of the 64-bit product and U32.mul its low
# word: at the edges (0, 1, 2^16, 2^31, 2^32-1), over 1000 pairs from an LCG
# folded into one word, and at the top pair as a law the checker normalizes
import Base

def wide(+a: U32, +b: U32) -> String:
  U32.show(U32.mul_hi(a, b)) ++ ":" ++ U32.show(U32.mul(a, b))

def fold(n: Nat, +x: U32, acc: U32) -> U32:
  match n:
    case 0n:
      acc
    case 1n+p:
      +y = U32.add(U32.mul(x, 1664525), 1013904223)
      fold(p, U32.add(U32.mul(y, 22695477), 1),
        U32.add(U32.xor(acc, U32.mul_hi(x, y)), U32.mul(x, y)))

law wide_law:
  {U32.mul_hi(4294967295, 4294967295) == 4294967294 : U32}

def wide_law():
  {==}

def main() -> IO(Unit):
  IO.print(wide(0, 4294967295) ++ " " ++ wide(1, 4294967295) ++ " "
    ++ wide(65536, 65536) ++ " " ++ wide(2147483648, 2) ++ " "
    ++ wide(2147483648, 2147483648) ++ " " ++ wide(4294967295, 4294967295)
    ++ " " ++ wide(3000000000, 4000000000) ++ " " ++ wide(123456789, 987654321)
    ++ " " ++ U32.show(fold(1000n, 1, 0)))

#|0:0 0:4294967295 1:0 1:0 1073741824:0 4294967294:1 2793967723:3635412992 28389652:4227814277 746073780
