import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "../src/db";

const CATEGORY = "Hanson Doughnuts";

function parseLine(line: string): string[] {
  const out: string[] = []; let cur = ""; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) { if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false; } else cur += ch; }
    else { if (ch === '"') inQ = true; else if (ch === ",") { out.push(cur); cur = ""; } else cur += ch; }
  }
  out.push(cur);
  return out;
}

async function main() {
  const raw = readFileSync(join(process.cwd(), "prisma", "hanson-import.csv"), "utf-8").replace(/\r/g, "");
  const lines = raw.split("\n").filter((l) => l.trim().length);
  const header = parseLine(lines[0]).map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.findIndex((h) => h.includes(name));
  const iName = col("name"), iSub = col("subcategory"), iDesc = col("description"), iPrice = col("price");

  // Fresh catalogue: remove existing Hanson doughnuts (order history keeps name snapshots).
  await prisma.featuredProduct.deleteMany({ where: { category: CATEGORY } });
  await prisma.menuItem.deleteMany({ where: { category: CATEGORY } });

  let made = 0;
  let firstId = 0;
  for (let i = 1; i < lines.length; i++) {
    const f = parseLine(lines[i]);
    const name = (f[iName] ?? "").trim();
    if (!name) continue;
    const subcategory = (f[iSub] ?? "").trim();
    const description = (f[iDesc] ?? "").trim();
    const price = Number(String(f[iPrice] ?? "").replace(/[^0-9.]/g, "")) || 0;
    const item = await prisma.menuItem.create({
      data: { name, category: CATEGORY, subcategory, description, price, availableToday: true, isHidden: false, inStock: true, sortOrder: made },
    });
    if (!firstId) firstId = item.id;
    made++;
    console.log(`${subcategory.padEnd(9)} ${name} — $${price}`);
  }
  // Re-point the homepage Hanson featured to the first doughnut.
  if (firstId) await prisma.featuredProduct.create({ data: { category: CATEGORY, menuItemId: firstId, sortOrder: 99 } }).catch(() => {});

  console.log(`\nImported ${made} Hanson doughnuts.`);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
