import { Importer, type ImportUnit } from "imports/importer";
import pino from "pino";

const CURRENT_YEAR = new Date().getFullYear();
const UNSW_API_BASE_URL =
  "https://courseoutlines.unsw.edu.au/v1/publicsitecourseoutlines/search";
const UNSW_API_QUERY_PARAMS = `?pageNumber=1&top=10000&year=${CURRENT_YEAR}`;

type UNSWApiUnit = {
  integrat_teachingperiod: string;
  integrat_deliveryformat: string;
  integrat_coursecode: string;
  integrat_location: string;
  integrat_termcode: string;
  integrat_simscourseid: string;
  integrat_term: string;
  integrat_unitsofcredit: string;
  integrat_coursesummary: string;
  integrat_year: string;
  integrat_courseoutlineid: string;
  integrat_ecoscourseoutlineid: string;
  integrat_deliverymode: string;
  integrat_coursename: string;
  integrat_owningacademicunit: string;
  primaryURL: string;
  secondaryURL: string;
};

export default class UniversityOfNewSouthWalesImporter extends Importer {
  constructor(logger: pino.Logger) {
    super(
      "University of New South Wales",
      `https://www.handbook.unsw.edu.au/undergraduate/courses/${CURRENT_YEAR}/`,
      logger,
    );
  }

  async getUnits(): Promise<ImportUnit[]> {
    const unitResults = await fetch(UNSW_API_BASE_URL + UNSW_API_QUERY_PARAMS, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const unitsJson = await unitResults.json();
    const unswUnits = unitsJson.response.results as UNSWApiUnit[];

    const units: ImportUnit[] = unswUnits.map((unit) => ({
      code: unit.integrat_coursecode,
      name: unit.integrat_coursename.trim(),
      level: "NA",
      creditPoints: parseInt(unit.integrat_unitsofcredit),
      facultyName: unit.integrat_owningacademicunit,
      offerings: [
        {
          location: unit.integrat_location.trim(),
          period: unit.integrat_term.trim(),
        },
      ],
    }));

    return units;
  }
}
