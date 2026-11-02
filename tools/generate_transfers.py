"""Sampled Earth-Moon barycentre <-> Mars Lambert atlas.
JPL Table 1 approximate planetary elements; Sun-only zero/one-revolution
boundary-value solutions. Every retained arc is independently propagated
with DOP853 and checked for closure, invariants and revolution count.
"""
from pathlib import Path
from datetime import datetime, timedelta
import json, math, hashlib
import numpy as np
from scipy.optimize import brentq, minimize_scalar
from scipy.integrate import solve_ivp
ROOT = Path(__file__).resolve().parents[1]
AU = 149597870.7
DAY = 86400.0
GM = 132712440041.279419
MU = GM * DAY**2 / AU**3
VUNIT = AU / DAY
ELEMENTS = {
    'earth': ([1.00000261,.01671123,-.00001531,100.46457166,102.93768193,0],
              [.00000562,-.00004392,-.01294668,35999.37244981,.32327364,0]),
    'mars': ([1.52371034,.09339410,1.84969142,-4.55343205,-23.94362959,49.55953891],
             [.00001847,.00007882,-.00813131,19140.30268499,.44441088,-.29257343]),
}
EPOCH = datetime(2000,1,1,12)
TOFS = [90,120,150,180,210,240,270,300,330,360,420,480,600,720,900]

def position(body, jd):
    """Heliocentric AU at JD(TDB); Earth is the Earth-Moon barycentre."""
    b, rate = ELEMENTS[body]
    a,e,i,L,peri,node = np.array(b) + np.array(rate)*(jd-2451545)/36525
    i,L,peri,node = np.deg2rad([i,L,peri,node]); m=(L-peri+math.pi)%(2*math.pi)-math.pi
    E=m
    for _ in range(15):
        d=(E-e*math.sin(E)-m)/(1-e*math.cos(E)); E-=d
        if abs(d)<1e-14: break
    x=a*(math.cos(E)-e); y=a*math.sqrt(1-e*e)*math.sin(E)
    w=peri-node; cw,sw,cn,sn,ci,si=math.cos(w),math.sin(w),math.cos(node),math.sin(node),math.cos(i),math.sin(i)
    return np.array([(cw*cn-sw*sn*ci)*x+(-sw*cn-cw*sn*ci)*y,
                     (cw*sn+sw*cn*ci)*x+(-sw*sn+cw*cn*ci)*y,sw*si*x+cw*si*y])

def state(body, jd):
    h=.02
    v=(-position(body,jd+2*h)+8*position(body,jd+h)-8*position(body,jd-h)+position(body,jd-2*h))/(12*h)
    return position(body,jd),v

def stumpff(z):
    if abs(z)<1e-7:
        return .5-z/24+z*z/720-z**3/40320,1/6-z/120+z*z/5040-z**3/362880
    if z>0:
        s=math.sqrt(z); return 2*math.sin(s/2)**2/z,(s-math.sin(s))/(s**3)
    s=math.sqrt(-z); return (math.cosh(s)-1)/(-z),(math.sinh(s)-s)/(s**3)

def lambert(r0,r1,days,mu=MU,max_revs=0):
    """Prograde universal-variable solutions; two M=1 branches when present."""
    a0=float(np.linalg.norm(r0)); a1=float(np.linalg.norm(r1)); c=np.clip(np.dot(r0,r1)/(a0*a1),-1,1)
    if 1-abs(c)<1e-11: return []
    sign=1 if np.cross(r0,r1)[2]>=0 else -1
    A=sign*math.sqrt(a0*a1*(1+c))
    def timing(z):
        C,S=stumpff(float(z))
        if C<=0: return float('nan'),float('nan')
        y=a0+a1+A*(z*S-1)/math.sqrt(C)
        if y<0: return float('nan'),y
        return ((y/C)**1.5*S+A*math.sqrt(y))/math.sqrt(mu),y
    def residual(z):
        t,y=timing(z)
        return t-days if math.isfinite(t) else -days
    roots=[]
    lo=-1.0
    while residual(lo)>0 and lo>-400: lo*=2
    hi=4*math.pi**2-1e-5
    if residual(lo)<0 and residual(hi)>0:
        roots.append((brentq(residual,lo,hi,xtol=2e-12),0,'single'))
    for m in range(1,max_revs+1):
        left=(2*m*math.pi)**2+1e-4; right=(2*(m+1)*math.pi)**2-1e-4
        minimum=minimize_scalar(lambda z:timing(z)[0],bounds=(left,right),method='bounded',options={'xatol':1e-10})
        if minimum.success and minimum.fun<days-1e-8:
            for aa,bb,name in [(left,minimum.x,'lower-z'),(minimum.x,right,'upper-z')]:
                roots.append((brentq(residual,aa,bb,xtol=2e-12),m,name))
    out=[]
    for z,m,branch in roots:
        t,y=timing(z); f=1-y/a0; g=A*math.sqrt(y/mu); gd=1-y/a1
        if abs(g)<1e-12: continue
        v0=(r1-f*r0)/g; v1=(gd*r1-r0)/g
        out.append((v0,v1,m,branch,z,'short' if sign>0 else 'long'))
    return out

