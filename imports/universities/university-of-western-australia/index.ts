import * as cheerio from "cheerio";
import { Importer, type ImportUnit } from "imports/importer";
import pino from "pino";

const UWA_SEARCH_URL =
    "https://www.handbooks.uwa.edu.au/search/?type=units&searchtext=";

export default class UniversityOfWesternAustraliaImporter extends Importer {
    constructor(logger: pino.Logger) {
        super(
            "University of Western Australia",
            "https://www.handbooks.uwa.edu.au/unitdetails?code=",
            logger,
        );
    }

    async getUnits(): Promise<ImportUnit[]> {
        const response = await fetch(UWA_SEARCH_URL, {
            method: "GET",
        });

        const html = await response.text();
        const $ = cheerio.load(html);

        const units: ImportUnit[] = [];

        $("#filter-target > li.filter-item").each((_, element) => {
            const $li = $(element);

            // Extract code and name from h4 which is in format "Name [CODE]"
            const h4Text = $li.find("h4").text().trim();
            const match = h4Text.match(/^(.+?)\s*\[([^\]]+)\]$/);

            if (!match) return;

            const name = match[1].trim();
            const code = match[2].trim();

            // Extract credit points
            const creditPointsText = $li
                .find("dt:contains('Credit points:')")
                .next("dd")
                .text()
                .trim();
            const creditPoints = parseInt(creditPointsText) || 0;

            // Extract level(s)
            const levels: string[] = [];
            $li
                .find("dt:contains('Level of study:')")
                .nextUntil("dt")
                .each((_, dd) => {
                    const levelText = $(dd).text().trim();
                    if (levelText) levels.push(levelText);
                });
            const level = levels.join(", ");

            // Extract school (use as facultyName)
            const facultyName =
                $li.find("dt:contains('School:')").next("dd").text().trim() || "NA";

            // Extract offerings (availability and location)
            const offerings: Array<{ location: string; period: string }> = [];
            const locations: string[] = [];
            const periods: string[] = [];

            $li
                .find("dt:contains('Location:')")
                .nextUntil("dt")
                .each((_, dd) => {
                    const locationText = $(dd).text().trim();
                    if (locationText) locations.push(locationText);
                });

            $li
                .find("dt:contains('Availability:')")
                .nextUntil("dt")
                .each((_, dd) => {
                    const periodText = $(dd).text().trim();
                    if (periodText) periods.push(periodText);
                });

            // Create combinations of location and period
            if (locations.length > 0 && periods.length > 0) {
                for (const location of locations) {
                    for (const period of periods) {
                        offerings.push({ location, period });
                    }
                }
            }

            if (code && name) {
                units.push({
                    code,
                    name,
                    level,
                    creditPoints,
                    facultyName,
                    offerings,
                });
            }
        });

        this.logger.info(`Extracted ${units.length} units`);
        return units;
    }
}
