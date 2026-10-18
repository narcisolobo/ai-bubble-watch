---
name: AI Bubble Watch
description: A one-page dashboard reading AI-overheating indicators like river gauges against Normal, Watch and Alert stages.
colors:
  ground: "#ffffff"
  ink: "#20262e"
  muted: "#59626e"
  rule: "#d8dde3"
  hydrograph-blue: "#1f5fa8"
  normal-tint: "#eef3f8"
  watch-tint: "#f7ecbf"
  alert-tint: "#eab8b2"
  watch-edge: "#a8841f"
  alert-edge: "#b4544a"
  ground-dark: "#111418"
  ink-dark: "#e7eaee"
  muted-dark: "#a0a9b5"
  rule-dark: "#2b323b"
  hydrograph-blue-dark: "#74b0f0"
  normal-tint-dark: "#16202b"
  watch-tint-dark: "#443a16"
  alert-tint-dark: "#57292c"
  watch-edge-dark: "#c9a640"
  alert-edge-dark: "#d9776c"
typography:
  display:
    fontFamily: "system-ui, -apple-system, \"Segoe UI\", Roboto, \"Helvetica Neue\", sans-serif"
    fontSize: "3rem"
    fontWeight: 750
    lineHeight: 1
    letterSpacing: "-0.03em"
    fontFeature: "tnum"
  headline:
    fontFamily: "system-ui, -apple-system, \"Segoe UI\", Roboto, \"Helvetica Neue\", sans-serif"
    fontSize: "1.375rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  title:
    fontFamily: "system-ui, -apple-system, \"Segoe UI\", Roboto, \"Helvetica Neue\", sans-serif"
    fontSize: "1.125rem"
    fontWeight: 650
    lineHeight: 1.2
  body:
    fontFamily: "system-ui, -apple-system, \"Segoe UI\", Roboto, \"Helvetica Neue\", sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "tnum"
  body-small:
    fontFamily: "system-ui, -apple-system, \"Segoe UI\", Roboto, \"Helvetica Neue\", sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "system-ui, -apple-system, \"Segoe UI\", Roboto, \"Helvetica Neue\", sans-serif"
    fontSize: "0.75rem"
    fontWeight: 650
    lineHeight: 1
  tick:
    fontFamily: "system-ui, -apple-system, \"Segoe UI\", Roboto, \"Helvetica Neue\", sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 600
    lineHeight: 1
    fontFeature: "tnum"
rounded:
  hairline: "1px"
  tag: "2px"
  chip: "4px"
  dot: "50%"
spacing:
  xxs: "4px"
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "20px"
  xl: "24px"
  xxl: "28px"
  section: "32px"
  section-wide: "40px"
  page-end: "48px"
components:
  status-chip-normal:
    backgroundColor: "{colors.normal-tint}"
    textColor: "{colors.ink}"
    rounded: "{rounded.chip}"
    padding: "3px 10px 3px 8px"
    typography: "{typography.body-small}"
  status-chip-watch:
    backgroundColor: "{colors.watch-tint}"
    textColor: "{colors.ink}"
    rounded: "{rounded.chip}"
    padding: "3px 10px 3px 8px"
  status-chip-alert:
    backgroundColor: "{colors.alert-tint}"
    textColor: "{colors.ink}"
    rounded: "{rounded.chip}"
    padding: "3px 10px 3px 8px"
  flag-stale:
    textColor: "{colors.ink}"
    rounded: "{rounded.chip}"
    padding: "2px 10px"
  attention-banner:
    backgroundColor: "{colors.alert-tint}"
    textColor: "{colors.ink}"
    rounded: "{rounded.chip}"
    padding: "8px 12px"
  gauge-staff:
    backgroundColor: "{colors.normal-tint}"
    width: "14px"
    height: "64px"
  gauge-staff-wide:
    width: "18px"
    height: "160px"
  chart:
    backgroundColor: "{colors.normal-tint}"
    height: "152px"
  chart-wide:
    height: "184px"
  level-label-watch:
    backgroundColor: "{colors.watch-tint}"
    textColor: "{colors.ink}"
    rounded: "{rounded.tag}"
    padding: "2px 5px"
    typography: "{typography.label}"
  level-label-alert:
    backgroundColor: "{colors.alert-tint}"
    textColor: "{colors.ink}"
    rounded: "{rounded.tag}"
    padding: "2px 5px"
    typography: "{typography.label}"
  latest-label:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    rounded: "{rounded.tag}"
    padding: "2px 5px"
  gap-card:
    textColor: "{colors.muted}"
    rounded: "{rounded.chip}"
    padding: "10px 12px"
  disclosure-summary:
    textColor: "{colors.ink}"
    padding: "6px 0"
