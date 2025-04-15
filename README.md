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
- [x] Disable like/dislike buttons when not logged in
- [x] Add a year completed input to the review form
- [x] Ability to edit reviews from either profile page or unit page
- [x] Back button on unit page to go back to home or advanced search depending on where they came from
- [x] Ability for students to mark units deprecated
- [x] Ability for students to suggest changes to a unit (e.g. campus, location, semester)
- [x] Role-based permissioning to help maintain the site
- [x] Admins can see suggestions and approve them (once actioned), or reject them if they are invalid
- [ ] Fix bug with attendance required checkbox
- [ ] Toast popups after any submission of a modal, review, etc
- [ ] Improve the metrics around how much a unit requires on-campus attendance

## Future Features

### Visualisations

It'd be really nice to have a pre/co requisites visualisation like MonSTAR has, but unfortunately the dataset doesn't seem too strong at this time. I think there will be more work to perhaps use an LLM to parse the requisites description of each unit and add them later. Regardless, it's on the future features list.

### Course Maps

MonPlan already has this functionality and I don't see any particular reason to duplicate work unless there is a core feature that's missing or major improvements to be made. Will have to investigate further whether having this would be useful or not.

## Deployment

### Database

1. Set the `DATABASE_URL` inside .env
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
