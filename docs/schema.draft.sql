-- =============================================================================
-- Facility Training Platform — DATABASE SCHEMA DRAFT (PostgreSQL 16)
-- -----------------------------------------------------------------------------
-- Status: PROPOSAL for review. Real migrations will be generated from the
-- Drizzle schema in apps/api/src/db/schema/*.ts, hand-edited for the parts
-- Drizzle cannot express (triggers, RLS, partitions, domains).
--
-- Conventions
--   * PKs are uuid. The app generates UUIDv7 (time-ordered, can be created
--     offline on devices); gen_random_uuid() is only a fallback default.
--   * All timestamps are timestamptz (UTC); default display tz Asia/Riyadh.
--   * Localised content = jsonb {"ar": "...", "ur": "...", ...}; Arabic required.
--   * Every business table gets the generic audit trigger (section 12).
--   * DB roles: zaad_owner (migrations, owns objects)
--               zaad_app    (API runtime, subject to RLS)
--               zaad_worker (background jobs, BYPASSRLS, no DDL)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- -----------------------------------------------------------------------------
-- 0. Shared types
-- -----------------------------------------------------------------------------
CREATE TYPE app_language    AS ENUM ('ar','ur','bn','hi','ne','tl','en');
CREATE TYPE user_role       AS ENUM ('admin','trainer','supervisor','worker');
CREATE TYPE gender          AS ENUM ('male','female');
CREATE TYPE user_status     AS ENUM ('active','suspended','terminated');
CREATE TYPE record_source   AS ENUM ('manual','excel','hr_sync');
CREATE TYPE content_status  AS ENUM ('draft','published','archived');

CREATE DOMAIN localized_text AS jsonb
  CHECK (jsonb_typeof(VALUE) = 'object' AND VALUE ? 'ar');

-- -----------------------------------------------------------------------------
-- 1. Organisation: region > site > supervisor > worker
-- -----------------------------------------------------------------------------
CREATE TABLE regions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        citext NOT NULL UNIQUE,
  name        localized_text NOT NULL,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sites (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id   uuid NOT NULL REFERENCES regions(id),
  code        citext NOT NULL UNIQUE,
  name        localized_text NOT NULL,
  city        text,
  timezone    text NOT NULL DEFAULT 'Asia/Riyadh',
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sites_region_idx ON sites(region_id);

CREATE TABLE jobs (                       -- job titles: cleaner, technician, ...
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        citext NOT NULL UNIQUE,
  name        localized_text NOT NULL,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_number     citext NOT NULL UNIQUE,
  full_name           text NOT NULL,              -- as in HR (usually Arabic)
  full_name_latin     text,
  phone_e164          text UNIQUE CHECK (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  role                user_role NOT NULL,
  gender              gender NOT NULL,
  preferred_language  app_language NOT NULL DEFAULT 'ar',
  status              user_status NOT NULL DEFAULT 'active',
  region_id           uuid REFERENCES regions(id),  -- admin scope; NULL = all regions
  site_id             uuid REFERENCES sites(id),    -- home site (worker/supervisor)
  supervisor_id       uuid REFERENCES users(id),    -- worker -> direct supervisor
  job_id              uuid REFERENCES jobs(id),
  hire_date           date,
  female_data_access  boolean NOT NULL DEFAULT false, -- explicit grant, female admins only
  hr_external_id      text UNIQUE,
  source              record_source NOT NULL DEFAULT 'manual',
  last_login_at       timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_site_required      CHECK (role NOT IN ('worker','supervisor') OR site_id IS NOT NULL),
  CONSTRAINT users_region_admin_only  CHECK (region_id IS NULL OR role = 'admin'),
  CONSTRAINT users_supervisor_workers CHECK (supervisor_id IS NULL OR role = 'worker'),
  CONSTRAINT users_female_access      CHECK (NOT female_data_access OR (gender = 'female' AND role = 'admin'))
);
CREATE INDEX users_site_role_idx   ON users(site_id, role) WHERE status = 'active';
CREATE INDEX users_supervisor_idx  ON users(supervisor_id);
CREATE INDEX users_job_idx         ON users(job_id);
CREATE INDEX users_name_trgm_idx   ON users USING gin (full_name gin_trgm_ops);

-- Groups (cohorts). Female workers may only be members of female_only groups,
-- and female_only groups may only have female staff (trigger below).
CREATE TYPE group_audience   AS ENUM ('mixed','female_only');
CREATE TYPE group_staff_role AS ENUM ('supervisor','trainer');

CREATE TABLE groups (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        citext NOT NULL UNIQUE,
  name        text NOT NULL,
  site_id     uuid REFERENCES sites(id),
  audience    group_audience NOT NULL DEFAULT 'mixed',
  is_active   boolean NOT NULL DEFAULT true,
  created_by  uuid REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE group_members (
  group_id    uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES users(id),
  added_by    uuid REFERENCES users(id),
  added_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);
CREATE INDEX group_members_user_idx ON group_members(user_id);

CREATE TABLE group_staff (
  group_id    uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES users(id),
  staff_role  group_staff_role NOT NULL,
  assigned_by uuid REFERENCES users(id),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);
CREATE INDEX group_staff_user_idx ON group_staff(user_id);

CREATE FUNCTION enforce_group_gender_rules() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_audience group_audience;
  v_gender   gender;
  v_role     user_role;
BEGIN
  SELECT audience INTO v_audience FROM groups WHERE id = NEW.group_id;
  SELECT gender, role INTO v_gender, v_role FROM users WHERE id = NEW.user_id;
  IF TG_TABLE_NAME = 'group_staff' THEN
    IF v_role NOT IN ('supervisor','trainer') THEN
      RAISE EXCEPTION 'group staff must be a supervisor or trainer';
    END IF;
    IF v_audience = 'female_only' AND v_gender <> 'female' THEN
      RAISE EXCEPTION 'female_only groups accept female staff only';
    END IF;
  ELSE
    IF v_gender = 'female' AND v_role = 'worker' AND v_audience <> 'female_only' THEN
      RAISE EXCEPTION 'female workers can only join female_only groups';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER group_members_gender BEFORE INSERT OR UPDATE ON group_members
  FOR EACH ROW EXECUTE FUNCTION enforce_group_gender_rules();
CREATE TRIGGER group_staff_gender BEFORE INSERT OR UPDATE ON group_staff
  FOR EACH ROW EXECUTE FUNCTION enforce_group_gender_rules();

-- A female worker's direct supervisor must be female.
CREATE FUNCTION enforce_supervisor_gender() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.role = 'worker' AND NEW.gender = 'female' AND NEW.supervisor_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM users s WHERE s.id = NEW.supervisor_id AND s.gender <> 'female') THEN
    RAISE EXCEPTION 'female worker % must report to a female supervisor', NEW.employee_number;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER users_supervisor_gender BEFORE INSERT OR UPDATE OF supervisor_id, gender, role ON users
  FOR EACH ROW EXECUTE FUNCTION enforce_supervisor_gender();

-- -----------------------------------------------------------------------------
-- 2. Authentication (OTP codes live only in Redis, never in Postgres)
-- -----------------------------------------------------------------------------
CREATE TYPE session_kind AS ENUM ('personal','kiosk');

CREATE TABLE kiosk_devices (                -- registered shared devices, bound to a site
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id        uuid NOT NULL REFERENCES sites(id),
  label          text NOT NULL,
  secret_hash    bytea NOT NULL UNIQUE,     -- SHA-256 of 256-bit device secret
  registered_by  uuid NOT NULL REFERENCES users(id),
  registered_at  timestamptz NOT NULL DEFAULT now(),
  last_seen_at   timestamptz,
  revoked_at     timestamptz,
  revoked_by     uuid REFERENCES users(id)
);

CREATE TABLE auth_sessions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES users(id),
  kind                session_kind NOT NULL,
  kiosk_device_id     uuid REFERENCES kiosk_devices(id),
  refresh_token_hash  bytea UNIQUE,         -- NULL for kiosk sessions (no refresh)
  family_id           uuid NOT NULL,        -- rotation family; reuse => revoke family
  ip                  inet,
  user_agent          text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  last_seen_at        timestamptz NOT NULL DEFAULT now(),
  expires_at          timestamptz NOT NULL,
  revoked_at          timestamptz,
  revoked_reason      text,
  CHECK (kind <> 'kiosk' OR kiosk_device_id IS NOT NULL)
);
CREATE INDEX auth_sessions_user_active_idx ON auth_sessions(user_id) WHERE revoked_at IS NULL;
CREATE INDEX auth_sessions_family_idx      ON auth_sessions(family_id);

CREATE TABLE badges (                       -- QR badge = opaque random token, not the employee no.
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES users(id),
  token_hash     bytea NOT NULL UNIQUE,
  token_hint     text NOT NULL,             -- last 4 chars, for support
  issued_by      uuid NOT NULL REFERENCES users(id),
  issued_at      timestamptz NOT NULL DEFAULT now(),
  revoked_at     timestamptz,
  revoked_by     uuid REFERENCES users(id),
  revoked_reason text
);
CREATE UNIQUE INDEX badges_one_active_per_user ON badges(user_id) WHERE revoked_at IS NULL;

CREATE TABLE api_clients (                  -- HR sync and other machine clients
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,
  key_id         text NOT NULL UNIQUE,
  secret_hash    bytea NOT NULL,
  scopes         text[] NOT NULL DEFAULT '{}',
  allowed_cidrs  cidr[] NOT NULL DEFAULT '{}',
  created_by     uuid NOT NULL REFERENCES users(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  last_used_at   timestamptz,
  revoked_at     timestamptz
);

-- -----------------------------------------------------------------------------
-- 3. Media (originals + HLS in MinIO; AES keys wrapped by a KEK from a secret)
-- -----------------------------------------------------------------------------
CREATE TYPE video_status AS ENUM ('uploading','queued','processing','ready','failed','archived');

CREATE TABLE videos (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title                text NOT NULL,
  original_filename    text,
  original_object_key  text UNIQUE,         -- s3://originals/...
  original_size_bytes  bigint,
  original_sha256      bytea,
  audio_language       app_language,
  duration_seconds     numeric(10,3),
  width                int,
  height               int,
  status               video_status NOT NULL DEFAULT 'uploading',
  status_detail        text,
  attempts             smallint NOT NULL DEFAULT 0,
  hls_prefix           text,                -- s3://hls/{video_id}/v{n}/
  renditions           jsonb,               -- [{"name":"720p","bandwidth":2400000,...}]
  poster_object_key    text,
  uploaded_by          uuid NOT NULL REFERENCES users(id),
  created_at           timestamptz NOT NULL DEFAULT now(),
  processed_at         timestamptz,
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE video_keys (                   -- never audited, never returned by list APIs
  video_id        uuid PRIMARY KEY REFERENCES videos(id) ON DELETE CASCADE,
  key_ciphertext  bytea NOT NULL,           -- AES-256-GCM(KEK, 16-byte HLS key)
  key_nonce       bytea NOT NULL,
  kek_version     smallint NOT NULL,
  iv              bytea NOT NULL,           -- HLS IV (also written into the playlist)
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE video_subtitles (
  video_id    uuid NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  language    app_language NOT NULL,
  object_key  text NOT NULL,                -- WebVTT
  created_by  uuid NOT NULL REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (video_id, language)
);

-- -----------------------------------------------------------------------------
-- 4. Content: skills, courses, lessons, learning paths
-- -----------------------------------------------------------------------------
CREATE TYPE audience_gender AS ENUM ('any','female','male');
CREATE TYPE lesson_type     AS ENUM ('video','quiz','practical');

CREATE TABLE skills (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        citext NOT NULL UNIQUE,
  name        localized_text NOT NULL,
  category    text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE job_required_skills (          -- drives "missing" cells in the skills matrix
  job_id    uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  skill_id  uuid NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  PRIMARY KEY (job_id, skill_id)
);

CREATE TABLE courses (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                        citext NOT NULL UNIQUE,
  title                       localized_text NOT NULL,
  description                 jsonb NOT NULL DEFAULT '{}',
  audience                    audience_gender NOT NULL DEFAULT 'any',
  status                      content_status NOT NULL DEFAULT 'draft',
  issues_certificate          boolean NOT NULL DEFAULT true,
  certificate_validity_months smallint CHECK (certificate_validity_months > 0), -- NULL = never expires
  created_by                  uuid NOT NULL REFERENCES users(id),
  updated_by                  uuid REFERENCES users(id),
  published_at                timestamptz,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE course_skills (
  course_id  uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  skill_id   uuid NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  PRIMARY KEY (course_id, skill_id)
);

CREATE TABLE course_prerequisites (         -- DAG; cycles rejected by the app (recursive CTE check)
  course_id           uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  requires_course_id  uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  PRIMARY KEY (course_id, requires_course_id),
  CHECK (course_id <> requires_course_id)
);

-- Practical checklist templates (versioned: published versions are immutable)
CREATE TABLE checklist_templates (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                citext NOT NULL,
  version             int NOT NULL DEFAULT 1,
  title               localized_text NOT NULL,
  pass_threshold_pct  smallint NOT NULL DEFAULT 100 CHECK (pass_threshold_pct BETWEEN 1 AND 100),
  status              content_status NOT NULL DEFAULT 'draft',
  created_by          uuid NOT NULL REFERENCES users(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (code, version)
);

CREATE TABLE checklist_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id  uuid NOT NULL REFERENCES checklist_templates(id) ON DELETE CASCADE,
  position     smallint NOT NULL,
  text         localized_text NOT NULL,
  is_critical  boolean NOT NULL DEFAULT false,   -- any critical fail => evaluation fails
  UNIQUE (template_id, position)
);

CREATE TABLE lessons (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id              uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  position               int NOT NULL,
  type                   lesson_type NOT NULL,
  title                  localized_text NOT NULL,
  is_required            boolean NOT NULL DEFAULT true,
  checklist_template_id  uuid REFERENCES checklist_templates(id),
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lessons_position_uq UNIQUE (course_id, position) DEFERRABLE INITIALLY DEFERRED,
  CHECK ((type = 'practical') = (checklist_template_id IS NOT NULL))
);

CREATE TABLE lesson_videos (                -- one video per language; 'ar' required on publish
  lesson_id  uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  language   app_language NOT NULL,
  video_id   uuid NOT NULL REFERENCES videos(id),
  PRIMARY KEY (lesson_id, language)
);

CREATE TABLE learning_paths (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code           citext NOT NULL UNIQUE,
  title          localized_text NOT NULL,
  description    jsonb NOT NULL DEFAULT '{}',
  is_sequential  boolean NOT NULL DEFAULT true,    -- course n unlocks after course n-1
  issues_certificate boolean NOT NULL DEFAULT false,
  status         content_status NOT NULL DEFAULT 'draft',
  created_by     uuid NOT NULL REFERENCES users(id),
  updated_by     uuid REFERENCES users(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE path_items (                   -- drag-and-drop order; deferred unique => atomic reorder
  path_id    uuid NOT NULL REFERENCES learning_paths(id) ON DELETE CASCADE,
  course_id  uuid NOT NULL REFERENCES courses(id),
  position   int NOT NULL,
  PRIMARY KEY (path_id, course_id),
  CONSTRAINT path_items_position_uq UNIQUE (path_id, position) DEFERRABLE INITIALLY DEFERRED
);

-- -----------------------------------------------------------------------------
-- 5. Assessment: question bank, quizzes (random draw), in-video cues
-- -----------------------------------------------------------------------------
CREATE TYPE question_type AS ENUM ('single','multiple','true_false');
CREATE TYPE cue_on_wrong  AS ENUM ('retry','rewind','continue');

CREATE TABLE questions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type              question_type NOT NULL,
  stem              localized_text NOT NULL,
  stem_audio        jsonb NOT NULL DEFAULT '{}',   -- {"ur":"s3://media/..."}: for low-literacy users
  media_object_key  text,                          -- optional picture
  explanation       jsonb NOT NULL DEFAULT '{}',
  difficulty        smallint NOT NULL DEFAULT 2 CHECK (difficulty BETWEEN 1 AND 3),
  tags              text[] NOT NULL DEFAULT '{}',
  status            content_status NOT NULL DEFAULT 'draft',
  version           int NOT NULL DEFAULT 1,
  created_by        uuid NOT NULL REFERENCES users(id),
  updated_by        uuid REFERENCES users(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX questions_tags_idx ON questions USING gin (tags);

CREATE TABLE question_options (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id       uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  position          smallint NOT NULL,
  text              localized_text NOT NULL,
  media_object_key  text,
  is_correct        boolean NOT NULL DEFAULT false,
  UNIQUE (question_id, position)
);

CREATE TABLE question_pools (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code         citext NOT NULL UNIQUE,
  name         text NOT NULL,
  description  text,
  created_by   uuid NOT NULL REFERENCES users(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE question_pool_items (
  pool_id      uuid NOT NULL REFERENCES question_pools(id) ON DELETE CASCADE,
  question_id  uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  PRIMARY KEY (pool_id, question_id)
);

CREATE TABLE quiz_settings (                -- 1:1 with lessons of type 'quiz'
  lesson_id           uuid PRIMARY KEY REFERENCES lessons(id) ON DELETE CASCADE,
  pass_score_pct      smallint NOT NULL DEFAULT 80 CHECK (pass_score_pct BETWEEN 1 AND 100),
  max_attempts        smallint CHECK (max_attempts > 0),   -- NULL = unlimited
  cooldown_minutes    int NOT NULL DEFAULT 0,
  time_limit_seconds  int CHECK (time_limit_seconds > 0),
  shuffle_options     boolean NOT NULL DEFAULT true
);

CREATE TABLE quiz_draw_rules (              -- "draw 5 from pool A (difficulty 2) + 3 from pool B"
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id      uuid NOT NULL REFERENCES quiz_settings(lesson_id) ON DELETE CASCADE,
  pool_id        uuid NOT NULL REFERENCES question_pools(id),
  draw_count     smallint NOT NULL CHECK (draw_count > 0),
  difficulty     smallint CHECK (difficulty BETWEEN 1 AND 3),
  required_tags  text[] NOT NULL DEFAULT '{}'
);

CREATE TABLE video_cues (                   -- in-video questions; same timing for all language variants
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id          uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  at_seconds         numeric(10,3) NOT NULL CHECK (at_seconds >= 0),
  question_id        uuid NOT NULL REFERENCES questions(id),
  require_correct    boolean NOT NULL DEFAULT true,
  on_wrong           cue_on_wrong NOT NULL DEFAULT 'retry',
  rewind_to_seconds  numeric(10,3),
  UNIQUE (lesson_id, at_seconds),
  CHECK (on_wrong <> 'rewind' OR (rewind_to_seconds IS NOT NULL AND rewind_to_seconds < at_seconds))
);

-- -----------------------------------------------------------------------------
-- 6. Assignment, escalation policy, enrollments
-- -----------------------------------------------------------------------------
CREATE TYPE enrollment_source AS ENUM ('manual','rule','recertification','import');
CREATE TYPE enrollment_status AS ENUM ('assigned','in_progress','completed','cancelled');

CREATE TABLE escalation_policies (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  is_default  boolean NOT NULL DEFAULT false,
  -- [{"after_days_overdue":0,"notify":"worker","channels":["whatsapp","in_app"]},
  --  {"after_days_overdue":3,"notify":"supervisor","channels":["in_app","whatsapp"]},
  --  {"after_days_overdue":7,"notify":"region_admin","channels":["email","in_app"]}]
  steps       jsonb NOT NULL CHECK (jsonb_typeof(steps) = 'array'),
  created_by  uuid NOT NULL REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX escalation_policies_one_default ON escalation_policies ((true)) WHERE is_default;

CREATE TABLE assignment_rules (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  text NOT NULL,
  path_id               uuid NOT NULL REFERENCES learning_paths(id),
  -- {"site_ids":[],"region_ids":[],"job_ids":[],"languages":[],"genders":[],"hired_within_days":null}
  -- empty array = any
  conditions            jsonb NOT NULL,
  due_in_days           int NOT NULL CHECK (due_in_days > 0),
  recurrence_months     smallint CHECK (recurrence_months > 0),
  escalation_policy_id  uuid REFERENCES escalation_policies(id),
  is_active             boolean NOT NULL DEFAULT true,
  created_by            uuid NOT NULL REFERENCES users(id),
  updated_by            uuid REFERENCES users(id),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE enrollments (                  -- a worker is assigned a path (or a single course)
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES users(id),
  path_id               uuid REFERENCES learning_paths(id),
  course_id             uuid REFERENCES courses(id),
  cycle                 smallint NOT NULL DEFAULT 1,      -- recurrence / recertification cycle
  source                enrollment_source NOT NULL,
  rule_id               uuid REFERENCES assignment_rules(id),
  escalation_policy_id  uuid REFERENCES escalation_policies(id),
  assigned_by           uuid REFERENCES users(id),
  assigned_at           timestamptz NOT NULL DEFAULT now(),
  due_at                timestamptz,
  status                enrollment_status NOT NULL DEFAULT 'assigned',
  started_at            timestamptz,
  completed_at          timestamptz,
  cancelled_at          timestamptz,
  cancel_reason         text,
  CHECK (num_nonnulls(path_id, course_id) = 1)
);
CREATE UNIQUE INDEX enrollments_path_uq   ON enrollments(user_id, path_id, cycle)   WHERE path_id IS NOT NULL;
CREATE UNIQUE INDEX enrollments_course_uq ON enrollments(user_id, course_id, cycle) WHERE course_id IS NOT NULL;
CREATE INDEX enrollments_open_due_idx     ON enrollments(due_at) WHERE status IN ('assigned','in_progress');

CREATE TABLE escalation_events (            -- idempotency: each step fires once per enrollment
  enrollment_id      uuid NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  step_index         smallint NOT NULL,
  notified_user_ids  uuid[] NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (enrollment_id, step_index)
);

-- -----------------------------------------------------------------------------
-- 7. Progress. A "round" = one pass through a course (round 2+ = recertification).
-- -----------------------------------------------------------------------------
CREATE TYPE progress_status AS ENUM ('not_started','in_progress','completed');

CREATE TABLE course_progress (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id),
  course_id     uuid NOT NULL REFERENCES courses(id),
  round         smallint NOT NULL DEFAULT 1,
  status        progress_status NOT NULL DEFAULT 'not_started',
  started_at    timestamptz,
  completed_at  timestamptz,
  UNIQUE (user_id, course_id, round)
);
CREATE INDEX course_progress_course_idx ON course_progress(course_id, status);

CREATE TABLE lesson_progress (              -- written in batches by the Redis flusher
  course_progress_id    uuid NOT NULL REFERENCES course_progress(id) ON DELETE CASCADE,
  lesson_id             uuid NOT NULL REFERENCES lessons(id),
  user_id               uuid NOT NULL REFERENCES users(id),   -- denormalised for scoping
  status                progress_status NOT NULL DEFAULT 'not_started',
  video_id              uuid REFERENCES videos(id),           -- language variant watched
  duration_seconds      numeric(10,3),
  max_position_seconds  numeric(10,3) NOT NULL DEFAULT 0 CHECK (max_position_seconds >= 0), -- server-credited frontier
  watched_seconds       numeric(12,3) NOT NULL DEFAULT 0,     -- real time credited (analytics)
  first_started_at      timestamptz,
  last_activity_at      timestamptz,
  completed_at          timestamptz,
  PRIMARY KEY (course_progress_id, lesson_id)
);
CREATE INDEX lesson_progress_user_idx ON lesson_progress(user_id);

CREATE TABLE playback_sessions (            -- one row per viewing session (summary, not per heartbeat)
  id                  uuid NOT NULL,
  started_at          timestamptz NOT NULL,
  user_id             uuid NOT NULL,
  lesson_id           uuid NOT NULL,
  video_id            uuid NOT NULL,
  course_progress_id  uuid NOT NULL,
  auth_session_id     uuid,
  ended_at            timestamptz,
  end_reason          text,                 -- ended | superseded | idle | logout | tamper
  last_heartbeat_at   timestamptz,
  start_position      numeric(10,3) NOT NULL DEFAULT 0,
  end_position        numeric(10,3),
  credited_seconds    numeric(12,3) NOT NULL DEFAULT 0,
  heartbeat_count     int NOT NULL DEFAULT 0,
  rejected_count      int NOT NULL DEFAULT 0,  -- "faster than real time" rejections
  tamper_flags        int NOT NULL DEFAULT 0,  -- watermark removed, rate changed, ...
  ip                  inet,
  user_agent          text,
  PRIMARY KEY (id, started_at)
) PARTITION BY RANGE (started_at);
CREATE INDEX playback_sessions_user_idx ON playback_sessions(user_id, started_at DESC);
CREATE TABLE playback_sessions_default PARTITION OF playback_sessions DEFAULT;
CREATE TABLE playback_sessions_2026_12 PARTITION OF playback_sessions
  FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');

CREATE TABLE quiz_attempts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES users(id),
  lesson_id           uuid NOT NULL REFERENCES lessons(id),
  course_progress_id  uuid NOT NULL REFERENCES course_progress(id),
  attempt_no          smallint NOT NULL,
  paper               jsonb NOT NULL,       -- frozen draw: [{question_id, version, option_order:[...]}]
  started_at          timestamptz NOT NULL DEFAULT now(),
  expires_at          timestamptz,
  submitted_at        timestamptz,
  score_pct           numeric(5,2),
  passed              boolean,
  UNIQUE (course_progress_id, lesson_id, attempt_no)
);

CREATE TABLE quiz_answers (
  attempt_id           uuid NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
  question_id          uuid NOT NULL REFERENCES questions(id),
  selected_option_ids  uuid[] NOT NULL,
  is_correct           boolean NOT NULL,
  answered_at          timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (attempt_id, question_id)
);

CREATE TABLE cue_responses (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES users(id),
  course_progress_id   uuid NOT NULL REFERENCES course_progress(id),
  cue_id               uuid NOT NULL REFERENCES video_cues(id),
  playback_session_id  uuid NOT NULL,
  selected_option_ids  uuid[] NOT NULL,
  is_correct           boolean NOT NULL,
  answered_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX cue_responses_progress_idx ON cue_responses(course_progress_id, cue_id) WHERE is_correct;

-- -----------------------------------------------------------------------------
-- 8. Practical checklist evaluations (recorded offline, synced later)
-- -----------------------------------------------------------------------------
CREATE TYPE checklist_result       AS ENUM ('pass','fail');
CREATE TYPE checklist_item_outcome AS ENUM ('pass','fail','na');

CREATE TABLE checklist_evaluations (
  id                   uuid PRIMARY KEY,    -- UUIDv7 generated ON THE DEVICE => idempotent sync
  template_id          uuid NOT NULL REFERENCES checklist_templates(id),
  worker_id            uuid NOT NULL REFERENCES users(id),
  supervisor_id        uuid NOT NULL REFERENCES users(id),
  site_id              uuid NOT NULL REFERENCES sites(id),
  lesson_id            uuid REFERENCES lessons(id),
  course_progress_id   uuid REFERENCES course_progress(id),
  performed_at         timestamptz NOT NULL,              -- device clock
  received_at          timestamptz NOT NULL DEFAULT now(), -- server clock
  result               checklist_result NOT NULL,
  score_pct            numeric(5,2) NOT NULL,
  notes                text,
  worker_ack_badge_id  uuid REFERENCES badges(id),        -- worker confirms by scanning own badge
  worker_ack_at        timestamptz,
  recorded_offline     boolean NOT NULL DEFAULT false,
  client_info          jsonb NOT NULL DEFAULT '{}',
  CHECK (performed_at <= received_at + interval '5 minutes')
);
CREATE INDEX checklist_evaluations_worker_idx ON checklist_evaluations(worker_id, performed_at DESC);
CREATE INDEX checklist_evaluations_site_idx   ON checklist_evaluations(site_id, performed_at DESC);

CREATE TABLE checklist_evaluation_items (
  evaluation_id  uuid NOT NULL REFERENCES checklist_evaluations(id) ON DELETE CASCADE,
  item_id        uuid NOT NULL REFERENCES checklist_items(id),
  outcome        checklist_item_outcome NOT NULL,
  note           text,
  PRIMARY KEY (evaluation_id, item_id)
);
-- NOTE: no photo/attachment column on purpose (no face capture anywhere).

-- -----------------------------------------------------------------------------
-- 9. Certificates
-- -----------------------------------------------------------------------------
CREATE TYPE certificate_status AS ENUM ('active','revoked','superseded');

CREATE TABLE certificates (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                text NOT NULL UNIQUE,  -- 128-bit random, base32; QR -> /verify/{code}
  user_id             uuid NOT NULL REFERENCES users(id),
  course_id           uuid REFERENCES courses(id),
  path_id             uuid REFERENCES learning_paths(id),
  course_progress_id  uuid REFERENCES course_progress(id),
  enrollment_id       uuid REFERENCES enrollments(id),
  language            app_language NOT NULL,
  issued_at           timestamptz NOT NULL DEFAULT now(),
  expires_at          timestamptz,
  status              certificate_status NOT NULL DEFAULT 'active',
  revoked_at          timestamptz,
  revoked_by          uuid REFERENCES users(id),
  revoked_reason      text,
  superseded_by       uuid REFERENCES certificates(id),
  pdf_object_key      text,
  snapshot            jsonb NOT NULL,        -- names/titles frozen at issue; verify page reads ONLY this
  CHECK (num_nonnulls(course_id, path_id) = 1),
  CHECK (expires_at IS NULL OR expires_at > issued_at)
);
CREATE INDEX certificates_user_idx     ON certificates(user_id);
CREATE INDEX certificates_expiring_idx ON certificates(expires_at) WHERE status = 'active' AND expires_at IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 10. Notifications (WhatsApp / SMS / email / in-app)
-- -----------------------------------------------------------------------------
CREATE TYPE notify_channel      AS ENUM ('whatsapp','sms','email','in_app');
CREATE TYPE notification_status AS ENUM ('queued','sent','delivered','read','failed','skipped');

CREATE TABLE notification_templates (
  key                     text NOT NULL,     -- e.g. 'cert.expiring', 'training.overdue'
  channel                 notify_channel NOT NULL,
  language                app_language NOT NULL,
  body                    text NOT NULL,
  provider_template_name  text,             -- pre-approved WhatsApp template name
  updated_by              uuid REFERENCES users(id),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (key, channel, language)
);

CREATE TABLE notifications (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES users(id),
  channel              notify_channel NOT NULL,
  template_key         text NOT NULL,
  payload              jsonb NOT NULL DEFAULT '{}',
  dedupe_key           text NOT NULL UNIQUE, -- e.g. 'cert.expiring:{cert}:7d:whatsapp'
  status               notification_status NOT NULL DEFAULT 'queued',
  attempts             smallint NOT NULL DEFAULT 0,
  provider_message_id  text,
  error                text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  sent_at              timestamptz,
  read_at              timestamptz
);
CREATE INDEX notifications_inbox_idx ON notifications(user_id, created_at DESC) WHERE channel = 'in_app';

-- -----------------------------------------------------------------------------
-- 11. Imports, HR sync, reports, analytics, settings
-- -----------------------------------------------------------------------------
CREATE TYPE import_kind       AS ENUM ('excel','hr_api');
CREATE TYPE import_status     AS ENUM ('uploaded','validating','validated','applying','applied','failed','cancelled');
CREATE TYPE import_row_action AS ENUM ('create','update','deactivate','unchanged','error');

CREATE TABLE import_jobs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind             import_kind NOT NULL,
  status           import_status NOT NULL DEFAULT 'uploaded',
  file_object_key  text,
  api_client_id    uuid REFERENCES api_clients(id),
  idempotency_key  text UNIQUE,             -- HR batches are idempotent
  summary          jsonb NOT NULL DEFAULT '{}',
  created_by       uuid REFERENCES users(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  validated_at     timestamptz,
  applied_at       timestamptz,
  applied_by       uuid REFERENCES users(id),
  CHECK (num_nonnulls(created_by, api_client_id) >= 1)
);

CREATE TABLE import_rows (                  -- staging + preview diff; not audited (job is)
  job_id      uuid NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,
  row_number  int NOT NULL,
  raw         jsonb NOT NULL,
  normalized  jsonb,
  action      import_row_action,
  errors      jsonb NOT NULL DEFAULT '[]',
  user_id     uuid REFERENCES users(id),
  PRIMARY KEY (job_id, row_number)
);

CREATE TABLE report_subscriptions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id),
  kind        text NOT NULL DEFAULT 'weekly_summary',
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind)
);

CREATE TABLE report_runs (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind                 text NOT NULL,
  period_start         date NOT NULL,
  period_end           date NOT NULL,
  status               text NOT NULL,
  recipient_count      int NOT NULL DEFAULT 0,
  artifact_object_key  text,
  error                text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  finished_at          timestamptz,
  UNIQUE (kind, period_start)
);

CREATE TABLE site_kpi_daily (               -- nightly snapshot -> trends, site comparison, weekly email
  site_id  uuid NOT NULL REFERENCES sites(id),
  day      date NOT NULL,
  metrics  jsonb NOT NULL,                  -- {active_workers, completion_rate, overdue, avg_quiz, checklist_pass, certified_pct}
  PRIMARY KEY (site_id, day)
);

CREATE TABLE app_settings (
  key         text PRIMARY KEY,
  value       jsonb NOT NULL,
  updated_by  uuid REFERENCES users(id),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Skills matrix source (refreshed CONCURRENTLY every ~10 min and on demand).
CREATE MATERIALIZED VIEW mv_worker_skill_status AS
WITH worker AS (
  SELECT u.id AS user_id, u.site_id, s.region_id, u.job_id
  FROM users u JOIN sites s ON s.id = u.site_id
  WHERE u.role = 'worker' AND u.status = 'active'
),
attained AS (
  SELECT cp.user_id, cs.skill_id,
         max(cp.completed_at)                                AS achieved_at,
         max(c.expires_at) FILTER (WHERE c.status = 'active') AS expires_at,
         bool_or(co.certificate_validity_months IS NULL)     AS never_expires
  FROM course_progress cp
  JOIN course_skills cs ON cs.course_id = cp.course_id
  JOIN courses co       ON co.id = cp.course_id
  LEFT JOIN certificates c ON c.course_progress_id = cp.id
  WHERE cp.completed_at IS NOT NULL
  GROUP BY cp.user_id, cs.skill_id
),
in_flight AS (
  SELECT DISTINCT cp.user_id, cs.skill_id
  FROM course_progress cp JOIN course_skills cs ON cs.course_id = cp.course_id
  WHERE cp.status = 'in_progress'
)
SELECT w.user_id, w.site_id, w.region_id, w.job_id, sk.id AS skill_id,
       (jrs.skill_id IS NOT NULL) AS required,
       CASE
         WHEN a.user_id IS NOT NULL AND (a.never_expires OR a.expires_at > now() + interval '30 days') THEN 'valid'
         WHEN a.user_id IS NOT NULL AND a.expires_at > now() THEN 'expiring'
         WHEN a.user_id IS NOT NULL THEN 'expired'
         WHEN f.user_id IS NOT NULL THEN 'in_progress'
         ELSE 'missing'
       END AS status,
       a.achieved_at, a.expires_at
FROM worker w
CROSS JOIN skills sk
LEFT JOIN job_required_skills jrs ON jrs.job_id = w.job_id AND jrs.skill_id = sk.id
LEFT JOIN attained a  ON a.user_id = w.user_id AND a.skill_id = sk.id
LEFT JOIN in_flight f ON f.user_id = w.user_id AND f.skill_id = sk.id;
CREATE UNIQUE INDEX mv_worker_skill_status_pk ON mv_worker_skill_status(user_id, skill_id);
CREATE INDEX mv_worker_skill_status_site_idx  ON mv_worker_skill_status(site_id, skill_id, status);

-- -----------------------------------------------------------------------------
-- 12. Audit log: append-only, monthly partitions, written by trigger + app events
-- -----------------------------------------------------------------------------
CREATE TYPE actor_kind AS ENUM ('user','system','api_client');

CREATE TABLE audit_log (
  id            bigint GENERATED ALWAYS AS IDENTITY,
  occurred_at   timestamptz NOT NULL DEFAULT now(),
  actor_kind    actor_kind NOT NULL,
  actor_id      uuid,
  action        text NOT NULL,      -- 'users.update' (trigger) | 'auth.otp.verify_failed' (app event)
  entity_table  text,
  entity_id     text,
  changes       jsonb,              -- INSERT: row | UPDATE: {col:[old,new]} | DELETE: old row; secrets redacted
  request_id    uuid,
  ip            inet,
  PRIMARY KEY (id, occurred_at)
) PARTITION BY RANGE (occurred_at);
CREATE INDEX audit_log_entity_idx ON audit_log(entity_table, entity_id, occurred_at DESC);
CREATE INDEX audit_log_actor_idx  ON audit_log(actor_id, occurred_at DESC);
CREATE TABLE audit_log_default PARTITION OF audit_log DEFAULT;
CREATE TABLE audit_log_2026_12 PARTITION OF audit_log
  FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');

-- The API runs every request in a transaction that first does:
--   SELECT set_config('app.actor_id', $1, true), set_config('app.actor_kind', 'user', true),
--          set_config('app.request_id', $2, true), set_config('app.client_ip', $3, true);
-- Trigger args = columns to redact.
CREATE FUNCTION audit_row_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_old     jsonb;
  v_new     jsonb;
  v_changes jsonb;
  v_redact  text[] := coalesce(TG_ARGV, '{}'::text[]);  -- TG_ARGV is NULL when no args
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') THEN v_old := to_jsonb(OLD) - v_redact; END IF;
  IF TG_OP IN ('INSERT','UPDATE') THEN v_new := to_jsonb(NEW) - v_redact; END IF;

  IF TG_OP = 'UPDATE' THEN
    SELECT jsonb_object_agg(n.key, jsonb_build_array(v_old -> n.key, n.value))
      INTO v_changes
      FROM jsonb_each(v_new) n
     WHERE (v_old -> n.key) IS DISTINCT FROM n.value
       AND n.key <> 'updated_at';
    IF v_changes IS NULL THEN RETURN NULL; END IF;   -- no-op update
  ELSE
    v_changes := coalesce(v_new, v_old);
  END IF;

  INSERT INTO audit_log (actor_kind, actor_id, action, entity_table, entity_id, changes, request_id, ip)
  VALUES (
    coalesce(nullif(current_setting('app.actor_kind', true), ''), 'system')::actor_kind,
    nullif(current_setting('app.actor_id', true), '')::uuid,
    TG_TABLE_NAME || '.' || lower(TG_OP),
    TG_TABLE_NAME,
    coalesce(v_new ->> 'id', v_old ->> 'id'),
    v_changes,
    nullif(current_setting('app.request_id', true), '')::uuid,
    nullif(current_setting('app.client_ip', true), '')::inet
  );
  RETURN NULL;
END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'regions','sites','jobs','users','groups','group_members','group_staff',
    'videos','video_subtitles','skills','job_required_skills','courses','course_skills',
    'course_prerequisites','checklist_templates','checklist_items','lessons','lesson_videos',
    'learning_paths','path_items','questions','question_options','question_pools',
    'question_pool_items','quiz_settings','quiz_draw_rules','video_cues',
    'escalation_policies','assignment_rules','enrollments','course_progress',
    'quiz_attempts','checklist_evaluations','checklist_evaluation_items',
    'certificates','notification_templates','import_jobs','report_subscriptions','app_settings'
  ] LOOP
    EXECUTE format('CREATE TRIGGER audit AFTER INSERT OR UPDATE OR DELETE ON %I
                    FOR EACH ROW EXECUTE FUNCTION audit_row_change()', t);
  END LOOP;
END $$;

-- Secret-bearing tables: audited with hashes redacted.
CREATE TRIGGER audit AFTER INSERT OR UPDATE OR DELETE ON badges
  FOR EACH ROW EXECUTE FUNCTION audit_row_change('token_hash');
CREATE TRIGGER audit AFTER INSERT OR UPDATE OR DELETE ON kiosk_devices
  FOR EACH ROW EXECUTE FUNCTION audit_row_change('secret_hash');
CREATE TRIGGER audit AFTER INSERT OR UPDATE OR DELETE ON api_clients
  FOR EACH ROW EXECUTE FUNCTION audit_row_change('secret_hash');

-- lesson_progress: audit status transitions only (frontier moves every 10 s).
CREATE TRIGGER audit_insert AFTER INSERT ON lesson_progress
  FOR EACH ROW EXECUTE FUNCTION audit_row_change();
CREATE TRIGGER audit_status AFTER UPDATE ON lesson_progress
  FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION audit_row_change();

-- Deliberately NOT trigger-audited (high-churn telemetry or secrets); the app writes
-- semantic events instead: auth_sessions (auth.login/logout/refresh_reuse),
-- video_keys (media.key_created), playback_sessions, notifications, import_rows,
-- quiz_answers / cue_responses (covered by attempt rows), site_kpi_daily.

-- -----------------------------------------------------------------------------
-- 13. Privacy: Row-Level Security on users (defence in depth for the female rule)
-- -----------------------------------------------------------------------------
-- A female worker's row is visible only to: herself, female staff assigned to one
-- of her groups, and female admins with female_data_access. Everyone else gets no
-- row => joins for names/phones/employee numbers silently drop her. No actor set
-- => fail closed. Background jobs use zaad_worker (BYPASSRLS) and must aggregate.
CREATE FUNCTION app_can_view_user(p_id uuid, p_gender gender, p_role user_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH actor AS (
    SELECT u.id, u.gender, u.female_data_access
    FROM users u
    WHERE u.id = nullif(current_setting('app.actor_id', true), '')::uuid
      AND u.status = 'active'
  )
  SELECT p_gender = 'male'
      OR p_role <> 'worker'
      OR EXISTS (SELECT 1 FROM actor a WHERE a.id = p_id)
      OR EXISTS (
           SELECT 1 FROM actor a
           WHERE a.gender = 'female'
             AND (a.female_data_access
                  OR EXISTS (SELECT 1
                             FROM group_members gm
                             JOIN group_staff gs ON gs.group_id = gm.group_id
                             WHERE gm.user_id = p_id AND gs.user_id = a.id)));
$$;

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY users_visibility ON users
  USING (app_can_view_user(id, gender, role));

-- Narrow, audited bypasses for login (no actor exists yet). They return only what
-- the auth flow needs.
CREATE FUNCTION auth_find_user_by_phone(p_phone text)
RETURNS TABLE (id uuid, status user_status, preferred_language app_language)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, status, preferred_language FROM users WHERE phone_e164 = p_phone;
$$;

CREATE FUNCTION auth_find_user_by_badge(p_token_hash bytea)
RETURNS TABLE (id uuid, site_id uuid, status user_status, badge_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT u.id, u.site_id, u.status, b.id
  FROM badges b JOIN users u ON u.id = b.user_id
  WHERE b.token_hash = p_token_hash AND b.revoked_at IS NULL;
$$;

-- -----------------------------------------------------------------------------
-- 14. Grants (sketch; real roles created in infra/postgres/init)
-- -----------------------------------------------------------------------------
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO zaad_app;
-- REVOKE UPDATE, DELETE, TRUNCATE ON audit_log FROM zaad_app, zaad_worker;   -- append-only
-- REVOKE ALL ON video_keys FROM zaad_app; GRANT SELECT ON video_keys TO zaad_app; -- read-only for key endpoint
-- ALTER ROLE zaad_worker BYPASSRLS;
