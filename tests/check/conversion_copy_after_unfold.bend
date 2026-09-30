# a copy met only after a def unfolds converts before either copy
# unfolds: big() is 2^30 as a chain of Succ, which the full pass
# would evaluate on both sides (a stack overflow)
import Base

type Box is Data:
  Box{n: Nat}

def big() -> Nat:
  Nat.pow(2n, 30n)

def boxed() -> Box:
  Box{big()}

def twice(+n: Nat) -> Box:
  Box{Nat.add(n, n)}

def boxed_eq() -> {Box{big()} == boxed() : Box}:
  {==}

def boxed_sym() -> {boxed() == Box{big()} : Box}:
  {==}

def twice_eq() -> {twice(big()) == Box{Nat.add(big(), big())} : Box}:
  {==}

#|ALL PROOFS CHECK
#|Use --verdict for mathematical validity.
