/* Mars extension for the recovered 2026-11-01 Cislunar Atlas.
 * This is injected inside the ORIGINAL v1 closure. It reuses its scene,
 * renderer, camera, controls, labels, timeline, and inspector. No v1 orbit
 * record, texture, line geometry, or numerical catalog is replaced.
 * Local Mars paths are analytic two-body examples, not flight ephemerides.
 */
const MarsV2 = (() => {
  const GM = 42828.375816 - 0.0007087 - 0.0000962;
  const SUN = 132712440041.279419, AU = 149597870.7, DAY = 86400;
  const RAD = Math.PI / 180, MARS_RADIUS = 3389.5;
  const CENTER = [3.65, 2.7, 0], KM_PER_UNIT = 50000;
  const REF = 'https://ssd.jpl.nasa.gov/';
  const layers = [], orbits = [], bodies = [];
  let active = false, root, transition = null, snapshot = null, selected = null;
  let fullWeb = true, selectedOrbit = null, marsBody, details, frameText, originalFrame;
  let originalView, originalPreset, note, sinceHUD = 0;
  const byId = id => layers.find(layer => layer.id === id);
  const clamp = (x,a,b) => Math.max(a, Math.min(b,x));

  // E - e sin(E) = M. Velocities are physical km/s, not display derivatives.
  function kepler(a, e, mean, mu = GM) {
    let E = mean % (2*Math.PI);
    for (let n=0; n<18; n++) {
      const delta = (E-e*Math.sin(E)-mean%(2*Math.PI))/(1-e*Math.cos(E));
      E -= delta; if (Math.abs(delta)<1e-13) break;
    }
    const n = Math.sqrt(mu/(a*a*a)), d = 1-e*Math.cos(E), b = Math.sqrt(1-e*e);
    return {position:[a*(Math.cos(E)-e), a*b*Math.sin(E),0],
      velocity:[-a*n*Math.sin(E)/d, a*n*b*Math.cos(E)/d,0], E};
  }
  function orient(p, inclination=0, node=0, peri=0) {
    const c=Math.cos(peri*RAD),s=Math.sin(peri*RAD),ci=Math.cos(inclination*RAD),si=Math.sin(inclination*RAD);
    const cn=Math.cos(node*RAD),sn=Math.sin(node*RAD),x=p[0]*c-p[1]*s,y=p[0]*s+p[1]*c;
    return [cn*x-sn*y*ci, sn*x+cn*y*ci, y*si];
  }
  function display(p) { return new C(CENTER[0]+p[0]/KM_PER_UNIT,CENTER[1]+p[1]/KM_PER_UNIT,p[2]/KM_PER_UNIT); }
  function addLayer(id,name,color,description,use,limitations) {
    const item={id,name,color,description,use,limitations,enabled:true,object:new Yt,orbits:[],paths:[],markers:[]};
    item.object.visible=false; root.add(item.object); layers.push(item); return item;
  }
  function addOrbit(layer, def) {
    const period=2*Math.PI*Math.sqrt(def.a**3/GM);
    const record={...def,periodSeconds:period,model:'Mars-centered two-body Kepler model',layer:layer.id};
    record.state = days => {
      const k=kepler(def.a,def.e||0,(def.phase||0)+days*DAY*2*Math.PI/period);
      return {position:orient(k.position,def.i,def.node,def.peri),velocity:orient(k.velocity,def.i,def.node,def.peri)};
    };
    const points=[];
    for(let j=0;j<=600;j++) points.push(display(record.state(j/600*period/DAY).position));
    const path=oi(points,layer.color,.48); path.userData.marsOrbit=def.id;
    layer.object.add(path);layer.paths.push(path);record.path=path;
    const marker=gc(layer.color,.0045,true);layer.object.add(marker);layer.markers.push({marker,record});
    record.marker=marker;layer.orbits.push(record);orbits.push(record);return record;
  }
  function marsTexture() {
    const c=document.createElement('canvas');c.width=512;c.height=256;
    const ctx=c.getContext('2d'),img=ctx.createImageData(c.width,c.height);
    for(let y=0;y<c.height;y++) for(let x=0;x<c.width;x++) {
      const u=x/c.width*Math.PI*2,v=y/c.height*Math.PI;
      const terrain=.5+.19*Math.sin(4*u+2*Math.sin(v*3))+.14*Math.sin(11*u-7*v)+.09*Math.cos(27*u+19*v);
      const dark=Math.pow(Math.max(0,Math.sin(u*2-.3)*Math.sin(v)),4);
      const cap=Math.pow(Math.abs(Math.cos(v)),32),p=(y*c.width+x)*4;
      img.data[p]=clamp(148+terrain*63-dark*63+cap*50,0,255);
      img.data[p+1]=clamp(65+terrain*43-dark*38+cap*110,0,255);
      img.data[p+2]=clamp(36+terrain*27-dark*13+cap*125,0,255);img.data[p+3]=255;
    }
    ctx.putImageData(img,0,0);const tex=new Js(c);tex.colorSpace=wt;return tex;
  }
  function body(name,position,color,radius,texture) {
    const object=new gt(new Tn(radius,40,28),new ds({color,roughness:1,map:texture||null}));
    object.position.copy(position);root.add(object);bodies.push(object);
    Da(name,position.toArray(),{className:'planet',offset:name==='Mars'?[0,-29]:name==='Phobos'?[-47,14]:[-20,36],visible:()=>active&&root.visible,
      getPosition:()=>object.position,onClick:()=>inspect('mars-moons')});
    return object;
  }
  function addSolarTransfers() {
    const layer=addLayer('mars-transfer','Earth–Mars transfer arcs','#e0bf8d',
      'Two analytic Sun-centered half-ellipse transfers connect a circular 1 AU Earth orbit with a circular 1.523679 AU Mars orbit. The departure and arrival markers refer to different epochs.',
      'Understand transfer geometry and the roughly nine-month flight time of the ideal Hohmann example.',
      'An ideal two-body transfer, not a launch-date solution, cycler, free manifold connection, or an operating shipping route. Local Earth–Moon and Mars neighborhoods are magnified independently.');
    const r1=AU,r2=1.523679*AU,a=(r1+r2)/2,e=(r2-r1)/(r2+r1),n=Math.sqrt(SUN/a**3);
    const length=Math.hypot(CENTER[0],CENTER[1]),px=-CENTER[1]/length,py=CENTER[0]/length;
    function pos(mean,sign) {
      const k=kepler(a,e,mean,SUN),u=(r1-k.position[0])/(r1+r2),v=k.position[1]/(r1+r2)*length*sign;
      return new C(CENTER[0]*u+px*v,CENTER[1]*u+py*v,0);
    }
    for(const sign of [1,-1]) {
      const points=[];for(let j=0;j<=600;j++)points.push(pos(Math.PI*j/600,sign));
      const path=oi(points,layer.color,.30);layer.object.add(path);layer.paths.push(path);
      const marker=gc(layer.color,.006,true);layer.object.add(marker);
      layer.markers.push({marker,transfer:true,position:days=>pos((days*DAY*n)%Math.PI,sign)});
    }
    layer.transferDays=Math.PI/n/DAY;
    layer.deltaVEarth=Math.sqrt(SUN*(2/r1-1/a))-Math.sqrt(SUN/r1);
    layer.deltaVMars=Math.sqrt(SUN/r2)-Math.sqrt(SUN*(2/r2-1/a));
    // The Sun is the true focus of the displayed half-ellipses. Its radius is symbolic.
    const sun=gc('#ddbd84',.011,true);sun.position.set(CENTER[0]*r1/(r1+r2),CENTER[1]*r1/(r1+r2),0);
    layer.object.add(sun);
    Da('Sun',sun.position.toArray(),{offset:[0,22],visible:()=>active&&layer.enabled,
      onClick:()=>inspect(layer.id)});
  }
  function buildGeometry() {
    root=new Yt;root.name='Mars extension (v1 scene preserved)';root.visible=false;yn.add(root);
    const low=addLayer('mars-low','Low Mars orbital families','#e3a281',
      'Five circular two-body reference orbits at 400 km altitude, with different inclinations. They use Mars gravity and share the original v1 renderer.',
      'Compare equatorial, inclined, and polar orbital geometries for observation and surface logistics.',
      'Illustrative orbital elements, not real spacecraft tracking. Mars oblateness, atmosphere, solar perturbations, and stationkeeping are omitted.');
    [0,30,60,90,110].forEach((i,j)=>addOrbit(low,{id:'mars-low-'+j,name:'400 km · '+i+'° inclination',a:MARS_RADIUS+400,e:0,i,node:j*24,peri:0,phase:j*.9}));
    const high=addLayer('mars-high','Elliptical staging / capture','#d6af7e',
      'Five Mars-centered Kepler ellipses with 400 km periapsis and progressively higher apoapses. Their trajectories are calculated analytically.',
      'Explore staging-orbit geometry and the range of altitudes a vehicle might traverse.',
      'These are reference bound orbits after a hypothetical capture maneuver. They do not calculate an arrival burn, aerocapture, or an optimized mission.');
    [16000,23457,32000,43000,55000].forEach((ra,j)=>{const rp=MARS_RADIUS+400;
      addOrbit(high,{id:'mars-high-'+j,name:'Apoapsis radius '+ra.toLocaleString('en-US')+' km',a:(rp+ra)/2,e:(ra-rp)/(ra+rp),i:[15,35,55,75,100][j],node:j*37,peri:j*62,phase:j*.8});});
    const sync=addLayer('mars-sync','Areosynchronous reference','#a1b2d7',
      'A circular equatorial reference whose two-body period equals the adopted Mars sidereal rotation period of 1.02595676 days.',
      'See the ideal orbit underlying stationary-over-Mars relay concepts.',
      'The long-term stability of an actual areostationary satellite requires the real Mars gravity field and perturbation analysis.');
    addOrbit(sync,{id:'mars-sync-0',name:'Sidereal-day reference',a:Math.cbrt(GM*(1.02595676*DAY/(2*Math.PI))**2),e:0,i:0,node:0,peri:0});
    const moons=addLayer('mars-moons','Phobos & Deimos orbital paths','#c7d4af',
      'Phobos and Deimos orbit Mars at representative semimajor axes of 9,375 km and 23,457 km. These are mean-element Kepler approximations, not a live ephemeris.',
      'Locate the two moon neighborhoods relative to low Mars orbit and higher staging orbits.',
      'Mean elements are from JPL. The display phases and plane orientations are illustrative. The moons are not shown at their current real positions.');
    const ph=addOrbit(moons,{id:'phobos-mean',name:'Phobos · mean-element approximation',a:9375,e:.015,i:1.1,node:169.2,peri:216.3,phase:189.7*RAD});
    const de=addOrbit(moons,{id:'deimos-mean',name:'Deimos · mean-element approximation',a:23457,e:0,i:1.8,node:54.3,peri:0,phase:205*RAD});
    marsBody=body('Mars',new C(...CENTER),'#ffffff',.071,marsTexture());
    for(const [name,record,radius]of [['Phobos',ph,.011],['Deimos',de,.009]]){
      const object=body(name,display(record.state(0).position),'#b7ada0',radius,null);object.userData.orbit=record;
      // These labels follow the actual animated markers rather than static destinations.
      const label=Lu[Lu.length-1];label.visible=()=>active&&moons.enabled&&!!document.getElementById('marsMoonLabels')?.checked;
    }
    const transfers=addLayer('mars-local-transfer','Transfers to moon distances','#9ec5ca',
      'Six bound Kepler reference ellipses link low-Mars periapsis radius with the Phobos or Deimos orbital radius. Their useful transfer portion is half an orbit.',
      'Compare the geometry of changing orbital altitude within the Mars system.',
      'Reaching a moon’s orbital radius is not automatically a rendezvous. Target phasing, inclination changes, capture, and final approach are not solved.');
    [9375,23457].forEach((ra,k)=>[0,55,115].forEach((peri,j)=>{const rp=MARS_RADIUS+400;
      addOrbit(transfers,{id:'mars-moon-transfer-'+k+'-'+j,name:(k?'Deimos':'Phobos')+' radius · '+peri+'° example',a:(rp+ra)/2,e:(ra-rp)/(ra+rp),i:k?1.8:1.1,node:15,peri,phase:j*.8});}));
    addSolarTransfers();
    Da('LMO',display([MARS_RADIUS+400,0,0]).toArray(),{offset:[-45,-15],visible:()=>active&&low.enabled&&(!Ii()||(ct.right-ct.left)/ct.zoom<2),onClick:()=>inspect(low.id)});
    const gale=gc('#f1c7ae',.0045,true);gale.position.copy(new C(CENTER[0]+.035,CENTER[1]-.048,.035));root.add(gale);
    Da('Gale Crater',gale.position.toArray(),{offset:[55,12],visible:()=>active&&(!Ii()||(ct.right-ct.left)/ct.zoom<2),getPosition:()=>gale.position,onClick:()=>{
      inspect('mars-low');Z('inspectTitle').textContent='Gale Crater · surface reference';
      Z('inspectDescription').textContent='A labeled surface destination inspired by the supplied logistics diagram. Its placement on this illustrative globe is schematic, not a landing trajectory or surveyed position.';
    }});
  }
  function snapshotV1() {
    return {selected:he.selected,selectedOrbit:he.selectedOrbit,preset:he.preset,trueSize:he.trueSize,
      inspectorHidden:Z('inspector').hidden,collapsed:Z('inspector').classList.contains('collapsed'),
      layers:Vt.map(layer=>({id:layer.id,enabled:layer.enabled,solo:layer.solo,paths:layer.paths.map(p=>p.visible)}))};
  }
  function showOriginalWeb() {
    if(!snapshot)return;
    for(const saved of snapshot.layers){const layer=Xn.get(saved.id);
      const computed=(layer.orbits.length&&!layer.orbits[0].approximation)||layer.kind==='manifold';
      ws(layer.id,fullWeb&&computed?true:saved.enabled,false);
      if(!fullWeb){layer.solo=saved.solo;layer.paths.forEach((p,j)=>p.visible=saved.paths[j]);}
    }
  }
  function leave() {
    if(!active)return;active=false;root.visible=false;transition=null;selected=null;selectedOrbit=null;
    document.body.classList.remove('mars-overview');note.hidden=true;frameText.nodeValue=originalFrame;
    if(snapshot){
      for(const saved of snapshot.layers){const layer=Xn.get(saved.id);ws(saved.id,saved.enabled,false);layer.solo=saved.solo;layer.paths.forEach((p,j)=>p.visible=saved.paths[j]);}
      he.preset=snapshot.preset;he.trueSize=snapshot.trueSize;_c();xc();
      he.selected=snapshot.selected;he.selectedOrbit=snapshot.selectedOrbit;
      if(snapshot.selected)ai(snapshot.selected,snapshot.selectedOrbit);
      Z('inspector').hidden=snapshot.inspectorHidden;Z('inspector').classList.toggle('collapsed',snapshot.collapsed);
      Z('expandInspector').setAttribute('aria-expanded',String(!snapshot.collapsed));
    }
    snapshot=null;dc();Na();
  }
  function enter(instant=false) {
    if(!active){snapshot=snapshotV1();active=true;showOriginalWeb();}
    he.view='mars';root.visible=true;layers.forEach(layer=>layer.object.visible=layer.enabled);
    details.open=true;document.body.classList.add('mars-overview');note.hidden=false;
    frameText.nodeValue=' MULTISCALE EARTH–MARS OVERVIEW ';
    document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view==='mars'));
    const target=new C(1.05,.65,0),position=target.clone().add(new C(0,0,9));
    // One original scene and camera. Earth remains at its original (0,0,0).
    // Fit the Earth–Moon network at lower-left and the Mars neighborhood at upper-right.
    xn=null;
    transition={start:performance.now(),duration:instant?0:1150,from:ct.position.clone(),to:position,
      targetFrom:Tt.target.clone(),targetTo:target,fromWidth:Mr,fromHeight:Sr,fromZoom:ct.zoom,toWidth:7.4,toHeight:6.2};
    selected=null;selectedOrbit=null;
    Z('inspector').hidden=true;
    if(!Ii())details.scrollIntoView({block:'nearest',behavior:instant?'instant':'smooth'});
    dc();
  }
  function setLayer(id,enabled){const layer=byId(id);if(!layer)return;layer.enabled=enabled;layer.object.visible=active&&enabled;
    const cb=details.querySelector('[data-mars-toggle="'+id+'"]');if(cb)cb.checked=enabled;
  }
  function renderSidebar() {
    document.getElementById('marsLayers')?.remove();
    details=document.createElement('details');details.className='layer-section';details.id='marsLayers';
    details.innerHTML='<summary>MARS · ORBITAL EXTENSION</summary>'+layers.map(layer=>
      '<div class="layer-row" data-mars-layer="'+layer.id+'" style="--color:'+layer.color+'">'+
      '<label title="Toggle '+layer.name+'"><input type="checkbox" checked data-mars-toggle="'+layer.id+'" aria-label="Show '+layer.name+'"></label>'+
      '<button class="layer-name" data-mars-inspect="'+layer.id+'">'+layer.name+'</button><span class="layer-number">'+(layer.orbits.length||2)+'</span></div>').join('')+
      '<label class="mars-full-web"><input type="checkbox" id="marsMoonLabels"> Show Phobos & Deimos labels</label>'+ 
       '<label class="mars-full-web"><input type="checkbox" id="marsFullWeb" checked> Include the full v1 cislunar web</label>'+
      '<p class="mars-sidebar-note">The original orbit data is untouched. Mars is an additional group in the same scene.</p>';
    Z('layerList').append(details);
    details.querySelectorAll('[data-mars-toggle]').forEach(cb=>cb.addEventListener('change',()=>{if(!active)enter();setLayer(cb.dataset.marsToggle,cb.checked);}));
    details.querySelectorAll('[data-mars-inspect]').forEach(b=>b.addEventListener('click',()=>{if(!active)enter();setLayer(b.dataset.marsInspect,true);inspect(b.dataset.marsInspect);if(Ii())Z('layers').classList.remove('open');}));
    Z('marsFullWeb').addEventListener('change',()=>{fullWeb=Z('marsFullWeb').checked;if(active)showOriginalWeb();});
  }
  function inspect(id,orbitId) {
    if(!active)enter();const layer=byId(id);if(!layer)return;selected=id;
    selectedOrbit=layer.orbits.find(o=>o.id===orbitId)||layer.orbits[0]||null;
    Z('inspector').hidden=false;Z('inspector').classList.remove('collapsed');Z('expandInspector').setAttribute('aria-expanded','true');
    Z('inspectTitle').textContent=layer.name;Z('inspectDescription').textContent=layer.description;
    Z('inspectUses').innerHTML='<strong>Possible use</strong>'+Wn(layer.use);
    Z('inspectStatus').textContent='CALCULATED TWO-BODY EXAMPLE';Z('inspectStatus').className='status-chip approx';
    Z('inspectLimit').textContent=layer.limitations+' Display separation and local scales are compressed; this is not one globally scaled ephemeris.';
    Z('orbitPickerWrap').hidden=!layer.orbits.length;
    Z('orbitPicker').innerHTML=layer.orbits.map(o=>'<option value="'+o.id+'">'+Wn(o.name)+'</option>').join('');
    if(selectedOrbit)Z('orbitPicker').value=selectedOrbit.id;
    const pairs=selectedOrbit?[
      ['PERIOD',Ci(selectedOrbit.periodSeconds/3600,2)+' hours'],['SEMI-MAJOR AXIS',Ci(selectedOrbit.a,0)+' km'],
      ['ECCENTRICITY',Ci(selectedOrbit.e||0,4)],['INCLINATION',Ci(selectedOrbit.i||0,1)+'°']]:[
      ['IDEAL FLIGHT TIME',Ci(layer.transferDays,1)+' days'],['EARTH HELIOCENTRIC Δv',Ci(layer.deltaVEarth,2)+' km/s'],
      ['MARS HELIOCENTRIC Δv',Ci(layer.deltaVMars,2)+' km/s'],['DATE-SPECIFIC SOLUTION','No']];
    Z('inspectMetrics').innerHTML=pairs.map(([a,b])=>'<div class="metric"><small>'+a+'</small><strong>'+b+'</strong></div>').join('');
    Z('focusSelection').disabled=false;Z('isolateSelection').disabled=false;
  }
  function equations() {
    Z('guideDialog').showModal();document.querySelectorAll('[data-tab]').forEach(b=>b.classList.remove('active'));
    const o=selectedOrbit;
    Z('guideContent').innerHTML='<h3>Mars extension · equations and display frames</h3>'+
      '<p>V1’s Earth–Moon CR3BP trajectories remain exactly as recovered. New Mars paths use the analytic two-body model below, independently of the original CR3BP calculations.</p>'+
      '<pre class="equations">r̈ = −GM r / |r|³\nE − e sin E = M = M₀ + √(GM/a³) t\nx = a(cos E − e)\ny = a √(1−e²) sin E\nT = 2π √(a³/GM)\nGM(Mars) = '+GM.toFixed(9)+' km³/s²</pre>'+
      (o?'<h3>'+Wn(o.name)+'</h3><pre class="equations">a = '+o.a+' km\ne = '+(o.e||0)+'\ni = '+(o.i||0)+' degrees\nT = '+o.periodSeconds+' seconds</pre>':'')+
      '<h3>A multiscale overview, not a global ephemeris</h3><p>The entire original cislunar scene keeps its original coordinates. The Mars neighborhood has a separate fixed local scale of 50,000 km per display unit. Interplanetary arcs are ideal Sun-centered Hohmann half-ellipses, rigidly oriented and scaled to the overview; the local neighborhoods are independently enlarged. Departures and arrivals occur at different epochs. Surface and capture labels are destinations, not solved landings.</p>'+
      '<p>The Mars globe is a procedural illustration, not a geographic texture. No claim is made of live positions, optimized transfers, free rendezvous, operational trade lanes, or exact real-world trajectories.</p>'+
      '<h3>Primary references</h3><p><a target="_blank" rel="noopener" href="'+REF+'astro_par.html">JPL astrodynamic constants</a><br><a target="_blank" rel="noopener" href="'+REF+'sats/elem/">JPL mean satellite elements</a><br><a target="_blank" rel="noopener" href="'+REF+'sats/phys_par/">JPL satellite masses</a><br><a target="_blank" rel="noopener" href="'+REF+'planets/phys_par.html">JPL planetary radii and rotation</a></p>';
    Z('guideContent').scrollTop=0;
  }
  function capture(id,fn){Z(id).addEventListener('click',event=>{if(!active||!selected)return;event.preventDefault();event.stopImmediatePropagation();fn();},true);}
  function install() {
    buildGeometry();renderSidebar();
    const css=document.createElement('style');css.id='marsExtensionStyles';css.textContent=
      '.mars-full-web{display:flex;align-items:center;gap:8px;padding:10px 5px;font-size:11px;color:#b4c2cf}.mars-full-web input{accent-color:#d6af7e}.mars-sidebar-note{font-size:10px;line-height:1.6;color:#93a7b9;padding:0 6px 12px}.mars-scale-note{position:absolute;bottom:44px;left:24px;right:24px;font-size:10px;color:#b4c2cf;pointer-events:none;text-align:center}.mars-overview #scaleBar{visibility:hidden}.mars-overview #cameraHint{bottom:16px}.mars-overview .frame-label{font-size:8px}@media(max-width:760px){.mars-scale-note{bottom:86px;left:12px;right:12px;font-size:8px;line-height:1.4}.mars-overview .frame-label{font-size:6px;letter-spacing:.1em}}';document.head.append(css);
    note=document.createElement('div');note.id='marsScaleNote';note.className='mars-scale-note';note.hidden=true;
    note.textContent='One scene · Original v1 + Mars · Local scales enlarged; interplanetary distances compressed · Not live positions';Z('stage').append(note);
    frameText=Array.from(document.querySelector('.frame-label').childNodes).find(n=>n.nodeType===3&&n.nodeValue.trim());originalFrame=frameText.nodeValue;
    originalView=rn;rn=function(view,instant=false){if(view==='mars')return enter(instant);leave();return originalView(view,instant);};
    originalPreset=fc;fc=function(preset){leave();return originalPreset(preset);};
    const nativeInspect=ai;ai=function(...args){selected=null;selectedOrbit=null;return nativeInspect(...args);};
    capture('equationBtn',equations);
    capture('focusSelection',()=>{const layer=byId(selected);if(layer)Cu({kind:'mars',orbits:[],object:layer.object});});
    capture('isolateSelection',()=>{layers.forEach(layer=>setLayer(layer.id,layer.id===selected));inspect(selected,selectedOrbit?.id);});
    Z('orbitPicker').addEventListener('change',event=>{if(!active||!selected)return;event.stopImmediatePropagation();inspect(selected,event.target.value);},true);
    Z('closeInspector').addEventListener('click',()=>{selected=null;selectedOrbit=null;});
    Z('frameHelp').addEventListener('click',event=>{if(!active)return;event.stopImmediatePropagation();equations();},true);
    // A normal v1 layer selection hands the inspector back to its unchanged code.
    document.querySelectorAll('[data-inspect]').forEach(b=>b.addEventListener('click',()=>{selected=null;selectedOrbit=null;},true));
    Z('downloadHTML').href='index.html';Z('downloadHTML').download='cislunar-atlas-v2.html';
    document.querySelector('a[href="cislunar-source.zip"]').href='https://github.com/JonErnster/Cislunar-Economy/archive/refs/heads/main.zip';
    for(const id of ['downloadJSON','downloadSelected'])Z(id).addEventListener('click',event=>{
      if(location.protocol==='file:')return;
      event.preventDefault();event.stopImmediatePropagation();
      if(id==='downloadJSON')hc(JSON.stringify({...ht.catalog,orbits:Iu,cyclerModel:ht.cyclers.model,manifolds:ht.manifolds}),'cislunar-orbit-data.json');
      else {const o=qn.get(he.selectedOrbit)||ht.cyclers.orbits[0];hc('t_TU,x_LU,y_LU,z_LU,vx_LU_per_TU,vy_LU_per_TU,vz_LU_per_TU\n'+o.samples.map(row=>row.join(',')).join('\n'),o.id+'.csv','text/csv');}
    },true);
    window.CislunarMars={version:'2.0.0-v1-preserved',enter:()=>rn('mars'),leave:()=>rn('map'),
      getState:()=>({active,selected,fullWeb,marsOrbitCount:orbits.length,transferArcCount:2,originalOrbitCount:Iu.length,
        originalManifoldCount:ht.manifolds.paths.length,enabled:layers.filter(l=>l.enabled).map(l=>l.id),
        camera:ct.position.toArray(),target:Tt.target.toArray(),sceneChildren:yn.children.length,
        marsCenter:CENTER,earthPosition:Ts.position.toArray(),v1DataVersion:ht.catalog.generatedAt}),
      getModel:()=>({gmMarsKm3s2:GM,gmSunKm3s2:SUN,kmPerMarsDisplayUnit:KM_PER_UNIT,
        hohmannDays:byId('mars-transfer').transferDays,orbits:orbits.map(({id,name,a,e,i,periodSeconds,model})=>({id,name,a,e,i,periodSeconds,model}))}),
      testKepler:kepler,inspect};
  }
  function tick() {
    if(!active)return;
    if(transition){const f=transition.duration?clamp((performance.now()-transition.start)/transition.duration,0,1):1,s=f*f*(3-2*f);
      ct.position.lerpVectors(transition.from,transition.to,s);Tt.target.lerpVectors(transition.targetFrom,transition.targetTo,s);
      Mr=transition.fromWidth+(transition.toWidth-transition.fromWidth)*s;Sr=transition.fromHeight+(transition.toHeight-transition.fromHeight)*s;
      ct.zoom=transition.fromZoom+(1-transition.fromZoom)*s;ct.up.set(0,1,0);Ua();if(f===1)transition=null;
    }
    for(const layer of layers){layer.object.visible=layer.enabled;if(!layer.enabled)continue;
      for(const entry of layer.markers){entry.marker.visible=he.markers;if(entry.transfer)entry.marker.position.copy(entry.position(he.days));else entry.marker.position.copy(display(entry.record.state(he.days).position));}}
    marsBody.rotation.y=he.days*Math.PI*2/1.02595676;
    for(const object of bodies)if(object.userData.orbit){object.visible=byId('mars-moons').enabled;object.position.copy(display(object.userData.orbit.state(he.days).position));}
    if(++sinceHUD%30===0)Z('orbitCount').textContent=Vt.filter(l=>l.enabled).reduce((n,l)=>n+(l.solo?1:l.orbits.length),0)+' v1 + '+layers.filter(l=>l.enabled).reduce((n,l)=>n+l.orbits.length,0)+' Mars model orbits';
  }
  return {install,tick};
})();
