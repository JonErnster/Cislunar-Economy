"""Run Chromium regression tests without a server. Set CHROMIUM_PATH to use a system browser."""
import asyncio,json,pathlib,os
from playwright.async_api import async_playwright
BASE=pathlib.Path(__file__).resolve().parent
HTML=(BASE/'index.html').read_text(encoding='utf-8').replace('<link rel="stylesheet" href="styles.css">','<style>'+(BASE/'styles.css').read_text(encoding='utf-8')+'</style>').replace('<script src="model.js"></script>','<script>'+(BASE/'model.js').read_text(encoding='utf-8')+'</script>').replace('<script src="app.js"></script>','<script>'+(BASE/'app.js').read_text(encoding='utf-8')+'</script>')
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
  page=await browser.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1)
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.set_content(HTML)
  await page.wait_for_function('window.atlas && atlas.paths.length===38 && document.querySelector("#loading").hidden',timeout=60000)
  await page.click('#play');await page.wait_for_timeout(900)
  await page.screenshot(path=str(BASE/'v2-map-desktop.png'))
  data=await page.evaluate('''() => ({initial:atlas.state.view,labels:[...document.querySelectorAll('[data-view]')].map(x=>x.textContent),paths:atlas.paths.map(p=>({label:p.label,periodic:p.periodic,n:p.samples.length,T:p.T,end:p.samples.at(-1).t,error:Math.hypot(...p.q.map((v,i)=>v-p.samples.at(-1).q[i]))})),overflow:document.documentElement.scrollWidth>innerWidth})''')
  await page.click('[data-view="mars"]');await page.wait_for_timeout(1300)
  data['mars']=await page.evaluate('({view:atlas.state.view,nodes:atlas.visibleNodes().length,routes:atlas.visibleRoutes().length,camera:atlas.camera})')
  await page.screenshot(path=str(BASE/'v2-mars-desktop.png'))
  await page.select_option('#node-select','DCO');await page.wait_for_timeout(150);data['nodeCard']=await page.locator('#info-title').inner_text()
  await page.click('#close-info');await page.uncheck('#layer-phobos');data['phobosHidden']=await page.evaluate('!atlas.visibleNodes().some(n=>n.id==="PHOB"||n.id==="PCO")');await page.check('#layer-phobos')
  await page.click('[data-mars="solar"]');await page.wait_for_timeout(1100);await page.screenshot(path=str(BASE/'v2-solar-desktop.png'))
  await page.click('[data-view="3d"]');await page.wait_for_timeout(1100);await page.screenshot(path=str(BASE/'v2-3d-desktop.png'))
  await page.check('#layer-manifold');await page.wait_for_function('atlas.paths.length===86',timeout=60000)
  data['manifolds']=await page.evaluate('atlas.paths.filter(p=>p.group==="manifold").length')
  await page.click('[data-view="moon"]');await page.wait_for_timeout(1000);await page.screenshot(path=str(BASE/'v2-moon-desktop.png'))
  for width,height in [(390,844),(320,700)]:
   mobile=await browser.new_page(viewport={'width':width,'height':height},is_mobile=True,has_touch=True,device_scale_factor=1)
   mobile.on('pageerror',lambda e:errors.append(str(e)))
   await mobile.set_content(HTML);await mobile.wait_for_selector('#loading',state='hidden',timeout=60000);await mobile.click('#play');await mobile.wait_for_timeout(500)
   await mobile.screenshot(path=str(BASE/f'v2-map-{width}.png'))
   await mobile.click('[data-view="mars"]');await mobile.wait_for_timeout(1100);await mobile.screenshot(path=str(BASE/f'v2-mars-{width}.png'))
   data[f'mobile{width}']=await mobile.evaluate('({overflow:document.documentElement.scrollWidth>innerWidth,view:atlas.state.view,nodes:atlas.visibleNodes().length})')
   await mobile.click('#open-layers');await mobile.wait_for_timeout(250);await mobile.screenshot(path=str(BASE/f'v2-layers-{width}.png'))
   await mobile.click('#close-layers');await mobile.select_option('#node-select','GC');data[f'card{width}']=await mobile.locator('#info-title').inner_text()
   await mobile.close()
  assert data['initial']=='map'
  assert data['labels']==['Map','3D','Moon','Mars']
  assert data['mars']['nodes']==17 and data['mars']['routes']==32
  assert data['phobosHidden'] and data['manifolds']==48
  assert not data['overflow'] and not data['mobile390']['overflow'] and not data['mobile320']['overflow']
  assert data['card390']=='Gale Crater' and data['card320']=='Gale Crater'
  assert max(p['error'] for p in data['paths'] if p['periodic'])<1e-5
  assert not errors, errors
  data['errors']=errors;(BASE/'test-results.json').write_text(json.dumps(data,indent=2),encoding='utf-8');print(json.dumps(data,indent=2))
  await browser.close()
asyncio.run(main())
