import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const csvPathArg = process.argv[2];
if (!csvPathArg) {
  console.error('Uso: node backend/import-products.mjs <caminho_csv>');
  process.exit(1);
}

const csvPath = path.resolve(process.cwd(), csvPathArg);

const parseLine = (line) => {
  const cells = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ';' && !inQuotes) {
      cells.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
};

const normalizeSku = (value) => String(value || '').trim();
const normalizeName = (value) => String(value || '').trim();
const chunkArray = (array, size) => {
  const chunks = [];
  for (let index = 0; index < array.length; index += size) {
    chunks.push(array.slice(index, index + size));
  }
  return chunks;
};

const run = async () => {
  const raw = fs.readFileSync(csvPath).toString('latin1');
  const lines = raw.split(/\r?\n/).filter((line) => line.trim() !== '');

  if (lines.length <= 1) {
    console.log('Nenhum registro para importar.');
    return;
  }

  const rows = lines
    .slice(1)
    .map(parseLine)
    .map((cells) => ({
      sku: normalizeSku(cells[0]),
      name: normalizeName(cells[1]),
    }))
    .filter((row) => row.sku && row.name);

  const uniqueMap = new Map();
  for (const row of rows) {
    if (!uniqueMap.has(row.sku)) {
      uniqueMap.set(row.sku, row);
    }
  }

  const uniqueRows = Array.from(uniqueMap.values());
  const existing = await prisma.card.findMany({
    where: { refCode: { in: uniqueRows.map((row) => row.sku) } },
    select: { refCode: true }
  });
  const existingSkuSet = new Set(existing.map((row) => row.refCode));

  const toCreate = uniqueRows.filter((row) => !existingSkuSet.has(row.sku));

  if (toCreate.length > 0) {
    const batches = chunkArray(toCreate, 200);
    for (const batch of batches) {
      await prisma.card.createMany({
        data: batch.map((row) => ({
          refCode: row.sku,
          title: row.name,
          description: null,
          tags: null,
          dimensions: null,
          weight: null,
          boxQty: null,
          price: null,
        })),
      });
    }
  }

  console.log(`total_csv=${rows.length}`);
  console.log(`total_unicos=${uniqueRows.length}`);
  console.log(`ja_existiam=${existingSkuSet.size}`);
  console.log(`inseridos=${toCreate.length}`);
};

run()
  .catch((error) => {
    console.error('Falha na importacao:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });