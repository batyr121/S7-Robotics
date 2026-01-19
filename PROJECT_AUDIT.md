# PROJECT AUDIT (d:/s7-new)

Дата: 2026-01-13

## 1) Executive summary

Проект состоит из:

- Frontend: Next.js (App Router) в корне репозитория.
- Backend: Express + Prisma в `server/`.

Аудит выявил **критические** проблемы, которые могут приводить к 401/404, сломанному флоу регистрации, проблемам деплоя и уязвимостям безопасности.

## 1.1 Критические проблемы (P0)

- **[P0] Несоответствие ролей/JWT типов и фактических значений.**
  - **Где:** `server/src/utils/jwt.ts`, `server/src/types.ts`, `server/src/middleware/auth.ts`.
  - **Факт:** Prisma `UserRole` содержит `STUDENT | PARENT | MENTOR | ADMIN | ...`, а типы JWT/req.user ограничены `"USER" | "ADMIN"`.
  - **Решение:** Обновить типы JWT/req.user, чтобы они соответствовали типу `UserRole` из Prisma.

- **[P0] Next.js BFF (`app/api/auth/*`) не проксирует `Authorization` для защищённых операций.**
  - **Где:** `app/api/auth/change-password/route.ts`.
  - **Факт:** handler проксирует `POST /auth/change-password` на backend, но не пробрасывает заголовок `Authorization`.
  - **Симптом:** `components/auth/change-password.tsx` вызывает `apiFetch("/auth/change-password")` → запрос уходит на `/api/auth/change-password` (Next handler), а Express не видит токен → 401.

- **[P0] Несогласованные прокси-слои/порты backend (риск 404/500).**
  - **Где:**
    - `server/src/env.ts`: `PORT` default `4000`.
    - `app/api/**/route.ts`: `BACKEND_URL || "http://localhost:3001"`.
    - `next.config.mjs`: rewrites только при наличии `API_DEV_TARGET`.
  - **Симптомы:** часть запросов уходит на `:3001`, часть проксируется rewrites/nginx на `:4000`, часть перехватывается `app/api/*`.
  - **Рекомендация:** выбрать одну стратегию:
    - либо убрать `app/api/*` и использовать rewrites/nginx,
    - либо сделать `app/api/*` единым BFF и стандартизировать `BACKEND_URL`.

- **[P0] Несуществующий backend-эндпоинт `POST /auth/register-verify` при наличии Next handler.**
  - **Где:** `app/api/auth/register-verify/route.ts`.
  - **Факт:** в `server/src/routes/auth.ts` отсутствует маршрут `/register-verify`.
  - **Симптом:** 404 при обращении к `/api/auth/register-verify`.

- **[P0] Удаление файлов по произвольному пути из запроса (опасно).**
  - **Где:** `server/src/routes/uploads.ts` (`DELETE /uploads/media`).
  - **Факт:** сервер выполняет `fs.unlink(storagePath)`, где `storagePath` приходит из `req.body`.
  - **Риск:** удаление произвольных файлов, доступных процессу.
  - **Рекомендация:** принимать только `filename`/id и вычислять путь внутри `MEDIA_DIR`.

- **[P0] ESM/runtime риск: использование `require()` в backend.**
  - **Где:** `server/src/routes/attendance.ts`.
  - **Факт:** backend собирается в ESM (`server/package.json`: `type: "module"`, build: `tsup --format esm`).
  - **Риск:** `require()` может падать в production сборке.

- **[P0] Отсутствуют backend-роуты для `/api/clubs/*`, но фронт их вызывает.**
  - **Где:** `lib/api.ts` добавляет `/api` ко всем запросам `/clubs/*` при отсутствии `NEXT_PUBLIC_API_URL`.
  - **Факт:** в `server/src/index.ts` нет `app.use("/api/clubs", ...)`, и в `server/src/routes` нет `clubs.ts`.
  - **Симптом:** 404 на страницах/табах, где используются `/clubs/*`.

- **[P0] Слишком широкий CORS по умолчанию (`origin: true`) при `credentials: true`.**
  - **Где:** `server/src/index.ts`.
  - **Факт:** если `CORS_ORIGIN` не задан, включается `origin: true`.
  - **Рекомендация:** в production задавать `CORS_ORIGIN` списком доменов.

