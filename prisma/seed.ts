import { PrismaClient } from "@prisma/client";
import processedUnits from "../imports/processed_units.json";

const prisma = new PrismaClient();

async function main() {
  // Create campuses
  const clayton = await prisma.campus.create({
    data: { name: "Clayton" },
  });

  const malaysia = await prisma.campus.create({
    data: { name: "Malaysia" },
  });

  const peninsula = await prisma.campus.create({
    data: { name: "Peninsula" },
  });

  const caulfield = await prisma.campus.create({
    data: { name: "Caulfield" },
  });

  // Create semesters
  const firstSem = await prisma.semester.create({
    data: { name: "First semester" },
  });

  const secondSem = await prisma.semester.create({
    data: { name: "Second semester" },
  });

  const summerSemA = await prisma.semester.create({
    data: { name: "Summer semester A" },
  });
  const summerSemB = await prisma.semester.create({
    data: { name: "Summer semester B" },
  });
  const winterSem = await prisma.semester.create({
    data: { name: "Winter semester" },
  });

  const fullYear = await prisma.semester.create({
    data: { name: "Full year" },
  });

  const getSemesterId = (period: string) => {
    switch (period) {
      case "First semester":
        return firstSem.id;
      case "Second semester":
        return secondSem.id;
      case "Summer semester A":
        return summerSemA.id;
      case "Summer semester B":
        return summerSemB.id;
      case "Winter semester":
        return winterSem.id;
      case "Full year":
        return fullYear.id;
      default:
        return null;
    }
  };

  const getCampusId = (location: string) => {
    switch (location) {
      case "Clayton":
        return clayton.id;
      case "Malaysia":
        return malaysia.id;
      case "Peninsula":
        return peninsula.id;
      case "Caulfield":
        return caulfield.id;
      default:
        return null;
    }
  };

  const mappedUnits = Object.values(processedUnits)
    .map((unit: any) => ({
      code: unit.code,
      name: unit.title,
      level: unit.level,
      facultyName: unit.school,
      creditPoints: unit.credit_points,
      offerings: unit.offerings?.map((offering: any) => ({
        location: offering.location,
        period: offering.period,
      })),
    }))
    // Only include units with offerings
    .filter((unit) => unit.offerings?.length > 0);

  // Create the units in the database
  for (const unit of mappedUnits) {
    const faculty = await prisma.faculty.upsert({
      select: {
        id: true,
      },
      where: {
        name: unit.facultyName,
      },
      create: {
        name: unit.facultyName,
      },
      update: {},
    });

    const createdUnit = await prisma.unit.create({
      data: {
        code: unit.code,
        name: unit.name,
        level: unit.level,
        creditPoints: parseInt(unit.creditPoints),
        facultyId: faculty.id,
      },
    });

    for (const offering of unit.offerings) {
      const campus = getCampusId(offering.location);
      const semester = getSemesterId(offering.period);

      if (semester) {
        try {
          await prisma.unitSemester.create({
            data: {
              unitId: createdUnit.id,
              semesterId: semester,
            },
          });
        } catch (error) {}
      }
      if (campus) {
        try {
          await prisma.unitCampus.create({
            data: {
              unitId: createdUnit.id,
              campusId: campus,
            },
          });
        } catch (error) {}
      }
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
