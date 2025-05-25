import { PrismaClient } from "@prisma/client";
import processedUnits from "../imports/monash/units.json";

const prisma = new PrismaClient();

async function main() {
  const mappedUnits = Object.values(processedUnits)
    .map((unit: any) => ({
      code: unit.code,
      name: unit.title,
      level: unit.level,
      facultyName: unit.school,
      creditPoints: unit.credit_points,
      offerings: unit.offerings,
    }))
    .filter((unit) => unit.offerings?.length > 0);

  // Get all unique values
  const uniqueLocations = new Set<string>();
  const uniquePeriods = new Set<string>();
  const uniqueSchools = new Set<string>();
  for (const unit of mappedUnits) {
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
  for (const unit of mappedUnits) {
    const createdUnit = await prisma.unit.upsert({
      where: { code: unit.code },
      update: {
        name: unit.name,
        level: unit.level,
        creditPoints: parseInt(unit.creditPoints),
        facultyId: facultyMap[unit.facultyName],
      },
      create: {
        code: unit.code,
        name: unit.name,
        level: unit.level,
        creditPoints: parseInt(unit.creditPoints),
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