- **[P0] DEV backdoor при `DEV_AUTH=1`.**
  - **Где:** `server/src/routes/auth.ts`.
  - **Факт:** логин `email="1"`/`password="1"` выдаёт admin токены.
  - **Риск:** критично при утечке/ошибке конфигурации.
  - **Рекомендация:** удалить или жёстко ограничить `DEV_AUTH` (например, только при `NODE_ENV=development`).

## 2) Архитектура и точки входа

### 2.1 Backend (Express)

- **Entry point:** `server/src/index.ts`.
- **Env validation:** `server/src/env.ts`.
- **Auth middleware:** `server/src/middleware/auth.ts` (`requireAuth`, `requireAdmin`, `optionalAuth`).
- **JWT utils:** `server/src/utils/jwt.ts`.
- **Static media:**
  - `GET /media/*`
  - `GET /api/media/*`

### 2.2 Frontend (Next.js)

- **App Router:** `app/*`.
- **Next API route handlers (BFF):** `app/api/*`.
- **API client:** `lib/api.ts` (`apiFetch`).
  - **Token storage:** `localStorage` + JS cookies (не `HttpOnly`).
  - **Dev proxy:** через `next.config.mjs` rewrites при наличии `API_DEV_TARGET`.

## 3) Переменные окружения и конфиг

### 3.1 Backend env (фактический контракт)

Источник: `server/src/env.ts`.

- `DATABASE_URL` (required)
- `APP_SECRET` (required, min 16)
- `PORT` (default 4000)
- `NODE_ENV` (development|production|test)
- `MEDIA_DIR` (default ./media)
- `CORS_ORIGIN` (optional)
- `EMAIL_PASSWORD` (optional)

### 3.2 Документация vs код (несоответствия)

- `README.MD` упоминает `JWT_SECRET`, но в коде используется `APP_SECRET`.
- `README.MD` указывает Next.js 15, но `package.json` содержит `next@14.2.16`.

### 3.3 Качество сборки (quality gates)

- `next.config.mjs`:
  - `eslint.ignoreDuringBuilds: true`
  - `typescript.ignoreBuildErrors: true`
  Это позволяет собрать проект с ошибками типов/линта.

## 4) Реестр API эндпоинтов

### 4.1 Express: точки монтирования (из `server/src/index.ts`)

- **Health**
  - `GET /health`
  - `GET /api/health`

- **Auth**
  - `/auth/*` и `/api/auth/*` → `server/src/routes/auth.ts`

- **Courses**
  - `/courses/*` и `/api/courses/*` → `server/src/routes/courses.ts`

- **Admin**
  - `/api/admin/*` → `server/src/routes/admin.ts`
  - `/api/admin-courses/*` → `server/src/routes/admin-courses.ts`

- **Events**
  - `/events/*` и `/api/events/*` → `server/src/routes/events.ts`

- **Content & Media**
  - `/news/*` и `/api/news/*` → `server/src/routes/news.ts`
  - `/bytesize/*` и `/api/bytesize/*` → `server/src/routes/bytesize.ts`
  - `/uploads/*` и `/api/uploads/*` → `server/src/routes/uploads.ts`
  - `/media/*` и `/api/media/*` → static из `MEDIA_DIR`

- **Student/Mentor/Parent**
  - `/api/student/*` → `server/src/routes/student.ts`
  - `/api/mentor/*` → `server/src/routes/mentor.ts`
  - `/api/parent/*` → `server/src/routes/parent.ts`

- **Other modules**
  - `/api/programs/*` → `server/src/routes/programs.ts`
  - `/api/subscriptions/*` → `server/src/routes/subscriptions.ts`
  - `/api/certificates/*` → `server/src/routes/certificates.ts`
  - `/api/submissions/*` → `server/src/routes/submissions.ts`
  - `/api/achievements/*` → `server/src/routes/achievements.ts`
  - `/api/shop/*` → `server/src/routes/shop.ts`
  - `/api/salaries/*` → `server/src/routes/salaries.ts`
  - `/api/games/*` → `server/src/routes/games.ts`
  - `/api/individual-lessons/*` → `server/src/routes/individual-lessons.ts`
  - `/api/attendance/*` → `server/src/routes/attendance.ts`
  - `/api/attendance-live/*` → `server/src/routes/attendance-live.ts`
  - `/api/notifications/*` → `server/src/routes/notifications.ts`
  - `/api/reviews/*` → `server/src/routes/reviews.ts`

### 4.2 Next.js Route Handlers (`app/api/*`)

