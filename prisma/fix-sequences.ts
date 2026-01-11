import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";

// More details here:
// https://github.com/prisma/prisma/discussions/5256

dotenv.config();
const prisma = new PrismaClient();

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
