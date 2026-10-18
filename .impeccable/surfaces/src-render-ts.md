---
version: 1
slug: "src-render-ts"
primary_target: "src/render.ts"
related_targets: ["src/view.ts"]
---

# Surface: the dashboard page (`dist/index.html`)

**Mode:** Operate, with a Read layer one tap down.

**Audience and job:** the owner scans for a crossed threshold in seconds, usually on a phone. Shared-link newcomers need every term explained and the method one tap away.

**Constraints:** static HTML, CSS inline in `renderPage`, no JS. Style through `data-status`, `data-stale`, `data-fetch-failed` and keep the markup semantic. System font stack. Light and dark follow the system. No state is signalled by colour alone.

**Memorable moment:** the gauge board. Three staffs show where each reading sits against its stages before any number is read.

**Unresolved:** headroom above Alert on the staff/chart range is the builder's to choose, but it must be the same rule for every indicator.

## Direction contract

THESIS: Every indicator is read like a river gauge: the latest observation against stages for Normal, Watch, and Alert. It refuses the KPI-tile grid with a badge and a bare sparkline.

OWN-WORLD: White ground, ink #20262e, hydrograph blue #1f5fa8 is the only saturated colour, used for the data line and markers. Pale stage tints (watch #f7ecbf, alert #eab8b2) with dark-mode equivalents that still read as stages. Gauge staffs with tick numerals. System sans with tabular figures. Stages are never called "flood".

STORY: The visitor sees which stage each reading is in, sees how close it is to the next stage, then opens "How this is measured" to see the threshold reasoning and source.

FIRST VIEWPORT: On a phone: a compact header (name, refresh time, status counts). Below it, a gauge board of three staffs, each with a marker, the value, and the stage in text, on the chart's y-range ("Scale matches the chart below"). Then card one: value at 48px, a stage label with a glyph, the as-of date and change, and the chart on stage bands with the latest point as a labelled dot.

FORM: River Gauge, #1 on the ordered list (IMPECCABLE’S PICK, chosen over the roll). seed:edf0a0f6ddf731be

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
