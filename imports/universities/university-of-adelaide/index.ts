import { Importer, type ImportUnit } from "imports/importer";
import pino from "pino";

const ADELAIDE_API_BASE_URL =
    "https://courseplanner-api.adelaide.edu.au/api/course-planner-query/v1/";
const ADELAIDE_API_QUERY_PARAMS =
    "?target=/system/COURSE_SEARCH/queryx&virtual=Y&year=2025&course_title=&pagenbr=1&pagesize=10000";

type AdelaideApiResponse = {
    status: string;
    data: {
        query: {
            total_rows: number;
            num_rows: number;
            queryname: string;
            rows: AdelaideApiUnit[];
        };
    };
};

type AdelaideApiUnit = {
    COURSE_ID: string;
    COURSE_OFFER_NBR: number;
    YEAR: string;
    TERM: string;
    TERM_DESCR: string;
    SUBJECT: string;
    CATALOG_NBR: string;
    ACAD_CAREER: string;
    ACAD_CAREER_DESCR: string;
    COURSE_TITLE: string;
    UNITS: number;
    CAMPUS: string;
    CLASS_NBR: number;
};

export default class UniversityOfAdelaideImporter extends Importer {
    constructor(logger: pino.Logger) {
        super(
            "University of Adelaide",
            "https://www.adelaide.edu.au/course-outlines/",
            logger,
        );
    }

    async getUnits(): Promise<ImportUnit[]> {
        this.logger.info("Starting unit import process");

        const unitResults = await fetch(
            ADELAIDE_API_BASE_URL + ADELAIDE_API_QUERY_PARAMS,
            {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                },
            },
        );

        const responseJson: AdelaideApiResponse = await unitResults.json();
        const adelaideUnits = responseJson.data.query.rows;

        // Group units by course code since the same course can have multiple offerings
        const courseMap = new Map<string, AdelaideApiUnit[]>();

        for (const unit of adelaideUnits) {
            const courseCode = `${unit.SUBJECT} ${unit.CATALOG_NBR}`;
            if (!courseMap.has(courseCode)) {
                courseMap.set(courseCode, []);
            }
            courseMap.get(courseCode)!.push(unit);
        }

        // Convert grouped courses to ImportUnit format
        const units: ImportUnit[] = Array.from(courseMap.entries()).map(
            ([courseCode, offerings]) => {
                const firstOffering = offerings[0];

                return {
                    code: courseCode,
                    name: firstOffering.COURSE_TITLE.trim(),
                    level: "NA",
                    creditPoints: firstOffering.UNITS,
                    facultyName: "NA",
                    offerings: offerings.map((offering) => ({
                        location: offering.CAMPUS.trim(),
                        period: offering.TERM_DESCR.trim(),
                    })),
                };
            },
        );

        return units;
    }
}
