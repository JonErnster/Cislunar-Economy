# Cislunar Atlas 02 — Earth to Mars

An interactive, dependency-free orbital atlas and proposed interplanetary supply-chain explorer. **This repository now contains a working app, not a redirect.**

## Version two

The opening view is always **Map**. The top navigation is **Map | 3D | Moon | Mars**; Mars replaces the former Wide view.

- **Map** shows the Earth–Moon rotating-frame orbital geometry.
- **3D** allows rotation of the numerical paths and optional torus, cylinder and globe overlays.
- **Moon** focuses on the lunar neighborhood.
- **Mars** smoothly pulls back to a compressed Earth–Moon–Mars logistics network. A **Mars & Interplanetary** category moves to the top of the sidebar, with switches for Mars, Phobos, Deimos, capture nodes, surface links and interplanetary connections.

The Mars view includes **17 reference nodes and 32 candidate links**. It separates EML4 and EML5 rather than combining them. Nodes include Kennedy Space Center, Pacific recovery, LEO, GTO, GEO, EML1/2/4/5, low lunar orbit, the lunar south pole, low Mars orbit, Gale Crater, Phobos and Deimos, and their capture/rendezvous neighborhoods. Click a point or use the destination selector to inspect its role and connections.

Within Mars, **Supply network** shows the proposed logistics architecture. **Solar orbits** switches to a separate idealized, Sun-centered Earth–Mars Hohmann-transfer illustration. The two views do not pretend to share a single physical scale or reference frame.

## Run it

Download this repository as a ZIP, extract it, and open `index.html` in a current browser. The app uses local `styles.css`, `model.js` and `app.js`, with no runtime packages, API keys, remote fonts, texture downloads or backend. Alternatively, serve the folder with `python -m http.server 8000`.

To create one portable HTML file, run:

```sh
python build_standalone.py
```

This writes `cislunar-atlas-v2.html`, embedding the styles, model seeds and JavaScript. On phones, a hosted web URL is generally more convenient than an HTML file preview.

## Public website

GitHub Pages had not been enabled when v2 was committed. The source code is public; that alone does not activate the website.

Open [Settings → Pages](https://github.com/JonErnster/Cislunar-Economy/settings/pages). Choose **Deploy from a branch**, then **main** and **/(root)**, and save. After GitHub reports a successful deployment, the expected website address is:

`https://jonernster.github.io/Cislunar-Economy/`

The root `index.html` serves the atlas directly. It no longer forwards visitors to a private ChatGPT site.

## Controls

Drag to pan in Map, Moon and Mars. Drag to rotate in 3D. Scroll or pinch to zoom. The bottom controls pause, scrub and change model-time speed. Tap a layer name for an explanation and, where available, an example state vector and governing equations. On smaller screens, **Layers** opens the sidebar. The desktop **Save view** button exports the canvas as a PNG.

## Scientific scope and provenance

**This is an educational model, not mission-design or flight-navigation software.**

The original hosted v1 source was unavailable during this update. Version two is a new standalone implementation with independently calculated examples, not a recovery of the original 71-record dataset. The [original hosted v1 atlas](https://jon-cislunar-atlas.jmernster7.chatgpt.site/) remains linked and unchanged; it may require sign-in.

The v2 model includes:

| Model component | Records |
| --- | ---: |
| L1/L2 northern and southern halo solutions | 20 |
| L1/L2 planar Lyapunov solutions | 6 |
| Distant retrograde solutions | 3 |
| Classical Arenstorf-type Earth–Moon circuit | 1 |
| Finite-time L4/L5 libration samples | 8 |
| Approximate stable/unstable manifold branches | 48 |

Periodic initial states are independently corrected by symmetry shooting and checked using SciPy DOP853 integration. The browser propagates them with an adaptive Dormand–Prince 5(4) integrator. The seed-generation checks record state closure and Jacobi drift. The browser regression test separately checks periodic closure to a nondimensional tolerance of `1e-5`; this is a visualization test, not a flight accuracy guarantee. L4/L5 samples are explicitly **not** asserted to close. Finite nonperiodic tracks are retraced by the animation for display.

The Earth–Moon CR3BP assumes point masses and circular primary motion. Solar perturbations, eccentricity, lunar mascons, maneuvers and real ephemerides are omitted. LEO/GTO/GEO/LLO rings are simplified references. Bodies are visually enlarged. The torus, cylinder and globe are illustrative envelopes, not official dynamical boundaries. The classical cycler shown here is distinct from the recent stable prograde cycler families discussed in the background literature.

**Every dashed Mars-network route is a schematic candidate relationship, not a solved transfer or verified operating service.** The network compresses distances to make nodes legible. PCO and DCO denote mission-dependent capture/rendezvous neighborhoods, not universal stable orbits. Surface resource extraction and industrial facilities are hypothetical. The diagram is not an exhaustive transcription of every obscured line in the reference photograph.

The solar inset uses circular, coplanar reference orbits and an ideal Hohmann transfer; its animation is not tied to a calendar date. Apollo, Glaser and O’Neill layers represent proposed logistics architectures, not unique exact trajectories.

## Reproduce and test

```sh
python -m pip install -r requirements.txt
python build_model.py
python -m playwright install chromium
python test_browser.py
```

`build_model.py` regenerates `model-seeds.json` and `model.js`. Numerical-library versions can produce small differences in corrected seeds and eigenvectors. `test_browser.py` uses Playwright with inlined local content; set `CHROMIUM_PATH` to use an installed Chromium executable. It checks default Map, all four view labels, 17 Mars nodes, 32 links, Phobos visibility, manifold generation, periodic closure and layouts at 1440, 390 and 320 pixels. Initial testing reported no JavaScript errors or horizontal overflow. Mobile-width Chromium tests do not establish testing on physical iPhones or Safari.

## Sources

- [NASA/JPL periodic-orbit API: equations, units and family conventions](https://ssd-api.jpl.nasa.gov/doc/periodic_orbits.html).
- [NASA Basics of Space Flight: interplanetary trajectories](https://science.nasa.gov/learn/basics-of-space-flight/chapter4-1/).
- [JPL planetary-satellite orbital elements](https://ssd.jpl.nasa.gov/sats/elem/).
- [Ross and Roberts-Tsoukkas, 2025: prograde Earth–Moon cycler research](https://www.ross.aoe.vt.edu/papers/ross-roberts-tsoukkas-2025-AAS-25-621.pdf), for background, not the classical cycler seeds rendered here.

The logistics vocabulary follows Jon’s supplied “Interplanetary Supply Chain Network” reference image. That photograph is not redistributed. Decorative planet textures are generated by the app and are not scientific imagery. This independent project is not affiliated with NASA, Blue Origin or the U.S. government.
