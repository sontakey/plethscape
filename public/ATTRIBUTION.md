# Plethscape anatomy attribution

BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International.

- Data: BodyParts3D release 4.0, `isa_BP3D_4.0_obj_99.zip`.
- Source: https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html
- Current license notice: https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html
- Terms: https://creativecommons.org/licenses/by/4.0/
- Adaptations: selected structures, a common coordinate transformation, browser optimization, curated system groups, tissue materials, cutaway presentation and illustrative animation.

Lung geometry: Kristen Browne and Heidi Schlehlein (2024), **3D Reference Organ for Lung, Male v1.4**, Human Reference Atlas / HuBMAP, CC BY 4.0.

- DOI: https://doi.org/10.48539/HBM532.KLZD.394
- Source: https://lod.humanatlas.io/ref-organ/lung-male/v1.4/
- Terms: https://creativecommons.org/licenses/by/4.0/
- Adaptations: lobar geometry selected, positioned with BodyParts3D, optimized, shaded and animated. This is a separate Visible Human Male reference, not the same individual as BodyParts3D.

These sources do not endorse Plethscape. Anatomical geometry and simulated physiology have separate provenance. The application supplies synthetic PPG, flow cues, breathing and movement.

Human Atlas (https://github.com/ashemag/human-atlas) supplied the user-requested explorer reference and display-system classification reference. Its anatomy has the BodyParts3D license above; its original classification material has the following license.

## Human Atlas MIT License

Copyright (c) 2026 ashemag

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Neutral presentation skin

`models/neutral-skin.glb` is adapted from BodyParts3D FJ2810 under the same CC BY 4.0 license. Custom processing changes the hand pose, reconstructs the forearm surface, removes external reproductive contours, and remeshes the skin for interactive display. See `scripts/build_neutral_skin.py`.

## Scanned presentation heads

The two presentation-head assets are adapted from Renderpeople free rigged models. They are not covered by the application's MIT license or the anatomy assets' CC BY 4.0 license.

- `public/models/scanned-head.glb` is adapted from **Eric Rigged 001**, © Renderpeople. Official source collection: https://renderpeople.com/free-3d-people/. Model reference: https://free3d.com/3d-model/eric-rigged-001-771956.html.
- `public/models/scanned-head-female.glb` is adapted from **Claudia Rigged 002**, © Renderpeople. Official source collection: https://renderpeople.com/free-3d-people/. Model reference: https://free3d.com/3d-model/claudia-rigged-002-167206.html.
- Adaptations: head extraction, neck fitting, subdivision, texture cropping and resizing, material changes, browser compression, and, for Claudia, clothing removal and ponytail isolation.
- Renderpeople terms: https://renderpeople.com/general-terms-and-conditions/. The standard terms permit rendering uses but restrict transfer, learning-environment implementation, and direct or easy third-party access to the 3D data. Public source-repository distribution therefore requires separate express written consent from Renderpeople. Do not reuse or redistribute these GLB files based on this repository's MIT or CC BY notices.

The heads are separate photographic scans, not the individuals represented by the internal anatomy. Renderpeople does not endorse Plethscape.

## Draco decoder

`public/models/draco/draco_decoder.js`, `draco_decoder.wasm`, and `draco_wasm_wrapper.js` are byte-for-byte copies of the glTF decoder files distributed with three.js 0.186.0. They are Google Draco software under the Apache License 2.0, not Plethscape MIT code. Source: https://github.com/google/draco. The complete license text is distributed at [`public/models/draco/LICENSE`](models/draco/LICENSE).

## Sensor Bio marks

`src/assets/sensorbio-wordmark.svg`, the Sensor Bio name and logo, and their appearance in screenshots are Sensor Bio trademarks and brand assets. They are not licensed under the Plethscape MIT license. No trademark rights are granted by this repository.
