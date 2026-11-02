"""Generate small, verified CR3BP examples, not mission ephemerides."""
import json, numpy as np
from scipy.integrate import solve_ivp
from scipy.optimize import root
MU=0.01215058560962404

def f(t,q):
 x,y,z,u,v,w=q
 r1=((x+MU)**2+y*y+z*z)**1.5
 r2=((x-1+MU)**2+y*y+z*z)**1.5
 return [u,v,w,2*v+x-(1-MU)*(x+MU)/r1-MU*(x-1+MU)/r2,-2*u+y-(1-MU)*y/r1-MU*y/r2,-(1-MU)*z/r1-MU*z/r2]

def flow(q,t,dense=False):
 return solve_ivp(f,[0,t],q,rtol=2e-11,atol=2e-13,method='DOP853',dense_output=dense)

def halo(z,seed):
 def fun(p):
  x,v,h=p
  if h<.2 or h>5: return np.ones(3)*100
  q=flow([x,0,z,0,v,0],h).y[:,-1]
  return q[[1,3,5]]
 sol=root(fun,seed,tol=1e-10)
 x,v,h=sol.x
 q=[x,0,z,0,v,0]
 close=np.linalg.norm(flow(q,2*h).y[:,-1]-q)
 print('HALO',z,sol.success,sol.x,'close',close,flush=True)
 return sol.x,q,2*h,close

if __name__=='__main__':
 for z,seed in [(.03,[.823,.14,1.37]),(.06,[.82,.17,1.37]),(.04,[1.18,-.16,1.7]),(.10,[1.12,.2,1.7]),(-.18,[1.02,-.1,.75])]:
  try: halo(z,seed)
  except Exception as e: print(e)
