import * as cheerio from "cheerio";
import { Importer, type ImportUnit } from "imports/importer";
import pino from "pino";

const UQ_SEARCH_URL =
    "https://programs-courses.uq.edu.au/search.html?keywords=+&searchType=course";

export default class UniversityOfQueenslandImporter extends Importer {
    constructor(logger: pino.Logger) {
        super(
            "University of Queensland",
            "https://programs-courses.uq.edu.au/course.html?course_code=",
            logger,
        );
    }

    async getUnits(): Promise<ImportUnit[]> {
        const response = await fetch(UQ_SEARCH_URL, {
            method: "GET",
        });

        const html = await response.text();
        const $ = cheerio.load(html);

        const units: ImportUnit[] = [];

        $("ul.listing > li").each((_, element) => {
            const $li = $(element);

            const code = $li.find("a.code").text().trim();
            const name = $li.find("a.title").text().trim();
            const level = $li.find(".course-level").text().trim();
            const unitsText = $li.find(".course-units").text().trim();
            const creditPoints = parseInt(unitsText) || 0;

            const offerings: Array<{ location: string; period: string }> = [];
            $li.find("table tbody tr").each((_, row) => {
                const $row = $(row);
                const cells = $row.find("td");

                if (cells.length >= 3) {
                    const period = cells.eq(0).text().trim();
                    const location = cells.eq(1).text().trim();

                    if (period && location && !period.includes("View all")) {
                        offerings.push({
                            location,
                            period,
                        });
                    }
                }
            });

            if (code && name) {
                units.push({
                    code,
                    name,
                    level,
                    creditPoints,
                    facultyName: "NA",
                    offerings,
                });
            }
        });

        this.logger.info(`Extracted ${units.length} units`);
        return units;
    }
}
