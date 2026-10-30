# Contributing

Thanks for considering a contribution. Calendar Studio is small and friendly to
hack on.

## Getting set up

```bash
git clone https://github.com/bensom/dsh-plugin-dev
cd dsh-plugin-dev/plugins/obsidian-calendar-studio
npm install
npm run dev
```

`npm run dev` watches `src/` and rebuilds `main.js`. Copy the build into your
vault to see changes:

```bash
VAULT_PATH="/path/to/your/vault" npm run deploy
```

Then reload the vault (`Cmd/Ctrl + P` → *Reload app without saving*) or restart
Obsidian.

## Rules of the road

1. **Never hard-code a vault path, folder name or property name.** Anything
   user-specific belongs in `CalendarStudioSettings` and is exposed in the
   settings tab. If you need a new option, add it to the settings interface,
   the settings tab, and both locale files.
2. **Never write to the vault with the file system.** Use
   `app.vault.modify` / `app.vault.create`. Obsidian holds the vault in memory
   and will overwrite your disk changes.
3. **Every new user-visible string goes through `t()`.** Add the key to
   `src/lang/locale/en.ts` and `src/lang/locale/zh-CN.ts`.
4. **Keep the bundle small.** Do not add a rendering library; the calendar grid
   is hand-written on purpose.
5. **Type-check before you push.** `npm run build` runs `tsc --noEmit`.

## Adding a data source

A source is a class that implements `EventSource`:

```ts
export interface EventSource {
  id: string;
  /** Re-collect every event this source knows about. */
  collect(): CalendarEvent[];
}
```

Return `CalendarEvent[]` and the index, UI and exporters will pick it up with
no further changes. See `src/sources/` for examples.

## Pull requests

- One topic per PR.
- Add or update unit tests for logic changes (`npm run test`).
- Update `README.md` and `CHANGELOG.md` when behaviour changes.
- By contributing you agree that your work is licensed under the MIT License.
