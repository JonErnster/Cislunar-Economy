"""UI regression checks and comparison of the original Map drawing."""
from pathlib import Path
import json, os, io
from PIL import Image, ImageChops
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
SEED='''() => { let s=1234567; Math.random=()=>{s=(1664525*s+1013904223)>>>0;return s/4294967296;}; }'''

def load(browser, path, width, height):
    page=browser.new_page(viewport={'width':width,'height':height},reduced_motion='reduce')
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.evaluate(SEED);page.set_content(path.read_text(),wait_until='load')
    page.wait_for_function('window.CislunarAtlas');page.wait_for_timeout(1200)
    return page,errors

def main():
    report={'visualComparisonScope':'Original Map drawing; navigation controls excluded because V3 adds a tab.','viewports':[],'model':'Sun-only Lambert with approximate JPL ephemerides'}
    with sync_playwright() as p:
        opts={'headless':True,'args':['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}
        if os.environ.get('CHROMIUM_PATH'):opts['executable_path']=os.environ['CHROMIUM_PATH']
        b=p.chromium.launch(**opts)
        baseline,errors=load(b,ROOT/'_build/v2.html',1440,960)
        before=baseline.locator('#canvasHost canvas').screenshot(style='#viewbar{visibility:hidden!important}');baseline.close()
        for width,height in [(1440,960),(390,844),(320,740)]:
            print('viewport',width,flush=True)
            page,errors=load(b,ROOT/'index.html',width,height)
            state=page.evaluate('CislunarAtlas.getState()')
            assert state['view']=='map' and state['orbitCount']==71 and state['manifoldCount']==96
            if width==1440:
                after=page.locator('#canvasHost canvas').screenshot(style='#viewbar{visibility:hidden!important}')
                diff=ImageChops.difference(Image.open(io.BytesIO(before)).convert('RGB'),Image.open(io.BytesIO(after)).convert('RGB'))
                report['originalMapCanvasPixelIdentical']=diff.getbbox() is None
                assert report['originalMapCanvasPixelIdentical'],'Original Map drawing changed.'
            page.screenshot(path=str(ROOT/f'docs/v3-map-{width}.png'))
            page.locator('[data-view=interplanetary]').click();page.wait_for_timeout(1600)
            ip=page.evaluate('EarthMoonMarsV3.getState()')
            assert ip['active'] and ip['shown']==360 and ip['total']==1969 and not ip['solar']
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
            page.screenshot(path=str(ROOT/f'docs/v3-interplanetary-{width}.png'))
            if width<760:page.locator('#layerToggle').click()
            page.locator('#ipFrame').select_option('solar');page.wait_for_timeout(1200)
            assert page.evaluate('EarthMoonMarsV3.getState().solar')
            if width<760:page.locator('#closeLayers').click()
            page.screenshot(path=str(ROOT/f'docs/v3-solar-{width}.png'))
            if width<760:page.locator('#layerToggle').click()
            page.locator('#ipYear').select_option('2026');page.locator('#ipDirection').select_option('outbound');page.locator('#ipRevs').select_option('1')
            page.locator('#ipDensity').select_option('0')
            ip=page.evaluate('EarthMoonMarsV3.getState()');assert ip['matching']>0 and ip['matching']==ip['shown']
            page.locator('#ipInspect').click()
            if width<760:page.locator('#closeLayers').click()
            page.locator('#equationBtn').click();assert page.locator('#guideContent').inner_text().find('C3')>=0
            page.locator('#guideDialog .close-modal').click()
            page.locator('[data-view=map]').click();page.wait_for_timeout(1400)
            restored=page.evaluate('CislunarAtlas.getState()');assert restored==state
            assert not page.evaluate('EarthMoonMarsV3.getState().active')
            for view in ['oblique','moon','mars','map']:
                page.locator('[data-view='+view+']').click();page.wait_for_timeout(1100)
                assert page.evaluate('CislunarAtlas.getState().view')==view
            assert not errors,errors
            report['viewports'].append({'width':width,'height':height,'defaultMap':True,'mapStateRestored':True,'marsAndOriginalViews':True,'noJavaScriptErrors':True,'noHorizontalOverflow':True,'filtersAndInspector':True})
            page.close()
        b.close()
    (ROOT/'docs/v3-browser-verification.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2))
if __name__=='__main__':main()
