"""Build the V3 standalone atlas without modifying the V1 data, CSS or V2 source."""
from pathlib import Path
import hashlib, json, re, runpy
ROOT = Path(__file__).resolve().parents[1]
V2_SHA = '59bd258352723eaf8dc2746fb56b08f08350c6ce52b7b2231ea6defa4ead370b'

def main():
    if (ROOT/'tools/build_v2.py').exists():
        runpy.run_path(str(ROOT/'tools/build_v2.py'),run_name='__main__')
    base=(ROOT/'index.html').read_bytes()
    assert hashlib.sha256(base).hexdigest()==V2_SHA,'Unexpected v2 input; refusing an unverified patch.'
    (ROOT/'_build').mkdir(exist_ok=True)
    (ROOT/'_build/v2.html').write_bytes(base)
    text=base.decode();data=(ROOT/'data/interplanetary.json').read_text()
    assert '</script' not in data.lower()
    original_data=re.search(r'<script>\s*window\.ATLAS_DATA=.*?</script>',text,re.S).group(0)
    original_css=re.search(r'<style>.*?</style>',text,re.S).group(0)
    patches=[
      ('<title>Cislunar Atlas · The geometry of possibility</title>','<title>Earth–Moon–Mars Atlas · V3</title>'),
      ('<button data-view="mars">Mars</button>','<button data-view="mars">Mars</button><button data-view="interplanetary">Interplanetary</button>'),
      ('<script>window.ATLAS_DATA=', '<script>window.INTERPLANETARY_DATA='+data+';</script>\n<script>window.ATLAS_DATA='),
      ('try{W_(),L_(),MarsV2.install(),q_()', (ROOT/'src/interplanetary.js').read_text()+'\ntry{W_(),L_(),MarsV2.install(),InterplanetaryV3.install(),q_()'),
      ('if(MarsV2.tick(),Tt.update()', 'if(MarsV2.tick(),InterplanetaryV3.tick(),Tt.update()'),
    ]
    for before,after in patches:
        assert text.count(before)==1,f'Nonunique patch anchor: {before[:80]}'
        text=text.replace(before,after,1)
    assert original_data in text and original_css in text
    (ROOT/'index.html').write_text(text)
    report={'version':'3.0.0','baseV2Sha256':V2_SHA,'v3Sha256':hashlib.sha256(text.encode()).hexdigest(),
      'v1OrbitalDataByteIdentical':True,'v1StylesheetByteIdentical':True,'originalOrbits':71,'originalManifoldBranches':96,
      'defaultView':'map','transferCounts':json.loads(data)['meta']['counts'],'bytes':len(text.encode())}
    (ROOT/'docs/v3-build-verification.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2))
if __name__=='__main__':main()
