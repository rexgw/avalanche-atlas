"""Assemble index.html. Usage: python3 -I assemble.py template.html terrain.json routes.json runs.json three.bundle.js out.html"""
import sys
tpl, terr, routes, runs, three, out = sys.argv[1:7]
t = open(tpl).read()
js = open(three).read()
assert "</script" not in js.lower()
for k, f in (("/*__TERRAIN__*/null", terr), ("/*__ROUTES__*/null", routes), ("/*__RUNS__*/null", runs)):
    assert t.count(k) == 1, k
    t = t.replace(k, open(f).read())
t = t.replace("/*__THREE__*/", "/* three.js r187, MIT licence, https://threejs.org */\n" + js, 1)
open(out, "w").write(t)