---

# Design System: AI Bubble Watch

## Overview

**Creative North Star: "The River Gauge"**

Every indicator is read the way a hydrologist reads a river: the latest observation against marked stages for Normal, Watch and Alert. The page refuses the KPI-tile grid with a badge and a bare sparkline. Instead, stage bands sit behind every chart, a gauge staff stands for every reading, and the threshold values are written on the staff and the plot as graduations, so where a reading sits and how close it is to the next stage are visible before any number is read.

The world is a field instrument on white paper: ink type, one saturated colour (hydrograph blue) reserved for the measured data, and pale, low-chroma stage tints that read as bands rather than warnings. It is calm by design. An Alert band is a tint, not a siren; the tone stays level even when a reading is in its highest stage. Density is single-column and editorial, capped at 46rem, with type and rules doing the structural work instead of cards and shadows.

Light and dark follow the system. Dark mode keeps the same roles and raises the stage tints enough to stay distinguishable from one another and from the ground.

**Key Characteristics:**
- One saturated colour, hydrograph blue, for the data line, latest-reading dot and staff marker only.
- Three stage tints (normal, watch, alert), each paired with a darker edge colour drawn as the threshold line.
- Gauge staffs with tick numerals, on the same y-range as their chart.
- System sans throughout, tabular figures everywhere.
- Flat: hairline rules, 4px chips, no elevation.
- Every state is spoken in words as well as colour.

## Colors

A cool neutral ink-on-white palette with one hydrograph blue and three pale stage tints that carry meaning only together with words.

### Primary
- **Hydrograph Blue** (`hydrograph-blue`; `hydrograph-blue-dark` in dark mode): the measured series, the latest-reading dot at the line's right end, and the level marker across each gauge staff. Nothing else.

### Secondary
- **Watch Straw** (`watch-tint`, dark `watch-tint-dark`): the Watch band on charts and staffs, the Watch status chip, the Watch level label. Also the text-selection colour.
- **Alert Clay** (`alert-tint`, dark `alert-tint-dark`): the Alert band, Alert chip and level label, and the summary banner that lists failed or stale indicators.
- **Normal Mist** (`normal-tint`, dark `normal-tint-dark`): the Normal band, which is the chart plot's own ground and the bottom of every staff; the Normal chip.

### Tertiary
- **Watch Brass** (`watch-edge`, dark `watch-edge-dark`): the 1px Watch threshold line across the chart and staff; the Watch chip border.
- **Alert Brick** (`alert-edge`, dark `alert-edge-dark`): the 1px Alert threshold line; the Alert chip border; the dashed border of stale and fetch-failed flags.

### Neutral
- **Paper** (`ground`, dark `ground-dark`): the page ground; also the halo ring that lifts the dot, staff marker and latest-value tag off the bands.
- **Gauge Ink** (`ink`, dark `ink-dark`): all headings, values, links, disclosure summaries, staff outline, tick numerals, focus ring.
- **Slate** (`muted`, dark `muted-dark`): descriptions, as-of dates, axis labels, captions, the secondary dashed series (EBP), the chart baseline, table head rule, gap-card borders.
- **Hairline** (`rule`, dark `rule-dark`): section and card dividers, table rules, neutral chip borders.

### Named Rules
**The Data-Only Blue Rule.** Hydrograph blue marks the measurement and nothing else. Links, disclosure summaries, focus and buttons are ink. If blue appears on something that is not a reading, it is wrong.