- **Auth BFF**
  - `POST /api/auth/login`
  - `POST /api/auth/login-verify`
  - `POST /api/auth/forgot-password`
  - `POST /api/auth/verify-reset-code`
  - `POST /api/auth/reset-password`
  - `POST /api/auth/reset-password/confirm`
  - `POST /api/auth/send-verification`
  - `POST /api/auth/change-password`
  - `POST /api/auth/register-verify`

- **Courses BFF**
  - `GET /api/courses/:courseId/lessons/:lessonId`

### 4.3 Express: эндпоинты (детально)

#### 4.3.1 Auth (`/auth/*` и `/api/auth/*`) — `server/src/routes/auth.ts`

- `POST /auth/register` — public
- `POST /auth/send-verification` — public
- `POST /auth/verify-email` — public
- `POST /auth/login` — public
- `POST /auth/login-verify` — public
- `POST /auth/forgot-password` — public
- `POST /auth/verify-reset-code` — public
- `POST /auth/reset-password` — public
- `POST /auth/reset-password/confirm` — public
- `POST /auth/refresh` — public
- `POST /auth/logout` — public
- `GET /auth/me` — requireAuth
- `PUT /auth/me` — requireAuth
- `POST /auth/change-password` — requireAuth

#### 4.3.2 Courses (`/courses/*` и `/api/courses/*`) — `server/src/routes/courses.ts`

- `GET /courses` — public
- `GET /courses/continue` — requireAuth
- `GET /courses/:courseId` — optionalAuth
- `GET /courses/:courseId/lessons/:lessonId` — optionalAuth
- `GET /courses/:courseId/lessons/:lessonId/questions` — optionalAuth
- `GET /courses/:courseId/questions` — optionalAuth
- `POST /courses/:courseId/questions` — requireAuth + admin only (проверка через `req.user?.role !== "ADMIN"`)
- `POST /courses/questions/:questionId/answer` — requireAuth
- `GET /courses/:courseId/missions` — optionalAuth
- `POST /courses/:courseId/missions` — requireAuth + admin only
- `POST /courses/missions/:missionId/progress` — requireAuth
- `GET /courses/:courseId/leaderboard` — optionalAuth
- `GET /courses/:courseId/progress` — requireAuth
- `POST /courses/:courseId/lessons/:lessonId/progress` — requireAuth
- `POST /courses/:courseId/purchase` — requireAuth
- `GET /courses/:courseId/analytics` — requireAuth + admin only
- `GET /courses/:courseId/questions/analytics` — requireAuth + admin only
- `GET /courses/:courseId/questions/answers` — requireAuth + admin only

#### 4.3.3 Events (`/events/*` и `/api/events/*`) — `server/src/routes/events.ts`

- `GET /events` — public
- `GET /events/:id` — public
- `GET /events/mine/list` — requireAuth
- `POST /events` — requireAuth
- `POST /events/:id/register` — requireAuth
- `GET /events/mine/registrations` — requireAuth

#### 4.3.4 Admin (`/api/admin/*`) — `server/src/routes/admin.ts`

Глобально: `requireAuth` + `requireAdmin`.

- `GET /api/admin/analytics`
- `GET /api/admin/users`
- `PUT /api/admin/users/:id`
- `GET /api/admin/users/:id/overview`
- `GET /api/admin/kruzhoks`
- `GET /api/admin/groups`
- `GET /api/admin/groups/:id`
- `POST /api/admin/groups`
- `PUT /api/admin/groups/:id`
- `DELETE /api/admin/groups/:id`
- `POST /api/admin/groups/:id/assign`
- `POST /api/admin/groups/:id/remove`
- `POST /api/admin/groups/:id/set-mentor`
- `POST /api/admin/groups/:id/migrate-student`
- `GET /api/admin/analytics/groups`
- `GET /api/admin/analytics/groups/:id`
- `GET /api/admin/bytesize`
- `POST /api/admin/bytesize`
- `DELETE /api/admin/bytesize/:id`
- `GET /api/admin/events`
- `POST /api/admin/events`
- `DELETE /api/admin/events` (danger: deletes all events)
- `DELETE /api/admin/events/:id`
- `GET /api/admin/events/:id/registrations`
- `POST /api/admin/events/:eventId/registrations/:regId/approve`
- `POST /api/admin/events/:eventId/registrations/:regId/reject`

#### 4.3.5 Admin Courses (`/api/admin-courses/*`) — `server/src/routes/admin-courses.ts`

Глобально: `requireAuth` + `requireAdmin`.

