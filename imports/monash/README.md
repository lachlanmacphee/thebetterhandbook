# Monash Handbook Scraper

A TypeScript version of the Monash University handbook scraper, loosely based on [Sai's Go implementation](https://github.com/saikumarmk/monash-handbook-scraper).

## Usage

You can run the import using the following command with `tsx` from the **root** directory. Keep in mind that it is not meant to be fast, it will take hours to run due to rate limiting from CourseLoop's side. Please do not attempt to find ways around this; they have those limits in place for a reason.

```bash
npx tsx imports/monash/index.ts
```

## Output

The importer will generate a `units.json` file in the `imports/monash` directory with information about each unit.

## Credits

Shoutout to Sai for the original Go implementation. You can read the blog post about Sai's journey scraping the Monash Handbook [here](https://www.saikumarmk.com/universe-of-units/).
