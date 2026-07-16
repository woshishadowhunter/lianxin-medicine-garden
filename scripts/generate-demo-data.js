#!/usr/bin/env node

const { writeFileSync, mkdirSync } = require('node:fs');
const { join } = require('node:path');

const communities = ['Sunrise Community', 'Riverside Community', 'Garden School'];
const plants = [
  { code: 'mint', name: 'Mint', category: 'herb' },
  { code: 'basil', name: 'Basil', category: 'herb' },
  { code: 'tomato', name: 'Cherry Tomato', category: 'vegetable' },
  { code: 'marigold', name: 'Marigold', category: 'flower' },
];
const careTypes = ['water', 'fertilize', 'weed', 'pest_check'];

function family(index) {
  return {
    family_code: `D${String(index).padStart(3, '0')}`,
    community: communities[index % communities.length],
    phone: `1390000${String(index).padStart(4, '0')}`,
    contact_name: `Demo Family ${index}`,
    member_count: 2 + (index % 4),
    openid: '',
    is_active: true,
  };
}

function task(familyCode, plant, offset) {
  return {
    family_code: familyCode,
    plant_code: plant.code,
    plant_name: plant.name,
    plant_category: plant.category,
    plant_date: '2026-04-20',
    status: 'growing',
    care_count: 3 + offset,
  };
}

function record(familyCode, plant, index) {
  return {
    family_code: familyCode,
    plant_code: plant.code,
    plant_name: plant.name,
    care_type: careTypes[index % careTypes.length],
    care_date: `2026-05-${String(10 + index).padStart(2, '0')}`,
    audit_status: index % 5 === 0 ? 'pending' : 'confirmed',
    points_status: index % 5 === 0 ? 'none' : 'awarded',
    description: `Demo care note ${index}: photo evidence would be attached in production.`,
    photos: [`cloud://demo/family-${familyCode}/record-${index}.jpg`],
  };
}

function main() {
  const count = Number(process.argv[2] || 12);
  const families = Array.from({ length: count }, (_, index) => family(index + 1));
  const plantingTasks = [];
  const careRecords = [];
  const pointsAccounts = [];

  families.forEach((item, familyIndex) => {
    const assigned = plants.slice(0, 2 + (familyIndex % 2));
    assigned.forEach((plant, plantIndex) => {
      plantingTasks.push(task(item.family_code, plant, plantIndex));
      careRecords.push(record(item.family_code, plant, familyIndex + plantIndex));
    });
    pointsAccounts.push({
      family_code: item.family_code,
      balance: 20 + familyIndex * 10,
      total_earned: 40 + familyIndex * 10,
      total_reversed: 0,
      transaction_count: 4 + familyIndex,
      version: 1,
    });
  });

  const outDir = join(process.cwd(), 'docs', 'demo-data');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'demo-dataset.json'), JSON.stringify({
    generated_at: new Date().toISOString(),
    note: 'Synthetic demo data. Do not mix with production collections.',
    families,
    plants,
    planting_tasks: plantingTasks,
    care_records: careRecords,
    points_accounts: pointsAccounts,
  }, null, 2));
  console.log(`Wrote ${join(outDir, 'demo-dataset.json')}`);
}

main();