**The Tint-and-Edge Rule.** Each stage is a pale fill plus a darker edge drawn exactly at its threshold. The tint says "this region", the edge says "this line"; never use one without the other's meaning.

**The Never-Colour-Alone Rule.** Status, stale and fetch-failed are always in words ("Status: Watch", "Stale", "Fetch failed"); colour and the chip's three-segment stage mark only reinforce them.

## Typography

**Display Font:** system-ui (with -apple-system, Segoe UI, Roboto, Helvetica Neue, sans-serif)
**Body Font:** the same system stack
**Label/Mono Font:** the same stack with tabular figures; no monospace face

**Character:** one native sans, carried by weight (400 to 750) and size rather than by a second face; it reads like the instrument's own printing. This is an owner decision: no web font is loaded.

### Hierarchy
- **Display** (750, 3rem, line-height 1, -0.03em): the current reading on each card. The single largest thing on the page.
- **Page title** (750, 1.5rem rising to 1.75rem at 40rem, -0.01em): the product name only.
- **Gauge value** (700, 1.375rem rising to 1.75rem, line-height 1.1): the reading beside each staff on the gauge board.
- **Headline** (700, 1.375rem, -0.01em): scenario section headings.
- **Title** (650, 1.125rem): indicator names on cards.
- **Body** (400, 1rem/1.5): descriptions, capped at 62ch.
- **Body small** (400, 0.875rem): summary counts, as-of lines, change lines, method text, status chips (650).
- **Caption** (0.8125rem): flags, table text, card footers, page footer, gauge stage word (650).
- **Label** (650, 0.75rem, line-height 1): chart level labels, latest-value tag (700), axis and legend labels (400, slate), gauge descriptions.
- **Tick** (600, 0.6875rem, line-height 1): threshold numerals on the gauge staff.

Weights sit on a 400 / 600 / 650 / 700 / 750 ladder; 650 is the working "strong" weight for labels and terms.

### Named Rules
**The Tabular Figures Rule.** `font-variant-numeric: tabular-nums` is set on the body and inherited everywhere. Numbers must align in tables, ticks and readings.

**The One Face Rule.** Hierarchy comes from weight and size inside the system stack. Do not add a second family.

## Layout

A single centred column, max-width 46rem, with 16px side padding (24px from 40rem up) and 48px at the foot. The order is fixed: compact header with status counts and refresh time; the gauge board between two hairlines; scenario sections each holding indicator cards; the list of uncovered scenarios; the disclaimer footer.

Spacing runs on 4px steps: 4 and 8 inside components, 12 and 16 between related items, 20 and 28 around cards and charts, 32 between sections (40 at 40rem and up).

The one breakpoint is **40rem**. Below it, each gauge stacks: a 64px staff with tick numerals to its left, then value, stage word and description beneath; three gauges stay in a three-column grid. At 40rem and above, each staff stands 160px tall on the left with the words beside it, the chart grows from 152px to 184px, and method definition lists become a two-column 11rem / fluid grid.

Each chart keeps its own time span; the gauge staff shares its chart's y-range, stated in the caption "Scale matches the chart below."

## Elevation & Depth

Flat. There are no drop shadows. Depth comes from tonal stage bands and hairline rules. The only `box-shadow` values are zero-offset halo rings that cut a marker out of the bands beneath it.

### Shadow Vocabulary
- **Marker halo** (`box-shadow: 0 0 0 2px var(--ground)` on the chart dot; `0 0 0 1.5px var(--ground)` on the staff marker): separates the blue reading from tints and threshold lines.
- **Tag ring** (`box-shadow: 0 0 0 1px var(--rule)`): outlines the latest-value tag that floats above the dot.

### Named Rules
**The Paper Rule.** Surfaces never lift. If something needs separation, use a ground-coloured halo or a hairline, never an offset shadow.

## Shapes

Square and instrument-like. Radii are small and functional: 4px for chips, flags, the attention banner and gap cards; 2px for floating chart tags and the focus ring; 1px on the staff marker bar; a circle only for the latest-reading dot. The staff itself is an unrounded 1px ink-outlined rectangle. Borders are 1px. A **dashed** border always means absence or caveat: no threshold set, no data, stale, fetch failed, scenario not yet covered.