- `GET /api/admin-courses/:courseId`
- `POST /api/admin-courses`
- `PUT /api/admin-courses/:courseId`
- `POST /api/admin-courses/:courseId/basic`
- `POST /api/admin-courses/courses/:courseId/basic` (compat)
- `POST /api/admin-courses/courses/:courseId/modules`
- `PUT /api/admin-courses/modules/:moduleId`
- `POST /api/admin-courses/modules/:moduleId/lessons`
- `PUT /api/admin-courses/lessons/:lessonId`
- `POST /api/admin-courses/lessons/:lessonId/questions`
- `PUT /api/admin-courses/questions/:questionId`
- `DELETE /api/admin-courses/questions/:questionId`
- `DELETE /api/admin-courses/lessons/:lessonId`
- `DELETE /api/admin-courses/modules/:moduleId`

#### 4.3.6 News (`/news/*` и `/api/news/*`) — `server/src/routes/news.ts`

- `GET /news` — public
- `GET /news/admin/all` — requireAuth + requireAdmin
- `GET /news/:id` — public
- `POST /news` — requireAuth + requireAdmin
- `PUT /news/:id` — requireAuth + requireAdmin
- `DELETE /news/:id` — requireAuth + requireAdmin
- `PATCH /news/:id/publish` — requireAuth + requireAdmin

#### 4.3.7 ByteSize (`/bytesize/*` и `/api/bytesize/*`) — `server/src/routes/bytesize.ts`

- `GET /bytesize` — optionalAuth
- `POST /bytesize/:id/like` — requireAuth
- `POST /bytesize/:id/view` — public

#### 4.3.8 Uploads (`/uploads/*` и `/api/uploads/*`) — `server/src/routes/uploads.ts`

Глобально: `requireAuth`.

- `POST /uploads/media` — requireAuth
- `DELETE /uploads/media` — requireAuth + requireAdmin

#### 4.3.9 Programs (`/api/programs/*`) — `server/src/routes/programs.ts`

Глобально: `requireAuth`.

- `GET /api/programs`
- `POST /api/programs` — requireAuth + admin only (inline check `req.user?.role !== "ADMIN"`)
- `PATCH /api/programs/:id` — requireAuth + admin only
- `DELETE /api/programs/:id` — requireAuth + admin only
- `GET /api/programs/:programId/templates`
- `POST /api/programs/:programId/templates` — requireAuth + admin only
- `PATCH /api/programs/templates/:id` — requireAuth + admin only
- `DELETE /api/programs/templates/:id` — requireAuth + admin only

#### 4.3.10 Subscriptions (`/api/subscriptions/*`) — `server/src/routes/subscriptions.ts`

- `POST /api/subscriptions/request` — requireAuth
- `GET /api/subscriptions/status` — requireAuth
- `GET /api/subscriptions/admin/pending` — requireAuth + requireAdmin
- `POST /api/subscriptions/admin/:id/approve` — requireAuth + requireAdmin
- `POST /api/subscriptions/admin/:id/reject` — requireAuth + requireAdmin

#### 4.3.11 Certificates (`/api/certificates/*`) — `server/src/routes/certificates.ts`

- `GET /api/certificates/pending` — requireAuth + requireAdmin
- `GET /api/certificates/my` — requireAuth
- `POST /api/certificates/:requestId/issue` — requireAuth + requireAdmin
- `POST /api/certificates/:requestId/deny` — requireAuth + requireAdmin

#### 4.3.12 Parent (`/api/parent/*`) — `server/src/routes/parent.ts`

Глобально: `requireAuth`.

- `GET /api/parent/children` — requireAuth
- `GET /api/parent/subscriptions` — requireAuth
- `GET /api/parent/discounts` — requireAuth
- `GET /api/parent/child/:childId` — requireAuth
- `GET /api/parent/child/:childId/progress` — requireAuth
- `GET /api/parent/child/:childId/attendance` — requireAuth
- `GET /api/parent/child/:childId/achievements` — requireAuth
- `GET /api/parent/payments` — requireAuth
- `GET /api/parent/notifications` — requireAuth
- `POST /api/parent/link-child` — requireAuth

#### 4.3.13 Student (`/api/student/*`) — `server/src/routes/student.ts`

Глобально: `requireAuth`.

- `GET /api/student/mentors` — requireAuth
- `GET /api/student/groups` — requireAuth

#### 4.3.14 Mentor (`/api/mentor/*`) — `server/src/routes/mentor.ts`

