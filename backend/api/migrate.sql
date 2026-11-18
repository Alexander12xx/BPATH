-- BrightPath migration for an EXISTING InfinityFree database.
-- Step 1: export a backup in phpMyAdmin.
-- Step 2: run THIS file once in phpMyAdmin > SQL.
-- Step 3: run schema.sql once (it creates the new tables, badges, settings,
--         and starter lessons; existing tables are left untouched).
--
-- MariaDB 10.3+ (InfinityFree) supports "ADD COLUMN IF NOT EXISTS".
-- Re-running this file is safe.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS avatar VARCHAR(32) NOT NULL DEFAULT 'star' AFTER grade,
  ADD COLUMN IF NOT EXISTS family_code CHAR(8) DEFAULT NULL AFTER avatar,
  ADD COLUMN IF NOT EXISTS guardian_email VARCHAR(190) DEFAULT NULL AFTER family_code,
  ADD COLUMN IF NOT EXISTS guardian_consent_at DATETIME DEFAULT NULL AFTER guardian_email,
  ADD COLUMN IF NOT EXISTS must_change_password TINYINT(1) NOT NULL DEFAULT 0 AFTER guardian_consent_at,
  ADD COLUMN IF NOT EXISTS last_login_at DATETIME DEFAULT NULL AFTER active,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at;

ALTER TABLE users
  MODIFY COLUMN role ENUM('student','parent','tutor','school_admin','admin') NOT NULL DEFAULT 'student';

-- ---------------------------------------------------------------------------
-- schools
-- ---------------------------------------------------------------------------
ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS invite_code CHAR(8) DEFAULT NULL AFTER email,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at;

-- ---------------------------------------------------------------------------
-- assignments (older BrightPath databases are missing these columns)
-- ---------------------------------------------------------------------------
ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS correct_choice TINYINT UNSIGNED DEFAULT NULL AFTER choices_json,
  ADD COLUMN IF NOT EXISTS resource_stored_filename VARCHAR(80) DEFAULT NULL AFTER correct_choice,
  ADD COLUMN IF NOT EXISTS resource_original_filename VARCHAR(180) DEFAULT NULL AFTER resource_stored_filename,
  ADD COLUMN IF NOT EXISTS resource_mime_type VARCHAR(100) DEFAULT NULL AFTER resource_original_filename,
  ADD COLUMN IF NOT EXISTS resource_file_size INT UNSIGNED DEFAULT NULL AFTER resource_mime_type,
  ADD COLUMN IF NOT EXISTS points SMALLINT UNSIGNED NOT NULL DEFAULT 10 AFTER resource_file_size,
  ADD COLUMN IF NOT EXISTS due_at DATE DEFAULT NULL AFTER points,
  ADD COLUMN IF NOT EXISTS status ENUM('draft','published','closed') NOT NULL DEFAULT 'published' AFTER due_at,
  ADD COLUMN IF NOT EXISTS school_id BIGINT UNSIGNED DEFAULT NULL AFTER status,
  ADD COLUMN IF NOT EXISTS class_id BIGINT UNSIGNED DEFAULT NULL AFTER school_id,
  ADD COLUMN IF NOT EXISTS lesson_id BIGINT UNSIGNED DEFAULT NULL AFTER class_id,
  ADD COLUMN IF NOT EXISTS created_by BIGINT UNSIGNED DEFAULT NULL AFTER lesson_id,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER created_by,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at;

-- ---------------------------------------------------------------------------
-- submissions
-- ---------------------------------------------------------------------------
ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS status ENUM('submitted','reviewed') NOT NULL DEFAULT 'submitted' AFTER notes,
  ADD COLUMN IF NOT EXISTS feedback VARCHAR(2000) NOT NULL DEFAULT '' AFTER status,
  ADD COLUMN IF NOT EXISTS grade TINYINT UNSIGNED DEFAULT NULL AFTER feedback,
  ADD COLUMN IF NOT EXISTS reviewed_by BIGINT UNSIGNED DEFAULT NULL AFTER grade,
  ADD COLUMN IF NOT EXISTS reviewed_at DATETIME DEFAULT NULL AFTER reviewed_by;

-- ---------------------------------------------------------------------------
-- assignment_answers
-- ---------------------------------------------------------------------------
ALTER TABLE assignment_answers
  ADD COLUMN IF NOT EXISTS points TINYINT UNSIGNED DEFAULT NULL AFTER is_correct,
  ADD COLUMN IF NOT EXISTS feedback VARCHAR(2000) NOT NULL DEFAULT '' AFTER points,
  ADD COLUMN IF NOT EXISTS reviewed_by BIGINT UNSIGNED DEFAULT NULL AFTER feedback,
  ADD COLUMN IF NOT EXISTS reviewed_at DATETIME DEFAULT NULL AFTER reviewed_by;

-- ---------------------------------------------------------------------------
-- tutors (older database already has this table; keep it consistent)
-- ---------------------------------------------------------------------------
ALTER TABLE tutors
  ADD COLUMN IF NOT EXISTS verified TINYINT(1) NOT NULL DEFAULT 0 AFTER hourly_rate;

-- ---------------------------------------------------------------------------
-- Useful indexes. These use IF NOT EXISTS so re-running is harmless.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS ix_users_role_active ON users (role, active);
CREATE INDEX IF NOT EXISTS ix_users_family_code ON users (family_code);
CREATE INDEX IF NOT EXISTS ix_assignments_school ON assignments (school_id);
CREATE INDEX IF NOT EXISTS ix_assignments_creator ON assignments (created_by);
CREATE INDEX IF NOT EXISTS ix_submissions_status ON submissions (status, submitted_at);
CREATE UNIQUE INDEX IF NOT EXISTS uq_schools_invite ON schools (invite_code);

-- Done. Now run schema.sql to create new feature tables and starter content.
