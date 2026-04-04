import { faker } from '@faker-js/faker';
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST || 'db',
  port: 5432,
  user: process.env.DB_USER || 'isaacaheto',
  password: process.env.DB_PASS || 'isaacaheto',
  database: process.env.DB_NAME || 'medicaid'
});

const REASONS = ['General Screening', 'Eye Screening', 'NHIS', 'Counseling', 'Dental', 'Other'];
const GENDERS = ['Male', 'Female'];
const OCCUPATIONS = ['Student', 'Trader', 'Teacher', 'Nurse', 'Driver', 'Hairdresser', 'Barber', 'Seamstress', 'Tailor', 'Carpenter', 'Farmer', 'Business Owner', 'Civil Servant', 'Unemployed'];
const HEARD_FROM = ['Radio', 'My child told me', 'Information van (with megaphones)', 'On a whatsapp platform', 'Outreach guys with megaphones', 'Poster', 'Influencer (station master/market queen/assembly man)', 'Church/mosque announcement', 'Friends/Family (not my child)', 'Town crier (announcer)'];
const NHIS_SITUATIONS = ['Active', 'Expired', 'Pending', 'Suspended'];
const REGIONS = ['Greater Accra', 'Ashanti', 'Central', 'Eastern', 'Western', 'Northern', 'Volta', 'Brong-Ahafo', 'Upper East', 'Upper West'];
const CITIES = ['Accra', 'Kumasi', 'Cape Coast', 'Tamale', 'Takoradi', 'Sunyani', 'Ho', 'Koforidua', 'Cape Coast', 'Tema'];

async function seedPeople(count) {
  console.log(`Seeding ${count} people...`);
  const batchSize = 100;
  let inserted = 0;

  for (let i = 0; i < count; i += batchSize) {
    const batch = [];
    const batchCount = Math.min(batchSize, count - i);

    for (let j = 0; j < batchCount; j++) {
      const firstName = faker.person.firstName();
      const lastName = faker.person.lastName();
      batch.push({
        firstName,
        lastName,
        gender: faker.helpers.arrayElement(GENDERS),
        age: faker.number.int({ min: 18, max: 80 }),
        phone: faker.phone.number('+233#########'),
        email: faker.internet.email({ firstName, lastName }).toLowerCase(),
        occupation: faker.helpers.arrayElement(OCCUPATIONS),
        registrationSource: faker.helpers.arrayElement(HEARD_FROM),
        reasonForComing: faker.helpers.arrayElement(REASONS),
        addressLine1: faker.location.streetAddress(),
        city: faker.helpers.arrayElement(CITIES),
        region: faker.helpers.arrayElement(REGIONS),
        programYear: 2026,
        onboardingStatus: faker.helpers.arrayElement(['registered', 'in_review', 'approved', 'onboarded']),
        registrationDate: faker.date.between({ from: '2026-01-01', to: '2026-04-04' })
      });
    }

    const values = [];
    const params = [];
    let paramIndex = 1;

    for (const p of batch) {
      values.push(`($${paramIndex}, $${paramIndex+1}, $${paramIndex+2}, $${paramIndex+3}, $${paramIndex+4}, $${paramIndex+5}, $${paramIndex+6}, $${paramIndex+7}, $${paramIndex+8}, $${paramIndex+9}, $${paramIndex+10}, $${paramIndex+11}, $${paramIndex+12}, $${paramIndex+13}, $${paramIndex+14}, $${paramIndex+15})`);
      params.push(p.firstName, p.lastName, p.gender, p.age, p.phone, p.email, p.occupation, p.registrationSource, p.reasonForComing, p.addressLine1, p.city, p.region, p.programYear, p.onboardingStatus, p.registrationDate, faker.string.uuid());
      paramIndex += 16;
    }

    const query = `
      INSERT INTO people (first_name, last_name, gender, age, phone, email, occupation, registration_source, reason_for_coming, address_line1, city, region, program_year, onboarding_status, registration_date, id)
      VALUES ${values.join(', ')}
    `;

    try {
      await pool.query(query, params);
      inserted += batchCount;
      process.stdout.write(`\rPeople: ${inserted}/${count}`);
    } catch (err) {
      console.error('Error inserting people:', err.message);
    }
  }
  console.log(`\nInserted ${inserted} people`);
  return inserted;
}

async function seedNhis(count) {
  console.log(`Seeding ${count} NHIS records...`);
  const batchSize = 100;
  let inserted = 0;

  for (let i = 0; i < count; i += batchSize) {
    const batch = [];
    const batchCount = Math.min(batchSize, count - i);

    for (let j = 0; j < batchCount; j++) {
      batch.push({
        fullName: faker.person.fullName(),
        situationCase: faker.helpers.arrayElement(NHIS_SITUATIONS),
        amount: faker.number.float({ min: 0, max: 100, fractionDigits: 2 }),
        programYear: 2026,
        registrationDate: faker.date.between({ from: '2026-01-01', to: '2026-04-04' })
      });
    }

    const values = [];
    const params = [];
    let paramIndex = 1;

    for (const p of batch) {
      values.push(`($${paramIndex}, $${paramIndex+1}, $${paramIndex+2}, $${paramIndex+3}, $${paramIndex+4}, $${paramIndex+5})`);
      params.push(p.fullName, p.situationCase, p.amount, p.programYear, p.registrationDate, faker.string.uuid());
      paramIndex += 6;
    }

    const query = `
      INSERT INTO nhis_registrations (full_name, situation_case, amount, program_year, registration_date, id)
      VALUES ${values.join(', ')}
    `;

    try {
      await pool.query(query, params);
      inserted += batchCount;
      process.stdout.write(`\rNHIS: ${inserted}/${count}`);
    } catch (err) {
      console.error('Error inserting NHIS:', err.message);
    }
  }
  console.log(`\nInserted ${inserted} NHIS records`);
  return inserted;
}

async function main() {
  const args = process.argv.slice(2);
  const peopleCount = parseInt(args[0] || '1000', 10);
  const nhisCount = parseInt(args[1] || '1000', 10);

  console.log(`Generating ${peopleCount} people and ${nhisCount} NHIS records...\n`);

  const startTime = Date.now();

  try {
    await seedPeople(peopleCount);
    await seedNhis(nhisCount);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\nDone in ${elapsed}s`);

    // Verify counts
    const peopleResult = await pool.query("SELECT COUNT(*)::int as count FROM people WHERE program_year = 2026");
    const nhisResult = await pool.query("SELECT COUNT(*)::int as count FROM nhis_registrations WHERE program_year = 2026");
    console.log(`\nDB Stats:`);
    console.log(`  People: ${peopleResult.rows[0].count}`);
    console.log(`  NHIS: ${nhisResult.rows[0].count}`);

  } finally {
    await pool.end();
  }
}

main().catch(console.error);
