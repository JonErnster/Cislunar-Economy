"""Bundle the tested app into one offline HTML file; no packages are required."""
from pathlib import Path
import argparse

base = Path(__file__).resolve().parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', type=Path, default=base / 'cislunar-atlas-v2.html')
args = parser.parse_args()
html = (base / 'index.html').read_text(encoding='utf-8')
html = html.replace('<link rel="stylesheet" href="styles.css">',
                    '<style>' + (base / 'styles.css').read_text(encoding='utf-8') + '</style>')
for name in ['model.js', 'app.js']:
    source = (base / name).read_text(encoding='utf-8').replace('</script', '<\\/script')
    html = html.replace(f'<script src="{name}"></script>', '<script>' + source + '</script>')
args.output.write_text(html, encoding='utf-8')
print(f'Created {args.output} ({args.output.stat().st_size:,} bytes).')
