/**
 * BuhBot Database Seed Script
 *
 * Seeds initial GlobalSettings, Russian federal holidays for 2025,
 * and comprehensive test data for all models.
 * Idempotent: safe to run multiple times (uses upsert).
 *
 * Usage: pnpm prisma:seed
 */

import { PrismaClient, UserRole, ChatType, RequestStatus, AlertType, MessageClassification, AlertDeliveryStatus, TemplateCategory } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { randomUUID } from 'crypto';
import { config } from 'dotenv';

// Load environment variables
config();

const { Pool } = pg;

// Create PostgreSQL connection pool
const connectionString = process.env['DIRECT_URL'] || process.env['DATABASE_URL'];
if (!connectionString) {
  throw new Error('DIRECT_URL or DATABASE_URL environment variable is required');
}

const pool = new Pool({
  connectionString,
  max: 5,
});

// Create Prisma client with driver adapter
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

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

// ============================================================================
// TEST DATA SEED FUNCTIONS
// ============================================================================

// DEV MODE admin user (matches context.ts DEV_MODE_USER)
const DEV_ADMIN = {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  email: 'admin@buhbot.local',
  fullName: 'DEV Admin',
  role: 'admin' as UserRole,
  telegramId: BigInt(100000),
};

// Test user IDs (consistent UUIDs for idempotent seeding)
const TEST_USERS = [
  { id: DEV_ADMIN.id, email: DEV_ADMIN.email, fullName: DEV_ADMIN.fullName, role: DEV_ADMIN.role, telegramId: DEV_ADMIN.telegramId },
  { id: '11111111-1111-1111-1111-111111111111', email: 'admin@buhbot.ru', fullName: 'Иван Администратор', role: 'admin' as UserRole, telegramId: BigInt(100001) },
  { id: '22222222-2222-2222-2222-222222222222', email: 'manager@buhbot.ru', fullName: 'Мария Менеджер', role: 'manager' as UserRole, telegramId: BigInt(100002) },
  { id: '33333333-3333-3333-3333-333333333333', email: 'accountant1@buhbot.ru', fullName: 'Анна Бухгалтер', role: 'observer' as UserRole, telegramId: BigInt(100003) },
  { id: '44444444-4444-4444-4444-444444444444', email: 'accountant2@buhbot.ru', fullName: 'Петр Счетовод', role: 'observer' as UserRole, telegramId: BigInt(100004) },
  { id: '55555555-5555-5555-5555-555555555555', email: 'accountant3@buhbot.ru', fullName: 'Елена Финансист', role: 'observer' as UserRole, telegramId: BigInt(100005) },
];

// Test chat IDs
const TEST_CHATS = [
  { id: BigInt(-1001234567001), title: 'ООО "Ромашка" - Бухгалтерия', accountantIdx: 2, slaMinutes: 60 },
  { id: BigInt(-1001234567002), title: 'ИП Сидоров - Отчётность', accountantIdx: 2, slaMinutes: 45 },
  { id: BigInt(-1001234567003), title: 'ООО "Восток" - Консультации', accountantIdx: 3, slaMinutes: 30 },
  { id: BigInt(-1001234567004), title: 'АО "ТехноПром" - Налоги', accountantIdx: 3, slaMinutes: 60 },
  { id: BigInt(-1001234567005), title: 'ООО "Стройка" - Документы', accountantIdx: 4, slaMinutes: 90 },
];

// Sample client messages
const SAMPLE_MESSAGES = [
  'Добрый день! Подскажите, когда нужно сдать декларацию по НДС за 3 квартал?',
  'Здравствуйте, можете проверить акт сверки с поставщиком?',
  'Нужна справка 2-НДФЛ за прошлый год для сотрудника Иванова',
  'Когда будет готов баланс за полугодие?',
  'Подскажите, как правильно оформить командировочные?',
  'Есть вопрос по начислению зарплаты за ноябрь',
  'Нужно срочно подготовить документы для банка',
  'Когда можно получить акт выполненных работ?',
  'Помогите разобраться с первичной документацией',
  'Вопрос по учёту основных средств',
];

async function seedUsers(): Promise<void> {
  console.log('Seeding test users...');

  for (const user of TEST_USERS) {
    await prisma.user.upsert({
      where: { id: user.id },
      update: {},
      create: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        telegramId: user.telegramId,
        telegramUsername: user.fullName.split(' ')[0]?.toLowerCase(),
        isOnboardingComplete: true,
      },
    });
  }

  console.log(`  Users: ${TEST_USERS.length} created/verified`);
}

