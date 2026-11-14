ALTER TABLE assignments
  ADD COLUMN assignment_type ENUM('file', 'choice', 'text') NOT NULL DEFAULT 'file' AFTER grade,
  ADD COLUMN question_text TEXT DEFAULT NULL AFTER assignment_type,
  ADD COLUMN choices_json JSON DEFAULT NULL AFTER question_text,
  ADD COLUMN correct_choice TINYINT UNSIGNED DEFAULT NULL AFTER choices_json,
  ADD COLUMN resource_stored_filename VARCHAR(80) DEFAULT NULL AFTER correct_choice,
  ADD COLUMN resource_original_filename VARCHAR(180) DEFAULT NULL AFTER resource_stored_filename,
  ADD COLUMN resource_mime_type VARCHAR(100) DEFAULT NULL AFTER resource_original_filename,
  ADD COLUMN resource_file_size INT UNSIGNED DEFAULT NULL AFTER resource_mime_type;

CREATE TABLE assignment_answers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  assignment_id BIGINT UNSIGNED NOT NULL,
  student_id BIGINT UNSIGNED NOT NULL,
  selected_choice TINYINT UNSIGNED DEFAULT NULL,
  answer_text TEXT DEFAULT NULL,
  is_correct TINYINT(1) DEFAULT NULL,
  submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_assignment_answers_student (assignment_id, student_id),
  CONSTRAINT fk_assignment_answers_assignment FOREIGN KEY (assignment_id) REFERENCES assignments (id) ON DELETE CASCADE,
  CONSTRAINT fk_assignment_answers_student FOREIGN KEY (student_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