Глобально: `requireAuth`.

- `GET /api/mentor/my-kruzhoks` — requireAuth
- `GET /api/mentor/open-groups` — requireAuth
- `GET /api/mentor/groups` — requireAuth
- `GET /api/mentor/wallet/summary` — requireAuth
- `GET /api/mentor/wallet` — requireAuth
- `GET /api/mentor/wallet/transactions` — requireAuth
- `GET /api/mentor/payroll/lessons` — requireAuth
- `GET /api/mentor/today-lessons` — requireAuth
- `GET /api/mentor/schedule` — requireAuth
- `POST /api/mentor/schedule` — requireAuth
- `PUT /api/mentor/schedule/:id` — requireAuth
- `POST /api/mentor/schedule/:id/attendance` — requireAuth
- `GET /api/mentor/students` — requireAuth
- `GET /api/mentor/student/:studentId` — requireAuth
- `POST /api/mentor/award-coins` — requireAuth
- `GET /api/mentor/stats` — requireAuth
- `POST /api/mentor/comment` — requireAuth
- `GET /api/mentor/class/:classId/students` — requireAuth
- `GET /api/mentor/class/:classId/attendance` — requireAuth
- `POST /api/mentor/class/:classId/attendance` — requireAuth
- `POST /api/mentor/class/:classId/add-student` — requireAuth
- `POST /api/mentor/class/:classId/migrate-student` — requireAuth
- `POST /api/mentor/class` — requireAuth

#### 4.3.15 Shop (`/api/shop/*`) — `server/src/routes/shop.ts`

- `GET /api/shop/items` — requireAuth
- `POST /api/shop/purchase` — requireAuth
- `GET /api/shop/my-purchases` — requireAuth
- `GET /api/shop/my-balance` — requireAuth
- `GET /api/shop/transactions` — requireAuth
- `GET /api/shop/admin/items` — requireAuth + inline admin check
- `POST /api/shop/admin/items` — requireAuth + inline admin check
- `PUT /api/shop/admin/items/:id` — requireAuth + inline admin check
- `DELETE /api/shop/admin/items/:id` — requireAuth + inline admin check
- `GET /api/shop/admin/orders` — requireAuth + inline admin check

#### 4.3.16 Salaries (`/api/salaries/*`) — `server/src/routes/salaries.ts`

- `GET /api/salaries/stats` — requireAuth + requireAdmin
- `POST /api/salaries/pay` — requireAuth + requireAdmin

#### 4.3.17 Games (`/api/games/*`) — `server/src/routes/games.ts`

- `GET /api/games` — requireAuth
- `POST /api/games` — requireAuth + requireAdmin
- `PATCH /api/games/:id` — requireAuth + requireAdmin
- `DELETE /api/games/:id` — requireAuth + requireAdmin

#### 4.3.18 Individual lessons (`/api/individual-lessons/*`) — `server/src/routes/individual-lessons.ts`

- `GET /api/individual-lessons/slots` — requireAuth
- `GET /api/individual-lessons/mentors` — requireAuth
- `POST /api/individual-lessons/book/:slotId` — requireAuth
- `GET /api/individual-lessons/my-bookings` — requireAuth
- `DELETE /api/individual-lessons/bookings/:id` — requireAuth
- `POST /api/individual-lessons/bookings/:id/rate` — requireAuth
- `GET /api/individual-lessons/mentor-slots` — requireAuth
- `POST /api/individual-lessons/slots` — requireAuth
- `DELETE /api/individual-lessons/slots/:id` — requireAuth
- `GET /api/individual-lessons/mentor-bookings` — requireAuth
- `PATCH /api/individual-lessons/bookings/:id/complete` — requireAuth
- `PATCH /api/individual-lessons/bookings/:id/no-show` — requireAuth
- `GET /api/individual-lessons/admin/all-slots` — requireAuth + inline admin check
- `GET /api/individual-lessons/admin/all-bookings` — requireAuth + inline admin check
- `GET /api/individual-lessons/stats` — requireAuth

#### 4.3.19 Attendance (`/api/attendance/*`) — `server/src/routes/attendance.ts`

Глобально: `requireAuth`.

- `POST /api/attendance/mark` — requireAuth

#### 4.3.20 Attendance live (`/api/attendance-live/*`) — `server/src/routes/attendance-live.ts`

Глобально: `requireAuth`.

