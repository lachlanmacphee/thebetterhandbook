import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";

// More details here:
// https://github.com/prisma/prisma/discussions/5256

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function fixSequences() {
    console.log("🔧 Fixing database sequences...\n");

    const tables = [
        "University",
        "User",
        "Faculty",
        "Campus",
        "Semester",
        "UnitCampus",
        "UnitSemester",
        "Unit",
        "UnitPrerequisite",
        "UnitCorequisite",
        "UnitAdditionRequest",
        "UnitDeprecation",
        "UnitSuggestion",
        "Review",
        "ReviewReaction",
    ];

    for (const table of tables) {
        try {
            await prisma.$executeRawUnsafe(`
        SELECT setval(
          pg_get_serial_sequence('"${table}"', 'id'),
          coalesce(max(id) + 1, 1),
          false
        )
        FROM "${table}";
      `);

            console.log(`✅ Fixed sequence for ${table}`);
        } catch (error) {
            console.error(`❌ Error fixing sequence for ${table}:`, error);
        }
    }

    console.log("\n✨ All sequences have been fixed!");
}

fixSequences()
    .catch((error) => {
        console.error("Error:", error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
