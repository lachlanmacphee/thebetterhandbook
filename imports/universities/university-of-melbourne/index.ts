import { Importer, type ImportUnit } from "imports/importer";
import pino from "pino";

const CURRENT_YEAR = new Date().getFullYear();
const COURSE_PLANNER_API_BASE_URL =
  "https://course-planner.unimelb.edu.au/apis/v1";
const COURSE_PLANNER_API_SUBJECT_URL = `${COURSE_PLANNER_API_BASE_URL}/subject`;
const COURSE_PLANNER_API_PLAN_CREATION_URL = `${COURSE_PLANNER_API_BASE_URL}/planCreationConfig`;
const COURSE_PLANNER_USER_ID = "910cb597-680c-4da6-b7b4-ed32b620ad33";

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

export default class UniversityOfMelbourneImporter extends Importer {
  constructor(logger: pino.Logger) {
    super(
      "University of Melbourne",
      "https://handbook.unimelb.edu.au/subjects/",
      logger,
    );
  }

  getQueryParamForCourseId(courseId: string): string {
    return `?year=${CURRENT_YEAR}&query={%22text%22:%22%22,%22level%22:[],%22studyPeriod%22:[],%22areaOfStudy%22:[],%22courseRecordIds%22:[],%22onlyBreadth%22:false,%22onlyDiscipline%22:true,%22satisfyRequisites%22:false,%22points%22:[%226.25%22,%2212.5%22,%2218.75%22,%2225%22],%22courseCodes%22:[%22${courseId}%22],%22courseEffectiveYear%22:${CURRENT_YEAR}}&sort={%22code%22:%22ASC%22}&paging={%22page%22:0,%22pageSize%22:2000}`;
  }

  async getUnits(): Promise<ImportUnit[]> {
    const coursesResults = await fetch(COURSE_PLANNER_API_PLAN_CREATION_URL, {
      method: "GET",
      headers: {
        "x-user-id": COURSE_PLANNER_USER_ID,
      },
    });

    const coursesJson = await coursesResults.json();
    const courses = coursesJson.courses;
    this.logger.info(`Found ${courses.length} course IDs to process`);

    let units: ImportUnit[] = [];

    for (let i = 0; i < courses.length; i++) {
      const results = await fetch(
        COURSE_PLANNER_API_SUBJECT_URL +
        this.getQueryParamForCourseId(courses[i].code),
        {
          method: "GET",
          headers: {
            "x-user-id": COURSE_PLANNER_USER_ID,
          },
        },
      );

      let json;
      try {
        json = await results.json();
      } catch (e) {
        this.logger.error(
          `Couldn't read the result for course with code ${courses[i].code} and name ${courses[i].name}.`,
        );
        continue;
      }

      const coursePlannerUnits = json.results as CoursePlannerUnit[];

      const unitsToAdd = coursePlannerUnits.map((unit) => ({
        code: unit.code,
        name: unit.name,
        level: unit.level || "NA",
        creditPoints: unit.points,
        facultyName:
          unit.areaOfStudy.length > 0
            ? unit.areaOfStudy[0].description
            : "Unknown",
        offerings:
          unit.availability?.map((offering) => ({
            location: offering.campus,
            period: offering.studyPeriod,
          })) || [],
      }));

      this.logger.info(
        `Found ${unitsToAdd.length} units to add for the course with name ${courses[i].name} `,
      );

      units.push(...unitsToAdd.flat());
    }

    this.logger.info(
      `Import process completed: ${units.length} total units imported`,
    );

    return units;
  }
}
