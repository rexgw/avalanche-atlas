import sys
t=open(sys.argv[1]).read()
t=t.replace("/*__TERRAIN__*/null", open(sys.argv[2]).read()).replace("/*__ROUTES__*/null", open(sys.argv[3]).read())
open(sys.argv[4],'w').write(t)
