# Grok/Replit Open 2025 — Wimbledon Pong

Browser Pong clone with a Wimbledon colour scheme. Originally published on Replit; now hosted on [dabbuilds.com/play](https://dabbuilds.com/play/) and GitHub Pages.

I vibe-coded version 1 with Grok in short bursts in 2025. Replit’s free host expired, so the game moved onto this repo and dabbuilds.com. Version 2 is the August 2026 pass: the same idea, with the bits that were fighting me cleaned up.

## Play

- Site hub (opens each version in a new window): https://dabbuilds.com/play/
- GitHub Pages: https://phoniness2005.github.io/grok-replit-open-2025/
- Original write-up: https://dabbuilds.com/grok-replit-open-2025/

## Versions

| Folder | What it is |
|---|---|
| `v2/` | Clickable menus, mouse or W/S, three actually-different opponents, court graphics that sit inside the collision lines. Fills the window; drag to move on a phone. |
| `v1/` | The original Grok/Replit build, kept so you can see the evolution. Same window-fill and drag-to-move so it is playable on a phone. |

## Version 2 in short

- Menus are HTML. Click them, or use arrows and Enter. Holding a key no longer skips the list.
- Score and instructions sit on the court. The original post opens each version in a new window so the court is not cropped.
- Amateur / Tour / Pro are separate AIs (reaction time, aim error, bounce prediction). Pro still misses.
- White and purple frame is drawn on the canvas. Ball and paddles stay on the grass.
- Grass, seat cloth, and wooden bats are tiled photographs rather than flat fills.

See [CHANGELOG.md](./CHANGELOG.md) for the full list.
