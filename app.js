/* Cislunar Atlas 2.0.0. Dependency-free, offline-capable educational visualization.
 * Frames are deliberately separated: Earth–Moon CR3BP / compressed logistics graph /
 * circular heliocentric reference. No displayed network edge is a solved transfer. */
'use strict';
(() => {
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const TAU=Math.PI*2, MU=MODEL.mu, TU=MODEL.time_seconds/86400;
const cv=$('#space'), ctx=cv.getContext('2d');
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const state={view:'map',marsMode:'network',time:0,playing:!reduced,speed:3,labels:true,motion:true,grid:true,glow:true,selected:null};
const camera={x:0,y:0,z:0,span:2.9,pitch:0,yaw:0};let target={...camera}, W=1,H=1,dpr=1,ready=false,paths=[],manifoldReady=false,last=0,picks=[],routePicks=[],hover=null;
const layers={cyclers:1,halo1:1,halo2:1,lyap1:0,lyap2:0,l4:1,l5:1,dro:1,leo:1,gto:0,geo:1,llo:1,manifold:0,torus:0,cylinder:0,globe:0,apollo:0,glaser:0,oneill:0,marsOrbit:1,marsLinks:1,phobos:1,deimos:1,capture:1,surface:1};
const defs={
 cyclers:['Earth–Moon cycler','#c8dce8','A classical Arenstorf-type periodic circuit that visits the Earth and Moon neighborhoods. This numerical solution is different from the recent stable prograde cycler families. A rendezvous still requires matching position, velocity and timing.'],
 halo1:['L1 · halo families','#70cbd3','Three-dimensional periodic solutions near Earth–Moon L1. Candidate uses include observation, communication and staging studies. Stationkeeping and transfers are not included.'],
 halo2:['L2 · halo families','#aaa1e6','Three-dimensional periodic solutions near Earth–Moon L2. These can be useful reference geometries for lunar-farside relay and staging studies; no particular mission is tracked here.'],
 lyap1:['L1 · planar Lyapunov','#70b8d5','Planar periodic loops around L1. Their unstable dynamics help organize approach and departure trajectories in the three-body model.'],
 lyap2:['L2 · planar Lyapunov','#9e9fda','Planar periodic loops around L2. A trajectory crossing another path on the map does not itself make a transfer possible.'],
 l4:['L4 · libration samples','#91c99e','Finite-time, small-amplitude CR3BP trajectories near the triangular L4 equilibrium. The seeds use linear modes, followed by nonlinear integration. These tracks are not asserted to close exactly.'],
 l5:['L5 · libration samples','#cf94b4','Finite-time, small-amplitude CR3BP trajectories near L5. Hypothetical settlements are an architecture concept, not a consequence of an orbit being stable.'],
 dro:['Distant retrograde orbits','#c9bf8a','Numerically corrected periodic retrograde loops around the Moon in the rotating frame. These are representative model solutions, not spacecraft ephemerides.'],
 leo:['Low Earth orbit','#76a7e2','A 400 km circular two-body reference ring. Used to represent an assembly, payload checkout or departure neighborhood; not a single physical depot.'],
 gto:['Geostationary transfer orbit','#d5b575','An idealized elliptical reference linking a 400 km perigee with GEO altitude. Its orientation and motion are illustrative, not a mission-specific transfer.'],
 geo:['Geostationary orbit','#b7d5dd','A reference ring at 42,164 km from Earth’s center. Real GEO is equatorial and tied to Earth’s sidereal rotation; this ring is projected into the atlas plane for context.'],
 llo:['Low lunar orbit','#c5d2b3','A 100 km circular two-body reference ring. Lunar mass concentrations and perturbations are omitted; no long-term stability claim is made.'],
 manifold:['Approach / departure branches','#73bfc0','Stable and unstable manifold approximations from finite-difference monodromy eigenvectors of selected halo solutions, then integrated forward or backward. They reveal transport geometry, not end-to-end transfer designs.'],
 torus:['Lunar orbital torus','#6d9299','An illustrative doughnut-shaped volume around the lunar orbital radius. This is a viewing aid, not a physical wall, an exact dynamical boundary or an orbital solution.'],
 cylinder:['Cislunar viewing cylinder','#6d9299','A wireframe cylinder that helps reveal vertical scale. Its dimensions are visualization choices, not a definition of cislunar space.'],
 globe:['Cislunar globe','#6d9299','A wireframe spherical viewing envelope. It is not Earth’s Hill sphere or a boundary beyond which gravity changes abruptly.'],
 apollo:['Apollo · crew and logistics','#e2c7a4','Conceptual direct logistics: Earth orbit to lunar orbit and surface. The dashed links are architectural connections, not calculated Apollo flight trajectories.'],
 glaser:['Glaser · industrial materials','#9dd9c4','Conceptual lunar material production, orbital processing and delivery toward GEO for infrastructure. Resource extraction, energy and manufacturing economics must still be established.'],
 oneill:['O’Neill · settlement supply','#c5a5d8','Conceptual bulk supply from the lunar surface to staging and triangular-point regions. These lines describe a possible industrial chain, not existing settlements.'],
 marsOrbit:['Mars · orbital neighborhood','#edac8c','Reveal the Mars system and low Mars orbit. In network mode, orbital sizes and interplanetary distances are deliberately expanded or compressed for readability.'],
 marsLinks:['Earth–Moon ↔ Mars routes','#e5b591','Candidate transport relationships between cislunar nodes and the Mars system. All are schematic. A launch date, propulsion system, arrival conditions and mission constraints are needed to solve each flight.'],
 phobos:['Phobos · surface and orbit','#c8baa2','Phobos is the inner Martian moon. The network distinguishes its surface from a Phobos capture/rendezvous neighborhood (PCO). The rendered rings are schematic, not stable two-body capture solutions.'],
 deimos:['Deimos · surface and orbit','#b6cfb0','Deimos is the outer Martian moon. The network distinguishes its surface from a Deimos capture/rendezvous neighborhood (DCO). Resource extraction is hypothetical, not an established operation.'],
 capture:['LMO · PCO · DCO nodes','#eadc87','Low Mars orbit, Phobos capture orbit and Deimos capture orbit are distinct logistics interfaces. PCO and DCO are placeholders for mission-specific rendezvous designs, not unique universal orbits.'],
 surface:['Surface nodes and landing links','#a7d995','Surface endpoints from the supplied reference: Kennedy Space Center, Pacific recovery, the lunar south pole, Gale Crater, Phobos and Deimos. Green marks small-body surfaces; it does not prove usable resources.']
};
const groups=[['JOURNEYS BETWEEN WORLDS',['cyclers']],['AROUND L1 & L2',['halo1','halo2','lyap1','lyap2']],['AROUND L4 & L5',['l4','l5']],['EARTH & LUNAR ORBITS',['leo','gto','geo','llo','dro']],['TRANSPORT & SPACE',['manifold','torus','cylinder','globe']],['PROPOSED ECONOMIC FLOWS',['apollo','glaser','oneill']],['MARS & INTERPLANETARY',['marsOrbit','marsLinks','phobos','deimos','capture','surface']]];
const nodeRows=[
 ['KSC','Kennedy Space Center',.06,-.03,'earth','Launch, integration and ground logistics. This is an Earth surface endpoint, not an orbital state.'],
 ['PAC','Pacific recovery',-.20,.10,'earth','A conceptual Earth-return recovery endpoint. Entry, descent and landing are not propagated in this atlas.'],
 ['LEO','Low Earth orbit',.37,.37,'orbit','An Earth-orbit assembly and departure neighborhood. A node denotes an operational interface, not a single fixed location in inertial space.'],
 ['GTO','Geostationary transfer orbit',.05,1.03,'orbit','An elliptical Earth transfer regime, included as a reference logistics interface.'],
 ['GEO','Geostationary orbit',.04,1.82,'orbit','A potential destination for communications, servicing and other orbital infrastructure.'],
 ['EML1','Earth–Moon L1',1.02,.04,'lagrange','A staging-region reference between Earth and Moon. Practical assets would operate in selected nearby orbits, not simply park motionless.'],
 ['EML2','Earth–Moon L2',2.05,.27,'lagrange','A lunar-farside staging-region reference. Candidate onward routes depend on timing, propulsion and arrival conditions.'],
 ['EML4','Earth–Moon L4',1.18,1.62,'lagrange','The leading triangular-point region; shown separately from L5 instead of the combined EML4/5 label in the reference image.'],
 ['EML5','Earth–Moon L5',1.18,-.72,'lagrange','The trailing triangular-point region. Its location here is schematic; Map shows the physical Earth–Moon geometry.'],
 ['LLO','Low lunar orbit',1.62,.45,'orbit','The interface between lunar transfer vehicles and descent or ascent operations.'],
 ['LSP','Lunar south pole',1.52,-.13,'small','A candidate surface logistics and resource-processing region. No extraction capacity or economic feasibility is assumed.'],
 ['DCO','Deimos capture / rendezvous',3.30,2.16,'orbit','A placeholder for mission-specific operations near Deimos. The Sun, Mars and the moon’s weak gravity matter for actual navigation.'],
 ['DEIM','Deimos surface',3.57,2.50,'small','A surface destination on Mars’ outer moon. Potential resource operations are speculative.'],
 ['LMO','Low Mars orbit',4.00,1.75,'orbit','A staging, science or communications neighborhood around Mars. Capture, orbital maintenance and entry requirements are not calculated in network mode.'],
 ['GC','Gale Crater',4.31,2.10,'mars','The Mars surface reference destination named in your supplied diagram. Its inclusion is not a recommendation for a settlement site.'],
 ['PCO','Phobos capture / rendezvous',3.81,1.19,'orbit','A placeholder for approach and rendezvous near Phobos. A stable capture orbit cannot be inferred from the node alone.'],
 ['PHOB','Phobos surface',4.34,.98,'small','A surface destination on Mars’ inner moon. Surface and rendezvous logistics are kept separate.']
];
const nodes=nodeRows.map(r=>({id:r[0],name:r[1],p:[r[2],r[3],0],type:r[4],text:r[5]})), nodeBy=Object.fromEntries(nodes.map(n=>[n.id,n]));
const routeRows=[['KSC','LEO','local'],['LEO','PAC','local'],['LEO','GTO','local'],['GTO','GEO','local'],['LEO','EML1','local'],['LEO','EML2','local'],['LEO','LLO','local'],['EML1','LLO','local'],['EML2','LLO','local'],['LLO','LSP','local'],['LSP','EML2','local'],['EML2','EML4','local'],['EML2','EML5','local'],['EML4','GEO','local'],['EML5','GEO','local'],['LEO','LMO','interplanetary'],['EML1','LMO','interplanetary'],['EML2','LMO','interplanetary'],['EML2','DCO','interplanetary'],['EML2','PCO','interplanetary'],['GEO','DCO','interplanetary'],['GTO','PCO','interplanetary'],['EML4','DCO','interplanetary'],['EML5','PCO','interplanetary'],['LMO','GC','mars'],['LMO','PCO','mars'],['LMO','DCO','mars'],['DCO','DEIM','mars'],['PCO','PHOB','mars'],['PCO','DCO','mars'],['LMO','PAC','interplanetary'],['DCO','EML2','interplanetary']];
const routes=routeRows.map((r,i)=>({a:r[0],b:r[1],kind:r[2],bend:((i%5)-2)*.055,index:i}));
function buildUI(){
 $('#layer-list').innerHTML=groups.map((g,gi)=>`<details class="layer-group ${gi===6?'mars':''}" open><summary>${g[0]}</summary>${g[1].map(k=>`<div class="layer-row" style="--row-color:${defs[k][1]}"><input type="checkbox" id="layer-${k}" data-layer="${k}" ${layers[k]?'checked':''} aria-label="Show ${defs[k][0]}"><button data-info="${k}">${defs[k][0]}</button><span class="count">${MODEL.orbits.filter(o=>o.group===k).length||''}</span></div>`).join('')}${gi===6?'<p class="layer-note">Select Mars above to expand the network.<br>Dashed links are proposed logistics.</p>':''}</details>`).join('');
 $('#node-select').innerHTML+=[...nodes].map(n=>`<option value="${n.id}">${n.id} — ${n.name}</option>`).join('');
 $$('[data-layer]').forEach(el=>el.onchange=()=>{layers[el.dataset.layer]=el.checked;if(el.dataset.layer==='manifold'&&el.checked)ensureManifolds();if(groups[6][1].includes(el.dataset.layer)&&state.view!=='mars')setView('mars');updateStatus()});
 $$('[data-info]').forEach(el=>el.onclick=()=>showLayer(el.dataset.info));
 $$('[data-view]').forEach(el=>el.onclick=()=>setView(el.dataset.view));
 $$('[data-preset]').forEach(el=>el.onclick=()=>preset(el.dataset.preset));
 $$('[data-mars]').forEach(el=>el.onclick=()=>{state.marsMode=el.dataset.mars;setView('mars')});
 $('#node-select').onchange=e=>{if(e.target.value)showNode(e.target.value)};
 $('#play').onclick=()=>{state.playing=!state.playing;syncPlay()};
 $('#time').oninput=e=>state.time=Number(e.target.value);$('#time-reset').onclick=()=>state.time=0;
 $('#speed').onchange=e=>state.speed=Number(e.target.value);
 for(const k of ['motion','labels','grid','glow'])$('#'+k).onchange=e=>state[k]=e.target.checked;
 $('#reset').onclick=()=>setView(state.view);$('#zoom-in').onclick=()=>zoom(.8);$('#zoom-out').onclick=()=>zoom(1.25);
 $('#open-layers').onclick=()=>$('#sidebar').classList.toggle('open');$('#close-layers').onclick=()=>$('#sidebar').classList.remove('open');
 $('#close-info').onclick=clearInfo;$('#guide').onclick=()=>$('#guide-dialog').showModal();$('#close-guide').onclick=()=>$('#guide-dialog').close();
 $('#guide-dialog').onclick=e=>{if(e.target===$('#guide-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close()}};
 $('#export').onclick=()=>{const a=document.createElement('a');a.download='cislunar-atlas-v2-'+state.view+'.png';a.href=cv.toDataURL('image/png');a.click();toast('Saved the current visualization.')};
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){$('#sidebar').classList.remove('open');clearInfo()}if(e.target===cv){if(e.key==='+'||e.key==='=')zoom(.85);if(e.key==='-')zoom(1.18)}});
 syncPlay();
}
function syncPlay(){$('#play').textContent=state.playing?'Ⅱ':'▶';$('#play').setAttribute('aria-label',state.playing?'Pause animation':'Play animation')}
function toast(text){$('#toast').textContent=text;$('#toast').classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').classList.remove('visible'),2500)}
function preset(p){for(const k of Object.keys(layers))if(!groups[6][1].includes(k))layers[k]=false;
 if(p==='atlas')for(const k of ['cyclers','halo1','halo2','l4','l5','dro','leo','geo','llo'])layers[k]=true;
 if(p==='garden'){for(const k of ['cyclers','halo1','halo2','lyap1','lyap2','l4','l5','dro','manifold','torus'])layers[k]=true;ensureManifolds()}
 if(p==='commerce'){for(const k of ['apollo','glaser','oneill','leo','geo','llo'])layers[k]=true}
 if(p==='clear')for(const k of Object.keys(layers))layers[k]=false;
 syncLayers();updateStatus();}
function syncLayers(){$$('[data-layer]').forEach(el=>el.checked=!!layers[el.dataset.layer])}
function setView(view){state.view=view;state.selected=null;clearInfo();document.body.classList.toggle('mars-view',view==='mars');
 $$('[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===view);b.setAttribute('aria-pressed',String(b.dataset.view===view))});
 $('#mars-tools').hidden=view!=='mars';if(view==='mars')$('#layer-list').scrollTop=0;$$('[data-mars]').forEach(b=>b.classList.toggle('active',b.dataset.mars===state.marsMode));
 $('#intro').hidden=view==='moon'||view==='3d';
 if(view==='mars'){
  target=state.marsMode==='network'?{x:1.85,y:.90,z:0,span:5.9,pitch:0,yaw:0}:{x:0,y:0,z:0,span:4.25,pitch:.22,yaw:0};
  $('#frame').textContent=state.marsMode==='network'?'INTERPLANETARY SUPPLY NETWORK · COMPRESSED SCALE':'SUN-CENTERED REFERENCE · IDEALIZED LAUNCH CYCLE';
  $('#intro').innerHTML='<div class="eyebrow">EARTH · MOON · MARS</div><h2>The next<br>connected worlds.</h2><p>17 logistics nodes. One possible network.<br>Dashed routes are concepts, not flight plans.</p>';
  $('#intro').hidden=state.marsMode==='solar';
  $('#legend').textContent=state.marsMode==='network'?'● Surface  ◇ Orbital  ◉ Lagrange  ·  Dashed: conceptual transfers':'Circular reference orbits · Ideal Hohmann transfer · Not an ephemeris';
 }else{
  target={x:view==='moon'?1:0,y:0,z:0,span:view==='moon'?.58:2.9,pitch:view==='3d'?.95:0,yaw:view==='3d'?-.25:0};
  $('#frame').textContent='EARTH–MOON ROTATING FRAME · NUMERICAL MODEL';
  $('#intro').innerHTML='<div class="eyebrow">EARTH · MOON · POSSIBILITY</div><h2>Gravity draws<br>the first roads.</h2><p>A living map of model orbits.<br>Choose <b>Mars</b> to see the wider network.</p>';
  $('#legend').innerHTML='<span class="line-key"></span>Calculated CR3BP paths · Dashed: reference geometry';
 }
 $('#hint').textContent=view==='3d'?'Drag to rotate · Scroll or pinch to zoom':'Drag to pan · Scroll or pinch to zoom · Tap a point';
 if(reduced)Object.assign(camera,target);updateStatus();
}
function updateStatus(){const n=paths.filter(p=>layers[p.group]).length;$('#status').textContent=state.view==='mars'?`${visibleNodes().length} nodes · ${visibleRoutes().length} candidate links`:`${n} model tracks · Earth–Moon system`}
function clearInfo(){$('#info').hidden=true;state.selected=null;$('#node-select').value=''}
function showInfo(type,title,body,meta){$('#info-type').textContent=type;$('#info-title').textContent=title;$('#info-body').textContent=body;$('#info-meta').innerHTML=meta||'';$('#info-actions').innerHTML='';$('#info').hidden=false}
function showLayer(k){state.selected=null;const list=paths.filter(p=>p.group===k);showInfo(groups[6][1].includes(k)?'MARS & INTERPLANETARY':'ORBITAL LAYER',defs[k][0],defs[k][2],list.length?`${list.length} numerical examples.<br>${list[0].periodic?'Periodic solutions verified by independent integration.':'Finite-time samples; no exact closure claim.'}`:'Explanatory geometry / architecture.');
 const toggle=document.createElement('button');toggle.textContent=layers[k]?'Hide layer':'Show layer';toggle.onclick=()=>{layers[k]=!layers[k];if(k==='manifold'&&layers[k])ensureManifolds();syncLayers();showLayer(k);updateStatus()};$('#info-actions').append(toggle);
 if(groups[6][1].includes(k)){const b=document.createElement('button');b.textContent='Open Mars';b.onclick=()=>setView('mars');$('#info-actions').append(b)}
 if(list.length){const b=document.createElement('button');b.textContent='Equations & state';b.onclick=()=>{const p=list[0];$('#info-meta').innerHTML=`<div class="eq">ẍ = 2ẏ + x − (1−μ)(x+μ)/r₁³ − μ(x−1+μ)/r₂³\nÿ = −2ẋ + y − (1−μ)y/r₁³ − μy/r₂³\nz̈ = −(1−μ)z/r₁³ − μz/r₂³\nμ = ${MU}\n\nExample: ${p.label}\nq₀ = [${p.q.map(v=>v.toPrecision(11)).join(', ')}]\nT = ${p.T.toFixed(8)} model units\n${p.periodic?'Closure error: '+p.closure.toExponential(2):'Finite integration interval, not a repeat period.'}\n\nLength unit: ${MODEL.length_km.toFixed(3)} km\nTime unit: ${MODEL.time_seconds.toFixed(3)} s</div>`};$('#info-actions').append(b)}
}
function showNode(id){const n=nodeBy[id];state.selected=id;$('#node-select').value=id;const connected=visibleRoutes().filter(e=>e.a===id||e.b===id);showInfo('SUPPLY-CHAIN NODE · '+id,n.name,n.text,`<b>${connected.length} visible candidate connections</b><br>${connected.map(e=>e.a+' ↔ '+e.b).join('<br>')}<br><br>Network location is schematic.`);state.selected=id;const b=document.createElement('button');b.textContent='Show all connections';b.onclick=clearInfo;$('#info-actions').append(b)}
function showRoute(e){showInfo('CANDIDATE TRANSPORT RELATIONSHIP',e.a+' → '+e.b,`A conceptual logistics connection between ${nodeBy[e.a].name} and ${nodeBy[e.b].name}. This curve is not a calculated trajectory. Its feasibility, energy, transit time and payload capacity require a dated mission design.`,`Type: ${e.kind}.<br>Markers show connectivity, not travel speed.`)}
function visibleNodes(){if(state.view!=='mars')return[];return nodes.filter(n=>{
 if(['KSC','PAC','LSP','GC','PHOB','DEIM'].includes(n.id)&&!layers.surface)return false;
 if(['LMO','GC','PCO','PHOB','DCO','DEIM'].includes(n.id)&&!layers.marsOrbit)return false;
 if(['PCO','PHOB'].includes(n.id)&&!layers.phobos)return false;
 if(['DCO','DEIM'].includes(n.id)&&!layers.deimos)return false;
 if(['LMO','PCO','DCO'].includes(n.id)&&!layers.capture)return false;return true})}
function visibleRoutes(){const ids=new Set(visibleNodes().map(n=>n.id));return routes.filter(e=>ids.has(e.a)&&ids.has(e.b)&&(e.kind!=='interplanetary'||layers.marsLinks))}
// Dormand–Prince 5(4), adaptive local error, all six rotating-frame states.
function deriv(q){const [x,y,z,u,v,w]=q,r1=Math.hypot(x+MU,y,z)**3,r2=Math.hypot(x-1+MU,y,z)**3;return[u,v,w,2*v+x-(1-MU)*(x+MU)/r1-MU*(x-1+MU)/r2,-2*u+y-(1-MU)*y/r1-MU*y/r2,-(1-MU)*z/r1-MU*z/r2]}
function integrate(q0,T,stopAtSurface=false){let q=q0.slice(),t=0,h=Math.sign(T)*.003,steps=0;const out=[{t:0,q:q.slice()}];
 const coeff=[[],[1/5],[3/40,9/40],[44/45,-56/15,32/9],[19372/6561,-25360/2187,64448/6561,-212/729],[9017/3168,-355/33,46732/5247,49/176,-5103/18656],[35/384,0,500/1113,125/192,-2187/6784,11/84]];
 const b4=[5179/57600,0,7571/16695,393/640,-92097/339200,187/2100,1/40];
 while(Math.abs(t)<Math.abs(T)-1e-12&&steps++<50000){if(Math.abs(h)>Math.abs(T-t))h=T-t;let k=[deriv(q)];for(let i=1;i<7;i++){const qi=q.map((v,j)=>v+h*coeff[i].reduce((s,a,m)=>s+a*k[m][j],0));k.push(deriv(qi))}
 const next=q.map((v,j)=>v+h*coeff[6].reduce((s,a,m)=>s+a*k[m][j],0));let err=0;
 for(let j=0;j<6;j++){const low=q[j]+h*b4.reduce((s,a,m)=>s+a*k[m][j],0);err=Math.max(err,Math.abs(next[j]-low)/(2e-12+2e-10*Math.max(Math.abs(q[j]),Math.abs(next[j]))))}
 if(!Number.isFinite(err))throw Error('Non-finite integration state');
 if(err<=1){q=next;t+=h;out.push({t,q:q.slice()});if(stopAtSurface&&(Math.hypot(q[0]+MU,q[1],q[2])<.01637||Math.hypot(q[0]-1+MU,q[1],q[2])<.00446))break}
 h*=Math.min(3,Math.max(.15,.9*Math.pow(Math.max(err,1e-12),-.2)));if(Math.abs(h)> .04)h=Math.sign(h)*.04;if(Math.abs(h)<1e-10)break;
 }
 return out;
}
async function calculate(){try{for(let i=0;i<MODEL.orbits.length;i++){const p=MODEL.orbits[i];paths.push({...p,samples:integrate(p.q,p.T)});if(i%5===0)await new Promise(r=>setTimeout(r,0))}ready=true;$('#loading').hidden=true;updateStatus()}catch(e){$('#loading').textContent='The numerical renderer could not initialize. '+e.message;console.error(e)}}
async function ensureManifolds(){if(manifoldReady)return;manifoldReady=true;toast('Calculating approach and departure branches…');for(let i=0;i<MODEL.manifolds.length;i++){const p=MODEL.manifolds[i];paths.push({...p,samples:integrate(p.q,p.T,true)});if(i%4===0)await new Promise(r=>setTimeout(r,0))}updateStatus()}
function sample(p,time){const a=p.samples,T=a[a.length-1].t;let t=((time/TU)%Math.abs(T))/Math.abs(T)*T;if(!p.periodic){const f=(time/TU/Math.abs(T))%2;t=(f<=1?f:2-f)*T}let lo=0,hi=a.length-1;const sign=Math.sign(T);while(hi-lo>1){const m=(lo+hi)>>1;if(a[m].t*sign<t*sign)lo=m;else hi=m}const u=(t-a[lo].t)/(a[hi].t-a[lo].t||1);return a[lo].q.slice(0,3).map((v,j)=>v+(a[hi].q[j]-v)*u)}
function resize(){const r=cv.getBoundingClientRect();W=r.width;H=r.height;dpr=Math.min(devicePixelRatio||1,2);cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);ctx.setTransform(dpr,0,0,dpr,0,0)}
new ResizeObserver(resize).observe($('#viewport'));
function project(p){let x=p[0]-camera.x,y=p[1]-camera.y,z=(p[2]||0)-camera.z;const cy=Math.cos(camera.yaw),sy=Math.sin(camera.yaw),cp=Math.cos(camera.pitch),sp=Math.sin(camera.pitch);const a=x*cy-y*sy,b=x*sy+y*cy;const yy=b*cp-z*sp,zz=b*sp+z*cp;const scale=Math.min(W/camera.span,H/(camera.span*.86))*.91;const persp=1/(1+zz/(camera.span*3));return[W*.52+a*scale*persp,H*.55-yy*scale*persp,scale*persp,zz]}
function line(points,color,alpha=1,width=1,dash=[]){if(!points.length)return;ctx.save();ctx.globalAlpha=alpha;ctx.strokeStyle=color;ctx.lineWidth=width;ctx.setLineDash(dash);ctx.beginPath();for(let i=0;i<points.length;i++){const p=project(points[i]);if(i===0)ctx.moveTo(p[0],p[1]);else ctx.lineTo(p[0],p[1])}ctx.stroke();ctx.restore()}
function text(label,p,color='#c8d7e0',size=11,dx=0,dy=-14){const a=project(p);ctx.save();ctx.font=`${size}px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif`;ctx.textAlign='center';ctx.fillStyle=color;ctx.shadowColor='#070f1c';ctx.shadowBlur=6;ctx.fillText(label,a[0]+dx,a[1]+dy);ctx.restore()}
function dot(p,color,r=2,alpha=1){const a=project(p);ctx.save();ctx.globalAlpha=alpha;ctx.fillStyle=color;if(state.glow){ctx.shadowColor=color;ctx.shadowBlur=8}ctx.beginPath();ctx.arc(a[0],a[1],r,0,TAU);ctx.fill();ctx.restore()}
function circle(center,r,zFactor=0){return Array.from({length:161},(_,i)=>{const a=i/160*TAU;return[center[0]+r*Math.cos(a),center[1]+r*Math.sin(a),r*zFactor*Math.sin(a*2)]})}
const textures={};function planetTexture(kind){if(textures[kind])return textures[kind];const c=document.createElement('canvas');c.width=c.height=160;const g=c.getContext('2d'),r=76;g.translate(80,80);g.beginPath();g.arc(0,0,r,0,TAU);g.clip();let seed=kind.length*1893;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};const colors=kind==='earth'?['#305c8c','#467f91']:kind==='mars'?['#cc7850','#e2aa77']:kind==='sun'?['#f8c876','#f5e7a7']:['#999993','#c0beb0'];g.fillStyle=colors[0];g.fillRect(-80,-80,160,160);
 if(kind==='earth'){const land=[[-.55,-.60,-.30,-.70,-.05,-.48,-.13,-.25,-.35,-.13,-.42,.04,-.62,-.12],[-.3,.04,-.10,.08,.03,.35,-.15,.73,-.27,.44],[.12,-.62,.42,-.64,.68,-.42,.76,-.15,.47,-.03,.28,-.20,.12,-.1],[.14,-.16,.40,-.07,.47,.26,.26,.57,.14,.19],[.53,.44,.72,.33,.85,.56,.61,.66]];g.fillStyle='#778f71';for(const p of land){g.beginPath();for(let i=0;i<p.length;i+=2)i?g.lineTo(p[i]*80,p[i+1]*80):g.moveTo(p[i]*80,p[i+1]*80);g.closePath();g.fill()}g.strokeStyle='#d4e7e55c';g.lineWidth=3;for(let i=0;i<6;i++){g.beginPath();g.ellipse((rand()-.5)*70,(rand()-.5)*110,25+rand()*40,4+rand()*6,-.3,0,TAU);g.stroke()}}
 else if(kind!=='sun'){for(let i=0;i<170;i++){const x=(rand()-.5)*160,y=(rand()-.5)*160,rr=1+rand()*11;g.fillStyle=i%2?'#352d2e28':'#fff1d01a';g.beginPath();g.ellipse(x,y,rr,rr*.85,rand(),0,TAU);g.fill()}if(kind==='mars'){g.fillStyle='#e9d9bf88';g.beginPath();g.ellipse(-5,-70,24,8,.2,0,TAU);g.fill()}}
 const shade=g.createRadialGradient(-32,-35,5,18,10,104);shade.addColorStop(0,'#ffffff22');shade.addColorStop(.45,'#00000000');shade.addColorStop(1,'#000b');g.fillStyle=shade;g.fillRect(-80,-80,160,160);textures[kind]=c;return c}
function planet(p,r,kind,label){const a=project(p);ctx.save();if(state.glow){ctx.shadowColor=kind==='earth'?'#548cc344':kind==='mars'?'#dc875344':'#bad0cb22';ctx.shadowBlur=r*.6}ctx.drawImage(planetTexture(kind),a[0]-r,a[1]-r,r*2,r*2);ctx.restore();if(state.labels&&label)text(label,p,kind==='mars'?'#f0cab4':'#dbe7ef',12,0,r+17)}
function random(seed){let s=seed;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296}}
const rng=random(3107),stars=Array.from({length:170},()=>[rng(),rng(),rng()]);
function background(){ctx.clearRect(0,0,W,H);for(const [x,y,b] of stars){ctx.globalAlpha=.12+b*.3;ctx.fillStyle='#bbd2e1';ctx.fillRect(x*W,y*H,b>.9?1.5:1,b>.9?1.5:1)}ctx.globalAlpha=1;const g=ctx.createRadialGradient(W*.6,H*.5,0,W*.6,H*.5,Math.max(W,H)*.6);g.addColorStop(0,state.view==='mars'?'#9a613309':'#5796ae0d');g.addColorStop(1,'#0000');ctx.fillStyle=g;ctx.fillRect(0,0,W,H)}
function drawVolumes(){if(state.grid){line([[-1.35,0,0],[1.5,0,0]],'#42616f',.22,.6);line([[0,-1.3,0],[0,1.3,0]],'#42616f',.22,.6);line(circle([0,0],1),'#477080',.25,.6,[2,6])}
 if(layers.globe){for(let k=0;k<9;k++){const a=k*Math.PI/9;line(Array.from({length:121},(_,i)=>{const t=i/120*TAU;return[1.3*Math.cos(t)*Math.cos(a),1.3*Math.cos(t)*Math.sin(a),1.3*Math.sin(t)]}),'#6c8c9d',.13,.6)}}
 if(layers.cylinder){for(const z of [-.5,.5])line(circle([0,0],1.3).map(p=>[p[0],p[1],z]),'#7a9b9e',.23,.7);for(let i=0;i<12;i++){const a=i/12*TAU;line([[1.3*Math.cos(a),1.3*Math.sin(a),-.5],[1.3*Math.cos(a),1.3*Math.sin(a),.5]],'#7a9b9e',.12,.6)}}
 if(layers.torus){for(let i=0;i<18;i++){const a=i/18*TAU;line(Array.from({length:71},(_,j)=>{const t=j/70*TAU,r=1+.2*Math.cos(t);return[r*Math.cos(a),r*Math.sin(a),.2*Math.sin(t)]}),'#82ada6',.15,.6)}for(let k=0;k<6;k++){const t=k/6*TAU;line(circle([0,0],1+.2*Math.cos(t)).map(p=>[p[0],p[1],.2*Math.sin(t)]),'#82ada6',.15,.6)}}}
function drawNumerical(network=false){for(const p of paths){if(!layers[p.group])continue;const col=defs[p.group][1],isMan=p.group==='manifold';const coords=p.samples.map(s=>[(s.q[0]+MU)*(network?1.5:1),s.q[1]*(network?1.5:1),s.q[2]*(network?1.5:1)]);line(coords,col,network?.15:isMan?.20:p.group==='cyclers'?.75:.38,isMan?.65:p.group==='cyclers'?1.15:.8);if(!network&&state.motion){const q=sample(p,state.time);dot([q[0]+MU,q[1],q[2]],col,isMan?1:1.8,isMan?.5:1)}}}
function drawReferences(){const list=[['leo',0,6778/MODEL.length_km,.064],['geo',0,42164/MODEL.length_km,.9973],['llo',1,1837.1/MODEL.length_km,.083]];for(const [k,c,r,T] of list){if(!layers[k])continue;line(circle([c,0],r),defs[k][1],.6,.8,[3,3]);if(state.motion){const a=TAU*state.time/T;dot([c+r*Math.cos(a),r*Math.sin(a),0],defs[k][1],1.5)}}if(layers.gto){const rp=6778/MODEL.length_km,ra=42164/MODEL.length_km,a=(ra+rp)/2,e=(ra-rp)/(ra+rp);line(Array.from({length:161},(_,i)=>{const t=i/160*TAU;return[a*(Math.cos(t)-e),a*Math.sqrt(1-e*e)*Math.sin(t),0]}),defs.gto[1],.6,.8,[3,3])}}
function curve(a,b,bend=.1){return Array.from({length:61},(_,i)=>{const t=i/60,s=Math.sin(Math.PI*t);return[a[0]+(b[0]-a[0])*t-(b[1]-a[1])*bend*s,a[1]+(b[1]-a[1])*t+(b[0]-a[0])*bend*s,(a[2]||0)+((b[2]||0)-(a[2]||0))*t]})}
function drawCommerce(){const pos={leo:[.03,0,0],llo:[1,.02,0],lsp:[1,0,0],l2:[1.16783,0,0],l4:[.5,.866,0],l5:[.5,-.866,0],geo:[.108,0,0]};for(const [key,pairs]of [['apollo',[['leo','llo'],['llo','lsp']]],['glaser',[['lsp','l2'],['l2','geo']]],['oneill',[['lsp','l2'],['l2','l4'],['l2','l5']]]]){if(!layers[key])continue;for(const [a,b]of pairs){const pts=curve(pos[a],pos[b],.13);line(pts,defs[key][1],.7,1,[5,5]);if(state.motion)dot(pts[Math.floor((state.time*.04%1)*60)],defs[key][1],2)}}}
function drawLocal(){drawVolumes();drawNumerical();drawReferences();drawCommerce();const eqs=[['L1',.8369151257723572+MU,0],['L2',1.155682165444884+MU,0],['L3',-1.005062645810278+MU,0],['L4',.5,Math.sqrt(3)/2],['L5',.5,-Math.sqrt(3)/2]];for(const [name,x,y]of eqs){const p=[x,y,0],a=project(p);dot(p,'#91d8ca',3);if(state.labels)text(name,p,'#b2e5d8',11,0,name==='L5'?20:-13);picks.push({x:a[0],y:a[1],r:12,action:()=>showInfo('EARTH–MOON EQUILIBRIUM',name,name==='L4'||name==='L5'?'Triangular equilibrium in the circular restricted three-body model. Nearby model librations do not imply an existing facility.':'Collinear equilibrium in the circular restricted three-body model. Useful nearby orbits generally need navigation and stationkeeping.',`Earth-centered model coordinates: ${x.toFixed(6)}, ${y.toFixed(6)}, 0.`)})}
 planet([0,0,0],state.view==='moon'?Math.max(10,project([0,0,0])[2]*.0164):14,'earth','Earth');planet([1,0,0],state.view==='moon'?18:8,'moon','Moon');}
const nc={earth:'#79a9fa',small:'#b8e896',mars:'#ed8a6f',orbit:'#e4cf79',lagrange:'#c1a2ec'};
function drawNetwork(){if(state.grid){line([[-.35,-.92,0],[4.7,-.92,0]],'#526577',.2,.6);for(let i=0;i<11;i++){let x=-.35+i*.5;line([[x,-.94,0],[x,-.90,0]],'#526577',.3,.6)}}drawNumerical(true);
 // Local reference rings are metro-map glyphs, not physical orbital dimensions.
 for(const r of [.25,.5,.85])line(circle([0,0],r).map(p=>[p[0],p[1]*.65,p[2]]),'#557d9f',.22,.7,[2,5]);line(circle([1.5,-.13],.45),'#819988',.25,.7,[2,5]);
 if(layers.marsOrbit){for(const r of [.28,.48,.76])line(circle([4.24,1.93],r).map(p=>[p[0],1.93+(p[1]-1.93)*.62,p[2]]),'#a17b62',.24,.7,[2,5])}
 for(const e of visibleRoutes()){const a=nodeBy[e.a].p,b=nodeBy[e.b].p,pts=curve(a,b,e.bend);const selected=!state.selected||e.a===state.selected||e.b===state.selected;const col=e.kind==='interplanetary'?'#d5a98a':e.kind==='mars'?'#c0c9aa':'#8badbc';line(pts,col,selected?(state.selected?.92:.34):.065,selected&&state.selected?1.5:.8,[3,5]);if(state.motion&&selected){const idx=Math.floor(((state.time*.022+e.index*.076)%1)*60);dot(pts[idx],col,1.7,.8)}routePicks.push({points:pts.filter((_,i)=>i%5===0).map(project),route:e})}
 planet([0,-.12,0],W<600?27:37,'earth','Earth');planet([1.5,-.22,0],W<600?16:22,'moon','Moon');if(layers.marsOrbit)planet([4.3,2.08,0],W<600?29:42,'mars','Mars');
 if(layers.marsOrbit&&layers.phobos)planet([4.4,.99,0],W<600?9:13,'phobos','Phobos');if(layers.marsOrbit&&layers.deimos)planet([3.62,2.57,0],W<600?8:12,'deimos','Deimos');
 for(const n of visibleNodes()){const a=project(n.p),sel=state.selected===n.id;ctx.save();ctx.globalAlpha=state.selected&&!sel?.62:1;ctx.fillStyle='#0b1521';ctx.strokeStyle=nc[n.type];ctx.lineWidth=sel?2.3:1.4;if(state.glow){ctx.shadowColor=nc[n.type];ctx.shadowBlur=sel?14:7}ctx.beginPath();if(n.type==='orbit'){ctx.moveTo(a[0],a[1]-5);ctx.lineTo(a[0]+5,a[1]);ctx.lineTo(a[0],a[1]+5);ctx.lineTo(a[0]-5,a[1]);ctx.closePath()}else ctx.arc(a[0],a[1],sel?6:4.5,0,TAU);ctx.fill();ctx.stroke();ctx.restore();if(state.labels){const offset={KSC:[12,18],PAC:[-10,-12],LSP:[20,17],GC:[23,-12],PHOB:[-20,21],DEIM:[-14,-18],EML5:[0,19]};const [dx,dy]=offset[n.id]||[0,-13];text(n.id,n.p,sel?'#fff0da':nc[n.type],W<550?9:10,dx,dy)}picks.push({x:a[0],y:a[1],r:12,action:()=>showNode(n.id),id:n.id})}
}
function drawSolar(){const rE=1,rM=1.523679,a=(rE+rM)/2,e=(rM-rE)/(rM+rE),tof=365.256/2*a**1.5,phase=Math.PI-TAU*tof/686.98,t=state.time%tof;line(circle([0,0],rE),'#7ba9d1',.55,1);if(layers.marsOrbit)line(circle([0,0],rM),'#dba181',.65,1);const transfer=Array.from({length:241},(_,i)=>{const E=i/240*Math.PI;return[a*(Math.cos(E)-e),a*Math.sqrt(1-e*e)*Math.sin(E),0]});if(layers.marsLinks){line(transfer,'#dfd4b2',.8,1.2,[5,4]);let M=Math.PI*t/tof,E=M;for(let j=0;j<9;j++)E-=(E-e*Math.sin(E)-M)/(1-e*Math.cos(E));dot([a*(Math.cos(E)-e),a*Math.sqrt(1-e*e)*Math.sin(E),0],'#fff5cc',3)}const thE=TAU*t/365.256,thM=phase+TAU*t/686.98;planet([0,0,0],18,'sun','Sun');planet([Math.cos(thE),Math.sin(thE),0],10,'earth','Earth');if(layers.marsOrbit)planet([rM*Math.cos(thM),rM*Math.sin(thM),0],9,'mars','Mars');text('Ideal transfer ≈ '+tof.toFixed(0)+' days',[0,-1.8,0],'#d0b497',11);text('Initial Mars lead ≈ '+(phase*180/Math.PI).toFixed(1)+'°',[0,-1.95,0],'#8d9ca8',10);if(state.labels){text('1 AU',[.25,-.98,0],'#7195b0',9);text('1.524 AU',[.35,-1.5,0],'#ad866c',9)}}
function render(now){const dt=Math.min(.05,last?(now-last)/1000:0);last=now;if(state.playing&&ready)state.time=(state.time+dt*state.speed)%780;const a=reduced?1:1-Math.exp(-dt*6);for(const k of Object.keys(camera))camera[k]+=(target[k]-camera[k])*a;ctx.setTransform(dpr,0,0,dpr,0,0);background();picks=[];routePicks=[];if(ready){if(state.view==='mars'){if(state.marsMode==='solar')drawSolar();else drawNetwork()}else drawLocal()}$('#day').textContent='Day '+state.time.toFixed(1);if(document.activeElement!==$('#time'))$('#time').value=state.time;requestAnimationFrame(render)}
function zoom(f){target.span=Math.max(.12,Math.min(15,target.span*f))}
// Mouse, touch pan, 3D orbit, wheel zoom, and two-finger pinch.
const pointers=new Map();let drag=null,pinchDistance=0;
cv.addEventListener('pointerdown',e=>{cv.setPointerCapture(e.pointerId);pointers.set(e.pointerId,[e.clientX,e.clientY]);drag={x:e.clientX,y:e.clientY,total:0};if(pointers.size===2){const p=[...pointers.values()];pinchDistance=Math.hypot(p[0][0]-p[1][0],p[0][1]-p[1][1])}});
cv.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId)){hover=picks.find(p=>Math.hypot(p.x-e.offsetX,p.y-e.offsetY)<p.r);cv.style.cursor=hover?'pointer':state.view==='3d'?'grab':'crosshair';return}const prev=pointers.get(e.pointerId);pointers.set(e.pointerId,[e.clientX,e.clientY]);if(pointers.size===2){const p=[...pointers.values()],d=Math.hypot(p[0][0]-p[1][0],p[0][1]-p[1][1]);if(pinchDistance>0&&d>0)zoom(pinchDistance/d);pinchDistance=d;if(drag)drag.total=100;return}const dx=e.clientX-prev[0],dy=e.clientY-prev[1];if(drag)drag.total+=Math.abs(dx)+Math.abs(dy);if(state.view==='3d'){target.yaw+=dx*.006;target.pitch=Math.max(-1.5,Math.min(1.5,target.pitch+dy*.006))}else{const scale=project([0,0,0])[2];target.x-=dx/scale;target.y+=dy/scale}});
function pointerEnd(e){if(drag&&drag.total<7&&pointers.size===1){const r=cv.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top,p=picks.find(p=>Math.hypot(p.x-x,p.y-y)<p.r);if(p)p.action();else if(state.view==='mars'&&state.marsMode==='network'){let nearest=null,dist=7;for(const r of routePicks)for(const p of r.points){const d=Math.hypot(p[0]-x,p[1]-y);if(d<dist){nearest=r.route;dist=d}}if(nearest)showRoute(nearest);else clearInfo()}}pointers.delete(e.pointerId);if(!pointers.size)drag=null;pinchDistance=0}
cv.addEventListener('pointerup',pointerEnd);cv.addEventListener('pointercancel',e=>{pointers.delete(e.pointerId);drag=null});cv.addEventListener('wheel',e=>{e.preventDefault();zoom(Math.exp(e.deltaY*.001))},{passive:false});
// A small read-only test surface makes model and UI regression tests repeatable.
window.atlas={state,layers,camera,nodes,routes,get paths(){return paths},setView,integrate,visibleNodes,visibleRoutes,version:'2.0.0'};
buildUI();resize();setView('map');requestAnimationFrame(render);calculate();
})();
