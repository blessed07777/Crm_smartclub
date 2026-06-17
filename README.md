# SmartClub CRM

CRM-система для подготовительной школы к **ЕНТ** и топ-школам Казахстана.
Полноценный продукт на TypeScript + React + Supabase с разделением ролей,
финансами, расписанием, посещаемостью и аналитикой.

![Stack](https://img.shields.io/badge/React-18-61dafb?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript)
![Supabase](https://img.shields.io/badge/Supabase-JWT%20%2B%20RLS-3ecf8e?logo=supabase)
![Tailwind](https://img.shields.io/badge/TailwindCSS-3-38bdf8?logo=tailwindcss)

---

## ✨ Возможности

### Роли (RBAC через Supabase Auth + RLS)
- **Администратор** — полный доступ
- **Менеджер продаж** — лиды, ученики, группы, финансы, отчёты
- **Преподаватель** — расписание, посещаемость, оценки своих групп

### Модули
- 🎯 **Лиды / Воронка продаж** — kanban-доска по 6 стадиям, перенос между этапами одним кликом
- 👥 **Ученики** — полный CRUD, фильтр, статусы (учится / заморозка / архив / выпускник)
- 🎓 **Группы** — предметы ЕНТ, преподаватель, стоимость, расписание, состав
- 📅 **Расписание** — уроки по дням, темы, ДЗ, отмена
- ✅ **Посещаемость** — отметка статуса (был / нет / опоздал / уваж.) и оценок 0–100
- 💰 **Финансы** — доходы, расходы, зарплаты преподавателей, возвраты, фильтры, статистика
- 👨‍🏫 **Сотрудники** — управление ролями и активацией
- 📊 **Отчёты** — графики по месяцам, воронка лидов, топ-группы по выручке
- ⚙️ **Настройки** — профиль пользователя

### Технологии
| Слой         | Технологии                                                                    |
|--------------|-------------------------------------------------------------------------------|
| Frontend     | React 18, TypeScript 5, Vite 5, TailwindCSS 3                                |
| State / Data | TanStack Query, Zustand                                                       |
| UI           | lucide-react, recharts, react-hot-toast                                       |
| Backend      | Supabase (PostgreSQL + Auth JWT + Row Level Security + триггеры)              |

---

## 🚀 Быстрый старт

### 1. Клонировать и установить
```bash
git clone https://github.com/blessed07777/Crm_smartclub.git
cd Crm_smartclub
npm install
```

### 2. Создать Supabase-проект
1. Зайти на [supabase.com](https://supabase.com) → New Project
2. В **SQL Editor** выполнить файл `supabase/migrations/0001_init.sql`
3. Включить **Email/Password Auth** в Authentication → Providers (по умолчанию)
4. Скопировать `Project URL` и `anon public key` из Project Settings → API

### 3. Настроить переменные окружения
```bash
cp .env.example .env
```
Заполнить `.env`:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Запустить
```bash
npm run dev
```
Приложение откроется на http://localhost:5173

### 5. Создать первого администратора
Зарегистрируйте первого пользователя на странице `/register`, выбрав роль **Администратор**.
Для production: подтвердите email в Supabase → Authentication → Users или отключите подтверждение
в Auth → Providers → Email.

---

## 🗂 Структура

```
.
├── supabase/
│   └── migrations/
│       └── 0001_init.sql            # схема + RLS + триггеры + сиды
├── src/
│   ├── components/
│   │   ├── layout/                  # AuthLayout, AppLayout (sidebar)
│   │   └── ui/                      # Modal, StatCard, EmptyState, PageHeader
│   ├── lib/
│   │   ├── supabase.ts              # клиент
│   │   └── format.ts                # форматтеры
│   ├── pages/                       # Dashboard, Leads, Students, Groups,
│   │                                  Schedule, Attendance, Finance,
│   │                                  Teachers, Reports, Settings, Setup
│   ├── stores/
│   │   └── auth.ts                  # Zustand auth store
│   └── types/
│       └── database.ts              # типы таблиц
├── tailwind.config.js
├── vite.config.ts
└── package.json
```

---

## 🔐 Безопасность

- **JWT** через Supabase Auth (access + refresh tokens, авто-обновление)
- **Row Level Security** включён на всех таблицах
- Политики RLS закодированы в миграции:
  - админ видит всё
  - менеджер — продажи, учеников, финансы
  - преподаватель — только свои группы, уроки, посещаемость, своих учеников
- Пароли — bcrypt на стороне Supabase
- Anon key безопасно использовать на клиенте (RLS защищает данные)

---

## 📈 Доменная модель

```
profiles ── teaches ─→ groups ── contains ─→ group_students ─→ students
                         │                                         │
                         └─ schedules ─→ lessons ─→ attendance ────┘

payments ── linked_to ─→ students | groups | profiles (teacher payout)
leads ─→ (конвертируются в students)
```

---

## 🛠 Скрипты

| Команда           | Что делает                          |
|-------------------|--------------------------------------|
| `npm run dev`     | Dev-сервер Vite                      |
| `npm run build`   | Production-сборка                    |
| `npm run preview` | Превью прод-сборки                   |

---

## 🗺 Roadmap

- [ ] Конвертация лида в ученика одним кликом
- [ ] SMS/WhatsApp напоминания родителям
- [ ] Календарный вид расписания
- [ ] Отчёт по KPI преподавателей
- [ ] Импорт/экспорт CSV
- [ ] Платёжный шлюз (Kaspi Pay)
- [ ] Telegram-бот для родителей

---

## 📄 Лицензия

MIT — используйте свободно для своей школы.

Made with 💜 for top schools of Kazakhstan.
