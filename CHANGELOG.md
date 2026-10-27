# Changelog

## Unreleased

- Claude Code: one button in Settings → Connections adds or removes the hooks; no paths to copy by hand.
- Vercel: the project is matched to the GitHub repo it deploys from (any letter case) and the right team is found automatically; new “Open the site” button that opens the public domain; the dashboard link works without typing it.
- Music: the play/pause button follows what Windows is playing, with the track title.
- After a touch on the dock, the pointer goes back where it was on the other monitors (Settings → General → Touch).
- Lighter dark theme: background, cards and borders are easier to see on the dock screen.
- Twitch removed; the Scenes tab is now Games, with a gamepad icon.
- Install works with pnpm 11+ and Electron 45.

## 0.6.0

- New name: Nockdock (data moves from `%APPDATA%\Dock` automatically).
- English and Italian interface, automatic from Windows or chosen in Settings.
- Light theme, or follow Windows; any accent colour for an account.
- Settings → Appearance: tab order, Home cards and project buttons to show.
- Custom links per project (up to 4 extra buttons).
- The idle screen no longer depends on Yuyu; the setup has a "Look & startup" step with Yuyu as an option.
- The 1024×600 layout scales to dock screens of any resolution.
- Ready for public release: MIT license, CI, release workflow.
- New app icon: a monitor with the glowing dock underneath (source in `build/icon.svg`).

## 0.5.0

- Guided setup on first launch: screen, browser and accounts, projects found in a folder, Yuyu.
- Settings on the dock: general, screen, accounts and browser, projects, connections, Yuyu, desk, snippets.
- Up to 4 accounts with name, colour and browser profile; Brave, Chrome, Edge or the Windows default browser.
- Desk tab: per-app volume, master volume, audio output, monitor brightness (DDC/CI), media keys.
- Old configuration files are converted automatically.

## 0.4.0

- Reworked animations for Yuyu (walk, jump, laptop); hold Yuyu to open Claude Desktop.

## 0.3.0

- Speech bubble, Claude Code hooks, commit streak and levels, Vercel deploys with preview QR, Steam games and Twitch channels.

## 0.2.0

- Yuyu the mascot and the idle screen.

## 0.1.0

- First version: projects, home with "pick up where you left off", accounts, end-of-day recap, system.
