import express from 'express';
import { query } from '../db.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';

const router = express.Router();

router.use(requireAuth);

router.get('/summary', requirePermission('overview', 'view'), async (req, res) => {
  const year = Number.parseInt(req.query.year, 10) || new Date().getFullYear();

  const totalPeople = await query('SELECT COUNT(*)::int AS count FROM people WHERE program_year = $1', [year]);
  const onboarded = await query(
    "SELECT COUNT(*)::int AS count FROM people WHERE program_year = $1 AND onboarding_status = 'onboarded'",
    [year]
  );
  const inReview = await query(
    "SELECT COUNT(*)::int AS count FROM people WHERE program_year = $1 AND onboarding_status IN ('registered', 'in_review', 'approved')",
    [year]
  );
  const gender = await query(
    `SELECT COALESCE(NULLIF(gender, ''), 'Unknown') AS label, COUNT(*)::int AS value
     FROM people
     WHERE program_year = $1
     GROUP BY 1
     ORDER BY value DESC`,
    [year]
  );
  const regions = await query(
    `SELECT COALESCE(NULLIF(region, ''), 'Unknown') AS label, COUNT(*)::int AS value
     FROM people
     WHERE program_year = $1
     GROUP BY 1
     ORDER BY value DESC`,
    [year]
  );
  const cities = await query(
    `SELECT COALESCE(NULLIF(city, ''), 'Unknown') AS label, COUNT(*)::int AS value
     FROM people
     WHERE program_year = $1
     GROUP BY 1
     ORDER BY value DESC
     LIMIT 8`,
    [year]
  );
  const ageRanges = await query(
    `WITH ranges AS (
      SELECT * FROM (VALUES
        ('0-17', 1, 0, 17),
        ('18-24', 2, 18, 24),
        ('25-34', 3, 25, 34),
        ('35-44', 4, 35, 44),
        ('45-54', 5, 45, 54),
        ('55-64', 6, 55, 64),
        ('65+', 7, 65, 1000)
      ) AS v(label, sort_order, min_age, max_age)
    ),
    known AS (
      SELECT
        ranges.label,
        ranges.sort_order,
        COUNT(people.id)::int AS value
      FROM ranges
      LEFT JOIN people
        ON people.program_year = $1
       AND people.age BETWEEN ranges.min_age AND ranges.max_age
      GROUP BY ranges.label, ranges.sort_order
    ),
    unknown AS (
      SELECT
        'Unknown'::text AS label,
        8::int AS sort_order,
        COUNT(*)::int AS value
      FROM people
      WHERE program_year = $1
        AND (age IS NULL OR age < 0)
    )
    SELECT label, value
    FROM (
      SELECT * FROM known
      UNION ALL
      SELECT * FROM unknown
    ) grouped
    WHERE value > 0
    ORDER BY sort_order`,
    [year]
  );
  const thisWeek = await query(
    `SELECT COUNT(*)::int AS count FROM people
     WHERE program_year = $1 AND registration_date >= (current_date - interval '7 days')`,
    [year]
  );
  const reasons = await query(
    `SELECT COALESCE(NULLIF(reason_for_coming, ''), 'Unknown') AS label, COUNT(*)::int AS value
     FROM people
     WHERE program_year = $1
     GROUP BY 1
     ORDER BY value DESC`,
    [year]
  );
  const mainReasonHighlights = await query(
    `SELECT
      COUNT(*) FILTER (WHERE LOWER(TRIM(COALESCE(reason_for_coming, ''))) = 'general screening')::int AS "generalScreening",
      COUNT(*) FILTER (WHERE LOWER(TRIM(COALESCE(reason_for_coming, ''))) = 'eye screening')::int AS "eyeScreening",
      COUNT(*) FILTER (WHERE LOWER(TRIM(COALESCE(reason_for_coming, ''))) = 'nhis')::int AS "nhis"
     FROM people
     WHERE program_year = $1`,
    [year]
  );
  const reasonTrend = await query(
    `WITH months AS (
      SELECT make_date($1, 1, 1) + (gs || ' months')::interval AS month_start
      FROM generate_series(0, 11) gs
     ),
     reason_counts AS (
      SELECT date_trunc('month', registration_date) AS month_start,
             COUNT(*) FILTER (
               WHERE LOWER(TRIM(COALESCE(reason_for_coming, ''))) = 'general screening'
             )::int AS "generalScreening",
             COUNT(*) FILTER (
               WHERE LOWER(TRIM(COALESCE(reason_for_coming, ''))) = 'eye screening'
             )::int AS "eyeScreening",
             COUNT(*) FILTER (
               WHERE LOWER(TRIM(COALESCE(reason_for_coming, ''))) = 'nhis'
             )::int AS "nhis"
      FROM people
      WHERE program_year = $1
      GROUP BY 1
     )
     SELECT to_char(months.month_start, 'Mon') AS label,
            COALESCE(reason_counts."generalScreening", 0)::int AS "generalScreening",
            COALESCE(reason_counts."eyeScreening", 0)::int AS "eyeScreening",
            COALESCE(reason_counts."nhis", 0)::int AS "nhis"
     FROM months
     LEFT JOIN reason_counts ON reason_counts.month_start = months.month_start
     ORDER BY months.month_start;`,
    [year]
  );

  const trend = await query(
    `WITH months AS (
      SELECT make_date($1, 1, 1) + (gs || ' months')::interval AS month_start
      FROM generate_series(0, 11) gs
     ),
     registrations AS (
      SELECT date_trunc('month', registration_date) AS month_start, COUNT(*)::int AS count
      FROM people
      WHERE program_year = $1
      GROUP BY 1
     )
     SELECT to_char(months.month_start, 'Mon') AS label,
            COALESCE(registrations.count, 0) AS value
     FROM months
     LEFT JOIN registrations ON registrations.month_start = months.month_start
     ORDER BY months.month_start;`
    ,
    [year]
  );

  return res.json({
    totals: {
      people: totalPeople.rows[0].count,
      onboarded: onboarded.rows[0].count,
      inReview: inReview.rows[0].count,
      newThisWeek: thisWeek.rows[0].count
    },
    trend: trend.rows,
    gender: gender.rows,
    regions: regions.rows,
    cities: cities.rows,
    ageRanges: ageRanges.rows,
    reasons: reasons.rows,
    mainReasonHighlights: mainReasonHighlights.rows[0],
    reasonTrend: reasonTrend.rows
  });
});

export default router;
