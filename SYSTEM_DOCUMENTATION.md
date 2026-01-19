# S7 Robotics LMS — Полная документация системы

## Содержание
1. [Роли и права](#роли-и-права)
2. [Создание пользователей](#создание-пользователей)
3. [Управление группами](#управление-группами)
4. [Проведение урока](#проведение-урока)
5. [Посещаемость и QR](#посещаемость-и-qr)
6. [Оценивание и обратная связь](#оценивание-и-обратная-связь)
7. [Родительский контроль](#родительский-контроль)
8. [Зарплата и финансы](#зарплата-и-финансы)
9. [Контент-менеджмент](#контент-менеджмент)

---

## Роли и права

| Роль | Описание | Кто создаёт |
|------|----------|-------------|
| `ADMIN` | Полный доступ ко всему | Первый пользователь или вручную в БД |
| `MENTOR` | Ведёт группы, проводит уроки | Админ через панель |
| `PARENT` | Следит за детьми | Регистрируется сам |
| `STUDENT` | Учится, посещает уроки | Регистрируется сам или создаёт Админ |

```
Иерархия доступа:
ADMIN > MENTOR > PARENT/STUDENT
```

---

## Создание пользователей

### Регистрация (самостоятельная)

```
Пользователь → POST /api/auth/register
├── email, password, fullName, role (опционально)
└── По умолчанию роль = USER (становится STUDENT)
```

**Файл:** `server/src/routes/auth.ts`

### Создание Админом

```
Админ → POST /api/admin/users
├── email, fullName, password
├── role: STUDENT | MENTOR | PARENT | ADMIN
└── parentId (для привязки ребёнка сразу)
```

### Изменение роли

```
Админ → PUT /api/admin/users/:id
├── role: "MENTOR" | "PARENT" | "STUDENT"
└── parentId: (для привязки к родителю)
```

---

## Управление группами

### Кто создаёт группы?
**Только ADMIN** через Admin Console

### Создание группы

```
POST /api/admin/groups
{
  "kruzhokId": "...",      // ID программы/кружка
  "name": "Группа 5А",
  "description": "Роботехника, 9-11 лет",
  "maxStudents": 12,
  "mentorId": "...",       // Назначить ментора
  "wagePerLesson": 3000,   // KZT за урок
  "scheduleDescription": "Пн/Ср 15:00"
}
```

### Редактирование группы

```
PUT /api/admin/groups/:id
```

### Удаление группы

```
DELETE /api/admin/groups/:id
```

### Добавление ученика в группу

```
POST /api/admin/groups/:id/assign
{ "studentId": "..." }
```

### Удаление ученика из группы

```
POST /api/admin/groups/:id/remove
{ "studentId": "..." }
```

### Миграция ученика (перенос в другую группу)

```
POST /api/admin/groups/:id/migrate-student
{
  "studentId": "...",
  "targetClassId": "..."
}
```

> При миграции родитель автоматически получает уведомление.

---

## Проведение урока

### Кто проводит?
**MENTOR** или **ADMIN**

### Шаг 1: Начать урок

```
POST /api/attendance-live/start
{ "classId": "..." }

Ответ:
{
  "schedule": { ... },
  "token": "eyJ...",   // QR токен
  "serverTime": 1737...,
  "startedAt": "2026-01-19T12:00:00Z"
}
```

**Что происходит:**
1. Создаётся/активируется расписание (Schedule)
2. `status` → `IN_PROGRESS`
3. `startedAt` → текущее серверное время
4. Генерируется JWT-токен для QR

### Шаг 2: Показать QR ученикам

Ментор показывает QR-код на экране. Код обновляется каждые 30 секунд.

```
GET /api/attendance-live/:scheduleId/qr
→ { "token": "eyJ...", "serverTime": ... }
```

### Шаг 3: Заполнить табель

Пока урок идёт, ментор видит таблицу всех учеников:

```
GET /api/attendance-live/:scheduleId/state
→ { schedule: {...}, rows: [...] }
```

Каждая строка:
- `user`: { id, fullName, email }
- `status`: PRESENT | LATE | ABSENT
- `grade`: 1-5
- `summary`: Что делал ученик
- `comment`: Комментарий родителю

### Шаг 4: Ручное редактирование

```
POST /api/attendance-live/update-record
{
  "scheduleId": "...",
  "studentId": "...",
  "status": "PRESENT",
  "grade": 5,
  "workSummary": "Собрал робота",
  "comment": "Молодец!"
}
```

### Шаг 5: Завершить урок

```
POST /api/attendance-live/:scheduleId/end
```

**Что происходит:**
1. `status` → `COMPLETED`
2. `completedAt` → текущее время
3. Все кто не отметился → `ABSENT`
4. Родителям отправляются уведомления об оценках

### Шаг 6: Экспорт в Excel

```
GET /api/attendance-live/:scheduleId/export
→ lesson-xxx.xlsx
```

---

## Посещаемость и QR

### Как работает QR-код?

```
QR содержит JWT токен:
{
  "scheduleId": "...",
  "mentorId": "...",
  "timestamp": 1737...
}
```

| Параметр | Значение |
|----------|----------|
| Срок жизни | 120 секунд |
| Обновление | Каждые 30 сек |
| Секрет подписи | APP_SECRET из .env |

### Логика статусов

```
Время от начала урока:
├── 0-5 минут → PRESENT
├── >5 минут → LATE
└── Не сканировал → ABSENT (при завершении)
```

### Сканирование учеником

```
POST /api/attendance/mark
{ "qrToken": "eyJ..." }

Проверки:
1. Токен валиден (JWT)
2. Не истёк (< 120 сек)
3. Урок IN_PROGRESS
4. Ученик записан в группу

Ответ:
{ "status": "PRESENT" | "LATE" }
```

**Файл:** `server/src/routes/attendance.ts`

---

## Оценивание и обратная связь

### Ментор → Ученику (оценка)

**При проведении урока:**
```
POST /api/attendance-live/update-record
{ "grade": 5, "workSummary": "...", "comment": "..." }
```

Оценка сохраняется в модели `Attendance`.

### Ученик → Ментору (отзыв)

**После завершения урока:**

```
GET /api/reviews/pending
→ Список уроков без отзыва

POST /api/reviews/mentor
{
  "scheduleId": "...",
  "rating": 5,        // 1-5 звёзд
  "comment": "Отличный урок!"
}
```

Отзывы сохраняются в `MentorReview`.

### Рейтинг ментора

Админ видит рейтинг:
```
GET /api/admin/analytics
→ mentorRatings: [{ id, fullName, ratingAvg, ratingCount, lessonsCompleted }]
```

---

## Родительский контроль

### Привязка ребёнка

```
POST /api/parent/link-child
{ "childEmail": "child@example.com" }

Система:
1. Находит пользователя по email
2. Проверяет что роль = STUDENT/USER
3. Устанавливает parentId
4. Ребёнок появляется у родителя
```

### Что видит родитель

| Данные | API |
|--------|-----|
| Список детей | `GET /api/parent/children` |
| Подписки | `GET /api/parent/subscriptions` |
| Скидки | `GET /api/parent/discounts` |
| Посещаемость ребёнка | `GET /api/parent/child/:id/attendance` |
| Достижения | `GET /api/parent/child/:id/achievements` |
| Уведомления | `GET /api/parent/notifications` |

### Push-уведомления

Родитель получает при:
- Ребёнок отметился (PRESENT)
- Ребёнок опоздал (LATE)
- Получена оценка
- Миграция в другую группу

---

## Зарплата и финансы

### Модель оплаты

```
ClubClass.wagePerLesson = 3000 KZT
```

При завершении урока ментор "зарабатывает" эту сумму.

### Расчёт зарплаты

```
GET /api/mentor/wallet
→ {
  "balance": 45000,       // Выплачено всего
  "pendingBalance": 12000, // Ожидает выплаты
  "lessonsCount": 19,
  "ratePerHour": 3000,
  "grade": "Junior",
  "ratingAvg": 4.7,
  "rank": 3,
  "rankTotal": 8
}
```

### Выплаты

```
GET /api/mentor/wallet/transactions
→ [{ id, amount, period, status, paidAt }]
```

**Модель:** `SalaryPayment`

Админ может создавать выплаты:
```
POST /api/admin/salaries
{ "userId": "...", "amount": 45000, "period": "2026-01" }
```

---

## Контент-менеджмент

### Новости (для родителей)

```
POST /api/admin/news
{
  "title": "Новый курс!",
  "content": "...",
  "coverImageUrl": "/media/news/cover.jpg",
  "published": true
}
```

### ByteSize (видео)

```
POST /api/admin/bytesize
{
  "title": "Как помочь ребёнку",
  "videoUrl": "/media/bytesize/video.mp4",
  "coverImageUrl": "...",
  "tags": ["воспитание"]
}
```

### Магазин (бонусы)

```
POST /api/admin/shop
{
  "title": "Футболка S7",
  "priceCoins": 500,
  "type": "MERCH",
  "imageUrl": "..."
}
```

### Мастер-классы

```
POST /api/admin/events
{
  "title": "Робохакатон",
  "date": "2026-02-15T10:00:00Z",
  "format": "offline",
  "location": "ул. Пушкина 10",
  "status": "published"
}
```

---

## Схема базы данных (ключевые модели)

```
User
├── id, email, passwordHash, fullName
├── role: STUDENT | PARENT | MENTOR | ADMIN
├── parentId → User (Parent-Child)
├── level, experiencePoints, coinBalance

ClubClass (Группа)
├── name, description, maxStudents
├── kruzhokId → Kruzhok
├── mentorId → User
├── wagePerLesson

ClassEnrollment
├── classId → ClubClass
├── userId → User
├── status: active | inactive

Schedule (Урок)
├── classId → ClubClass
├── scheduledDate, scheduledTime
├── status: SCHEDULED | IN_PROGRESS | COMPLETED
├── startedAt, completedAt

Attendance
├── scheduleId → Schedule
├── studentId → User
├── status: PRESENT | LATE | ABSENT
├── grade, workSummary, notes

MentorReview
├── scheduleId → Schedule
├── studentId → User
├── mentorId → User
├── rating: 1-5
├── comment
```

---

## API Endpoints Summary

| Роль | Endpoints |
|------|-----------|
| **Auth** | `/api/auth/register`, `/api/auth/login`, `/api/auth/refresh` |
| **Student** | `/api/student/groups`, `/api/student/mentors`, `/api/attendance/mark` |
| **Mentor** | `/api/mentor/groups`, `/api/mentor/wallet`, `/api/attendance-live/*` |
| **Parent** | `/api/parent/children`, `/api/parent/link-child`, `/api/parent/child/:id/*` |
| **Admin** | `/api/admin/users`, `/api/admin/groups`, `/api/admin/analytics`, `/api/admin/news` |
