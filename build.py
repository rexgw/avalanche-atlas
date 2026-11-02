"""Rebuild index.html from the sources in src/ (python3 build.py)."""
from pathlib import Path
here = Path(__file__).parent
src = here / 'src'
page = (src / 'page.html').read_text(encoding='utf-8')
out = (page.replace('/*ENGINE*/', (src / 'engine.js').read_text(encoding='utf-8'))
           .replace('/*DATA*/', (src / 'data.js').read_text(encoding='utf-8'))
           .replace('/*MAP*/', (src / 'worldmap.json').read_text(encoding='utf-8')))
(here / 'index.html').write_text(out, encoding='utf-8')
print('index.html', len(out), 'bytes')
