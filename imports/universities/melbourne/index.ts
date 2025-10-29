import fs from "fs";
import { Importer, type ImportUnit } from "imports/importer";
import pino from "pino";

const CURRENT_YEAR = new Date().getFullYear();
const COURSE_PLANNER_API_BASE_URL =
  "https://course-planner.unimelb.edu.au/apis/v1";
const COURSE_PLANNER_API_SUBJECT_URL = `${COURSE_PLANNER_API_BASE_URL}/subject`;
const COURSE_PLANNER_API_PLAN_CREATION_URL = `${COURSE_PLANNER_API_BASE_URL}/planCreationConfig`;
const COURSE_PLANNER_USER_ID = "insert-user-id-here";

type CoursePlannerUnit = {
  id: string;
  areaOfStudy: {
    area: string;
    description: string;
  }[];
  code: string;
  name: string;
  points: number;
  level: string;
  availability: {
    campus: string;
    studyPeriod: string;
  }[];
};

export default class MelbourneImporter extends Importer {
  constructor(logger: pino.Logger) {
    super(
      "University of Melbourne",
      "https://handbook.unimelb.edu.au/subjects",
      logger
    );
  }

  getQueryParamForCourseId(courseId: string): string {
    return `?year=${CURRENT_YEAR}&query={%22text%22:%22%22,%22level%22:[],%22studyPeriod%22:[],%22areaOfStudy%22:[],%22courseRecordIds%22:[],%22onlyBreadth%22:false,%22onlyDiscipline%22:true,%22satisfyRequisites%22:false,%22points%22:[%226.25%22,%2212.5%22,%2218.75%22,%2225%22],%22courseCodes%22:[%22${courseId}%22],%22courseEffectiveYear%22:${CURRENT_YEAR}}&sort={%22code%22:%22ASC%22}&paging={%22page%22:0,%22pageSize%22:500}`;
  }

  async getUnits(): Promise<ImportUnit[]> {
    if (fs.existsSync(this.unitOutputPath)) {
      this.logger.info(
        `Unit data already exists at ${this.unitOutputPath}, skipping import`
      );
      return JSON.parse(fs.readFileSync(this.unitOutputPath, "utf-8"));
    }

    this.logger.info("Starting unit import process");

    const coursesResults = await fetch(COURSE_PLANNER_API_PLAN_CREATION_URL, {
      method: "GET",
      headers: {
        "x-user-id": COURSE_PLANNER_USER_ID,
      },
    });

    const coursesJson = await coursesResults.json();
    const courseIds = coursesJson.courses.map(
      (course: any) => course.code
    ) as string[];

    this.logger.info(`Found ${courseIds.length} course IDs to process`);

    const units: ImportUnit[] = [];

    const fetchPromises = courseIds.map(async (id: string) => {
      const results = await fetch(
        COURSE_PLANNER_API_SUBJECT_URL + this.getQueryParamForCourseId(id),
        {
          method: "GET",
          headers: {
            "x-user-id": COURSE_PLANNER_USER_ID,
          },
        }
      );

      const json = await results.json();
      const coursePlannerUnits = json.results as CoursePlannerUnit[];

      return coursePlannerUnits.map((unit) => ({
        code: unit.code,
        name: unit.name,
        level: parseInt(unit.level) || 0,
        creditPoints: unit.points,
        facultyName:
          unit.areaOfStudy.length > 0 ? unit.areaOfStudy[0].area : "Unknown",
        offerings: unit.availability?.map((offering) => ({
          location: offering.campus,
          period: offering.studyPeriod,
        })),
      }));
    });

    const results = await Promise.all(fetchPromises);
    units.push(...results.flat());

    this.logger.info(
      `Import process completed: ${units.length} total units imported`
    );

    fs.writeFileSync(this.unitOutputPath, JSON.stringify(units, null, 2));
    this.logger.info(`Unit data written to ${this.unitOutputPath}`);

    return units;
  }
}
