# Arthik

> A premium, offline-first personal expense and daily-savings tracker built with React Native, Expo & Supabase.

[![React Native](https://img.shields.io/badge/React_Native-0.86-blue.svg)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo-SDK_57-black.svg)](https://expo.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue.svg)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Backend-Supabase-3ECF8E.svg)](https://supabase.com/)
[![Version](https://img.shields.io/badge/Version-1.2.4-green.svg)](https://github.com/Kislaya-06/Arthik-App/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 📲 Download & Install

**Arthik is distributed directly as a standalone Android APK — no Play Store download required.**  
*(Sign in quickly inside the app using your Google Account or Email).*

1. Head to [**GitHub Releases**](https://github.com/Kislaya-06/Arthik-App/releases/latest).
2. Under **Assets**, download **`Arthik-v1.2.4.apk`**.
3. Open your phone's Downloads folder and tap the APK to install (enable *"Install unknown apps"* if prompted).
4. Launch **Arthik** from your app drawer!

> 💡 **Compatibility:** Android 8.0 (Oreo) and above. Android is the primary supported platform today (`com.kislaya_agarwal.arthik`).

---

## ✨ Features

- 🐷 **Daily Budget & Smart Gullak (`SavingsScreen`)** — Configure a daily spending allowance. At midnight, unspent allowance automatically rolls over into your digital **Gullak** (savings reserve). If daily spending exceeds your budget, the deficit is deducted from accumulated savings, keeping net totals 100% truthful.
- 🔥 **Savings Streaks & Visual Calendar** — Track consecutive days stayed within budget with active streak counters and all-time best streak tracking. Includes a monthly streak calendar modal (`StreakCalendarModal`). Untracked days act as neutral bridges so taking a break never unfairly breaks your streak.
- 📶 **Offline-First Resilience** — Log, edit, and delete transactions with zero latency even without internet connectivity. Changes are queued in `AsyncStorage` and automatically synced to Supabase when reconnected, with status banners (`OfflineBanner` and `SyncFailedBanner`) keeping you informed.
- 🎨 **Adaptive Dark & Light Themes** — Full system-wide theme support using Arthik's curated palette: mint green (`#B8E0C8`), peach coral (`#F4B8AE`), and deep navy surfaces (`#1A2B4C` / `#0B111E`).
- 📊 **Real-Time Financial Dashboard** — Home screen overview featuring dynamic greeting typography, remaining allowance tracking, zero-state-aware donut charts, and instant period filters (Today, Week, Month, All).
- 📝 **Tactile Expense & Income Logging** — Quick transaction entry with custom spring-animated numeric keypad (with decoupled integer and decimal paise limits), payment mode tags (Cash, UPI, Card), and category assignment.
- 📈 **Visual Insights & History** — Searchable, chronologically grouped transaction history and analytical spending breakdowns across weekly, monthly, and all-time intervals.
- 🔔 **Smart Daily Reminders** — Local notifications scheduled via `expo-notifications` to remind you to log expenses and check your daily savings rollover.
- 🔒 **Secure Authentication** — Email/password signup, Google OAuth, session persistence via Supabase Auth (PKCE flow), and complete account deletion compliance.

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | React Native 0.86.3 + Expo SDK 57 (`expo-dev-client`) |
| **Language** | TypeScript (`strict: true`) |
| **State Management** | Zustand (`^5.0.14`, with `persist` + AsyncStorage queues) |
| **Backend & Auth** | Supabase (PostgreSQL, GoTrue Auth, Row Level Security) |
| **Navigation** | React Navigation (Native Stack + Custom Floating Bottom Tabs) |
| **Dates & Formatting** | `date-fns` (`^3.6.0`, strict `yyyy-MM-dd` ISO parsing) + Indian numbering (`₹`) |
| **Icons & Typography** | `lucide-react-native` & Quicksand (Google Fonts via Expo) |
| **Graphics** | `react-native-svg` |
| **Build & Updates** | Expo EAS Build (Preview APK) & Expo EAS Update (OTA) |

---

## 📁 Project Structure

```text
src/
├── components/   # Floating BottomNavBar, CustomDatePickerModal, DonutChart,
│                 # TransactionRow, ErrorBoundary, OfflineBanner, SyncFailedBanner
├── config/       # Supabase client & environment, Theme tokens (LightColors / DarkColors)
├── hooks/        # UI & presentation hooks (useExpenseForm, useScrollDirection, etc.)
├── lib/          # Pure domain logic (budgetCalculations, homeCalculations, dateFilters,
│                 # expenseFilters, amountKeypad, formatters, notificationService)
├── navigation/   # Root stack, Tab navigator, navigationRef
├── screens/      # Home, Savings, History, Insights, ExpenseForm, ManageCategories,
│                 # Profile, Notifications, Auth, Splash, Onboarding
├── store/        # Zustand stores (dailyBudgetStore, expenseStore, categoryStore,
│                 # authStore, networkStore, themeStore, notificationStore, appLockStore)
└── types/        # TypeScript route navigation & entity interfaces
tests/            # Vitest unit tests (18 files, 308 tests)
```

---

## 📚 Documentation & Architecture

This repository follows documented coding standards and domain models:

- [`AGENTS.md`](./AGENTS.md) — Operational guidelines, coding standards, design tokens, test coverage rules, and safety invariants for developers and AI pair programmers.
- [`CONTEXT.md`](./CONTEXT.md) — Single-context domain model, business rules, entity relationships, and core architectural invariants.
- [`docs/architecture.md`](./docs/architecture.md) — System architecture: layer map, stores, offline write path, startup sequence, Gullak engine, auth, and test inventory.
- [`docs/prd.md`](./docs/prd.md) — Product Requirements Document: full feature inventory, constraints, UX principles, roadmap, and technical risks.
- [`docs/adr/`](./docs/adr/) — Architecture Decision Records (9 ADRs) capturing the rationale behind key architectural and design choices.

---

## 🧑‍💻 Developer Setup

### Prerequisites
- [Node.js](https://nodejs.org/) v20+ (React Native 0.86 requires `>= 20.19.4`)
- [Android Studio & SDK](https://developer.android.com/studio) with an Android Virtual Device (AVD)
- A [Supabase](https://supabase.com/) project

> ⚠️ **Important:** **Expo Go is NOT supported.** Arthik uses custom native modules (`expo-dev-client`). You must run with a development client build or an Android emulator with the dev APK installed.

### Quickstart

1. **Clone the repository:**

   ```bash
   git clone https://github.com/Kislaya-06/Arthik-App.git
   cd Arthik-App
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Configure environment variables:**  
   Create a `.env` file in the project root:

   ```env
   EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Initialize database schema:**  
   Run [`schema.sql`](./schema.sql) in your Supabase SQL Editor.

5. **Start development server:**

   ```bash
   npm run dev
   ```
   *(This automatically executes `adb reverse tcp:8081 tcp:8081` and starts the Expo Metro bundler).*

6. **Run on Android:**

   ```bash
   npm run android
   ```

7. **Run tests & type checking:**

   ```bash
   npm test             # Runs Vitest unit tests across domain logic, keypad & formatters
   npx tsc --noEmit     # Validates full TypeScript type safety across src/ and tests/
   ```

---

## 🗄 Database Schema

Core tables in Supabase PostgreSQL (all protected by Row Level Security scoped to `auth.uid()`):

- **`profiles`** — User profile metadata, daily budget configuration (`daily_budget`, `is_auto_renew`), and registration timestamp.
- **`categories`** — Expense categories (global defaults + user-created custom categories with icons and colors).
- **`expenses`** — Individual transaction records (amount, category, payment mode, date, type, note).
- **`daily_savings_log`** — Finalized daily records (amount saved, amount spent, budget allocated, settlement status).

See [`schema.sql`](./schema.sql) for full table definitions, constraints, triggers, and RLS policies.

---

## 🚀 Deployment & OTA Updates

Arthik ships as an Android APK via **EAS Build** and is updated instantly via **EAS Update**:

- **Build Dev Client APK (for emulator debugging):**

  ```bash
  eas build -p android --profile development
  ```

- **Build Release Preview APK:**

  ```bash
  eas build -p android --profile preview
  ```

- **Publish Instant Over-The-Air (OTA) Update:**

  ```bash
  eas update --branch preview --message "Your update description"
  ```
  *(Note: OTA updates only reach devices running the same `expo.version` declared in `app.json`).*

---

## 📄 License

Distributed under the [MIT License](./LICENSE).

---

## 👤 Author

**Kislaya Agarwal**  
- GitHub: [@Kislaya-06](https://github.com/Kislaya-06)
