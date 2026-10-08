# Ebb

Arc-style auto-archive for Helium (and any Chromium). Ebb closes tabs you haven't looked at for 12 hours of time at the computer and keeps them in a searchable archive.

## Rules

- Pinned tabs, tabs in a group, tabs playing audio, and the active tab in each window are never archived.
- Age counts from the moment you leave a tab. Sleep, quitting Helium, and 10+ minutes without input don't count.
- The archive keeps one entry per URL, forever. Reopening an entry removes it from the archive and restores its back/forward history when it is among the browser's 25 most recent closes.
- Tabs you close yourself don't go into the archive. History has them.

## Use

- Click the toolbar icon to open the archive in the side panel. The badge counts tabs archived since you last looked.
- Type `ebb`, then Space or Tab, in the address bar to search the archive.
- "Clear window" in the panel archives every unprotected tab in the window, like Arc's Clear. You can bind a shortcut to it on the extensions shortcuts page.
- The panel footer shows which tabs go next and the away periods Ebb has recorded.

## Develop

```sh
bun install
bun test        # rules, presence ledger, archive
bun run check   # types
bun run pack    # dist/ and ebb.tar.gz
```

Plain `tsc`, no bundler. MV3 service workers load ES modules directly.
