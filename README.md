# The Better Handbook

See the About page for details.

## Deployment

### Database

1. Set the DATABASE_URL inside .env
2. Run `npx prisma db push --skip-generate`
3. If the database is fresh, ensure you seed it with `npx prisma db seed`. This script will take a while to run.

### App

To build and run using Docker:

```bash
docker build -t thebetterhandbook .

# Run the container
docker run -p 3000:3000 thebetterhandbook
```

The containerised application can be deployed to any platform that supports Docker, including:

- AWS ECS
- Google Cloud Run
- Azure Container Apps
- Digital Ocean App Platform
- Fly.io
- Railway
