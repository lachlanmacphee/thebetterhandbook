import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "~/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

let db = new PrismaClient({ adapter });

export default db;