## Components

### Gauge Staff (signature)
A narrow upright bar, 1px ink outline, filled bottom-up with normal mist, a 1px watch-brass edge, watch straw, a 1px alert-brick edge, alert clay. Stage positions come from `--watch`, `--alert`, `--latest` (percent from the bottom). A 4px hydrograph-blue bar crosses the staff 5px past each side at the latest reading, with a ground halo. Tick numerals (watch and alert values) sit to the left with a 4px tick line. The alert stage is drawn as tall as the watch stage. The staff is `aria-hidden` because it repeats the chart. Known limit: the gradient assumes higher-is-worse, and on the 64px phone staff tick numerals touch if the watch band is under about 18% of its range.

### Stage Chart (signature)
A plot on normal mist with a 1px slate baseline. Watch and Alert bands are SVG rects (direction-agnostic), with 1px edge lines at each threshold. The series is hydrograph blue at 2.25px, non-scaling, round joins; a secondary series is slate, 1.25px, dashed 4 3. The latest reading is a 10px blue dot at the right end with a 2px ground halo, labelled just above by a ground tag with a hairline ring. Level labels ("Watch ≥ 75.0%") sit at left on their band's tint so the line passes behind them. Axis start and end dates and an optional legend sit 6px below in slate.

### Status Chip
- **Style:** inline, 4px radius, 1px hairline border, 0.875rem at 650 weight, ink text, led by a 6×16px three-segment stage mark (bottom, middle, top segments for normal, watch, alert; the current segment in ink, the others at 35% ink).
- **State:** normal gets normal mist; watch gets watch straw with a watch-brass border; alert gets alert clay with an alert-brick border; no threshold and no data get a dashed border and no tint.

### Flags
Stale and fetch-failed flags are words in a 4px-radius pill with a 1px dashed alert-brick border, 0.8125rem at 650. No fill.

### Attention Banner
When the summary lists failed or stale indicators, that line becomes an alert clay block (8px 12px padding, 4px radius) with ink text and links to the cards. An all-clear line stays plain slate text.

### Links
Ink text with a 1px slate underline offset 0.18em; on hover the underline turns ink and thickens to 2px. Gauge-board links drop the underline and add it to the description on hover.

### Disclosure ("How this is measured")
An ink summary at 650 weight led by a 6px CSS chevron drawn from two 2px borders, rotating from -45° to 45° on open over 160ms `cubic-bezier(0.16, 1, 0.3, 1)` (no transition under reduced motion). Hover underlines. Inside: slate prose, definition lists, and tables at 0.8125rem with hairline row rules, a slate head rule and right-aligned tabular numbers.

### Gap Card
Each uncovered scenario is a slate-text block with a 1px dashed slate border, 4px radius, 10px 12px padding.

### Focus
2px solid ink outline, 2px offset, 2px radius, on every focusable element.

## Do's and Don'ts

### Do:
- **Do** put every reading against its stages: a tinted band and an edge line for each threshold, on the chart and on the staff.
- **Do** keep hydrograph blue to the data line, the latest-reading dot and the staff marker.
- **Do** say every status, stale and failed state in words; tint, border and the three-segment stage mark only reinforce it.
- **Do** use a dashed border for absence or caveat (no threshold, no data, stale, failed, uncovered) and a solid one for everything else.
- **Do** keep the gauge staff on its chart's y-range, and draw the alert stage as tall as the watch stage.
- **Do** use the system sans with tabular figures and build hierarchy from the 400 to 750 weight ladder.
- **Do** separate markers from bands with a ground-coloured halo ring.

### Don't:
- **Don't** colour links, summaries or controls in hydrograph blue; they are ink.
- **Don't** call a stage "flood"; the stages are Normal, Watch and Alert.
- **Don't** add drop or offset shadows, elevated cards, or a second typeface.
- **Don't** rely on colour alone for any state.
- **Don't** saturate the stage tints into warning colours; an alert is information, not an alarm.
- **Don't** assume the staff gradient or the chart dot handle lower-is-worse indicators; they are built for higher-is-worse, and only the SVG bands are direction-agnostic.
