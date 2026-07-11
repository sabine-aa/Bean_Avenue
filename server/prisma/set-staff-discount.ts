import "dotenv/config";
import { prisma } from "../src/db";

// One-off: set the global staff discount to 30%.
async function main() {
  const r = await prisma.setting.upsert({
    where: { key: "staff.discount.percent" },
    update: { value: "30" },
    create: { key: "staff.discount.percent", value: "30" },
  });
  console.log(`staff.discount.percent = ${r.value}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
