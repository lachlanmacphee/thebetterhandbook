import { PrismaClient } from "@prisma/client";
import MonashImporter from "../imports/universities/monash";
import pino from "pino";

const prisma = new PrismaClient();

async function main() {
  const logger = pino({
    level: "info",
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:standard",
        ignore: "pid,hostname",
      },
    },
  });

  const monashImporter = new MonashImporter(logger);
  const units = await monashImporter.getUnits();

  // Get all unique values
  const uniqueLocations = new Set<string>();
  const uniquePeriods = new Set<string>();
  const uniqueSchools = new Set<string>();
  for (const unit of units) {
    uniqueSchools.add(unit.facultyName);
    for (const offering of unit.offerings) {
      uniqueLocations.add(offering.location);
      uniquePeriods.add(offering.period);
    }
  }

  // Upsert campuses and store their IDs
  const campusMap: { [key: string]: number } = {};
  for (const location of uniqueLocations) {
    const campus = await prisma.campus.upsert({
      where: { name: location },
      update: {},
      create: { name: location },
    });
    campusMap[location] = campus.id;
  }

  // Upsert semesters and store their IDs
  const semesterMap: { [key: string]: number } = {};
  for (const period of uniquePeriods) {
    const semester = await prisma.semester.upsert({
      where: { name: period },
      update: {},
      create: { name: period },
    });
    semesterMap[period] = semester.id;
  }

  // Upsert faculties and store their IDs
  const facultyMap: { [key: string]: number } = {};
  for (const school of uniqueSchools) {
    const faculty = await prisma.faculty.upsert({
      where: { name: school },
      update: {},
      create: { name: school },
    });
    facultyMap[school] = faculty.id;
  }

  // Upsert units and their relationships
  for (const unit of units) {
    // Validate unit data before inserting
    if (!unit.code || !unit.name) {
      logger.warn(`Skipping unit with invalid data: ${JSON.stringify(unit)}`);
      continue;
    }

    // Ensure level is a valid number
    const level = isNaN(unit.level) ? 0 : unit.level;

    // Ensure creditPoints is a valid number
    const creditPoints = isNaN(unit.creditPoints) ? 6 : unit.creditPoints;

    const createdUnit = await prisma.unit.upsert({
      where: { code: unit.code },
      update: {
        name: unit.name,
        level,
        creditPoints,
        facultyId: facultyMap[unit.facultyName],
      },
      create: {
        code: unit.code,
        name: unit.name,
        level,
        creditPoints,
        facultyId: facultyMap[unit.facultyName],
      },
    });

    // First, delete all the existing semester and campus relationships
    // so we can re-create them fresh. This makes it easy to remove
    // any old campuses/semesters for this unit that no longer exist
    // in the new handbook data.
    await prisma.unitSemester.deleteMany({
      where: { unitId: createdUnit.id },
    });
    await prisma.unitCampus.deleteMany({
      where: { unitId: createdUnit.id },
    });

    const uniqueSemesters = new Set<number>();
    const uniqueCampuses = new Set<number>();

    for (const offering of unit.offerings) {
      uniqueSemesters.add(semesterMap[offering.period]);
      uniqueCampuses.add(campusMap[offering.location]);
    }

    for (const semesterId of uniqueSemesters) {
      await prisma.unitSemester.create({
        data: {
          unitId: createdUnit.id,
          semesterId: semesterId,
        },
      });
    }

    for (const campusId of uniqueCampuses) {
      await prisma.unitCampus.create({
        data: {
          unitId: createdUnit.id,
          campusId: campusId,
        },
      });
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