async function seedChats(): Promise<void> {
  console.log('Seeding test chats...');

  for (const chat of TEST_CHATS) {
    const accountant = TEST_USERS[chat.accountantIdx];
    await prisma.chat.upsert({
      where: { id: chat.id },
      update: {},
      create: {
        id: chat.id,
        chatType: 'supergroup' as ChatType,
        title: chat.title,
        assignedAccountantId: accountant?.id,
        accountantUsername: accountant?.fullName.split(' ')[0]?.toLowerCase(),
        slaEnabled: true,
        slaResponseMinutes: chat.slaMinutes,
        slaThresholdMinutes: chat.slaMinutes,
        monitoringEnabled: true,
      },
    });
  }

  console.log(`  Chats: ${TEST_CHATS.length} created/verified`);
}

async function seedClientRequests(): Promise<void> {
  console.log('Seeding test client requests...');

  const now = new Date();
  let createdCount = 0;

  // Generate requests for the last 14 days
  for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
    const dayDate = new Date(now);
    dayDate.setDate(dayDate.getDate() - dayOffset);
    dayDate.setHours(0, 0, 0, 0);

    // Skip weekends
    if (dayDate.getDay() === 0 || dayDate.getDay() === 6) continue;

    // 3-8 requests per day
    const requestsPerDay = 3 + Math.floor(Math.random() * 6);

    for (let i = 0; i < requestsPerDay; i++) {
      const chat = TEST_CHATS[Math.floor(Math.random() * TEST_CHATS.length)]!;
      const accountant = TEST_USERS[chat.accountantIdx]!;

      // Random time during working hours (9:00 - 18:00)
      const hour = 9 + Math.floor(Math.random() * 9);
      const minute = Math.floor(Math.random() * 60);
      const receivedAt = new Date(dayDate);
      receivedAt.setHours(hour, minute, 0, 0);

      // Random response time (5-120 minutes)
      const responseTimeMinutes = 5 + Math.floor(Math.random() * 115);
      const responseAt = new Date(receivedAt.getTime() + responseTimeMinutes * 60000);

      // Check if SLA was breached
      const slaBreached = responseTimeMinutes > chat.slaMinutes;

      // Random status (most should be answered)
      const statusRoll = Math.random();
      let status: RequestStatus;
      if (dayOffset === 0 && statusRoll < 0.3) {
        status = statusRoll < 0.15 ? 'pending' : 'in_progress';
      } else {
        status = slaBreached ? 'escalated' : 'answered';
      }

      const message = SAMPLE_MESSAGES[Math.floor(Math.random() * SAMPLE_MESSAGES.length)]!;
      const requestId = randomUUID();

      try {
        await prisma.clientRequest.create({
          data: {
            id: requestId,
            chatId: chat.id,
            messageId: BigInt(Date.now() + i + dayOffset * 100),
            messageText: message,
            clientUsername: `client_${Math.floor(Math.random() * 100)}`,
            receivedAt,
            assignedTo: accountant.id,
            responseAt: status === 'pending' || status === 'in_progress' ? null : responseAt,
            responseTimeMinutes: status === 'pending' || status === 'in_progress' ? null : responseTimeMinutes,
            status,
            classification: 'REQUEST' as MessageClassification,
            classificationScore: 0.95,
            classificationModel: 'keyword-fallback',
            slaTimerStartedAt: receivedAt,
            slaWorkingMinutes: responseTimeMinutes,
            slaBreached,
            respondedBy: status === 'answered' || status === 'escalated' ? accountant.id : null,
          },
        });
        createdCount++;

        // Create SLA alert for breached requests
        if (slaBreached) {
          await prisma.slaAlert.create({
            data: {
              id: randomUUID(),
              requestId,
              alertType: 'breach' as AlertType,
              minutesElapsed: responseTimeMinutes,
              deliveryStatus: 'sent' as AlertDeliveryStatus,
              deliveredAt: new Date(receivedAt.getTime() + chat.slaMinutes * 60000),
              escalationLevel: Math.min(3, Math.floor(responseTimeMinutes / chat.slaMinutes)),
            },
          });
        }
      } catch {
        // Skip duplicates
      }
    }
  }

  console.log(`  Client requests: ${createdCount} created`);
}

