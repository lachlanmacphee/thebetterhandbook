# The Better Handbook

See the [About page](https://thebetterhandbook.com.au/about) for details.

## Universities Supported

- [x] Australian National University
- [x] Monash University
- [x] University of Adelaide
- [x] University of Melbourne
- [x] University of New South Wales
- [x] University of Queensland
- [x] University of Sydney
- [x] University of Western Australia

## Roadmap

- [ ] Improve the metrics around how much a unit requires on-campus attendance
- [ ] Store degrees
- [ ] Pre/co-requisites visualisation
- [ ] Course maps
- [ ] Import data from University review systems (e.g. SETU at Monash, MonSTAR)

## Development

The Better Handbook is a single Go binary: the standard library's `net/http` and `html/template`, [htmx](https://htmx.org) for interactivity, [Pico CSS](https://picocss.com) for styling and SQLite for storage.

```
cmd/tbh/            the app: serve, import and backup subcommands
cmd/pgmigrate/      one-off copy of the old Postgres database into SQLite
internal/auth/      emailed sign-in codes and allowed student email domains
internal/config/    environment variables
internal/db/        migrations, sqlc queries, and the JSON API's SQL
internal/importer/  handbook scrapers, one package per university
internal/mail/      SMTP email
internal/web/       routes, handlers, templates and static files
```

Run it locally with Go 1.27+:

```bash
cp .env.example .env
set -a; source .env; set +a
go run ./cmd/tbh import australian-national-university
go run ./cmd/tbh serve
```

With `ENV=development`, sign-in codes are printed to the terminal instead of emailed.

- `go run ./cmd/tbh import <slug>... | all` pulls units from university handbooks. Run `go run ./cmd/tbh help` for the list of slugs. Importing is safe to repeat: units are upserted and never deleted.
- `go run ./cmd/tbh backup <file>` writes a consistent snapshot of the database.
- After changing `internal/db/queries/*.sql` or adding a migration, run `go generate ./internal/db` to regenerate the sqlc code.
- `go test ./...` runs the tests.

## Deployment

The Docker image runs `tbh serve` on port 3000 and stores the database at `/data/tbh.db`, so mount a volume there. It needs `SESSION_SECRET`, `EMAIL_HOST`, `EMAIL_USER` and `EMAIL_PASS`.

```yaml
services:
  tbh:
    image: ghcr.io/lachlanmacphee/thebetterhandbook:latest
    restart: unless-stopped
    ports: ["3000:3000"]
    env_file: .env
    volumes: ["tbh-data:/data"]
volumes:
  tbh-data:
```

Imports run inside the container, next to the database: `docker compose exec tbh tbh import monash-university`.

To make someone an admin, edit the database file on the volume, e.g. `sqlite3 tbh.db "UPDATE users SET role = 'ADMIN' WHERE email = '...'"`.

Commands to run on the VPS are:

```zsh
docker compose stop
docker compose pull tbh
docker compose up -d
docker image prune -a -f
```

### Moving from Postgres

`cmd/pgmigrate` copies everything from the old Prisma database into a new SQLite file, keeping IDs so old `/{id}/...` links redirect to the new `/universities/{slug}/...` URLs:

```bash
DATABASE_URL=postgres://... go run ./cmd/pgmigrate -sqlite tbh.db
```

Copy the resulting file into the volume as `tbh.db` before starting the new image. Everyone has to sign in again after the switch, but API keys keep working.

## Contributing & Hosting

If you're interested in becoming part of the team or helping with hosting costs, please get in touch using the email in my GitHub profile.
