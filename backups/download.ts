import { PrismaClient } from "@prisma/client";
import fs from "fs";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      apiKey: true,
    },
  });
  const usersJSON = JSON.stringify(users);
  fs.writeFile("users.json", usersJSON, "utf8", () => {});

  const reviews = await prisma.review.findMany({
    select: {
      id: true,
      requiresAttendance: true,
      createdAt: true,
      isWamBooster: true,
      contentRating: true,
      teachingRating: true,
      overallRating: true,
      workloadRating: true,
      difficultyRating: true,
      yearCompleted: true,
      title: true,
      text: true,
      userId: true,
      unit: {
        select: {
          code: true,
        },
      },
      reactions: true,
    },
  });
  const reviewsJSON = JSON.stringify(reviews);
  fs.writeFile("reviews.json", reviewsJSON, "utf8", () => {});
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
