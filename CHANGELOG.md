# Changelog

## Version 2 — 2026-08-29

Kept version 1 as-is under `v1/`. Version 2 lives under `v2/` and is stacked above it on the hub page.

### Analysis of version 1

- HUD (`#score`, `#stats`) was `position: absolute` against the viewport, so it floated off the court inside an iframe.
- CSS used an 8px purple border plus a 4px white box-shadow; collision used the raw canvas edge. The ball could travel through the 75px crowd bands.
- Menus were rebuilt with `innerHTML` every frame. Held arrow keys skipped options. The options had `cursor: pointer` and did not accept clicks.
- Amateur / Tour / Pro shared one tracker. Pro used zero error and followed the ball every frame.
- Surfaces were solid fills. Paddles were rectangles. The net ran through the stands.

### UI

- HTML overlay menus with 48px click targets. Click or keyboard.
- `keydown.repeat` ignored on menus so a held key moves one step.
- HUD is a grid above the canvas, so it stays lined up in an iframe.
- Mouse and touch move the left paddle during play. WASD yields while the pointer is moving.
- Difficulty screen has a Back button. Esc steps back from difficulty, otherwise returns to the main menu.
- Short “Ready / Play” hold after each point so the serve is readable.

### Opponent

| Skill | Behaviour |
|---|---|
| Amateur | Slow, ~38-frame reaction, large aim error, occasional full miss, returns to centre when the ball is going away. |
| Tour | Club pace, modest bounce prediction, still leaves openings. |
| Pro | Reads wall bounces, faster acceleration, small persistent error (never zero), chases when the ball is leaving. |

### Graphics

- White (8px) and purple (18px) frame drawn on the canvas. Playable grass is `PLAY_TOP`…`PLAY_BOTTOM`. Ball and paddles cannot enter the stands.
- Tiled photographs: grass, purple seat cloth, light oak and dark walnut bats.
- Mowing stripes, tramlines, centre net with mesh, tennis-ball seam, crowd in three rows on the seats.
- 1600×900 canvas scaled in CSS. `imageSmoothingQuality = high`.

## Version 1 — 2025

Original Grok/Replit build. 1200×900 canvas, keyboard-only menus, Wimbledon colours, wood-tinted paddles, crowd cheer on a point.
