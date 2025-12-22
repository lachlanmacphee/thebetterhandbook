import { Importer, type ImportUnit } from "imports/importer";
import pino from "pino";

const COURSELOOP_API_URL =
  "https://api-ap-southeast-2.prod.courseloop.com/publisher/search-all";
const COURSELOOP_SITE_ID = "monash-prod-pres";
const COURSELOOP_BATCH_SIZE = 10;
const COURSELOOP_INTER_BATCH_DELAY = 10000;
const HANDBOOK_API_URL = "https://handbook.monash.edu/_next/data";
const HANDBOOK_BUILD_ID = "x72Bg6G_Gp9JqA01tHcsD";

type IndexResult = {
  unitCodes: string[];
  aos: string[];
  courses: string[];
};

export default class MonashUniversityImporter extends Importer {
  constructor(logger: pino.Logger) {
    super(
      "Monash University",
      "https://handbook.monash.edu/current/units/",
      logger,
    );
  }

  async getUnits(): Promise<ImportUnit[]> {
    const { unitCodes } = await this.fetchIndex();
    this.logger.info(`Found ${unitCodes.length} unit codes to process`);

    const units: ImportUnit[] = [];
    const totalBatches = Math.ceil(unitCodes.length / COURSELOOP_BATCH_SIZE);

    for (let i = 0; i < unitCodes.length; i += COURSELOOP_BATCH_SIZE) {
      const currentBatch = Math.floor(i / COURSELOOP_BATCH_SIZE) + 1;
      const batch = unitCodes.slice(i, i + COURSELOOP_BATCH_SIZE);

      this.logger.info(
        `Processing batch ${currentBatch}/${totalBatches} (${batch.length} units)`,
      );

      const batchPromises = batch.map(async (unitCode) => {
        const unitContent = await this.fetchUnitContent(unitCode.trim());
        return unitContent;
      });

      const batchResults = await Promise.all(batchPromises);
      const validUnits = batchResults.filter((unit) => unit !== null);

      units.push(...validUnits);

      this.logger.info(
        `Batch ${currentBatch} completed: ${validUnits.length}/${batch.length} valid units found`,
      );

      if (i + COURSELOOP_BATCH_SIZE < unitCodes.length) {
        this.logger.debug(
          `Waiting ${COURSELOOP_INTER_BATCH_DELAY}ms before next batch to respect rate limits`,
        );
        await new Promise((resolve) =>
          setTimeout(resolve, COURSELOOP_INTER_BATCH_DELAY),
        );
      }
    }

    this.logger.info(
      `Import process completed: ${units.length} total units imported`,
    );

    return units;
  }

  private async fetchIndex(): Promise<IndexResult> {
    this.logger.info("Fetching unit index from CourseLoop API");
    const pageSize = 100;
    let start = 0;
    let results: any[] = [];

    while (true) {
      const url = `${COURSELOOP_API_URL}?from=${start}&query=&searchType=advanced&siteId=${COURSELOOP_SITE_ID}&siteYear=current&size=${pageSize}`;

      try {
        this.logger.debug(`Fetching page starting at ${start}`);
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
        this.logger.error({ error }, "Failed to fetch index page");
        throw error;
      }
    }

    const index: IndexResult = results.reduce(
      (acc, result) => {
        if (result && typeof result === "object") {
          const uri = result.uri;
          if (typeof uri === "string") {
            const parts = uri.split("/");
            const contentType = parts[2];
            const code = result.code;

            if (code && typeof code === "string") {
              if (contentType === "units") {
                acc.unitCodes.push(code.trim());
              } else if (contentType === "aos") {
                acc.aos.push(code.trim());
              } else if (contentType === "courses") {
                acc.courses.push(code.trim());
              }
            }
          }
        }
        return acc;
      },
      { unitCodes: [], aos: [], courses: [] },
    );

    this.logger.info(
      `Index fetch completed: ${index.unitCodes.length} units, ${index.aos.length} AOS, ${index.courses.length} courses`,
    );
    return index;
  }

  private async fetchUnitContent(unitCode: string): Promise<null | ImportUnit> {
    const url = `${HANDBOOK_API_URL}/${HANDBOOK_BUILD_ID}/current/units/${unitCode}.json?year=current&catchAll=current&catchAll=units&catchAll=${unitCode}`;

    try {
      const response = await fetch(url);
      const data = await response.json();

      if (data?.status === 403) {
        // This likely indicates rate limiting.
        // CourseLoop seems to return a 403 Forbidden
        // status code instead of a 429 Too Many Requests.
        this.logger.warn(
          `Rate limited for unit ${unitCode}, retrying after delay`,
        );
        await new Promise((resolve) =>
          setTimeout(resolve, COURSELOOP_INTER_BATCH_DELAY),
        );
        return this.fetchUnitContent(unitCode);
      }

      const unitData = data?.pageProps?.pageContent;

      if (unitData) {
        // Parse level with fallback
        const levelValue = parseInt(unitData.level?.value);
        const level = isNaN(levelValue) ? 0 : levelValue - 1;

        // Parse credit points with fallback
        const creditPoints = parseInt(unitData.credit_points);
        const validCreditPoints = isNaN(creditPoints) ? 6 : creditPoints;

        const unit = {
          code: unitData.code.trim(),
          name: unitData.title.trim(),
          facultyName: unitData.school?.value?.trim() || "Unknown",
          level: level?.toString() ?? "NA",
          offerings:
            unitData.unit_offering?.map((offering: any) => ({
              location: offering.location?.value?.trim() || "Unknown",
              period: offering.teaching_period?.value?.trim() || "Unknown",
            })) || [],
          creditPoints: validCreditPoints,
        };

        this.logger.debug(
          `Successfully fetched unit: ${unit.code.trim()} - ${unit.name}`,
        );
        return unit;
      }

      this.logger.warn(`No unit data found for ${unitCode}`);
      return null;
    } catch (error) {
      this.logger.error(
        { error, unitCode },
        `Failed to fetch unit content for ${unitCode}`,
      );
      return null;
    }
  }
}
