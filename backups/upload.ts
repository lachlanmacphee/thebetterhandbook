import { PrismaClient } from "@prisma/client";
import fs from "fs";

const prisma = new PrismaClient();

async function main() {
  fs.readFile("users.json", "utf8", async (err, data) => {
    if (err) {
      console.error("Error reading file:", err);
      return;
    }

    const users = JSON.parse(data);
    await prisma.user.createMany({
      data: users,
    });
  });

  fs.readFile("reviews.json", "utf8", async (err, data) => {
    if (err) {
      console.error("Error reading file:", err);
      return;
    }

    const reviews = JSON.parse(data);
    // @ts-ignore
    reviews.forEach(async (review) => {
      const unitCode = review.unit.code;
      const reactions = [...review.reactions];

      delete review.unit;
      delete review.reactions;

      const unitId = await prisma.unit.findFirst({
        where: {
          code: unitCode,
        },
      });

      await prisma.review.create({
        data: {
          ...review,
          unitId,
        },
      });

      await prisma.reviewReaction.createMany({
        data: reactions,
      });
    });
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
