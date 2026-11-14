# Requirements

Issues reference these IDs ("Implements F-21"). Shipped features are listed so agents don't rebuild them.

## Shipped
| ID | Feature |
|---|---|
| F-01 | Desktop shell: draggable/snapping windows, Start menu, taskbar, context menu, Ctrl+K palette, rubber-band select |
| F-02 | Boot sequence (BIOS + splash), skipped for returning visitors (`?boot` replays) |
| F-03 | Themes: Spider Night + Windows 98; living wallpapers; CRT bloom; screensaver; custom cursor |
| F-04 | EN/AR with RTL |
| F-05 | Phone layout: home screen, full-screen sheets, bottom tab bar |
| F-06 | Portfolio apps: About, Projects, Skills, Lab, Resume (+ plain `/resume`), Contact, GitHub |
| F-07 | Tools: Terminal, Explorer, Jukebox, Paint, Settings |
| F-08 | Games: SpiderSnake, Minesweeper (best scores saved) |
| F-09 | Breadboard.exe: 3D circuit simulator with MNA solver, 8 presets |
| F-10 | Pixel Spider mascot: 31 animations, physics, reactions |

## Next (see GitHub issues)
| ID | Feature | Priority |
|---|---|---|
| F-20 | Deep links: `?open=<app>` opens an app; "Copy link" for any window | High |
| F-21 | Share Breadboard circuits via URL | High |
| F-22 | Ohm.exe — resistor colour-code + LED resistor calculator | High |
| F-23 | Achievements.exe + unlock toasts | Medium |
| F-24 | Start menu → Shut Down / Restart / Stand By | Medium |
| F-25 | Keyboard & screen-reader accessibility pass | Medium |
| F-26 | Alt+Tab window switcher | Medium |
| F-27 | Recycle Bin | Low |
| F-28 | First-load JS budget check in CI | Low |

## Non-functional
- **Performance**: first load stays light; heavy apps lazy-load. Lighthouse perf ≥ 90 on desktop.
- **Accessibility**: keyboard usable, visible focus in both themes, reduced motion respected, contrast AA.
- **Privacy**: no backend, analytics, cookies or third-party trackers. Only localStorage.
- **Compatibility**: latest Chrome, Safari (iOS), Firefox, Edge; 360 px phones.
