# closed Nat terms over big literals convert without walking successors:
# Nat.add, Nat.sub, Nat.mul, Nat.divmod and Nat.cmp on two literals return
# the literal the unary reduction reaches (a stack overflow before)
import Base

law add:
  {Nat.add(4294967294n, 1n) == 4294967295n : Nat}

law sub:
  {Nat.sub(4294967295n, 4294967294n) == 1n : Nat}

law sub_cut:
  {Nat.sub(1000n, 4294967294n) == 0n : Nat}

law mul:
  {Nat.mul(65535n, 65537n) == 4294967295n : Nat}

law div_mod:
  {Nat.divmod(4294967294n, 3n) == (1431655764n, 2n) : Nat & Nat}

law div_zero:
  {Nat.divmod(4294967294n, 0n) == (0n, 4294967294n) : Nat & Nat}

law both_closed:
  {Nat.add(4294967294n, 1n) == Nat.mul(65535n, 65537n) : Nat}

law nested:
  {Nat.div(Nat.sub(4294967294n, 2n), 2n) == 2147483646n : Nat}

law cmp:
  {Nat.cmp(4294967294n, 4294967295n) == LT{} : Cmp}

law le:
  {Nat.is_le(4294967294n, Nat.add(4294967294n, 1n)) == True{} : Bool}

def add(): {==}
def sub(): {==}
def sub_cut(): {==}
def mul(): {==}
def div_mod(): {==}
def div_zero(): {==}
def both_closed(): {==}
def nested(): {==}
def cmp(): {==}
def le(): {==}

#|ALL PROOFS CHECK
#|Use --verdict for mathematical validity.
