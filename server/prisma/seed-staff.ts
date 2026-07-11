import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/db";

// Additive, idempotent seed of sample POS staff so the admin has people to edit.
// Roles map to the system's two roles: Supervisor -> MANAGER, Barista -> CASHIER.
// Skips any name that already exists, so it's safe to re-run and never wipes data.
const STAFF = [
  { name: "Layla Haddad", pin: "2201", role: "MANAGER" }, // Supervisor
  { name: "Karim Nassar", pin: "2202", role: "MANAGER" }, // Supervisor
  { name: "Maya Khoury", pin: "3301", role: "CASHIER" }, // Barista
  { name: "Rami Aoun", pin: "3302", role: "CASHIER" }, // Barista
  { name: "Nour Fares", pin: "3303", role: "CASHIER" }, // Barista
  { name: "Jad Saliba", pin: "3304", role: "CASHIER" }, // Barista
];

async function main() {
  let added = 0;
  let skipped = 0;
  for (const s of STAFF) {
    const exists = await prisma.staffUser.findFirst({ where: { name: s.name } });
    if (exists) {
      skipped++;
      console.log(`• Skipped (already exists): ${s.name}`);
      continue;
    }
    await prisma.staffUser.create({
      data: { name: s.name, pinHash: await bcrypt.hash(s.pin, 8), role: s.role },
    });
    added++;
    console.log(`✓ Added ${s.role === "MANAGER" ? "Supervisor" : "Barista"}: ${s.name} (PIN ${s.pin})`);
  }
  console.log(`\nDone. Added ${added}, skipped ${skipped}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
