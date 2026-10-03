# a wrong closed Nat equation over big literals still fails, with the unary
# reduction's value
import Base

law bad:
  {Nat.add(4294967294n, 1n) == 4294967294n : Nat}

def bad(): {==}

#|SOME PROOFS FAIL
#|Error:
#|- expected : 4294967295n
#|- observed : 4294967294n
#|Location: bad
#|7 | 
#|8>| def bad(): {==}
#|  |            ^^^^
#|9 | 
#|exit 1