def propagate(r,v,days,n=97):
    def rhs(t,s):
        return np.r_[s[3:],-MU*s[:3]/np.linalg.norm(s[:3])**3]
    sol=solve_ivp(rhs,(0,days),np.r_[r,v],method='DOP853',rtol=2e-11,atol=2e-13,t_eval=np.linspace(0,days,n))
    if not sol.success: raise ValueError(sol.message)
    return sol.y.T

def roundvec(a,n=10): return np.round(a,n).tolist()

def main():
    for t,m in [(math.pi/2,0),(5*math.pi/2,1)]:
        solutions=lambert(np.array([1.,0,0]),np.array([0.,1,0]),t,mu=1,max_revs=m)
        assert min(np.linalg.norm(v-np.array([0.,1,0])) for v,_,rev,*_ in solutions if rev==m)<1e-8
    arcs=[]; attempted=0; candidates=0; failures=[]; filtered=0
    start=datetime(2026,1,1); end=datetime(2035,12,31)
    departure_dates=[]; dt=start
    while dt<=end:
        departure_dates.append(dt);dt+=timedelta(days=30)
    worst={'positionKm':0.,'velocityKmS':0.,'relativeEnergy':0.,'relativeAngularMomentum':0.}
    for direction,origin,dest in [('outbound','earth','mars'),('inbound','mars','earth')]:
        for date_index,dt in enumerate(departure_dates):
            jd=2451545+(dt-EPOCH).total_seconds()/DAY
            r0,pv0=state(origin,jd)
            for tof in TOFS:
                attempted+=1;r1,pv1=state(dest,jd+tof)
                try: solutions=lambert(r0,r1,tof,max_revs=int(tof>=600))
                except (ValueError,OverflowError) as exc:
                    failures.append({'departure':dt.date().isoformat(),'tof':tof,'reason':str(exc)});continue
                for v0,v1,revs,branch,z,way in solutions:
                    candidates+=1
                    vinf0=float(np.linalg.norm(v0-pv0)*VUNIT);vinf1=float(np.linalg.norm(v1-pv1)*VUNIT)
                    energy=float(np.dot(v0,v0)/2-MU/np.linalg.norm(r0))
                    angular=np.cross(r0,v0); ecc=np.cross(v0,angular)/MU-r0/np.linalg.norm(r0)
                    peri=float(np.dot(angular,angular)/(MU*(1+np.linalg.norm(ecc))))
                    if vinf0**2>225 or vinf1>16 or peri<.35:
                        filtered+=1;continue
                    try:
                        states=propagate(r0,v0,tof)
                        err=float(np.linalg.norm(states[-1,:3]-r1)*AU)
                        verr=float(np.linalg.norm(states[-1,3:]-v1)*VUNIT)
                        energies=np.sum(states[:,3:]**2,axis=1)/2-MU/np.linalg.norm(states[:,:3],axis=1)
                        eerr=float(np.max(np.abs(energies-energy))/max(abs(energy),1e-12))
                        herr=float(np.max(np.linalg.norm(np.cross(states[:,:3],states[:,3:])-angular,axis=1))/np.linalg.norm(angular))
                        u=r0/np.linalg.norm(r0);w=angular/np.linalg.norm(angular);v=np.cross(w,u)
                        angles=np.unwrap(np.arctan2(states[:,:3]@v,states[:,:3]@u))
                        measured=int(np.floor((angles[-1]-angles[0]+1e-8)/(2*math.pi)))
                        if err>1 or verr>1e-6 or eerr>1e-7 or herr>1e-8 or measured!=revs:
                            raise ValueError(f'closure={err:.6g} km, revolutions={measured}/{revs}, energy={eerr:.3g}')
                    except (ValueError,RuntimeError) as exc:
                        failures.append({'departure':dt.date().isoformat(),'tof':tof,'reason':str(exc)});continue
                    for k,val in zip(worst,[err,verr,eerr,herr]):worst[k]=max(worst[k],val)
                    dep_mu,dep_r=(398600.435507,6578.137) if origin=='earth' else (42828.3750111,3789.5)
                    arr_mu,arr_r=(398600.435507,6578.137) if dest=='earth' else (42828.3750111,3789.5)
                    arcs.append({'id':f'{direction[0].upper()}{date_index:03}-{tof}-{revs}-{branch}',
                        'direction':direction,'departure':dt.date().isoformat(),'arrival':(dt+timedelta(days=tof)).date().isoformat(),
                        'jd':jd,'tof':tof,'year':dt.year,'revs':revs,'branch':branch,'way':way,
                        'c3':round(vinf0**2,5),'vinfArrival':round(vinf1,5),
                        'injectionDv':round(math.sqrt(vinf0**2+2*dep_mu/dep_r)-math.sqrt(dep_mu/dep_r),5),
                        'captureDv':round(math.sqrt(vinf1**2+2*arr_mu/arr_r)-math.sqrt(arr_mu/arr_r),5),
                        'endpointErrorKm':round(err,7),'perihelionAu':round(peri,7),
                        'r0':roundvec(r0),'r1':roundvec(r1),'v0KmS':roundvec(v0*VUNIT),'v1KmS':roundvec(v1*VUNIT),
                        'points':np.round(states[:,:3],7).tolist()})
        print(direction,len(arcs),'verified arcs',flush=True)
    assert len(arcs)>100 and any(a['revs']==1 for a in arcs)
    arcs.sort(key=lambda x:(x['departure'],x['direction'],x['tof'],x['revs'],x['branch']))
    refs={b:[roundvec(position(b,2462502.5+d),7) for d in np.linspace(0,365.25636 if b=='earth' else 686.98,361)] for b in ELEMENTS}
    counts={'total':len(arcs),'outbound':sum(a['direction']=='outbound' for a in arcs),
            'inbound':sum(a['direction']=='inbound' for a in arcs),'oneRevolution':sum(a['revs']==1 for a in arcs)}
    meta={'schema':1,'title':'Earth–Moon–Mars transfer catalogue','model':'Sun-only Lambert, JPL approximate planetary elements',
          'originNote':'Earth denotes the Earth–Moon barycentre in the interplanetary calculation.',
          'frame':'Heliocentric J2000 ecliptic','positionUnit':'AU','velocityUnit':'km/s',
          'timeScale':'Calendar labels interpreted at 00:00 TDB; UTC conversion is not modeled.',
          'departureRange':['2026-01-01','2035-12-31'],'departureStepDays':30,'flightDays':TOFS,
          'maxRevolutions':1,'c3Limit':225,'arrivalVinfLimit':16,'minimumPerihelionAU':.35,
          'gmSunKm3s2':GM,'auKm':AU,'counts':counts,
          'sources':['https://ssd.jpl.nasa.gov/planets/approx_pos.html','https://ssd.jpl.nasa.gov/astro_par.html','https://esa.github.io/pykep/lambert.html'],
          'limitations':['Finite grid of prograde zero/one-revolution solutions, not all possible orbits.',
                         'Approximate planetary positions; not JPL Horizons or live ephemerides.',
                         'No lunar escape matching, low thrust, gravity assists, aerocapture, landing, or round-trip mission optimization.',
                         'Injection/capture estimates assume ideal impulsive circular parking orbits: Earth 200 km, Mars 400 km; plane changes omitted.',
                         'Gallery endpoint alignment changes the frame and scale independently per trajectory. Solar view uses one AU scale.',
                         'Numerical residuals are internal checks, not real-world navigation accuracy.']}
    dataset={'meta':meta,'arcs':arcs,'referenceOrbits':refs}
    (ROOT/'data').mkdir(exist_ok=True); (ROOT/'docs').mkdir(exist_ok=True)
    raw=json.dumps(dataset,separators=(',',':'),ensure_ascii=False).encode()
    (ROOT/'data/interplanetary.json').write_bytes(raw)
    report={'counts':counts,'boundaryProblems':attempted,'lambertCandidates':candidates,'outsideEnvelope':filtered,
            'validationFailures':len(failures),'failureExamples':failures[:10],'maxResiduals':worst,
            'checks':['quarter-circle known solution','one-revolution circular known solution','independent DOP853 closure for every retained arc','energy and angular momentum','actual angular revolution count'],
            'dataSha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw)}
    (ROOT/'docs/v3-numerical-verification.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2))
if __name__=='__main__':main()
