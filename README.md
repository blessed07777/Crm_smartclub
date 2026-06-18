# SmartClub CRM

CRM-система для подготовительной школы к **ЕНТ** и топ-школам Казахстана.
**Полностью на своём стеке** — Node.js + Express + PostgreSQL + JWT.
Деплой одной командой на **Railway**.

![React](https://img.shields.io/badge/React-18-61dafb?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript)
![Postgres](https://img.shields.io/badge/PostgreSQL-Railway-336791?logo=postgresql)
![JWT](https://img.shields.io/badge/Auth-JWT%20%2B%20bcrypt-000000?logo=jsonwebtokens)
![Railway](https://img.shields.io/badge/Deploy-Railway-0B0D0E?logo=railway)

---

## ✨ Возможности

### Роли (RBAC через JWT-токен)
- **Администратор** — полный доступ ко всему
- **Менеджер продаж** — лиды, ученики, группы, финансы, отчёты
- **Преподаватель** — расписание, посещаемость и оценки своих групп

Первый зарегистрированный пользователь автоматически становится администратором.

### Модули
| Раздел | Что внутри |
|---|---|
| 🎯 **Лиды** | Канбан-доска 6 стадий (`new → contacted → trial → negotiation → won → lost`), быстрый перенос, ожидаемая выручка |
| 👥 **Ученики** | CRUD, поиск, статусы (учится/заморозка/архив/выпускник), цель по ЕНТ |
| 🎓 **Группы** | Предмет, преподаватель, стоимость, расписание, состав |
| 📅 **Расписание** | Уроки сгруппированы по дням, тема, ДЗ, отмена |
| ✅ **Посещаемость** | `был/нет/опоздал/уваж.` + оценки 0-100 |
| 💰 **Финансы** | 4 типа транзакций (доход / расход / зарплата / возврат), фильтры, привязка к ученику/группе/преподавателю |
| 👨‍🏫 **Сотрудники** | Управление ролями и активацией |
| 📊 **Отчёты** | Графики по месяцам, воронка лидов, топ-группы по выручке |
| ⚙️ **Настройки** | Профиль + смена пароля |

### Технологии
| Слой | Технологии |
|---|---|
| **Frontend** | React 18, TypeScript 5, Vite 5, TailwindCSS 3 |
| **State / Data** | TanStack Query, Zustand |
| **UI** | lucide-react, recharts, react-hot-toast |
| **Backend** | Node.js 20, Express 4, TypeScript (через `tsx`) |
| **Database** | PostgreSQL 15+ (Railway plugin) с авто-миграциями на старте |
| **Auth** | JWT (jsonwebtoken) + bcryptjs |

---

## 🚀 Деплой на Railway (5 минут)

### Через UI
1. Зайдите на [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo** → выберите `Crm_smartclub`
2. Внутри проекта: **+ New** → **Database** → **Add PostgreSQL**
   Railway автоматически добавит переменную `DATABASE_URL` в сервис
3. В сервисе **Variables** добавьте:
   ```
   JWT_SECRET = <случайная строка, openssl rand -hex 32>
   ```
4. Откройте **Settings** → **Networking** → **Generate Domain**
5. Готово 🎉 — миграции выполнятся автоматически при первом запуске.

### Через CLI
```bash
npm i -g @railway/cli
railway login
railway init        # выбрать SmartClub проект
railway add         # добавить Postgres plugin
railway variables set JWT_SECRET=$(openssl rand -hex 32)
railway up          # задеплоить из текущей папки
railway open        # открыть в браузере
```

Конфиг деплоя описан в [`railway.json`](railway.json) и [`nixpacks.toml`](nixpacks.toml):
- `build`: `npm install && npm run build` (собирает фронт в `dist/`)
- `start`: `npm start` (запускает Express, который сервит API + статику)
- `healthcheck`: `GET /api/health`

---

## 💻 Локальный запуск

### 1. Установить Postgres локально или через Docker
```bash
docker run --name smartclub-db -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:16
createdb -h localhost -U postgres smartclub
```

### 2. Клонировать и настроить
```bash
git clone https://github.com/blessed07777/Crm_smartclub.git
cd Crm_smartclub
npm install
cp .env.example .env
# отредактировать .env: DATABASE_URL, JWT_SECRET
```

### 3. Запустить
```bash
npm run dev          # параллельно vite (5173) + tsx watch server (4000)
```
- Frontend: http://localhost:5173
- API: http://localhost:5173/api/* (через прокси Vite → 4000)

Миграции применятся автоматически при старте сервера.

### 4. Зарегистрировать первого пользователя
Откройте http://localhost:5173/register — первый зарегистрированный аккаунт автоматически становится **администратором**.

---

## 🗂 Структура

```
.
├── server/
│   ├── index.ts            # Express app, все REST-эндпоинты
│   ├── auth.ts             # JWT + bcrypt + middleware
│   ├── db.ts               # pg pool
│   └── migrate.ts          # авто-миграции при старте
├── migrations/
│   └── 001_init.sql        # схема: users, leads, students, groups, lessons,
│                           # attendance, payments, subjects, group_students
├── src/
│   ├── lib/
│   │   ├── api.ts          # fetch-обёртка + ресурсы
│   │   └── format.ts
│   ├── stores/auth.ts      # Zustand auth store
│   ├── pages/              # 11 страниц
│   ├── components/         # layout, ui-kit
│   └── types/database.ts
├── railway.json            # Railway deploy config
├── nixpacks.toml           # Nixpacks build config
├── Procfile                # fallback для других PaaS
└── package.json
```

---

## 🔐 REST API

| Endpoint | Метод | Роли |
|---|---|---|
| `/api/health` | GET | public |
| `/api/auth/register` | POST | public |
| `/api/auth/login` | POST | public |
| `/api/auth/me` | GET/PATCH | auth |
| `/api/auth/change-password` | POST | auth |
| `/api/users` | GET/PATCH | auth / admin,manager |
| `/api/subjects` | CRUD | auth / admin,manager |
| `/api/leads` | CRUD | admin,manager |
| `/api/students` | CRUD | auth / admin,manager |
| `/api/groups` | CRUD | auth / admin,manager |
| `/api/groups/:id/roster` | GET/POST/DELETE | auth |
| `/api/lessons` | CRUD | auth |
| `/api/lessons/:id/roster` | GET | auth |
| `/api/lessons/:id/attendance` | PUT | auth |
| `/api/payments` | CRUD | admin,manager |
| `/api/dashboard/stats` | GET | auth |
| `/api/reports/monthly` | GET | admin,manager |
| `/api/reports/leads-funnel` | GET | admin,manager |
| `/api/reports/group-revenue` | GET | admin,manager |

Все защищённые эндпоинты ожидают `Authorization: Bearer <JWT>` (30-дневный токен).

---

## 🛠 Скрипты

| Команда | Что делает |
|---|---|
| `npm run dev`        | Параллельно: Vite + Express (с авто-перезапуском) |
| `npm run dev:server` | Только бэкенд |
| `npm run build`      | Сборка фронта в `dist/` |
| `npm start`          | Запуск Express (сервит API + статику) — для прода |

---

## 🗺 Roadmap

- [ ] Конвертация лида в ученика одним кликом
- [ ] SMS/WhatsApp напоминания родителям
- [ ] Календарный вид расписания (drag & drop)
- [ ] KPI преподавателей
- [ ] Импорт/экспорт CSV/Excel
- [ ] Платёжный шлюз (Kaspi Pay)
- [ ] Telegram-бот для родителей
- [ ] Code-splitting (сейчас один бандл 690KB)

---

## 📄 Лицензия

MIT — используйте свободно для своей школы.

Made with 💜 for top schools of Kazakhstan.
