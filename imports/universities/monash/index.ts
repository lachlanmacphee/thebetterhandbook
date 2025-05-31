import { Importer, type ImportUnit } from "imports/importer";

const COURSELOOP_API_URL =
  "https://api-ap-southeast-2.prod.courseloop.com/publisher/search-all";
const COURSELOOP_SITE_ID = "monash-prod-pres";
const COURSELOOP_BATCH_SIZE = 10;
const COURSELOOP_INTER_BATCH_DELAY = 10000;
const HANDBOOK_API_URL = "https://handbook.monash.edu/_next/data";
const HANDBOOK_BUILD_ID = "x72Bg6G_Gp9JqA01tHcsD";

export default class MonashImporter extends Importer {
  constructor() {
    super("Monash University");
  }

  async getUnits(): Promise<ImportUnit[]> {
    const { unitCodes } = await fetchIndex();

    const units: ImportUnit[] = [];

    for (let i = 0; i < unitCodes.length; i += COURSELOOP_BATCH_SIZE) {
      const batch = unitCodes.slice(i, i + COURSELOOP_BATCH_SIZE);

      const batchPromises = batch.map(async (unitCode) => {
        const unitContent = await fetchUnitContent(unitCode);
        return unitContent;
      });

      const batchResults = await Promise.all(batchPromises);
      units.push(
        ...batchResults
          .filter((unit) => unit !== null)
          .filter((unit) => unit.offerings.length > 0)
      );

      if (i + COURSELOOP_BATCH_SIZE < unitCodes.length) {
        await new Promise((resolve) =>
          setTimeout(resolve, COURSELOOP_INTER_BATCH_DELAY)
        );
      }
    }
    return units;
  }
}

type IndexResult = {
  unitCodes: string[];
  aos: string[];
  courses: string[];
};

async function fetchIndex(): Promise<IndexResult> {
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

  const index: IndexResult = results.reduce(
    (result) => {
      if (result && typeof result === "object") {
        const uri = result.uri;
        if (typeof uri === "string") {
          const parts = uri.split("/");
          const contentType = parts[2];
          const code = result.code;

          if (code && typeof code === "string") {
            if (contentType === "units") {
              result.unitCodes.push(code.trim());
            } else if (contentType === "aos") {
              result.aos.push(code.trim());
            } else if (contentType === "courses") {
              result.courses.push(code.trim());
            }
          }
        }
      }
    },
    { unitCodes: [], aos: [], courses: [] }
  );

  return index;
}

async function fetchUnitContent(unitCode: string): Promise<null | ImportUnit> {
  const url = `${HANDBOOK_API_URL}/${HANDBOOK_BUILD_ID}/current/units/${unitCode}.json?year=current&catchAll=current&catchAll=units&catchAll=${unitCode}`;
  const response = await fetch(url);

  const data = await response.json();

  if (data?.status === 403) {
    // This likely indicates rate limiting.
    // CourseLoop seems to return a 403 Forbidden
    // status code instead of a 429 Too Many Requests.
    console.warn(`Rate limited for unit ${unitCode}`);
    await new Promise((resolve) =>
      setTimeout(resolve, COURSELOOP_INTER_BATCH_DELAY)
    );
    return fetchUnitContent(unitCode);
  }

  const unitData = data?.pageProps?.pageContent;

  if (unitData)
    return {
      code: unitData.code.trim(),
      name: unitData.title.trim(),
      facultyName: unitData.school.value.trim(),
      level: parseInt(unitData.level.value) - 1,
      offerings: unitData.unit_offering?.map((offering: any) => ({
        location: offering.location.value.trim(),
        period: offering.teaching_period.value.trim(),
      })),
      creditPoints: parseInt(unitData.credit_points),
    };

  return null;
}
