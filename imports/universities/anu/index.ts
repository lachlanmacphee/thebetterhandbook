import { Importer, type ImportUnit } from "imports/importer";
import pino from "pino";

const ANU_API_BASE_URL =
  "https://programsandcourses.anu.edu.au/data/CourseSearch/GetCourses";
const ANU_API_QUERY_PARAMS = `?ShowAll=true&PageIndex=0&MaxPageSize=10&PageSize=Infinity`;

type ANUApiUnit = {
  CourseCode: string;
  Name: string;
  Session: string;
  Career: string;
  Units: number;
  ModeOfDelivery: string;
  Year: number;
};

export default class ANUImporter extends Importer {
  constructor(logger: pino.Logger) {
    super(
      "Australian National University",
      "https://programsandcourses.anu.edu.au/course/",
      logger,
    );
  }

  async getUnits(): Promise<ImportUnit[]> {
    this.logger.info("Starting unit import process");

    const unitResults = await fetch(ANU_API_BASE_URL + ANU_API_QUERY_PARAMS, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const unitsJson = await unitResults.json();
    const anuUnits = unitsJson.Items as ANUApiUnit[];

    const units: ImportUnit[] = anuUnits.map((unit) => ({
      code: unit.CourseCode,
      name: unit.Name.trim(),
      level: "NA",
      creditPoints: unit.Units,
      facultyName: "",
      offerings: unit.Session.split("/").map((session) => ({
        location: unit.ModeOfDelivery.trim(),
        period: session.trim(),
      })),
    }));

    return units;
  }
}
