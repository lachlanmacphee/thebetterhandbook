import { PrismaClient } from "@prisma/client";
import pino from "pino";
// import MonashUniversityImporter from "imports/universities/monash-university";
// import UniversityOfMelbourneImporter from "imports/universities/university-of-melbourne";
// import AustralianNationalUniversityImporter from "imports/universities/australian-national-university";
// import UniversityOfNewSouthWalesImporter from "imports/universities/university-of-new-south-wales";
// import UniversityOfQueenslandImporter from "imports/universities/university-of-queensland";
// import UniversityOfAdelaideImporter from "imports/universities/university-of-adelaide";
// import UniversityOfSydneyImporter from "imports/universities/university-of-sydney";
import UniversityOfWesternAustraliaImporter from "imports/universities/university-of-western-australia";

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

  // const importer = new MonashUniversityImporter(logger);
  // const importer = new UniversityOfMelbourneImporter(logger);
  // const importer = new AustralianNationalUniversityImporter(logger);
  // const importer = new UniversityOfNewSouthWalesImporter(logger);
  // const importer = new UniversityOfQueenslandImporter(logger);
  // const importer = new UniversityOfAdelaideImporter(logger);
  // const importer = new UniversityOfSydneyImporter(logger);
  const importer = new UniversityOfWesternAustraliaImporter(logger);

  logger.info(`Starting import for ${importer.university}`);
  const units = await importer.getUnits();

  const university = await prisma.university.upsert({
    where: { name: importer.university },
    update: {},
    create: {
      name: importer.university,
      handbookUrl: importer.handbookUrl,
    },
  });
  const universityId = university.id;

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
      where: {
        name_universityId: {
          name: location,
          universityId: universityId,
        },
      },
      update: {},
      create: {
        name: location,
        universityId: universityId,
      },
    });
    campusMap[location] = campus.id;
  }

  // Upsert semesters and store their IDs
  const semesterMap: { [key: string]: number } = {};
  for (const period of uniquePeriods) {
    const semester = await prisma.semester.upsert({
      where: {
        name_universityId: {
          name: period,
          universityId: universityId,
        },
      },
      update: {},
      create: {
        name: period,
        universityId: universityId,
      },
    });
    semesterMap[period] = semester.id;
  }

  // Upsert faculties and store their IDs
  const facultyMap: { [key: string]: number } = {};
  for (const school of uniqueSchools) {
    const faculty = await prisma.faculty.upsert({
      where: {
        name_universityId: {
          name: school,
          universityId: universityId,
        },
      },
      update: {},
      create: {
        name: school,
        universityId: universityId,
      },
    });
    facultyMap[school] = faculty.id;
  }

  for (const unit of units) {
    if (!unit.code || !unit.name) {
      logger.warn(`Skipping unit with invalid data: ${JSON.stringify(unit)}`);
      continue;
    }

    // Ensure level is a valid number
    const creditPoints = isNaN(unit.creditPoints) ? -1 : unit.creditPoints;

    const createdUnit = await prisma.unit.upsert({
      where: {
        code_universityId: {
          code: unit.code,
          universityId: universityId,
        },
      },
      update: {
        name: unit.name,
        level: unit.level,
        creditPoints,
        facultyId: facultyMap[unit.facultyName],
      },
      create: {
        code: unit.code,
        name: unit.name,
        level: unit.level,
        creditPoints,
        facultyId: facultyMap[unit.facultyName],
        universityId: universityId,
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
