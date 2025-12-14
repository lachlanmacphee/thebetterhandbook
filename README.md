# The Better Handbook

See the [About page](https://tbh.lachlanmacphee.com/about) for details.

## Todo

- [ ] Toast popups after any submission of a modal, review, etc
- [ ] Improve the metrics around how much a unit requires on-campus attendance
- [ ] All review additions/editing should be on the dedicated page
- [ ] Add more API call examples to the Bruno directory

## Future Features

### Visualisations

It'd be really nice to have a requisites visualisation like MonSTAR has, but my priorities are on expanding support to the entire Group of Eight before having a crack at this.

### Course Maps

Same as above; a nice to have but not coming any time soon.

### University's own review data

Might be worth incorporating some metrics in from each Uni's own review system, like SETU at Monash.

## Deployment

### Database

1. Set the `DATABASE_URL` inside .env
2. Run `npx prisma db push --skip-generate`
3. If the database is fresh, ensure you seed it with `npx prisma db seed`. This script will take a while to run.

### App

To build and run using Docker, set your environment variables on the machine, and then run:

```bash
docker compose up --detach
```

The containerised application can be deployed to any platform that supports Docker, including:

- AWS ECS
- Google Cloud Run
- Azure Container Apps
- Digital Ocean App Platform
- Fly.io
- Railway