async function seedTemplates(): Promise<void> {
  console.log('Seeding test templates...');

  const templates = [
    { title: 'Приветствие', content: 'Добрый день, {{client_name}}! Чем могу помочь?', category: 'greeting' as TemplateCategory },
    { title: 'Запрос документов', content: 'Для обработки вашего запроса, пожалуйста, пришлите {{document_name}}.', category: 'document_request' as TemplateCategory },
    { title: 'Статус готов', content: 'Ваш запрос обработан. {{result_description}}', category: 'status' as TemplateCategory },
    { title: 'Напоминание', content: 'Напоминаем о необходимости {{action}} до {{deadline}}.', category: 'reminder' as TemplateCategory },
    { title: 'Закрытие', content: 'Рады были помочь! Если возникнут вопросы - обращайтесь.', category: 'closing' as TemplateCategory },
  ];

  const adminId = TEST_USERS[0]!.id;

  for (const template of templates) {
    await prisma.template.upsert({
      where: { id: `template-${template.category}` },
      update: {},
      create: {
        id: `template-${template.category}`,
        title: template.title,
        content: template.content,
        category: template.category,
        createdBy: adminId,
        usageCount: Math.floor(Math.random() * 50),
      },
    });
  }

  console.log(`  Templates: ${templates.length} created/verified`);
}

async function seedFaqItems(): Promise<void> {
  console.log('Seeding test FAQ items...');

  const faqItems = [
    { question: 'Когда сдавать декларацию по НДС?', answer: 'Декларация по НДС сдаётся ежеквартально до 25 числа месяца, следующего за отчётным кварталом.', keywords: ['ндс', 'декларация', 'сроки'] },
    { question: 'Как оформить командировку?', answer: 'Для оформления командировки необходимо: 1) Приказ о командировке, 2) Командировочное удостоверение, 3) Авансовый отчёт.', keywords: ['командировка', 'оформление', 'документы'] },
    { question: 'Какие документы нужны для возврата НДС?', answer: 'Для возврата НДС потребуются: счета-фактуры, товарные накладные, акты выполненных работ, платёжные документы.', keywords: ['ндс', 'возврат', 'документы'] },
  ];

  const adminId = TEST_USERS[0]!.id;

  for (let i = 0; i < faqItems.length; i++) {
    const faq = faqItems[i]!;
    await prisma.faqItem.upsert({
      where: { id: `faq-${i + 1}` },
      update: {},
      create: {
        id: `faq-${i + 1}`,
        question: faq.question,
        answer: faq.answer,
        keywords: faq.keywords,
        createdBy: adminId,
        usageCount: Math.floor(Math.random() * 30),
      },
    });
  }

  console.log(`  FAQ items: ${faqItems.length} created/verified`);
}

async function seedFeedbackResponses(): Promise<void> {
  console.log('Seeding test feedback responses...');

  const now = new Date();
  let createdCount = 0;

  // Get existing requests with responses
  const answeredRequests = await prisma.clientRequest.findMany({
    where: {
      status: { in: ['answered', 'escalated'] },
    },
    take: 30,
  });

  for (const request of answeredRequests) {
    // 40% chance of feedback
    if (Math.random() > 0.4) continue;

    try {
      await prisma.feedbackResponse.create({
        data: {
          id: randomUUID(),
          chatId: request.chatId,
          requestId: request.id,
          clientUsername: request.clientUsername,
          rating: Math.floor(Math.random() * 3) + 3, // 3-5 stars mostly
          comment: Math.random() > 0.7 ? 'Спасибо за оперативную помощь!' : null,
          submittedAt: new Date(request.responseAt!.getTime() + Math.random() * 3600000),
        },
      });
      createdCount++;
    } catch {
      // Skip duplicates
    }
  }

  console.log(`  Feedback responses: ${createdCount} created`);
}

async function main(): Promise<void> {
  console.log('Seeding database...\n');

  try {
    // Core settings
    await seedGlobalSettings();
    console.log('');
    await seedHolidays();
    console.log('');

    // Test data
    await seedUsers();
    console.log('');
    await seedChats();
    console.log('');
    await seedClientRequests();
    console.log('');
    await seedTemplates();
    console.log('');
    await seedFaqItems();
    console.log('');
    await seedFeedbackResponses();

    console.log('\nSeed complete!');
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
    await pool.end();
  });
