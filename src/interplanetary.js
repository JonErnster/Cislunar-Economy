/* V3 transfer layer. Original cislunar catalogue, CSS and Mars objects are not regenerated. */
const InterplanetaryV3 = (() => {
  const dataset = window.INTERPLANETARY_DATA;
  const CEN = new C(3.65, 2.7, 0);
  let active=false, solar=false, group, curves, reference, dots, selected=null, panel, note;
  let shown=[], filtered=[], lines=[], oldVisible=[], oldTransfer=true, selectedOnly=false;
  let nativeView, frameNode, frameBefore, lastUpdate=0, transition=null, pointer=null, transferInspector=false, depLabel, arrLabel;
  const cfg={direction:'both',year:'all',flight:'all',revs:'all',c3:100,density:360,color:'direction'};
  const $=id=>document.getElementById(id);
  const fmt=(n,d=1)=>Number(n).toLocaleString('en-US',{maximumFractionDigits:d});
  function pointList(a) {
    const pp=a.points.map(p=>new C(...p));
    if(solar)return pp.map(p=>p.multiplyScalar(2.2));
    // A similarity transform per trajectory, not a shared physical frame.
    const r0=new C(...a.r0),r1=new C(...a.r1),chord=r1.clone().sub(r0),length=chord.length();
    const u=chord.normalize(),w=r0.clone().cross(r1).normalize(),v=w.clone().cross(u);
    const destination=CEN.clone().multiplyScalar(a.direction==='outbound'?1:-1);
    const sideways=new C(-destination.y,destination.x,0),origin=a.direction==='outbound'?new C():CEN;
    return pp.map(p=>{const d=p.sub(r0);return origin.clone().addScaledVector(destination,d.dot(u)/length).addScaledVector(sideways,d.dot(v)/length);});
  }
  function color(a){
    if(cfg.color==='direction')return a.direction==='outbound'?'#8dd8d1':'#edb783';
    if(cfg.color==='energy')return a.c3<25?'#9ed9a9':a.c3<60?'#84cbdc':a.c3<100?'#d7c190':'#d69eae';
    return a.tof<=180?'#89d7d5':a.tof<=360?'#d7c799':a.revs?'#b4a5e2':'#de9fa7';
  }
  function dispose(container){while(container.children.length){const obj=container.children[0];container.remove(obj);obj.traverse?.(c=>{c.geometry?.dispose();if(c.material&&!Array.isArray(c.material))c.material.dispose();});}}
  function hideOld(on){
    if(on&&!oldVisible.length){oldVisible=yn.children.filter(o=>o!==group&&!o.isLight).map(o=>[o,o.visible]);}
    if(on)oldVisible.forEach(([o])=>o.visible=false);
    else {oldVisible.forEach(([o,v])=>o.visible=v);oldVisible=[];}
    document.body.classList.toggle('ip-solar',on);
  }
  function filter(){
    filtered=dataset.arcs.filter(a=>(cfg.direction==='both'||a.direction===cfg.direction)&&(cfg.year==='all'||a.year===Number(cfg.year))&&a.c3<=cfg.c3&&
      (cfg.revs==='all'||a.revs===Number(cfg.revs))&&(cfg.flight==='all'||(cfg.flight==='fast'?a.tof<=180:cfg.flight==='medium'?a.tof>180&&a.tof<=360:a.tof>360)));
    if(!filtered.some(a=>a.id===selected?.id))selected=filtered.reduce((best,a)=>!best||a.c3+a.vinfArrival**2<best.c3+best.vinfArrival**2?a:best,null);
    const cap=cfg.density||filtered.length;shown=filtered.length<=cap?filtered.slice():Array.from({length:cap},(_,i)=>filtered[Math.floor(i*filtered.length/cap)]);
    if(selected&&!shown.includes(selected)&&shown.length)shown[0]=selected;
    if(selectedOnly)shown=selected?[selected]:[];
  }
  function rebuild(fit=true){
    filter();dispose(curves);lines=[];
    for(const a of shown){const points=pointList(a),line=oi(points,color(a),.12);line.userData.transferId=a.id;curves.add(line);lines.push({a,points,line});}
    reference.visible=solar;dots.forEach(d=>d.visible=!!selected);
    for(const entry of lines){const chosen=entry.a===selected;entry.line.material.opacity=chosen?.95:Math.min(.16,Math.max(.025,2.2/Math.sqrt(Math.max(1,shown.length))));}
    $('ipCount').textContent=fmt(shown.length,0)+' drawn / '+fmt(filtered.length,0)+' matching / '+fmt(dataset.arcs.length,0)+' calculated';
    $('ipEmpty').hidden=filtered.length!==0;
    $('ipPicker').innerHTML=filtered.map(a=>'<option value="'+a.id+'">'+a.departure+' · '+(a.direction==='outbound'?'E → M':'M → E')+' · '+a.tof+' d · '+a.revs+' rev</option>').join('');
    if(selected){$('ipPicker').value=selected.id;depLabel.el.innerHTML=(selected.direction==='outbound'?'Earth–Moon':'Mars')+'<small>DEPARTURE · '+selected.departure+'</small>';arrLabel.el.innerHTML=(selected.direction==='outbound'?'Mars':'Earth–Moon')+'<small>ARRIVAL · '+selected.arrival+'</small>';}
    $('ipC3Readout').textContent=cfg.c3+' km²/s²';
    $('ipFrame').value=solar?'solar':'gallery';
    note.textContent=solar?'Sun-centered J2000 ecliptic · Common AU scale · Endpoints are at different epochs':'Endpoint-aligned gallery · Each transfer is independently rotated and scaled · Local systems enlarged';
    frameNode.nodeValue=solar?' HELIOCENTRIC TRANSFER FAMILIES ':' EARTH–MOON–MARS TRANSFER ATLAS ';
    document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view==='interplanetary'));
    heatmap();if(fit)fitScene();tick();
  }
  let fitScene;
  function frame(){
    let minx=solar?-3.5:-1.8,maxx=solar?3.5:5,miny=solar?-3.5:-1.7,maxy=solar?3.5:4.3;
    // Fit all displayed trajectory samples; the original local geometries remain intact.
    const xs=[],ys=[];for(const e of lines)for(const p of e.points){xs.push(p.x);ys.push(p.y);}
    xs.sort((a,b)=>a-b);ys.sort((a,b)=>a-b);
    const q=0;
    if(xs.length){minx=Math.min(minx,xs[Math.floor((xs.length-1)*q)]);maxx=Math.max(maxx,xs[Math.ceil((xs.length-1)*(1-q))]);miny=Math.min(miny,ys[Math.floor((ys.length-1)*q)]);maxy=Math.max(maxy,ys[Math.ceil((ys.length-1)*(1-q))]);}
    return {target:new C((minx+maxx)/2,(miny+maxy)/2,0),w:(maxx-minx)*1.12,h:(maxy-miny)*1.20};
  }
  fitScene=function(){const f=frame();xn=null;transition={start:performance.now(),from:ct.position.clone(),fromTarget:Tt.target.clone(),to:f.target.clone().add(new C(0,0,9)),target:f.target,fw:Mr,fh:Sr,fz:ct.zoom,w:f.w,h:f.h};};
  function select(id,inspectNow=false){
    selected=filtered.find(a=>a.id===id)||null;
    if(selected&&!shown.includes(selected)){rebuild(false);}else{lines.forEach(e=>e.line.material.opacity=e.a===selected?.95:Math.min(.16,Math.max(.025,2.2/Math.sqrt(Math.max(1,shown.length)))));}
    if(selected){$('ipPicker').value=selected.id;depLabel.el.innerHTML=(selected.direction==='outbound'?'Earth–Moon':'Mars')+'<small>DEPARTURE · '+selected.departure+'</small>';arrLabel.el.innerHTML=(selected.direction==='outbound'?'Mars':'Earth–Moon')+'<small>ARRIVAL · '+selected.arrival+'</small>';}
    heatmap();if(inspectNow)inspect();
  }
  function inspect(){
    if(!selected)return;const a=selected;
    transferInspector=true;$('inspector').hidden=false;$('inspector').classList.remove('collapsed');$('expandInspector').setAttribute('aria-expanded','true');
    $('inspectTitle').textContent=(a.direction==='outbound'?'Earth–Moon → Mars':'Mars → Earth–Moon')+' · '+a.tof+' days';
    $('inspectStatus').textContent='CALCULATED LAMBERT SOLUTION';$('inspectStatus').className='status-chip';
    $('inspectDescription').textContent='Depart '+a.departure+' and arrive '+a.arrival+'. This prograde '+a.way+'-way arc includes '+a.revs+' additional complete solar revolution'+(a.revs===1?'':'s')+'.';
    $('inspectUses').innerHTML='<strong>Transport tradeoff</strong>Compare departure energy, cruise duration, and arrival speed. This is one ballistic transfer leg, not a complete crew or cargo mission.';
    $('orbitPickerWrap').hidden=true;
    const metrics=[['DEPARTURE C3',fmt(a.c3,2)+' km²/s²'],['ARRIVAL v∞',fmt(a.vinfArrival,2)+' km/s'],['IDEAL INJECTION',fmt(a.injectionDv,2)+' km/s'],['IDEAL CAPTURE',fmt(a.captureDv,2)+' km/s']];
    $('inspectMetrics').innerHTML=metrics.map(([k,v])=>'<div class="metric"><small>'+k+'</small><strong>'+v+'</strong></div>').join('');
    $('inspectLimit').textContent='Sun-only model with approximate JPL planetary positions. Earth means Earth–Moon barycentre. Parking-orbit burns omit plane changes. Lunar departure and Mars capture geometry are not dynamically joined. '+(solar?'One heliocentric scale.':'Gallery curves use independent endpoint alignment.');
    $('focusSelection').disabled=false;$('isolateSelection').disabled=false;
  }
  function equations(){
    const a=selected;$('guideDialog').showModal();document.querySelectorAll('[data-tab]').forEach(b=>b.classList.remove('active'));
    $('guideContent').innerHTML='<h3>V3 · Earth–Moon–Mars Atlas</h3><p>'+fmt(dataset.arcs.length,0)+' sampled, prograde Lambert solutions connect departure and arrival positions. A boundary-value solver chooses the velocity that reaches the destination after the selected flight time. Zero- and one-revolution branches are included.</p><pre class="equations">r̈ = −μ☉ r / |r|³\nr(t₀) = r_origin(t₀)\nr(t₀ + Δt) = r_destination(t₀ + Δt)\nC3 = |v_departure − v_origin|²\nv∞,arrival = |v_arrival − v_destination|\nΔv_parking = √(v∞² + 2μ/r_parking) − √(μ/r_parking)</pre>'+
      (a?'<h3>'+a.id+'</h3><pre class="equations">Departure: '+a.departure+' 00:00 TDB\nArrival: '+a.arrival+'\nFlight time: '+a.tof+' days\nExtra revolutions: '+a.revs+'\nBranch: '+a.branch+'\nInitial position [AU]: '+a.r0.join(', ')+'\nInitial velocity [km/s]: '+a.v0KmS.join(', ')+'\nIndependent endpoint residual: '+fmt(a.endpointErrorKm,6)+' km</pre>':'')+
      '<h3>Two display frames</h3><p><strong>Connected atlas:</strong> each solved arc is rigidly rotated and uniformly scaled to align its endpoints with the displayed Earth–Moon and Mars neighborhoods. This is a comparison gallery, not one common physical frame. The full local orbital systems remain visible. Use Show only to inspect the complete geometry of an individual solution.</p><p><strong>Solar frame:</strong> all transfer coordinates share the Sun-centered J2000 ecliptic frame and one AU scale. Routes depart on different dates; their endpoints are not simultaneous planet positions. The reference planetary curves are sampled near 2030. Planet bodies are symbolic.</p><h3>Numerics and scope</h3><p>Planet positions use JPL’s fitted 1800–2050 elements, not high-precision Horizons states. Each retained arc is independently integrated with DOP853 and checked for endpoint closure, energy, angular momentum and revolution count. Numerical residuals do not represent real-world navigation accuracy. Display positions are rounded to 10⁻⁷ AU. C3 is an excess-speed squared, not a total rocket delta-v.</p><p>The catalogue samples departures every 30 days during 2026–2035 and 15 flight durations from 90 to 900 days. It retains solutions with departure C3 ≤ 225 km²/s², arrival excess speed ≤ 16 km/s and perihelion ≥ 0.35 AU. These are display-envelope choices, not spacecraft capabilities. Injection and capture estimates use ideal circular parking orbits at Earth 200 km and Mars 400 km altitude.</p><p>It does not solve lunar escape matching, gravity assists, powered low-thrust spirals, aerocapture, surface landings, repeating Earth–Mars cyclers, or complete round trips. No line crossing establishes a rendezvous. This is a finite sampled catalogue, not every possible trajectory.</p><h3>Sources</h3><p><a href="https://ssd.jpl.nasa.gov/planets/approx_pos.html" target="_blank" rel="noopener">JPL planetary elements and their accuracy</a><br><a href="https://ssd.jpl.nasa.gov/astro_par.html" target="_blank" rel="noopener">JPL gravitational constants</a><br><a href="https://esa.github.io/pykep/lambert.html" target="_blank" rel="noopener">ESA description of Lambert’s boundary-value problem</a></p>';
    $('guideContent').scrollTop=0;
  }
  function heatmap(){
    const canvas=$('ipHeat'),ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;ctx.clearRect(0,0,w,h);
    ctx.fillStyle='#091421';ctx.fillRect(0,0,w,h);
    const groups=new Map();for(const a of filtered){const key=a.departure+'|'+a.tof;const old=groups.get(key);if(!old||old.c3>a.c3)groups.set(key,a);}
    const dates=[...new Set(dataset.arcs.filter(a=>cfg.year==='all'||a.year===Number(cfg.year)).map(a=>a.departure))].sort(),tofs=dataset.meta.flightDays;
    canvas._cells=[];const x0=9,y0=9,cw=(w-18)/Math.max(1,dates.length),ch=(h-36)/tofs.length;
    for(const a of groups.values()){const x=x0+dates.indexOf(a.departure)*cw,y=y0+(tofs.length-1-tofs.indexOf(a.tof))*ch;const t=Math.min(1,a.c3/225);
      ctx.fillStyle='hsl('+(173-t*148)+',45%,'+(65-t*33)+'%)';ctx.fillRect(x,y,Math.max(1,cw-.25),ch-.25);canvas._cells.push({a,x,y,w:cw,h:ch});
      if(a.id===selected?.id){ctx.strokeStyle='#fff';ctx.lineWidth=1.5;ctx.strokeRect(x-.5,y-.5,Math.max(2,cw+1),ch+1);}}
    ctx.fillStyle='#92a8bb';ctx.font='10px system-ui';ctx.fillText(dates[0]?.slice(0,7)||'No matches',9,h-8);ctx.textAlign='right';ctx.fillText(dates.at(-1)?.slice(0,7)||'',w-9,h-8);ctx.textAlign='left';
    $('ipHeatCaption').textContent='Click a cell to inspect its lowest-C3 match. Travel time increases upward; teal indicates lower C3. Blank cells are outside the selected sample.';
  }
  function enter(){
    if(!active){oldTransfer=window.CislunarMars.getState().enabled.includes('mars-transfer');nativeView('mars',true);active=true;frameBefore=frameNode.nodeValue;
      const cb=document.querySelector('[data-mars-toggle="mars-transfer"]');if(cb?.checked){cb.checked=false;cb.dispatchEvent(new Event('change'));}}
    he.view='interplanetary';document.querySelector('#hud>span:last-child').textContent='Earth–Moon–Mars system';group.visible=true;panel.open=true;selectedOnly=false;document.body.classList.add('interplanetary-active');note.hidden=false;
    hideOld(solar);rebuild();$('inspector').hidden=true;transferInspector=false;
    if(!Ii())panel.scrollIntoView({block:'nearest'});
  }
  function leave(){
    if(!active)return;hideOld(false);active=false;group.visible=false;transition=null;note.hidden=true;document.body.classList.remove('interplanetary-active');
    const cb=document.querySelector('[data-mars-toggle="mars-transfer"]');if(cb){cb.checked=oldTransfer;cb.dispatchEvent(new Event('change'));}
    frameNode.nodeValue=frameBefore;document.querySelector('#hud>span:last-child').textContent='Earth–Moon system';
  }
  function capture(id,fn,any=false){$(id).addEventListener('click',event=>{if(!active||(!any&&!transferInspector))return;event.preventDefault();event.stopImmediatePropagation();fn();},true);}
  function install(){
    group=new Yt;group.name='V3 interplanetary transfer catalogue';group.visible=false;yn.add(group);curves=new Yt;reference=new Yt;group.add(curves,reference);
    dots=['#a9e4da','#e7ae85','#f8efd6'].map(c=>{const d=gc(c,.015,true);group.add(d);return d;});
    for(const [body,p]of Object.entries(dataset.referenceOrbits))reference.add(oi(p.map(v=>new C(...v).multiplyScalar(2.2)),body==='earth'?'#739ab4':'#b18d7b',.34));
    const sun=gc('#efd29b',.05,true);reference.add(sun);
    Da('Sun',[0,0,0],{className:'ip-label',offset:[0,25],visible:()=>active&&solar});
    depLabel=Da('Departure',[0,0,0],{className:'ip-label',offset:[0,-25],visible:()=>active&&solar&&!!selected,getPosition:()=>dots[0].position,onClick:inspect});
    arrLabel=Da('Arrival',[0,0,0],{className:'ip-label',offset:[0,25],visible:()=>active&&solar&&!!selected,getPosition:()=>dots[1].position,onClick:inspect});
    const style=document.createElement('style');style.id='interplanetaryStyles';style.textContent=`
      #ipLayers .ip-controls{padding:4px 7px 14px;display:grid;gap:11px}#ipLayers label{display:grid;gap:5px;color:#a9bccb;font-size:10px}#ipLayers select{width:100%;background:#122434;border:1px solid #304858;border-radius:4px;color:#d8e6ee;font-size:11px;padding:7px}#ipLayers input[type=range]{width:100%;accent-color:#83cfc6}#ipCount{font-size:10px;line-height:1.6;color:#a9dbd4}.ip-mini{font-size:9px;line-height:1.6;color:#8fa5b8}.ip-actions{display:flex;gap:5px;flex-wrap:wrap}.ip-actions button{font-size:10px;background:#163139;border:1px solid #3c6469;border-radius:4px;padding:8px}#ipHeat{width:100%;height:auto;border:1px solid #2d4658;border-radius:4px;cursor:crosshair}.ip-note{position:absolute;bottom:18px;left:18px;right:18px;text-align:center;color:#a6bdca;font-size:9px;pointer-events:none;line-height:1.5}.interplanetary-active #marsScaleNote,.interplanetary-active #scaleBar,.interplanetary-active #sceneLegend,.interplanetary-active #cameraHint{display:none!important}.ip-solar #labels .point-label:not(.ip-label){display:none!important}#viewbar [data-view="interplanetary"]{padding-left:10px;padding-right:10px}.interplanetary-active #orbitCount{font-size:10px}.interplanetary-active .frame-label{font-size:7px}#ipLayers button:hover{background:#244851}@media(max-width:760px){#viewbar{max-width:calc(100% - 14px)}#viewbar button{padding-left:8px;padding-right:8px;font-size:10px}#viewbar [data-view="interplanetary"]{padding-left:7px;padding-right:7px;font-size:9px}#viewbar #resetView{padding:5px 7px}.ip-note{bottom:70px;font-size:8px;left:10px;right:10px}.interplanetary-active .frame-label{font-size:6px;letter-spacing:.08em}}`;
    document.head.append(style);
    panel=document.createElement('details');panel.id='ipLayers';panel.className='layer-section';
    const options=(vals)=>vals.map(([v,t])=>'<option value="'+v+'">'+t+'</option>').join('');
    panel.innerHTML='<summary>INTERPLANETARY · TRANSFER ATLAS</summary><div class="ip-controls"><p id="ipCount"></p>'+[
      ['ipFrame','Display frame',[['gallery','Connected atlas'],['solar','Solar frame · common AU scale']]],
      ['ipDirection','Journey',[['both','Both directions'],['outbound','Earth–Moon → Mars'],['inbound','Mars → Earth–Moon']]],
      ['ipYear','Departure year',[['all','2026–2035 · all samples'],...Array.from({length:10},(_,i)=>[2026+i,''+(2026+i)])]],
      ['ipFlight','Flight duration',[['all','90–900 days'],['fast','90–180 days'],['medium','210–360 days'],['long','420–900 days']]],
      ['ipRevs','Extra solar revolutions',[['all','Zero and one'],['0','Zero revolutions'],['1','One revolution · both branches']]],
      ['ipDensity','Drawing density',[['360','Dense · up to 360'],['96','Representative · up to 96'],['0','Every matching solution']]],
      ['ipColor','Color paths by',[['direction','Journey direction'],['duration','Flight duration'],['energy','Departure energy']]]
    ].map(([id,label,opts])=>'<label>'+label+'<select id="'+id+'">'+options(opts)+'</select></label>').join('')+
      '<label>Maximum departure C3 <span id="ipC3Readout">100 km²/s²</span><input id="ipC3" aria-label="Maximum departure C3" type="range" min="10" max="225" step="5" value="100"></label><p id="ipEmpty" hidden class="ip-mini">No samples match these filters. Increase C3 or choose another year.</p><label>Calculated transfer<select id="ipPicker"></select></label><div class="ip-actions"><button id="ipInspect">Inspect transfer</button><button id="ipAll">Show bundle</button><button id="ipMethods">Model & equations</button></div><label>Departure date × flight time<canvas id="ipHeat" width="240" height="150" aria-label="Sampled transfer energy grid"></canvas></label><p id="ipHeatCaption" class="ip-mini"></p><div class="ip-actions"><button id="ipDownload">Transfer JSON</button><button id="ipCSV">Selected path CSV</button></div><p class="ip-mini">Finite grid, approximate ephemerides, Sun-only cruise. The local systems are not dynamically stitched into these legs. The moving transfer marker uses normalized flight progress across the display timeline.</p></div>';
    $('layerList').append(panel);
    const binding={ipDirection:'direction',ipYear:'year',ipFlight:'flight',ipRevs:'revs',ipDensity:'density',ipColor:'color'};
    for(const [id,key]of Object.entries(binding))$(id).addEventListener('change',()=>{cfg[key]=key==='density'?Number($(id).value):$(id).value;selectedOnly=false;if(!active)enter();else rebuild(false);});
    $('ipC3').addEventListener('input',()=>{$('ipC3Readout').textContent=$('ipC3').value+' km²/s²';});
    $('ipC3').addEventListener('change',()=>{cfg.c3=Number($('ipC3').value);selectedOnly=false;if(!active)enter();else rebuild(false);});
    $('ipFrame').addEventListener('change',()=>{hideOld(false);solar=$('ipFrame').value==='solar';if(!active)enter();else{hideOld(solar);rebuild();}});
    $('ipPicker').addEventListener('change',()=>select($('ipPicker').value,true));$('ipInspect').onclick=inspect;$('ipAll').onclick=()=>{selectedOnly=false;rebuild();};$('ipMethods').onclick=equations;
    $('ipDownload').onclick=()=>hc(JSON.stringify({meta:dataset.meta,transfers:filtered},null,2),'earth-moon-mars-transfers.json');
    $('ipCSV').onclick=()=>{if(selected)hc('elapsed_days,x_AU,y_AU,z_AU\n'+selected.points.map((p,i)=>[i*selected.tof/(selected.points.length-1),...p].join(',')).join('\n'),selected.id+'.csv','text/csv');};
    $('ipHeat').addEventListener('click',e=>{const b=e.currentTarget.getBoundingClientRect(),x=(e.clientX-b.left)*240/b.width,y=(e.clientY-b.top)*150/b.height;const cell=e.currentTarget._cells?.find(c=>x>=c.x&&x<=c.x+c.w&&y>=c.y&&y<=c.y+c.h);if(cell)select(cell.a.id,true);});
    note=document.createElement('p');note.className='ip-note';note.id='ipNote';note.hidden=true;$('stage').append(note);
    frameNode=Array.from(document.querySelector('.frame-label').childNodes).find(n=>n.nodeType===3&&n.nodeValue.trim());
    nativeView=rn;rn=function(view,instant=false){if(view==='interplanetary')return enter();leave();return nativeView(view,instant);};
    const preset=fc;fc=function(p){leave();return preset(p);};
    capture('frameHelp',equations,true);capture('equationBtn',equations);
    const originalInspect=ai;ai=function(...args){transferInspector=false;return originalInspect(...args);};
    $('closeInspector').addEventListener('click',()=>transferInspector=false);
    capture('focusSelection',()=>{selectedOnly=true;rebuild();inspect();});capture('isolateSelection',()=>{selectedOnly=!selectedOnly;rebuild();inspect();});
    Ht.domElement.addEventListener('pointerdown',e=>pointer=[e.clientX,e.clientY]);
    Ht.domElement.addEventListener('pointerup',e=>{if(!active||!pointer||Math.hypot(e.clientX-pointer[0],e.clientY-pointer[1])>4)return;
      const b=Ht.domElement.getBoundingClientRect(),mx=e.clientX-b.left,my=e.clientY-b.top;let nearest=null,best=8;
      for(const item of lines){let prev=null;for(let i=0;i<item.points.length;i+=3){const p=item.points[i].clone().project(ct),x=(p.x+1)*b.width/2,y=(1-p.y)*b.height/2;
        if(prev){const dx=x-prev[0],dy=y-prev[1],l=dx*dx+dy*dy,t=Math.max(0,Math.min(1,((mx-prev[0])*dx+(my-prev[1])*dy)/(l||1))),d=Math.hypot(mx-prev[0]-t*dx,my-prev[1]-t*dy);if(d<best){best=d;nearest=item.a;}}prev=[x,y];}}
      if(nearest)select(nearest.id,true);
    });
    $('downloadHTML').download='earth-moon-mars-atlas-v3.html';
    window.EarthMoonMarsV3={version:'3.0.0',enter:()=>rn('interplanetary'),getState:()=>({active,solar,shown:shown.length,matching:filtered.length,total:dataset.arcs.length,selected:selected?.id,config:{...cfg},originalOrbitCount:Iu.length,originalManifoldCount:ht.manifolds.paths.length}),getData:()=>dataset};
  }
  function tick(){
    if(!active)return;
    if(transition){const t=Math.min(1,(performance.now()-transition.start)/1000),s=t*t*(3-2*t);ct.position.lerpVectors(transition.from,transition.to,s);Tt.target.lerpVectors(transition.fromTarget,transition.target,s);Mr=transition.fw+(transition.w-transition.fw)*s;Sr=transition.fh+(transition.h-transition.fh)*s;ct.zoom=transition.fz+(1-transition.fz)*s;ct.up.set(0,1,0);Ua();if(t===1)transition=null;}
    if(solar)oldVisible.forEach(([o])=>o.visible=false);
    if(selected){const entry=lines.find(e=>e.a===selected);if(entry){const p=entry.points;dots[0].position.copy(p[0]);dots[1].position.copy(p.at(-1));const progress=(he.days/160)*(p.length-1),i=Math.floor(progress);dots[2].position.lerpVectors(p[i],p[Math.min(i+1,p.length-1)],progress-i);dots[2].visible=he.markers;}}
    if(performance.now()-lastUpdate>200){$('orbitCount').textContent=fmt(shown.length,0)+' / '+fmt(dataset.arcs.length,0)+' transfer solutions';lastUpdate=performance.now();}
  }
  return {install,tick};
})();
