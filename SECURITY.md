# Security

Nockdock runs locally on your PC:

- tokens (Vercel, Twitch) are encrypted with your Windows account through Electron `safeStorage` and never written to the config file;
- the Claude Code hook server listens only on `127.0.0.1:47321` and only accepts hook events;
- the interface runs sandboxed with context isolation; only a fixed set of actions is exposed to it;
- the Windows helper for audio and monitors is plain C# source compiled on your machine by PowerShell.

If you find a vulnerability, please don't open a public issue: use GitHub's **Report a vulnerability** button in the Security tab of the repository.
