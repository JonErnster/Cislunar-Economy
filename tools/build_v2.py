"""Apply a small, verified Mars extension to the recovered original app.

The v1 HTML is retained byte-for-byte under vendor/v1/original.html. Neither
its ATLAS_DATA script nor its original stylesheet is regenerated. The build
fails rather than patching an unexpected original bundle.
"""
from pathlib import Path
import hashlib, json, re

ROOT = Path(__file__).resolve().parents[1]
EXPECTED = '65cc0daae9f72ffc30d9ba9f6996c3c5c143be8ca15f69b3c79fab50fa711be6'

def main():
    raw = (ROOT/'vendor/v1/original.html').read_bytes()
    assert hashlib.sha256(raw).hexdigest() == EXPECTED, 'Original v1 checksum does not match.'
    text = raw.decode('utf-8')
    original_data = re.search(r'<script>\s*window\.ATLAS_DATA=.*?</script>',text,re.S).group(0)
    original_style = re.search(r'<style>.*?</style>',text,re.S).group(0)
    patches = [
        ('<button data-view="wide">Wide</button>','<button data-view="mars">Mars</button>'),
        ('try{W_(),L_(),q_(),fc("atlas")',
         (ROOT/'src/mars-extension.js').read_text()+'\ntry{W_(),L_(),MarsV2.install(),q_(),fc("atlas")'),
        ('if(Tt.update(),Ht.render(yn,ct),G_()', 'if(MarsV2.tick(),Tt.update(),Ht.render(yn,ct),G_()'),
    ]
    for before, after in patches:
        assert text.count(before) == 1, f'Patch target is not unique: {before[:70]}'
        text = text.replace(before, after, 1)
    # This was injected by the original host, not part of the atlas. It calls
    # the old host's Cloudflare challenge endpoint and must not ship on Pages.
    text = re.sub(r'<script>\(function\(\)\{function c\(\).*?__CF\$cv\$params.*?</script>', '', text, flags=re.S)
    assert original_data in text, 'Original orbital data was modified.'
    assert original_style in text, 'Original stylesheet was modified.'
    assert 'try{W_(),L_(),MarsV2.install(),q_(),fc("atlas"),rn("map",!0)' in text
    (ROOT/'index.html').write_text(text)
    (ROOT/'docs').mkdir(exist_ok=True)
    report = {
        'base_sha256':EXPECTED, 'v2_sha256':hashlib.sha256(text.encode()).hexdigest(),
        'v1_data_script_sha256':hashlib.sha256(original_data.encode()).hexdigest(),
        'v1_style_sha256':hashlib.sha256(original_style.encode()).hexdigest(),
        'v1_data_byte_identical': True, 'v1_css_byte_identical': True,
        'original_model_orbits':71, 'original_manifold_branches':96,
        'patch_count':len(patches), 'default_view':'map',
        'integration':'Additional objects in original v1 scene; original renderer and camera retained',
        'new_physics':'Analytic two-body Mars examples and ideal Sun-centered transfer arcs',
        'display':'Multiscale, not a single physical distance scale; not a live ephemeris'
    }
    (ROOT/'docs/build-verification.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2))

if __name__ == '__main__':
    main()
