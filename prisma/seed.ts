import { PrismaClient } from "@prisma/client";
import MonashImporter from "../imports/universities/monash";

const prisma = new PrismaClient();

async function main() {
  const monashImporter = new MonashImporter();
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
    const createdUnit = await prisma.unit.upsert({
      where: { code: unit.code },
      update: {
        name: unit.name,
        level: unit.level,
        creditPoints: unit.creditPoints,
        facultyId: facultyMap[unit.facultyName],
      },
      create: {
        code: unit.code,
        name: unit.name,
        level: unit.level,
        creditPoints: unit.creditPoints,
        facultyId: facultyMap[unit.facultyName],
      },
    });

    // Update unit-semester relationships
    for (const offering of unit.offerings) {
      await prisma.unitSemester.upsert({
        where: {
          unitId_semesterId: {
            unitId: createdUnit.id,
            semesterId: semesterMap[offering.period],
          },
        },
        update: {},
        create: {
          unitId: createdUnit.id,
          semesterId: semesterMap[offering.period],
        },
      });

      // Update unit-campus relationships
      await prisma.unitCampus.upsert({
        where: {
          unitId_campusId: {
            unitId: createdUnit.id,
            campusId: campusMap[offering.location],
          },
        },
        update: {},
        create: {
          unitId: createdUnit.id,
          campusId: campusMap[offering.location],
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
