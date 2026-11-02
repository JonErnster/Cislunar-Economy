# Cislunar Economy — Interactive Orbital Atlas

[![Open the Interactive Cislunar Atlas](https://img.shields.io/badge/Launch-Interactive%20Cislunar%20Atlas-00aaff?style=for-the-badge)](https://jon-cislunar-atlas.jmernster7.chatgpt.site/)

**[▶ OPEN THE INTERACTIVE ATLAS](https://jon-cislunar-atlas.jmernster7.chatgpt.site/)**

Explore the Earth–Moon gravitational landscape in an interactive 3D visualizer. Examine Earth–Moon Lagrange points, halo and Lyapunov families, near-rectilinear halo orbits, distant retrograde orbits, resonant cyclers, and transfer manifolds. Toggle orbital layers, rotate the geometry, and study proposed lunar commercial pathways.

> **Access note:** The linked atlas was deployed in ChatGPT Sites with private access. It may require sign-in until that site is made public or a public GitHub Pages version is deployed. A GitHub repository URL cannot automatically redirect visitors to an external site; use the large launch link above, or enable Pages to serve the `index.html` redirect in this repository.

## Scientific scope

The orbital tracks in the previously built atlas include numerical solutions in the circular restricted three-body problem (CR3BP), while the proposed Apollo, Glaser, and O'Neill celestial lines of communication are conceptual logistics corridors, **not** uniquely determined exact orbital trajectories. The visualization is not a live ephemeris or flight-navigation tool.

## Source status

This repository currently contains the public project landing page and a redirect page. **The full atlas HTML bundle, JSON orbit records, numerical computation scripts, and other source assets have not yet been uploaded here.** Once the original project archive is available, it should be committed here with provenance and licenses.

## Suggested public hosting

In GitHub **Settings → Pages**, select **Deploy from a branch**, choose **main** and **/(root)**, then save. The `index.html` included here will redirect the Pages URL to the hosted atlas. It does not itself make a private atlas publicly accessible. For a truly public standalone experience, upload and host the atlas itself through GitHub Pages.

## References

- [NASA/JPL periodic orbits API](https://ssd-api.jpl.nasa.gov/doc/periodic_orbits.html)
- [NASA Lagrange points explanation](https://science.nasa.gov/solar-system/resources/faq/what-are-lagrange-points/)

This is an independent exploratory visualization and not an official NASA, Blue Origin, or U.S. government product.
