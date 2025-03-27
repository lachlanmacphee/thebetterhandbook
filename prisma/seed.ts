import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Create campuses
  const clayton = await prisma.campus.create({
    data: { name: "Clayton" },
  });

  const malaysia = await prisma.campus.create({
    data: { name: "Malaysia" },
  });

  // Create semesters
  const sem1 = await prisma.semester.create({
    data: { name: "Sem 1" },
  });

  const sem2 = await prisma.semester.create({
    data: { name: "Sem 2" },
  });

  // Create users
  const user1 = await prisma.user.create({
    data: {
      email: "user1@example.com",
      name: "User One",
    },
  });

  const user2 = await prisma.user.create({
    data: {
      email: "user2@example.com",
      name: "User Two",
    },
  });

  // Create units
  const unit1 = await prisma.unit.create({
    data: {
      name: "IT Professional Practice",
      code: "FIT1049",
      campuses: {
        create: [{ campusId: clayton.id }, { campusId: malaysia.id }],
      },
      semesters: {
        create: [{ semesterId: sem1.id }, { semesterId: sem2.id }],
      },
    },
  });

  const unit2 = await prisma.unit.create({
    data: {
      name: "Theory of Computation",
      code: "FIT2014",
      campuses: {
        create: [{ campusId: clayton.id }],
      },
      semesters: {
        create: [{ semesterId: sem2.id }],
      },
    },
  });

  // Create reviews
  await prisma.review.create({
    data: {
      title: "Practical",
      text: "Great unit with practical insights.",
      overallRating: 4,
      teachingRating: 5,
      contentRating: 4,
      difficultyRating: 3,
      workloadRating: 3,
      requiresAttendance: true,
      userId: user1.id,
      unitId: unit1.id,
    },
  });

  await prisma.review.create({
    data: {
      title: "Crazy",
      text: "One of the most challenging units I have done, but definitely rewarding.",
      overallRating: 5,
      teachingRating: 5,
      contentRating: 5,
      difficultyRating: 4,
      workloadRating: 4,
      requiresAttendance: false,
      userId: user2.id,
      unitId: unit2.id,
    },
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
