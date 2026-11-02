from pathlib import Path
import json, os, shutil
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
report = {'viewports': [], 'test_method': 'Load the self-contained built HTML directly into Chromium.'}
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium'), headless=True, args=['--no-sandbox', '--disable-gpu'])
    for width, height in [(1365,960), (390,844), (320,740)]:
        page = browser.new_page(viewport={'width':width,'height':height}, device_scale_factor=1, reduced_motion='reduce')
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.set_content((ROOT/'index.html').read_text(), wait_until='load')
        page.wait_for_function('window.CislunarAtlas && window.CislunarMars')
        page.wait_for_timeout(1000)
        start = page.evaluate('CislunarAtlas.getState()')
        assert start['view'] == 'map', start
        assert start['orbitCount'] == 71 and start['manifoldCount'] == 96, start
        numerical = page.evaluate('''() => {
          const model=CislunarMars.getModel();let maxError=0;
          for(const o of model.orbits)for(const M of [0,.1,1,2,3,5,6.2]){
            const s=CislunarMars.testKepler(o.a,o.e||0,M),r=Math.hypot(...s.position),v2=s.velocity.reduce((a,v)=>a+v*v,0),energy=v2/2-model.gmMarsKm3s2/r,expected=-model.gmMarsKm3s2/(2*o.a);
            maxError=Math.max(maxError,Math.abs((energy-expected)/expected));
          }
          return {relativeEnergyError:maxError,hohmannDays:model.hohmannDays};
        }''')
        assert numerical['relativeEnergyError'] < 1e-11, numerical
        assert 258 < numerical['hohmannDays'] < 260, numerical
        report['numerical'] = numerical
        assert page.locator('[data-view="mars"]').inner_text() == 'Mars'
        assert page.locator('[data-view="wide"]').count() == 0
        page.screenshot(path=str(ROOT/f'docs/v2-map-{width}.png'))
        page.locator('[data-view="mars"]').click()
        page.wait_for_timeout(1500)
        mars = page.evaluate('CislunarMars.getState()')
        assert mars['active'] and mars['marsOrbitCount'] == 19, mars
        assert page.evaluate('CislunarAtlas.getState().view') == 'mars'
        page.screenshot(path=str(ROOT/f'docs/v2-mars-{width}.png'))
        labels = page.evaluate('''() => Object.fromEntries([...document.querySelectorAll('.point-label')].filter(b=>['Earth','Mars'].includes(b.textContent)).map(b=>[b.textContent,{x:parseFloat(b.style.left),y:parseFloat(b.style.top),display:getComputedStyle(b).display}]))''')
        assert labels['Earth']['x'] < labels['Mars']['x'] and labels['Earth']['y'] > labels['Mars']['y'], labels
        assert labels['Mars']['display'] != 'none' and labels['Earth']['display'] != 'none'
        page.evaluate("CislunarMars.inspect('mars-high')")
        assert 'Elliptical' in page.locator('#inspectTitle').inner_text()
        page.locator('#equationBtn').click(force=True)
        assert 'two-body' in page.locator('#guideContent').inner_text()
        page.locator('#guideDialog .close-modal').click()
        page.locator('[data-view="map"]').click(force=True)
        page.wait_for_timeout(1000)
        restored = page.evaluate('CislunarAtlas.getState()')
        assert restored == start, (start,restored)
        assert not page.evaluate('CislunarMars.getState().active')
        page.locator('[data-view="oblique"]').click()
        page.wait_for_timeout(850)
        assert page.evaluate('CislunarAtlas.getState().view') == 'oblique'
        page.locator('[data-view="moon"]').click()
        page.wait_for_timeout(850)
        assert page.evaluate('CislunarAtlas.getState().view') == 'moon'
        page.locator('[data-view="map"]').click()
        page.wait_for_timeout(850)
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        assert not errors, errors
        report['viewports'].append({'width':width,'height':height,'default_map':True,'preserved_v1_state':True,'earth_lower_left_mars_upper_right':True,'no_js_errors':True,'no_horizontal_overflow':True,'mars_state':mars})
        page.close()
    browser.close()
(ROOT/'docs/browser-verification.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
