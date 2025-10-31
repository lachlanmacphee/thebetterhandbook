import { PrismaClient } from "@prisma/client";
import fs from "fs";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany();
  const usersJSON = JSON.stringify(users);
  fs.writeFile("users.json", usersJSON, "utf8", () => {});

  const reviews = await prisma.review.findMany({
    include: {
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
