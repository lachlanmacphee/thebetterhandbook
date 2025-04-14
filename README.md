# The Better Handbook

See the [About page](https://thebetterhandbook.fly.dev/about) for details.

## Todo

- [x] Include links to unit on Monash handbook for the current year
- [x] Include WAM Booster tag and checkbox on review
- [x] Sort reviews by likes/dislikes, controversial, latest/oldest etc
- [x] Add likes/dislikes to reviews
- [x] View all your reviews on your profile page
- [x] Edit your name on your profile page
- [x] Sort units on the search page by rating
- [ ] Disable like/dislike buttons when not logged in
- [ ] Add a year completed input to the review form
- [ ] Ability to edit reviews from either profile page or unit page
- [ ] Back button on unit page to go back to home or advanced search depending on where they came from
- [ ] Implement (pre/co/post)requisites visualisation
- [ ] Improve the metrics around how much oncampus is required for the unit
- [ ] Implement course maps

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
