# The Better Handbook

See the About page for details.

## Deployment

Only seed the database if it is fresh.

```
npx prisma db push --skip-generate
npx prisma db seed
```

Any pushes to the master branch will trigger a deployment to `thebetterhandbook.vercel.app`
