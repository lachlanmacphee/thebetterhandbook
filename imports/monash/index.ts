import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const COURSELOOP_API_URL =
  "https://api-ap-southeast-2.prod.courseloop.com/publisher/search-all";
const COURSELOOP_SITE_ID = "monash-prod-pres";
const COURSELOOP_BATCH_SIZE = 10;
const COURSELOOP_INTER_BATCH_DELAY = 10000;

const HANDBOOK_API_URL = "https://handbook.monash.edu/_next/data";
const HANDBOOK_BUILD_ID = "x72Bg6G_Gp9JqA01tHcsD";

const DIR = path.dirname(fileURLToPath(import.meta.url));

interface ContentSplits {
  [key: string]: string[];
}

async function fetchMonashIndex(): Promise<{ results: any[] }> {
  console.log("Fetching Monash index from Courseloop API...");

  const pageSize = 100;
  let start = 0;
  let results: any[] = [];

  while (true) {
    const url = `${COURSELOOP_API_URL}?from=${start}&query=&searchType=advanced&siteId=${COURSELOOP_SITE_ID}&siteYear=current&size=${pageSize}`;

    try {
      const response = await fetch(url);
      const pageData = await response.json();

      if (pageData?.data?.results && Array.isArray(pageData.data.results)) {
        results = [...results, ...pageData.data.results];
      }

      const total = pageData?.data?.total || 0;
      start += pageSize;

      if (start >= total) {
        break;
      }
    } catch (error) {
      console.error(`Error fetching page ${start / pageSize + 1}:`, error);
      throw error;
    }
  }

  return { results };
}

async function processMonashIndex(): Promise<ContentSplits> {
  console.log("Processing Monash index...");

  let contentSplits: ContentSplits = {};

  try {
    // Try to load existing content splits
    const contentSplitsPath = path.join(DIR, "content_splits.json");
    if (fs.existsSync(contentSplitsPath)) {
      contentSplits = JSON.parse(fs.readFileSync(contentSplitsPath, "utf-8"));
      console.log("Loaded existing content splits");
      return contentSplits;
    }
  } catch (error) {
    console.log("No existing content splits found, creating new ones");
  }

  try {
    const monashData = await fetchMonashIndex();

    for (const result of monashData.results) {
      if (result && typeof result === "object") {
        const uri = result.uri;
        if (typeof uri === "string") {
          const parts = uri.split("/");
          const contentType = parts[2];
          const code = result.code;

          if (code && typeof code === "string") {
            if (!contentSplits[contentType]) {
              contentSplits[contentType] = [];
            }
            contentSplits[contentType].push(code.trim());
          }
        }
      }
    }

    const contentSplitsPath = path.join(DIR, "content_splits.json");
    fs.writeFileSync(contentSplitsPath, JSON.stringify(contentSplits, null, 2));

    return contentSplits;
  } catch (error) {
    console.error("Error processing Monash index:", error);
    throw error;
  }
}

async function getUnitContent(unitCode: string): Promise<any> {
  try {
    const url = `${HANDBOOK_API_URL}/${HANDBOOK_BUILD_ID}/current/units/${unitCode}.json?year=current&catchAll=current&catchAll=units&catchAll=${unitCode}`;
    const response = await fetch(url);

    const data = await response.json();

    if (data?.message || data?.status === 403) {
      // This likely indicates rate limiting.
      // CourseLoop seems to return a 403 Forbidden
      // status code instead of a 429 Too Many Requests.
      console.warn(`Rate limited for unit ${unitCode}`);
      return null;
    }

    if (data?.pageProps?.pageContent) {
      const unitData = data.pageProps.pageContent;
      return {
        code: unitData.code.trim(),
        title: unitData.title.trim(),
        school: unitData.school.value.trim(),
        level: parseInt(unitData.level.value) - 1,
        offerings: unitData.unit_offering?.map((offering: any) => ({
          location: offering.location.value.trim(),
          period: offering.teaching_period.value.trim(),
        })),
        credit_points: parseInt(unitData.credit_points),
      };
    } else {
      console.warn(`No page content for unit ${unitCode}`);
      return null;
    }
  } catch (error) {
    console.error(`Error fetching unit ${unitCode}:`, error);
    return null;
  }
}

export async function scrapeUnits(): Promise<void> {
  console.log("Scraping units from Courseloop API...");

  try {
    const contentSplits = await processMonashIndex();
    const unitCodes = contentSplits["units"] || [];

    if (!unitCodes.length) {
      throw new Error("No unit codes found in content splits");
    }

    console.log(`Found ${unitCodes.length} unit codes to process`);

    const units: any[] = [];

    for (let i = 0; i < unitCodes.length; i += COURSELOOP_BATCH_SIZE) {
      const batch = unitCodes.slice(i, i + COURSELOOP_BATCH_SIZE);
      console.log(
        `Processing batch ${i / COURSELOOP_BATCH_SIZE + 1} of ${Math.ceil(
          unitCodes.length / COURSELOOP_BATCH_SIZE
        )}`
      );

      const batchPromises = batch.map(async (unitCode) => {
        const unitContent = await getUnitContent(unitCode);
        return unitContent;
      });

      const batchResults = await Promise.all(batchPromises);
      units.push(...batchResults.filter(Boolean));

      if (i + COURSELOOP_BATCH_SIZE < unitCodes.length) {
        console.log(
          `Waiting ${COURSELOOP_INTER_BATCH_DELAY}ms before next batch...`
        );
        await new Promise((resolve) =>
          setTimeout(resolve, COURSELOOP_INTER_BATCH_DELAY)
        );
      }
    }

    fs.writeFileSync(
      path.join(DIR, "units.json"),
      JSON.stringify(units, null, 2)
    );

    console.log(`Successfully scraped ${units.length} units`);
  } catch (error) {
    console.error("Error scraping units:", error);
    throw error;
  }
}

async function main(): Promise<void> {
  console.log("Importing Monash University units...");
  await scrapeUnits();
}

main();
