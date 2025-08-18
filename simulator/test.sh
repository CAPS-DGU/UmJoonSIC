#!/bin/bash

set -x
# 0) start sim
curl -sS -X POST "http://127.0.0.1:8080/begin" | jq

# 1) load ASM (returns registers, watch, listViewArray)
curl -sS -X POST "http://127.0.0.1:8080/load?filepath=/Users/codehotel/projects/SicTools/tests/fig2.10.asm" | jq
# optional: skim fields
curl -sS -X POST "http://127.0.0.1:8080/load?filepath=/Users/codehotel/projects/SicTools/tests/fig2.10.asm" | jq '{registers,watchCount:(.watch|length),listRows:(.listViewArray|length)}'

# 2) memory read (single)
curl -sS "http://127.0.0.1:8080/memory?addr=0x0000" | jq

# 3) memory read (range, inclusive)
curl -sS "http://127.0.0.1:8080/memory?start=0x0000&end=0x003F" | jq

# 4) toggle a breakpoint (example 0x0030 from your STL/PC-rel case)
curl -sS -X POST "http://127.0.0.1:8080/breakpoint?addr=0x0030" | jq   # set
curl -sS -X POST "http://127.0.0.1:8080/breakpoint?addr=0x0030" | jq   # clear

# 5) single step
curl -sS -X POST "http://127.0.0.1:8080/step" | jq
# step a few times and watch PC
for i in {1..5}; do curl -sS -X POST "http://127.0.0.1:8080/step" | jq -r '.registers.PC'; done

# 6) load OBJ (success/failure only)
curl -sS -X POST "http://127.0.0.1:8080/load?filepath=/Users/codehotel/projects/SicTools/tests/sample.obj" | jq

# 7) error case (missing file)
curl -sS -X POST "http://127.0.0.1:8080/load?filepath=/no/such/file.asm" | jq

