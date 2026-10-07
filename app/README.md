# UmJoonSIC app (Electron)

The UmJoonSIC desktop app: the Electron main process starts the Java simulator (`../simulator`), and the React renderer talks to it over HTTP.

```sh
pnpm install    # dependencies
pnpm dev        # development run
pnpm test       # unit tests
pnpm package    # the runnable app (out/)
```

Everything else (source layout, conventions, behaviour, Korean wording rules, building and releasing) is in the [developer documentation](../docs/DEVELOPMENT.md).
