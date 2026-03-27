-- Optional seed data for local testing

INSERT INTO people (first_name, last_name, gender, phone, city, region, onboarding_status, program_year)
VALUES
  ('Ama', 'Boateng', 'Female', '0240000000', 'Accra', 'Greater Accra', 'registered', (EXTRACT(YEAR FROM current_date))::int),
  ('Kwame', 'Mensah', 'Male', '0200000000', 'Kumasi', 'Ashanti', 'onboarded', (EXTRACT(YEAR FROM current_date))::int),
  ('Esi', 'Owusu', 'Female', '0260000000', 'Cape Coast', 'Central', 'in_review', (EXTRACT(YEAR FROM current_date))::int)
ON CONFLICT DO NOTHING;