- `POST /api/attendance-live/start` — requireAuth
- `GET /api/attendance-live/:scheduleId/qr` — requireAuth
- `GET /api/attendance-live/:scheduleId/state` — requireAuth
- `POST /api/attendance-live/update-record` — requireAuth
- `POST /api/attendance-live/:scheduleId/end` — requireAuth
- `GET /api/attendance-live/:scheduleId/export` — requireAuth

#### 4.3.21 Notifications (`/api/notifications/*`) — `server/src/routes/notifications.ts`

Глобально: `requireAuth`.

- `GET /api/notifications` — requireAuth
- `POST /api/notifications/read/:id` — requireAuth
- `POST /api/notifications/read-all` — requireAuth

#### 4.3.22 Reviews (`/api/reviews/*`) — `server/src/routes/reviews.ts`

Глобально: `requireAuth`.

- `GET /api/reviews/pending` — requireAuth
- `POST /api/reviews/mentor` — requireAuth

#### 4.3.23 Submissions (`/submissions/*` и `/api/submissions/*`) — `server/src/routes/submissions.ts`

- `GET /submissions/competitions/mine` — requireAuth
- `POST /submissions/competitions` — requireAuth

#### 4.3.24 Achievements (`/achievements/*` и `/api/achievements/*`) — `server/src/routes/achievements.ts`
- `GET /achievements/mine` — requireAuth

## 5) Дополнительные находки (P1/P2)

## 5.1 P1 (высокий приоритет)

- **Проблема порядка роутов в `events.ts` (сломает `/events/mine/*`).**
  - **Где:** `server/src/routes/events.ts`.
  - **Факт:** `GET /events/:id` объявлен раньше `GET /events/mine/list` и `GET /events/mine/registrations`.
  - **Симптом:** запрос `/events/mine/list` может матчиться как `/:id` (id=`mine`) и возвращать 404.
  - **Рекомендация:** перенести `/mine/*` выше `/:id`.
  - **Статус:** исправлено — `server/src/routes/events.ts` перестроен так, что `/mine/*` объявлены выше `/:id`.

- **Отключены проверки типов/линта в production build фронта.**
  - **Где:** `next.config.mjs`.
  - **Факт:** `eslint.ignoreDuringBuilds=true`, `typescript.ignoreBuildErrors=true`.
  - **Риск:** скрытые TS/ESLint ошибки не блокируют релиз.

- **Несоответствие лимита загрузки и текста ошибки.**
  - **Где:** `server/src/routes/uploads.ts`.

## 5.2 P2 (средний приоритет)

- **Токены хранятся в `localStorage` и в JS cookies (не HttpOnly).**
  - **Где:** `lib/api.ts` (`setTokens`).
  - **Риск:** XSS → кража access/refresh.
  - **Рекомендация:** перейти на HttpOnly cookies + CSRF защиту, либо как минимум внедрить CSP и аудит XSS.

- **Отладочные логи в API роутерах.**
  - **Где:** `server/src/routes/courses.ts`, `server/src/routes/bytesize.ts`.
  - **Риск:** шум/утечки в логах.

## 6) План исправлений (приоритетный)

## 6.1 P0 (сначала)

- **Роли/JWT типы:** привести `server/src/utils/jwt.ts` и `server/src/types.ts` к `UserRole` из Prisma.
- **Proxy стратегия:** выбрать единый подход (BFF или rewrites/nginx) и стандартизировать `BACKEND_URL`/`API_DEV_TARGET`/`NEXT_PUBLIC_API_URL`.
- **BFF auth headers:** проксировать `Authorization` в `app/api/auth/change-password/route.ts` (и аналогичных, если появятся).
- **Убрать/ограничить `DEV_AUTH`:** не допускать включения на production.
- **ESM-совместимость:** убрать `require()` из `server/src/routes/attendance.ts`.
- **Uploads delete hardening:** запретить удаление по произвольному `storagePath`, принимать только `filename`/id.
- **Clubs API:** реализовать `/api/clubs/*` (если это целевой контракт) или заменить фронтовые вызовы на существующие модули.
- **CORS:** зафиксировать `CORS_ORIGIN` в production.

## 6.2 P1

- Переставить роуты в `events.ts`.
- Включить TS/ESLint проверки в production build.
- Привести лимит upload и сообщения к одному значению.

## 6.3 P2

- Перевести токены на HttpOnly cookies/CSRF или ввести CSP + меры против XSS.
- Удалить отладочные `console.log`.
