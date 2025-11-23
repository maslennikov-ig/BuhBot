/**
 * BuhBot Database Seed Script
 *
 * Seeds initial GlobalSettings and Russian federal holidays for 2025.
 * Idempotent: safe to run multiple times (uses upsert).
 *
 * Usage: pnpm prisma:seed
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Russian Federal Holidays 2025
// Source: https://www.consultant.ru/law/ref/calendar/proizvodstvennye/
const RUSSIAN_HOLIDAYS_2025 = [
  // Новогодние праздники (New Year holidays)
  { date: '2025-01-01', name: 'Новогодние каникулы', year: 2025 },
  { date: '2025-01-02', name: 'Новогодние каникулы', year: 2025 },
  { date: '2025-01-03', name: 'Новогодние каникулы', year: 2025 },
  { date: '2025-01-04', name: 'Новогодние каникулы', year: 2025 },
  { date: '2025-01-05', name: 'Новогодние каникулы', year: 2025 },
  { date: '2025-01-06', name: 'Новогодние каникулы', year: 2025 },
  { date: '2025-01-07', name: 'Рождество Христово', year: 2025 },
  { date: '2025-01-08', name: 'Новогодние каникулы', year: 2025 },
  // Другие праздники (Other holidays)
  { date: '2025-02-23', name: 'День защитника Отечества', year: 2025 },
  { date: '2025-03-08', name: 'Международный женский день', year: 2025 },
  { date: '2025-05-01', name: 'Праздник Весны и Труда', year: 2025 },
  { date: '2025-05-09', name: 'День Победы', year: 2025 },
  { date: '2025-06-12', name: 'День России', year: 2025 },
  { date: '2025-11-04', name: 'День народного единства', year: 2025 },
];

// Default global settings for BuhBot
const DEFAULT_GLOBAL_SETTINGS = {
  id: 'default',
  defaultTimezone: 'Europe/Moscow',
  defaultWorkingDays: [1, 2, 3, 4, 5], // Mon-Fri
  defaultStartTime: '09:00',
  defaultEndTime: '18:00',
  defaultSlaThreshold: 60, // 60 minutes
  maxEscalations: 5,
  escalationIntervalMin: 30, // 30 minutes
  globalManagerIds: [] as string[],
  aiConfidenceThreshold: 0.7,
  messagePreviewLength: 500,
  dataRetentionYears: 3,
};

async function seedGlobalSettings(): Promise<void> {
  console.log('Seeding GlobalSettings...');

  const result = await prisma.globalSettings.upsert({
    where: { id: 'default' },
    update: {}, // Don't overwrite existing settings
    create: DEFAULT_GLOBAL_SETTINGS,
  });

  console.log(`  GlobalSettings: ${result.id} (timezone: ${result.defaultTimezone})`);
}

async function seedHolidays(): Promise<void> {
  console.log('Seeding Russian Federal Holidays 2025...');

  let created = 0;
  let skipped = 0;

  for (const holiday of RUSSIAN_HOLIDAYS_2025) {
    const holidayDate = new Date(holiday.date);

    try {
      await prisma.globalHoliday.upsert({
        where: { date: holidayDate },
        update: {}, // Don't overwrite existing holidays
        create: {
          date: holidayDate,
          name: holiday.name,
          year: holiday.year,
        },
      });
      created++;
    } catch (error) {
      // Handle potential race conditions or constraint violations
      skipped++;
      console.log(`  Skipped: ${holiday.date} - ${holiday.name}`);
    }
  }

  console.log(`  Holidays: ${created} created, ${skipped} skipped`);
}

async function main(): Promise<void> {
  console.log('Seeding database...\n');

  try {
    await seedGlobalSettings();
    console.log('');
    await seedHolidays();
    console.log('\nSeed complete');
  } catch (error) {
    console.error('Seed failed:', error);
    throw error;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
