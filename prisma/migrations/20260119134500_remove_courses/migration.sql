-- Remove legacy course tables and enums (courses are no longer used)
DROP TABLE IF EXISTS "CourseAnswer" CASCADE;
DROP TABLE IF EXISTS "CourseQuestion" CASCADE;
DROP TABLE IF EXISTS "LessonProgress" CASCADE;
DROP TABLE IF EXISTS "Enrollment" CASCADE;
DROP TABLE IF EXISTS "Lesson" CASCADE;
DROP TABLE IF EXISTS "CourseModule" CASCADE;
DROP TABLE IF EXISTS "Course" CASCADE;
DROP TABLE IF EXISTS "Purchase" CASCADE;
DROP TABLE IF EXISTS "DailyMissionProgress" CASCADE;
DROP TABLE IF EXISTS "DailyMission" CASCADE;

-- Snake_case legacy tables
DROP TABLE IF EXISTS "course_answers" CASCADE;
DROP TABLE IF EXISTS "course_questions" CASCADE;
DROP TABLE IF EXISTS "user_lesson_progress" CASCADE;
DROP TABLE IF EXISTS "user_course_enrollments" CASCADE;
DROP TABLE IF EXISTS "lessons" CASCADE;
DROP TABLE IF EXISTS "course_modules" CASCADE;
DROP TABLE IF EXISTS "courses" CASCADE;
DROP TABLE IF EXISTS "purchases" CASCADE;
DROP TABLE IF EXISTS "daily_missions" CASCADE;
DROP TABLE IF EXISTS "daily_mission_progress" CASCADE;

DROP TYPE IF EXISTS "EnrollmentStatus" CASCADE;
DROP TYPE IF EXISTS "PurchaseStatus" CASCADE;
DROP TYPE IF EXISTS "LessonMediaType" CASCADE;
