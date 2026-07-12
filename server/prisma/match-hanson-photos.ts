import "dotenv/config";
import { readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "../src/db";

const PHOTO_DIR = "C:\\Users\\sheha\\AppData\\Local\\Temp\\claude\\c--Users-sheha-OneDrive-Desktop-Bean-Project-Bean-Avenue\\11d93d6b-0839-464d-903e-514f701afae3\\scratchpad\\hansonphotos";

const stripAccents = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const norm = (s: string) => stripAccents(s).toLowerCase().replace(/[^a-z0-9]/g, "");
const photoName = (f: string) => f.replace(/\.(png|jpg|jpeg|webp)$/i, "").replace(/^\d+\)?\s*/, "").replace(/\s*temporary\s*$/i, "").trim();
const slugify = (s: string) => stripAccents(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function lev(a: string, b: string): number {
  const m = a.length, n = b.length;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}

async function main() {
  const files = readdirSync(PHOTO_DIR).filter((f) => /\.(png|jpg|jpeg|webp)$/i.test(f));
  const photos = files.map((f) => ({ file: f, name: photoName(f), norm: norm(photoName(f)), temp: /temporary/i.test(f) }));
  const doughnuts = await prisma.menuItem.findMany({ where: { category: "Hanson Doughnuts" }, select: { id: true, name: true } });

  const mapping: string[] = []; // "sourceFile|slug"
  const usedPhotos = new Set<string>();
  let matched = 0; const unmatched: string[] = [];

  for (const d of doughnuts) {
    const dn = norm(d.name);
    const cands = photos.filter((p) => !usedPhotos.has(p.file));
    // best: exact norm, else closest by Levenshtein (<=2), prefer non-temporary.
    let best = cands.find((p) => p.norm === dn && !p.temp) || cands.find((p) => p.norm === dn);
    if (!best) {
      let bd = 99, bp = null as typeof cands[number] | null;
      for (const p of cands) { const dist = lev(dn, p.norm); if (dist < bd || (dist === bd && bp?.temp && !p.temp)) { bd = dist; bp = p; } }
      if (bp && bd <= 2) best = bp;
    }
    if (best) {
      usedPhotos.add(best.file);
      const slug = slugify(d.name);
      mapping.push(`${best.file}|${slug}`);
      await prisma.menuItem.update({ where: { id: d.id }, data: { photo: `/photos/doughnuts/${slug}.jpg`, imageFit: "cover" } });
      matched++;
    } else unmatched.push(d.name);
  }

  writeFileSync(join(process.cwd(), "prisma", "hanson-photo-map.csv"), mapping.join("\n"), "utf-8");
  console.log(`Matched ${matched}/${doughnuts.length}.`);
  if (unmatched.length) console.log(`No photo: ${unmatched.join(", ")}`);
  const unused = photos.filter((p) => !usedPhotos.has(p.file)).map((p) => p.name);
  if (unused.length) console.log(`Unused photos: ${unused.join(", ")}`);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
