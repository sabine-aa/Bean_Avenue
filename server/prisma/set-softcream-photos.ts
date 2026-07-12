import "dotenv/config";
import { prisma } from "../src/db";

// Assign the sundae photos (cropped from the owner's marketing posters) to the
// Soft Cream menu items. Images live in the frontend's /photos/soft-cream/.
const MAP: { name: string; photo: string }[] = [
  { name: "Vanilla", photo: "/photos/soft-cream/vanilla.jpg" },
  { name: "Chocolate", photo: "/photos/soft-cream/chocolate.jpg" },
  { name: "Mixed Chocolate & Vanilla", photo: "/photos/soft-cream/mix.jpg" },
];

async function main() {
  for (const m of MAP) {
    const r = await prisma.menuItem.updateMany({
      where: { name: m.name, category: "Soft Cream" },
      data: { photo: m.photo, imageFit: "cover" },
    });
    console.log(`${m.name}: updated ${r.count}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
