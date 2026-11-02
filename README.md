# Cislunar Economy — Original Atlas

## [Open the original v1 Cislunar Atlas](https://jon-cislunar-atlas.jmernster7.chatgpt.site/)

The original hosted atlas is the version to preserve. The separate v2 reconstruction has been removed from the current branch at the owner's request. Its previous commits remain in Git history; it is no longer the application served by this branch.

## Current repository status

This branch contains a launch page pointing to the original hosted v1, **not the v1 application source**. The original application, textures, and numerical orbit catalog were never committed to this GitHub repository. The hosted site may require access through its owner's account. This repository does not change that access.

**The corrected v2 (v1 plus Mars) has not been released.** The original source must be available before the extension can be integrated and checked. The saved site record was located, but its source cannot be exported through the tools available for this edit. No replacement orbit model or redesigned interface is being substituted for v1.

## Required scope of the corrected v2

- Preserve the original v1 orbit data, equations, renderer, appearance, animation, descriptions, sidebar controls, and existing layer selections.
- Keep Map as the default. Preserve the original 3D and Moon views.
- Replace Wide with Mars. Its first view must pull back to display the existing cislunar orbital web toward the lower-left and the additional Mars orbital neighborhood toward the upper-right, together in one continuous scene.
- Add Mars layers to the existing sidebar without replacing the cislunar layers.
- Returning to Map must restore the original camera framing and retain the user's cislunar selections and animation state.
- A supply-chain diagram must not replace this orbital scene. Any visual compression of interplanetary distances, reference-frame changes, or schematic connections must be identified rather than presented as exact trajectory calculations.

## Hosting

`index.html` is the original launch redirect. It points to the original v1 site; it does not contain or recreate that application. GitHub Pages, if enabled for this branch, serves this redirect rather than the rejected rebuild. No new v2 live-site URL is being claimed.

This is an independent project, not an official NASA, Blue Origin, or U.S. government product.
