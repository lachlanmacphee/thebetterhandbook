import * as cheerio from "cheerio";
import { Importer, type ImportUnit } from "imports/importer";
import pino from "pino";

// NOTE 01: Be sure to add a bearer token by copying it from the network tab on your browser while on the search page.
// NOTE 02: Adjust the firstResult variable in the payload to paginate. E.g. after one run you would switch it to 2000 to get the next set of results.

const COVEO_API_URL =
    "https://universityofsydneyproduction10somjans.org.coveo.com/rest/search/v2?organizationId=universityofsydneyproduction10somjans";
const BEARER_TOKEN = "";
const UNITS_BASE_URL = "https://www.sydney.edu.au/units/";

export default class UniversityOfSydneyImporter extends Importer {
    constructor(logger: pino.Logger) {
        super("University of Sydney", UNITS_BASE_URL, logger);
    }

    async getUnits(): Promise<ImportUnit[]> {
        const unitCodes = await this.getUnitCodesFromSearch();

        const units: ImportUnit[] = [];
        for (let i = 0; i < unitCodes.length; i++) {
            const code = unitCodes[i];

            try {
                const unit = await this.getUnitDetails(code);
                if (unit) {
                    units.push(unit);
                }
            } catch (error) {
                this.logger.error(`Error fetching unit ${code}: ${error}`);
            }
        }

        return units;
    }

    private async getUnitCodesFromSearch(): Promise<string[]> {
        try {
            const unitCodes: string[] = [];

            const payload = {
                q: new Date().getFullYear().toString(),
                firstResult: 0, // Change to 2000, 4000, etc. to paginate
                numberOfResults: 10000,
                fieldsToInclude: [],
            };

            const response = await fetch(COVEO_API_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${BEARER_TOKEN}`,
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                this.logger.error(
                    `Failed to fetch from API: ${response.status} ${response.statusText}`,
                );
            }

            const data = await response.json();
            if (data.results && Array.isArray(data.results)) {
                for (const result of data.results) {
                    const uri = result.uri || result.clickUri || "";
                    const match = uri.match(/\/units\/([A-Z]{4}\d{4})/);
                    if (match) {
                        const code = match[1];
                        if (!unitCodes.includes(code)) {
                            unitCodes.push(code);
                        }
                    }
                }
            }

            return unitCodes;
        } catch (error) {
            this.logger.error(`Error fetching units from API: ${error}`);
            return [];
        }
    }

    private async getUnitDetails(code: string): Promise<ImportUnit | null> {
        try {
            const url = `${UNITS_BASE_URL}${code}`;
            const response = await fetch(url);

            if (!response.ok) {
                this.logger.warn(`Unit page not found: ${code}`);
                return null;
            }

            const html = await response.text();
            const $ = cheerio.load(html);

            const pageTitle = $("h1.pageTitle").text().trim();
            const nameParts = pageTitle.split(":");
            const name = nameParts.length > 1 ? nameParts[1].trim() : pageTitle;

            let creditPoints = 0;
            let level = "NA";

            $("table.table-striped.table-bordered tr").each((_, element) => {
                const $row = $(element);
                const header = $row.find("th").text().trim();
                const value = $row.find("td").text().trim();

                if (header === "Credit points") {
                    creditPoints = parseInt(value) || 0;
                } else if (header === "Study level") {
                    level = value;
                }
            });

            let facultyName = "NA";
            const schoolHeader = $("h4.b-title--first.fw-normal").text().trim();
            if (schoolHeader) {
                facultyName = schoolHeader;
            }

            const offerings: Array<{ location: string; period: string }> = [];

            $("#current-year tbody tr, #future-year tbody tr").each((_, element) => {
                const $row = $(element);
                const cells = $row.find("td");

                if (cells.length >= 3) {
                    const firstCell = cells.eq(0);
                    const sessionText = firstCell.contents().first().text().trim();
                    const location = cells.eq(2).text().trim();

                    if (sessionText && location) {
                        offerings.push({
                            location,
                            period: sessionText,
                        });
                    }
                }
            });

            return {
                code,
                name,
                level,
                creditPoints,
                facultyName,
                offerings,
            };
        } catch (error) {
            this.logger.error(`Error fetching details for unit ${code}: ${error}`);
            return null;
        }
    }
}
