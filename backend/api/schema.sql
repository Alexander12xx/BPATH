-- BrightPath production schema (MariaDB / MySQL, utf8mb4)
-- Import this file into an EMPTY database (phpMyAdmin > Import).
-- For the existing InfinityFree database, run migrate.sql instead.
-- Do NOT edit users/roles by hand; create the first administrator through the app setup screen.

SET NAMES utf8mb4;
SET time_zone = '+00:00';
SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------------
-- People and schools
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('student','parent','tutor','school_admin','admin') NOT NULL DEFAULT 'student',
  school_id BIGINT UNSIGNED DEFAULT NULL,
  grade TINYINT UNSIGNED DEFAULT NULL,
  avatar VARCHAR(32) NOT NULL DEFAULT 'star',
  family_code CHAR(8) DEFAULT NULL,
  guardian_email VARCHAR(190) DEFAULT NULL,
  guardian_consent_at DATETIME DEFAULT NULL,
  must_change_password TINYINT(1) NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1,
  last_login_at DATETIME DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  UNIQUE KEY uq_users_family_code (family_code),
  KEY ix_users_role_active (role, active),
  KEY ix_users_school (school_id),
  CONSTRAINT chk_users_grade CHECK (grade IS NULL OR grade BETWEEN 1 AND 8)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS schools (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(180) NOT NULL,
  address VARCHAR(255) DEFAULT NULL,
  phone VARCHAR(40) DEFAULT NULL,
  email VARCHAR(190) DEFAULT NULL,
  invite_code CHAR(8) DEFAULT NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_schools_invite (invite_code),
  KEY fk_schools_creator (created_by),
  CONSTRAINT fk_schools_creator FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tutors (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  school_id BIGINT UNSIGNED DEFAULT NULL,
  subjects VARCHAR(255) DEFAULT NULL,
  bio TEXT DEFAULT NULL,
  hourly_rate DECIMAL(8,2) DEFAULT NULL,
  verified TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_tutors_user (user_id),
  KEY fk_tutors_school (school_id),
  CONSTRAINT fk_tutors_school FOREIGN KEY (school_id) REFERENCES schools (id) ON DELETE SET NULL,
  CONSTRAINT fk_tutors_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Sessions, login rate limiting, recovery
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS api_tokens (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  last_used_at DATETIME DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_api_tokens_hash (token_hash),
  KEY ix_api_tokens_expiry (expires_at),
  KEY fk_api_tokens_user (user_id),
  CONSTRAINT fk_api_tokens_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS login_attempts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email_hash CHAR(64) NOT NULL,
  ip_hash CHAR(64) NOT NULL,
  success TINYINT(1) NOT NULL DEFAULT 0,
  attempted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_login_email_time (email_hash, attempted_at),
  KEY ix_login_ip_time (ip_hash, attempted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS password_resets (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_password_resets_hash (token_hash),
  KEY fk_password_resets_user (user_id),
  CONSTRAINT fk_password_resets_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Family and classroom relationships
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS parent_child_links (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  parent_id BIGINT UNSIGNED NOT NULL,
  student_id BIGINT UNSIGNED NOT NULL,
  status ENUM('pending','active','revoked') NOT NULL DEFAULT 'pending',
  requested_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_parent_child (parent_id, student_id),
  KEY fk_parent_links_student (student_id),
  CONSTRAINT fk_parent_links_parent FOREIGN KEY (parent_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_parent_links_student FOREIGN KEY (student_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tutor_students (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tutor_id BIGINT UNSIGNED NOT NULL,
  student_id BIGINT UNSIGNED NOT NULL,
  status ENUM('active','ended') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_tutor_student (tutor_id, student_id),
  KEY fk_tutor_students_student (student_id),
  CONSTRAINT fk_tutor_students_tutor FOREIGN KEY (tutor_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_tutor_students_student FOREIGN KEY (student_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Learning content
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lessons (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  title VARCHAR(180) NOT NULL,
  subject VARCHAR(60) NOT NULL DEFAULT 'General',
  grade TINYINT UNSIGNED NOT NULL,
  description VARCHAR(1000) NOT NULL DEFAULT '',
  content MEDIUMTEXT DEFAULT NULL,
  icon VARCHAR(32) NOT NULL DEFAULT 'book',
  theme VARCHAR(16) NOT NULL DEFAULT 'purple',
  estimated_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 15,
  points SMALLINT UNSIGNED NOT NULL DEFAULT 20,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  school_id BIGINT UNSIGNED DEFAULT NULL,
  published TINYINT(1) NOT NULL DEFAULT 1,
  created_by BIGINT UNSIGNED DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_lessons_grade_published (grade, published, sort_order),
  KEY ix_lessons_school (school_id),
  CONSTRAINT chk_lessons_grade CHECK (grade BETWEEN 1 AND 8)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lesson_questions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  lesson_id BIGINT UNSIGNED NOT NULL,
  prompt VARCHAR(1000) NOT NULL,
  choices_json JSON NOT NULL,
  correct_choice TINYINT UNSIGNED NOT NULL,
  explanation VARCHAR(600) NOT NULL DEFAULT '',
  points TINYINT UNSIGNED NOT NULL DEFAULT 5,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY fk_lesson_questions_lesson (lesson_id),
  CONSTRAINT fk_lesson_questions_lesson FOREIGN KEY (lesson_id) REFERENCES lessons (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lesson_progress (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  lesson_id BIGINT UNSIGNED NOT NULL,
  student_id BIGINT UNSIGNED NOT NULL,
  status ENUM('started','completed') NOT NULL DEFAULT 'started',
  score TINYINT UNSIGNED NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  completed_at DATETIME DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_lesson_progress (lesson_id, student_id),
  KEY fk_lesson_progress_student (student_id),
  CONSTRAINT fk_lesson_progress_lesson FOREIGN KEY (lesson_id) REFERENCES lessons (id) ON DELETE CASCADE,
  CONSTRAINT fk_lesson_progress_student FOREIGN KEY (student_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS learning_activity (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_id BIGINT UNSIGNED NOT NULL,
  activity_type VARCHAR(40) NOT NULL,
  detail VARCHAR(180) NOT NULL DEFAULT '',
  minutes SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  points SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_activity_student_time (student_id, created_at),
  CONSTRAINT fk_activity_student FOREIGN KEY (student_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS badges (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(40) NOT NULL,
  title VARCHAR(80) NOT NULL,
  description VARCHAR(240) NOT NULL DEFAULT '',
  icon VARCHAR(32) NOT NULL DEFAULT 'star',
  theme VARCHAR(16) NOT NULL DEFAULT 'purple',
  PRIMARY KEY (id),
  UNIQUE KEY uq_badges_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_badges (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  badge_code VARCHAR(40) NOT NULL,
  awarded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_user_badges (user_id, badge_code),
  CONSTRAINT fk_user_badges_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Assignments and student work
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS assignments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  title VARCHAR(180) NOT NULL,
  description TEXT DEFAULT NULL,
  grade TINYINT UNSIGNED NOT NULL,
  assignment_type ENUM('file','choice','text') NOT NULL DEFAULT 'file',
  question_text TEXT DEFAULT NULL,
  choices_json JSON DEFAULT NULL,
  correct_choice TINYINT UNSIGNED DEFAULT NULL,
  resource_stored_filename VARCHAR(80) DEFAULT NULL,
  resource_original_filename VARCHAR(180) DEFAULT NULL,
  resource_mime_type VARCHAR(100) DEFAULT NULL,
  resource_file_size INT UNSIGNED DEFAULT NULL,
  points SMALLINT UNSIGNED NOT NULL DEFAULT 10,
  due_at DATE DEFAULT NULL,
  status ENUM('draft','published','closed') NOT NULL DEFAULT 'published',
  school_id BIGINT UNSIGNED DEFAULT NULL,
  class_id BIGINT UNSIGNED DEFAULT NULL,
  lesson_id BIGINT UNSIGNED DEFAULT NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_assignments_grade_status_due (grade, status, due_at),
  KEY ix_assignments_school (school_id),
  KEY fk_assignments_creator (created_by),
  CONSTRAINT fk_assignments_creator FOREIGN KEY (created_by) REFERENCES users (id),
  CONSTRAINT chk_assignments_grade CHECK (grade BETWEEN 1 AND 8)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS submissions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  assignment_id BIGINT UNSIGNED NOT NULL,
  student_id BIGINT UNSIGNED NOT NULL,
  stored_filename VARCHAR(80) NOT NULL,
  original_filename VARCHAR(180) NOT NULL,
  mime_type VARCHAR(80) NOT NULL,
  file_size INT UNSIGNED NOT NULL,
  notes VARCHAR(1000) NOT NULL DEFAULT '',
  status ENUM('submitted','reviewed') NOT NULL DEFAULT 'submitted',
  feedback VARCHAR(2000) NOT NULL DEFAULT '',
  grade TINYINT UNSIGNED DEFAULT NULL,
  reviewed_by BIGINT UNSIGNED DEFAULT NULL,
  reviewed_at DATETIME DEFAULT NULL,
  submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_submissions_assignment_student (assignment_id, student_id),
  KEY fk_submissions_student (student_id),
  KEY ix_submissions_status (status, submitted_at),
  CONSTRAINT fk_submissions_assignment FOREIGN KEY (assignment_id) REFERENCES assignments (id) ON DELETE CASCADE,
  CONSTRAINT fk_submissions_student FOREIGN KEY (student_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS assignment_answers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  assignment_id BIGINT UNSIGNED NOT NULL,
  student_id BIGINT UNSIGNED NOT NULL,
  selected_choice TINYINT UNSIGNED DEFAULT NULL,
  answer_text TEXT DEFAULT NULL,
  is_correct TINYINT(1) DEFAULT NULL,
  points TINYINT UNSIGNED DEFAULT NULL,
  feedback VARCHAR(2000) NOT NULL DEFAULT '',
  reviewed_by BIGINT UNSIGNED DEFAULT NULL,
  reviewed_at DATETIME DEFAULT NULL,
  submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_assignment_answers_student (assignment_id, student_id),
  KEY fk_assignment_answers_student (student_id),
  CONSTRAINT fk_assignment_answers_assignment FOREIGN KEY (assignment_id) REFERENCES assignments (id) ON DELETE CASCADE,
  CONSTRAINT fk_assignment_answers_student FOREIGN KEY (student_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Live classes (Jitsi Meet)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS classes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  title VARCHAR(180) NOT NULL,
  subject VARCHAR(60) NOT NULL DEFAULT 'General',
  grade TINYINT UNSIGNED NOT NULL,
  tutor_id BIGINT UNSIGNED NOT NULL,
  school_id BIGINT UNSIGNED DEFAULT NULL,
  scheduled_at DATETIME NOT NULL,
  duration_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 45,
  audio_only TINYINT(1) NOT NULL DEFAULT 0,
  allow_recording TINYINT(1) NOT NULL DEFAULT 0,
  recording_url VARCHAR(500) DEFAULT NULL,
  status ENUM('scheduled','live','ended','cancelled') NOT NULL DEFAULT 'scheduled',
  room_name VARCHAR(80) NOT NULL,
  join_code CHAR(6) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_classes_room (room_name),
  KEY ix_classes_time (scheduled_at, status),
  KEY ix_classes_grade (grade, school_id),
  KEY fk_classes_tutor (tutor_id),
  CONSTRAINT fk_classes_tutor FOREIGN KEY (tutor_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT chk_classes_grade CHECK (grade BETWEEN 1 AND 8)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS class_attendance (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  class_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  left_at DATETIME DEFAULT NULL,
  minutes SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_class_attendance (class_id, user_id),
  KEY fk_class_attendance_user (user_id),
  CONSTRAINT fk_class_attendance_class FOREIGN KEY (class_id) REFERENCES classes (id) ON DELETE CASCADE,
  CONSTRAINT fk_class_attendance_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS class_messages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  class_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  body VARCHAR(1000) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME DEFAULT NULL,
  PRIMARY KEY (id),
  KEY ix_class_messages_class (class_id, created_at),
  CONSTRAINT fk_class_messages_class FOREIGN KEY (class_id) REFERENCES classes (id) ON DELETE CASCADE,
  CONSTRAINT fk_class_messages_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Messaging
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS conversations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  title VARCHAR(180) NOT NULL DEFAULT '',
  kind ENUM('direct','group','class') NOT NULL DEFAULT 'direct',
  class_id BIGINT UNSIGNED DEFAULT NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY fk_conversations_creator (created_by),
  CONSTRAINT fk_conversations_creator FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS conversation_members (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  conversation_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  last_read_at DATETIME DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_conversation_member (conversation_id, user_id),
  KEY fk_conversation_members_user (user_id),
  CONSTRAINT fk_conversation_members_conversation FOREIGN KEY (conversation_id) REFERENCES conversations (id) ON DELETE CASCADE,
  CONSTRAINT fk_conversation_members_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS messages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  conversation_id BIGINT UNSIGNED NOT NULL,
  sender_id BIGINT UNSIGNED NOT NULL,
  body VARCHAR(2000) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME DEFAULT NULL,
  PRIMARY KEY (id),
  KEY ix_messages_conversation (conversation_id, created_at),
  CONSTRAINT fk_messages_conversation FOREIGN KEY (conversation_id) REFERENCES conversations (id) ON DELETE CASCADE,
  CONSTRAINT fk_messages_sender FOREIGN KEY (sender_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Notifications, sponsors, games, support, settings, audit
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(160) NOT NULL,
  body VARCHAR(500) NOT NULL DEFAULT '',
  kind VARCHAR(40) NOT NULL DEFAULT 'general',
  page VARCHAR(40) NOT NULL DEFAULT 'home',
  read_at DATETIME DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_notifications_user (user_id, read_at, created_at),
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sponsors (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  title VARCHAR(160) NOT NULL,
  body VARCHAR(500) NOT NULL DEFAULT '',
  label VARCHAR(60) NOT NULL DEFAULT 'Parent-approved pick',
  image_url VARCHAR(500) NOT NULL DEFAULT '',
  target_url VARCHAR(500) NOT NULL DEFAULT '',
  grade_min TINYINT UNSIGNED NOT NULL DEFAULT 1,
  grade_max TINYINT UNSIGNED NOT NULL DEFAULT 8,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_by BIGINT UNSIGNED DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_sponsors_active (active, grade_min, grade_max)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sponsor_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  sponsor_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED DEFAULT NULL,
  event ENUM('impression','click') NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_sponsor_events (sponsor_id, event, created_at),
  CONSTRAINT fk_sponsor_events_sponsor FOREIGN KEY (sponsor_id) REFERENCES sponsors (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS game_scores (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_id BIGINT UNSIGNED NOT NULL,
  game VARCHAR(40) NOT NULL,
  score SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  duration_seconds SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_game_scores_best (game, score),
  KEY ix_game_scores_student (student_id, game),
  CONSTRAINT fk_game_scores_student FOREIGN KEY (student_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS support_messages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED DEFAULT NULL,
  name VARCHAR(120) NOT NULL DEFAULT '',
  email VARCHAR(190) NOT NULL DEFAULT '',
  page VARCHAR(40) NOT NULL DEFAULT '',
  body VARCHAR(2000) NOT NULL,
  status ENUM('open','closed') NOT NULL DEFAULT 'open',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_support_status (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  actor_id BIGINT UNSIGNED DEFAULT NULL,
  action VARCHAR(60) NOT NULL,
  entity VARCHAR(60) NOT NULL DEFAULT '',
  entity_id BIGINT UNSIGNED DEFAULT NULL,
  details_json TEXT DEFAULT NULL,
  ip_hash CHAR(64) NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_audit_actor (actor_id, created_at),
  KEY ix_audit_action (action, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS app_settings (
  setting_key VARCHAR(60) NOT NULL,
  setting_value TEXT DEFAULT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Starting badges and safe defaults
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO badges (code, title, description, icon, theme) VALUES
  ('first_steps', 'First Steps', 'Completed your first lesson.', 'star', 'purple'),
  ('quiz_whiz', 'Quiz Whiz', 'Answered five questions correctly.', 'sparkle', 'mint'),
  ('bookworm', 'Bookworm', 'Finished five lessons.', 'book', 'orange'),
  ('helper', 'Kind Helper', 'Asked for help or supported a classmate.', 'heart', 'peach'),
  ('game_on', 'Game On', 'Finished a brain-break game.', 'rocket', 'blue'),
  ('streak_3', 'Three in a Row', 'Learned on three days in a row.', 'trophy', 'yellow'),
  ('streak_7', 'Week Wonder', 'Learned on seven days in a row.', 'trophy', 'purple'),
  ('team_player', 'Team Player', 'Joined a live class.', 'people', 'blue');

INSERT IGNORE INTO app_settings (setting_key, setting_value) VALUES
  ('app_name', 'BrightPath'),
  ('jitsi_domain', 'meet.jit.si'),
  ('support_email', ''),
  ('welcome_message', 'A little progress every day adds up to something brilliant.');

SET FOREIGN_KEY_CHECKS = 1;


-- ---------------------------------------------------------------------------
-- Starter curriculum (real lessons, available to every grade after import).
-- Schools can add their own lessons; these give every learner a working start.
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO lessons (id, title, subject, grade, description, content, icon, theme, estimated_minutes, points, sort_order, published) VALUES
(1, 'Counting to 20', 'Mathematics', 1, 'Count, tap, and group numbers from 1 to 20.', 'Numbers help us count things all around us.

Count slowly and touch each picture as you say the number:
1, 2, 3, 4, 5, 6, 7, 8, 9, 10.

After 10 comes 11, 12, 13, 14, 15, 16, 17, 18, 19, 20.

Fun tip: count your fingers and toes. How many altogether?', 'star', 'purple', 10, 20, 1, 1),
(2, 'Story detectives: find the main idea', 'Reading', 2, 'Use clues to discover what a story is mostly about.', 'Every story has a main idea. That is what the story is mostly about.

Ask yourself: Who is in the story? What happens? How does it end?

A story about a little bird that learns to fly is mostly about being brave and trying again.

Story detective tip: look at the title and the pictures. They are clues!', 'book', 'orange', 12, 20, 2, 1),
(3, 'Plant power', 'Science', 3, 'Discover how roots, stems, and leaves keep a plant alive.', 'Plants are living things. They need water, light, and air.

Roots hold the plant in the soil and take in water.
The stem carries water up to the leaves.
Leaves use sunlight to make food for the plant.

Try this: look at a plant near your home. Can you name its roots, stem, and leaves?', 'leaf', 'mint', 12, 20, 3, 1),
(4, 'Multiplication magic', 'Mathematics', 4, 'Learn how equal groups make multiplication easy.', 'Multiplication is a fast way to add equal groups.

3 groups of 4 means 4 + 4 + 4 = 12.
We can write it as 3 x 4 = 12.

The answer to a multiplication question is called the product.

Practice tip: use small objects to make equal groups. Count them all to check your answer.', 'sparkle', 'purple', 15, 25, 4, 1),
(5, 'Fractions are friends', 'Mathematics', 5, 'Understand halves, quarters, and equal parts.', 'A fraction shows equal parts of a whole.

If a pizza is cut into 2 equal parts, each part is one half (1/2).
If it is cut into 4 equal parts, each part is one quarter (1/4).

Two quarters make one half.
The bottom number tells how many equal parts there are.
The top number tells how many parts you have.', 'chart', 'purple', 15, 25, 5, 1),
(6, 'The water cycle', 'Science', 6, 'Follow water as it evaporates, condenses, and rains.', 'The Sun heats water in oceans, rivers, and puddles. The water turns into vapour. This is evaporation.

High in the sky the vapour cools and forms tiny droplets. This is condensation. The droplets make clouds.

When the droplets get heavy, they fall as rain, snow, or hail. This is precipitation.

The water then flows back into rivers and oceans, and the cycle begins again.', 'leaf', 'mint', 18, 25, 6, 1),
(7, 'Building a strong paragraph', 'English', 7, 'Write a clear paragraph with a topic sentence and details.', 'A strong paragraph has three parts:

1. A topic sentence that tells the main idea.
2. Supporting details that explain or prove the idea.
3. A closing sentence that wraps it up.

Example topic sentence: Playing outside is good for your body.
Supporting detail: Running and jumping make your heart and muscles stronger.
Closing sentence: That is why a little outdoor play every day matters.', 'pencil', 'orange', 18, 30, 7, 1),
(8, 'Solving one-step equations', 'Mathematics', 8, 'Keep both sides balanced to find the missing number.', 'An equation is like a balance scale. Both sides must stay equal.

If x + 5 = 12, subtract 5 from both sides.
x = 12 - 5
x = 7

Check your answer by putting it back in: 7 + 5 = 12. It works!

The same idea works for subtraction, multiplication, and division. Do the opposite operation to both sides.', 'chart', 'purple', 20, 30, 8, 1);

INSERT IGNORE INTO lesson_questions (id, lesson_id, prompt, choices_json, correct_choice, explanation, points, sort_order) VALUES
(1, 1, 'What number comes after 12?', '["11","13","14"]', 1, 'After 12 comes 13. Numbers grow by one each time.', 5, 1),
(2, 1, 'How many fingers are on two hands?', '["5","10","20"]', 1, 'Each hand has 5 fingers, so 5 + 5 = 10.', 5, 2),
(3, 1, 'Which group has 5 stars?', '["* * *", "* * * * *", "* * * * * * *"]', 1, 'Count each star: one, two, three, four, five.', 5, 3),
(4, 2, 'What is the main idea of a story?', '["The last page","What the story is mostly about","The title font"]', 1, 'The main idea is the big point of the story.', 5, 1),
(5, 2, 'A story about a bird learning to fly is mostly about...', '["Being brave","Counting to ten","Cooking dinner"]', 0, 'The bird tries something new, so being brave is the main idea.', 5, 2),
(6, 2, 'Which clue can help you guess the main idea?', '["The title and pictures","The page number","The cover colour"]', 0, 'Titles and pictures give strong clues about the story.', 5, 3),
(7, 3, 'Which part takes in water from the soil?', '["Roots","Petals","Leaves"]', 0, 'Roots drink water from the soil.', 5, 1),
(8, 3, 'What do leaves use to make food?', '["Sunlight","Stones","Sand"]', 0, 'Leaves use sunlight to make food for the plant.', 5, 2),
(9, 3, 'What carries water up the plant?', '["The stem","The flower","The seed"]', 0, 'The stem is like a tiny pipe carrying water upward.', 5, 3),
(10, 4, 'What is 3 x 4?', '["7","12","34"]', 1, 'Three groups of four equal twelve.', 5, 1),
(11, 4, 'Multiplication is a fast way to...', '["Add equal groups","Subtract numbers","Draw shapes"]', 0, 'It adds the same group again and again.', 5, 2),
(12, 4, 'What do we call the answer to a multiplication question?', '["The product","The sum","The difference"]', 0, 'The answer is called the product.', 5, 3),
(13, 5, 'Which fraction is the same as one half?', '["1/4","2/4","3/4"]', 1, 'Two quarters make one half.', 5, 1),
(14, 5, 'A pizza is cut into 4 equal parts. What is each part?', '["One quarter","One half","One whole"]', 0, 'Four equal parts means each part is one quarter.', 5, 2),
(15, 5, 'In 3/4, what does the 4 tell you?', '["How many equal parts in the whole","How many parts you have","How many pizzas there are"]', 0, 'The bottom number shows the total equal parts.', 5, 3),
(16, 6, 'What is it called when water turns into vapour?', '["Evaporation","Condensation","Precipitation"]', 0, 'Heat causes evaporation.', 5, 1),
(17, 6, 'What forms clouds?', '["Tiny water droplets","Rocks","Sand"]', 0, 'Cooling vapour condenses into tiny droplets.', 5, 2),
(18, 6, 'Rain, snow, and hail are all examples of...', '["Precipitation","Evaporation","Condensation"]', 0, 'Water falling from clouds is precipitation.', 5, 3),
(19, 7, 'What does a topic sentence do?', '["Tells the main idea","Ends the paragraph","Lists every detail"]', 0, 'A topic sentence introduces the main idea.', 5, 1),
(20, 7, 'Which sentence is a supporting detail?', '["Playing outside is good for you.","Running makes your muscles stronger.","That is why play matters."]', 1, 'It explains the main idea with a fact.', 5, 2),
(21, 7, 'Why do we add a closing sentence?', '["To wrap up the idea","To start a new story","To make the paragraph longer"]', 0, 'A closing sentence finishes the thought.', 5, 3),
(22, 8, 'Solve x + 5 = 12. What is x?', '["5","7","17"]', 1, 'Subtract 5 from both sides: x = 7.', 5, 1),
(23, 8, 'To keep an equation balanced, whatever you do to one side you must...', '["Do to the other side","Ignore","Multiply by zero"]', 0, 'Both sides must stay equal.', 5, 2),
(24, 8, 'Check x = 7 in x + 5 = 12. Is it correct?', '["Yes, 7 + 5 = 12","No, it equals 11","No, it equals 13"]', 0, '7 + 5 = 12, so the answer checks out.', 5, 3);
