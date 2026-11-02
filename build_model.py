from generate_orbits import *
from pathlib import Path
rows=[]
def jacobi(q):
 x,y,z,u,v,w=np.asarray(q)
 return x*x+y*y+2*(1-MU)/np.sqrt((x+MU)**2+y*y+z*z)+2*MU/np.sqrt((x-1+MU)**2+y*y+z*z)-u*u-v*v-w*w

def add(group,label,q,T,periodic=True):
 q=np.array(q); r=flow(q,T,True); t=np.linspace(0,T,3000); Q=r.sol(t).T
 err=float(np.linalg.norm(Q[-1]-q)); jerr=float(np.max(np.abs(np.array([jacobi(a) for a in Q])-jacobi(q))))
 if periodic and err>1e-6: print('REJECT',label,err,flush=True);return
 record=dict(group=group,label=label,q=q.tolist(),T=float(T),periodic=periodic,closure=err,jacobi=float(jacobi(q)),jacobi_drift=jerr)
 rows.append(record); print('ADD',label,'err',err,'drift',jerr,flush=True)

# Halo continuation from symmetry shooting. Units of the JPL catalog.
for k,seed in [(1,[.823,.14,1.37]),(2,[1.18,-.16,1.7])]:
 for z in [.025,.05,.08,.115,.15]:
  sol,q,T,err=halo(z,seed)
  if err<1e-6:
   seed=sol;add('halo'+str(k),f'L{k} northern halo · z0={z}',q,T)
   qs=q.copy();qs[2]*=-1; qs[5]*=-1; add('halo'+str(k),f'L{k} southern halo · z0={-z}',qs,T)

# Planar symmetric periodic families, fixed starting x.
def planar(x,seed,group,label):
 def fun(p):
  v,h=p
  if h<.01 or h>30:return [100,100]
  return flow([x,0,0,0,v,0],h).y[[1,3],-1]
 sol=root(fun,seed,tol=5e-10);v,h=sol.x;q=[x,0,0,0,v,0]
 if h>.01 and h<30 and abs(v)>.0001:
  add(group,label,q,2*h)
 return sol.x
for x,v,h,k in [(.825,.105,1.35,1),(.815,.2,1.4,1),(.80,.3,1.5,1),(1.17,-.09,1.7,2),(1.185,-.18,1.7,2),(1.20,-.25,1.75,2)]:
 planar(x,[v,h],'lyap'+str(k),f'L{k} planar Lyapunov · x0={x}')
for x in [1.06,1.10,1.15]:
 r=x-(1-MU);planar(x,[-np.sqrt(MU/r)-r,np.pi/(np.sqrt(MU/r**3)+1)],'dro',f'Lunar distant retrograde · x0={x}')
# Classical Arenstorf-type periodic Earth–Moon circuit, corrected to MU above.
planar(.994,[-2.001585106379,17.06521656015796/2],'cyclers','Arenstorf-type Earth–Moon cycler')
# Small-amplitude libration trajectories near triangular equilibria (not claimed periodic).
for sign,name in [(1,'L4'),(-1,'L5')]:
 eq=np.array([.5-MU,sign*np.sqrt(3)/2,0.,0.,0.,0.]);eps=1e-6
 A=np.column_stack([(np.array(f(0,eq+np.eye(6)[j]*eps))-np.array(f(0,eq-np.eye(6)[j]*eps)))/(2*eps) for j in range(6)])
 vals,vecs=np.linalg.eig(A)
 for idx in [j for j,v in enumerate(vals) if v.imag>.01 and abs(v.imag-1)>.01]:
  vec=vecs[:,idx].real;vec/=np.linalg.norm(vec[:3]);freq=vals[idx].imag
  for amp in [.012,.025]:
   add(name.lower(),f'{name} {"long" if freq<.5 else "short"}-period libration sample',eq+amp*vec,2*np.pi/freq*2,False)

# Stable and unstable manifold seeds transported with an STM, using finite differences.
branches=[]
for group in ['halo1','halo2']:
 orb=next(o for o in rows if o['group']==group and o['q'][2]>.04)
 q=np.array(orb['q']);T=orb['T'];eps=2e-7
 base=flow(q,T,True)
 pert=[flow(q+np.eye(6)[j]*eps,T,True) for j in range(6)]
 M=np.column_stack([(p.sol(T)-base.sol(T))/eps for p in pert]);ev,V=np.linalg.eig(M)
 for kind,idx,direction in [('unstable',int(np.argmax(abs(ev))),1),('stable',int(np.argmin(abs(ev))),-1)]:
  eig=V[:,idx].real
  for t in np.linspace(0,T,6,endpoint=False):
   stm=np.column_stack([(p.sol(t)-base.sol(t))/eps for p in pert]);v=stm@eig;v/=np.linalg.norm(v[:3])
   for s in [-1,1]:
    qs=base.sol(t)+s*1e-5*v
    branches.append(dict(group='manifold',label=f'{group} {kind}',q=qs.tolist(),T=direction*5.5,periodic=False,kind=kind))

out={'version':'2.0.0','mu':MU,'length_km':389703.2648292776,'time_seconds':382981.2891290545,'model':'Earth–Moon CR3BP; point masses, circular primaries. No Sun, J2, mascons or ephemerides.','provenance':'Independent symmetry shooting and DOP853 verification; JPL normalizations. Not recovered v1 catalog.','orbits':rows,'manifolds':branches}
base=Path(__file__).resolve().parent
(base/'model-seeds.json').write_text(json.dumps(out,indent=2),encoding='utf-8')
(base/'model.js').write_text('/* Independently corrected CR3BP seeds. */\nconst MODEL = '+json.dumps(out,separators=(',',':'))+';\n',encoding='utf-8')
print('TOTAL',len(rows),len(branches),flush=True)
