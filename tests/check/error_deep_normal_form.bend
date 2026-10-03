# an error whose normal form is too deep for the stack still prints: the
# term is shown as written, not as a RangeError that hides the error
import Base

law bad:
  {Nat.double(100000n) == 7n : Nat}

def bad():
  {==}

#|SOME PROOFS FAIL
#|Error:
#|- expected : Nat.double(100000n)
#|- observed : 7n
#|Location: bad
#| 8 | def bad():
#| 9>|   {==}
#|   |   ^^^^
#|10 | 
#|exit 1
