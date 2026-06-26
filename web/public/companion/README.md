# Chittie Companion — vendored installer

`chittie-companion-latest-windows-x64-setup.exe` is a **copy** of the published Chittie Companion
Windows installer (NSIS, x64), so this repo carries its own copy and you can **self-host** it.

- **Source of truth (always latest):**
  `https://pub-4b53b304bc45450dbe0155abfe55778b.r2.dev/chittie-companion-latest-windows-x64-setup.exe`
- **This file is a snapshot** — it does **not** auto-update. Re-pull on each Companion release:
  ```sh
  curl -sS -o web/public/companion/chittie-companion-latest-windows-x64-setup.exe \
    https://pub-4b53b304bc45450dbe0155abfe55778b.r2.dev/chittie-companion-latest-windows-x64-setup.exe
  ```
  (The installed Companion still **auto-updates itself** regardless of which installer launched it.)

## Hosting it yourself

This sits under `web/public/`, so a deploy of the web app serves it at:

```
https://<your-domain>/companion/chittie-companion-latest-windows-x64-setup.exe
```

To make the in-app **Download for Windows** button use your copy instead of the R2 URL, set:

```sh
NEXT_PUBLIC_COMPANION_INSTALL_URL=/companion/chittie-companion-latest-windows-x64-setup.exe
```

Leave it unset to use the R2-hosted copy (recommended — always current).
