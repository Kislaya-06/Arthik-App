# Arthik

> A premium, offline-first personal expense tracker built with React Native, Expo & Supabase

[![React Native](https://img.shields.io/badge/React_Native-0.86-blue.svg)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo-SDK_57-black.svg)](https://expo.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Backend-Supabase-3ECF8E.svg)](https://supabase.com/)
[![Version](https://img.shields.io/badge/Version-1.2.1-green.svg)](https://github.com/Kislaya-06/Arthik-App/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 📲 Download & Install

**Arthik is distributed as a direct APK — no Play Store needed.**

1. Go to the [**Releases**](../../releases) section of this repository
2. Open the **latest release** (e.g. `v1.2.1`)
3. Under **Assets**, tap/click `arthik-v1.2.1.apk` to download
4. On your Android phone:
   - Open the downloaded file
   - If prompted, tap **"Install anyway"** (since it's not from the Play Store)
   - You may need to enable **"Install from unknown sources"** in your phone settings:
     `Settings → Security → Install unknown apps → Allow`
5. Done! Open **Arthik** from your home screen

> **Minimum Android version:** Android 8.0 (Oreo) and above

---

## ✨ Features

- **📶 Offline-First Architecture** — Full offline capability; log, edit, or delete expenses with zero network latency. Pending changes are queued in `AsyncStorage` and automatically synced to Supabase upon reconnect.
- **🛡️ App-Wide Error Boundary** — Catches unexpected React rendering crashes gracefully, presenting a modern recovery UI with instant restart/retry controls.
- **🐷 Smart Gullak (Daily Budget & Savings)** — Daily allowance budgeting, automated savings rollover, streak calendar tracking, and real-time overspending deduction from accumulated savings.
- **🔒 Secure Authentication** — Email/password signup & login, Google OAuth, session persistence, and password reset via email deep links.
- **📝 Unified Expense Form (`ExpenseFormScreen`)** — Single consolidated, adaptive component handling both expense creation and modification with auto-focus and state hydration.
- **🔢 Custom In-App Number Keypad** — Fast, tactile expense entry with spring-animated pill-shaped numeric keys and backspace.
- **📅 Theme-Aware Custom Date Picker** — Proprietary in-app calendar modal with quick "Today" and "Yesterday" pill shortcuts, seamlessly integrated with Arthik's dark/light design system.
- **📊 Real-Time Dashboard** — Instant spending overview with dynamic greeting typography, zero-state aware donut chart, remaining allowance tracking, and recent transactions.
- **🏷️ Flexible Categories** — Pre-loaded default categories + create fully custom categories with custom icons and curated hex colors.
- **📜 Searchable History** — Full searchable and filterable expense history, categorized and grouped chronologically.
- **📈 Visual Spending Insights** — Breakdown of spending habits by category with weekly, monthly, and yearly analytical trends.
- **💳 Payment Modes** — Track whether each transaction was Cash, UPI, or Card with spring-calibrated pill toggles.
- **🔔 Smart Reminders** — Daily evening reminder notifications with contextual deep linking directly to Savings and Notification hubs.
- **🌐 Strict Timezone-Safe Storage** — Direct ISO string date parsing eliminating off-by-one date shifts across timezones.

---

## ⚡ Architecture & Optimization Highlights

Recent deep engineering updates ensuring robust performance, offline resilience, and clean multi-user isolation:

### 1. Offline Engine & Dual-Endpoint Heartbeat (`networkStore.ts`)
- **Zero-Byte Connectivity Heartbeat:** Avoids unreliable OS-level connection flags by dispatching lightweight GET requests to `https://clients3.google.com/generate_204` with a 3.5s timeout, falling back to `https://www.cloudflare.com/cdn-cgi/trace`.
- **Local Mutation Queue:** When offline, expense creations, edits, and deletions update Zustand state immediately (optimistic UI) and append actions to an `AsyncStorage` persistent queue.
- **Auto-Flush Reconnection Listener:** Re-establishing internet triggers an automated background queue sync with Supabase and dismisses the status banner.
- **Animated Offline Banner (`OfflineBanner.tsx`):** A slide-down top indicator informing users of offline status and real-time syncing progress with a manual "Retry" action.

### 2. Comprehensive Error Boundary (`ErrorBoundary.tsx`)
- High-level React Error Boundary wrapping `SafeAreaProvider` and navigation root.
- Replaces generic white-screen crashes with a themed recovery card showing actionable error details, copy-to-clipboard trace, and a clean reset button to restore normal app state.

### 3. Smart Gullak & Savings Engine (`dailyBudgetStore.ts`)
- **Daily Budget Allowance:** Users configure a daily spending target (e.g. ₹500/day).
- **Rollover & Savings Deduction:** At midnight, unspent allowance rolls over into the "Gullak" (piggy bank). If daily spending exceeds the daily budget, the deficit is automatically deducted from accumulated savings.
- **Streak Calendar (`StreakCalendarModal.tsx`):** Visual calendar displaying daily streak dots, allowing users to track consecutive days within budget.

### 4. Memory Hygiene & Multi-User Cache Isolation
- **Store Reset Callback Registry:** Replaced dynamic runtime module imports in `signOut()` with a synchronous callback registry across `authStore`, `expenseStore`, `categoryStore`, and `dailyBudgetStore`.
- Prevents cross-account cache leakage and completely eliminates `TypeError: Cannot read property 'reload' of undefined` during sign-out.

---

## 🎨 UI/UX & Design Modernization

- **Unified Pill Design Language:** All form inputs (Notes, Date picker button, Payment mode toggles, and Primary CTAs) adhere to an exact, uniform `56dp` / `60dp` stadium-pill height (`borderRadius: 9999`).
- **Calibrated Bouncy Payment Toggle:** Spring animation physics (`tension: 70, friction: 8`) with boundary clamping (`extrapolate: 'clamp'`) and `overflow: 'hidden'`.
- **Floating Capsule Bottom Navigation Bar (`BottomNavBar`):** Balanced 5-column navigation layout with spring-animated horizontal expanding capsule tabs and an elevated center quick-add button.
- **Dynamic Header Typography Scaling:** Header greeting name auto-scales between `36px` and `19px` with `numberOfLines={1}` and `adjustsFontSizeToFit`, preventing overflow on long names.
- **Safe Area Insets:** Fully compliant with notch, dynamic island, and gesture bars using `react-native-safe-area-context` without hardcoded margins.

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | React Native (0.86.0) + Expo SDK 57 |
| **Language** | TypeScript |
| **Navigation** | React Navigation (Native Stack + Bottom Tabs) |
| **State Management** | Zustand (with AsyncStorage persistence) |
| **Backend & Auth** | Supabase (PostgreSQL + GoTrue Auth) |
| **Network & Sync** | Custom Offline Queue + Fetch Ping Heartbeat |
| **Icons** | lucide-react-native |
| **Typography** | Quicksand (Google Fonts via Expo) |
| **Vector Graphics** | react-native-svg |
| **Build System** | Expo EAS Build & Expo Updates (OTA) |

---

## 📁 Project Structure

```
src/
├── components/
│   ├── BottomNavBar.tsx          # Spring-animated floating pill tab bar
│   ├── CustomDatePickerModal.tsx # Proprietary in-app calendar modal
│   ├── ErrorBoundary.tsx         # App-level crash catcher & recovery view
│   ├── OfflineBanner.tsx         # Animated slide-in network status alert
│   ├── StreakCalendarModal.tsx   # Visual monthly streak calendar
│   └── ...                       # Other UI cards and components
├── config/                       # Supabase client, theme tokens & constants
├── hooks/                        # Custom React hooks (scroll direction, etc.)
├── lib/                          # Utility functions (notifications, dates, UPI utils)
├── navigation/                   # App routing (Root Stack + Bottom Tabs)
├── screens/                      # All full-screen views (Home, History, Form, etc.)
├── store/
│   ├── authStore.ts              # Authentication state & reset registry
│   ├── categoryStore.ts          # Category CRUD & local cache
│   ├── dailyBudgetStore.ts       # Gullak, daily budget & streak tracking
│   ├── expenseStore.ts           # Expense state, offline mutation queue & sync
│   ├── networkStore.ts           # Ping connectivity heartbeat & offline listeners
│   └── themeStore.ts             # Dark/Light theme switching
└── types/                        # TypeScript type definitions
```

---

## 🧑‍💻 Developer Setup

### Prerequisites
- [Node.js](https://nodejs.org/) v18+
- [Expo CLI](https://docs.expo.dev/get-started/installation/)
- [Android Studio & SDK](https://developer.android.com/studio) (for Android emulator/device testing)
- A [Supabase](https://supabase.com/) project

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

3. **Set up environment variables:**  
   Create a `.env` file in the root directory:
   ```env
   EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Initialize database schema:**  
   Run [`schema.sql`](./schema.sql) in your Supabase SQL Editor.

5. **Start the development server:**
   ```bash
   npx expo start
   ```

6. **Running on Android Emulator / Dev Client:**
   ```bash
   # Port forward Metro to Android emulator
   adb reverse tcp:8081 tcp:8081

   # Launch app directly into local Metro
   adb shell am start -a android.intent.action.VIEW -d "arthik://expo-development-client/?url=http%3A%2F%2F10.0.2.2%3A8081" com.kislaya_agarwal.arthik
   ```

---

## 🚀 Deployment & OTA Updates

Arthik leverages **Expo EAS Build** for native binaries and **Expo Updates** for instant Over-The-Air code patches:

- **Generate Android APK (Preview Profile):**
  ```bash
  eas build -p android --profile preview
  ```
- **Publish Instant OTA Update:**
  ```bash
  eas update --branch preview --message "Your update description"
  ```

---

## 🗄 Database Schema

Core tables in Supabase PostgreSQL:

- **`profiles`** — User profile metadata, monthly income, and auth linkage
- **`categories`** — Expense categories (global defaults + user-created custom categories)
- **`expenses`** — Individual expense transactions with amount, category, date, payment mode, and notes
- **`daily_budgets`** — Daily target limits, rollover savings (Gullak), and consecutive streak metrics

See [`schema.sql`](./schema.sql) for full table definitions and Row Level Security (RLS) policies.

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the [MIT License](./LICENSE).

---

## 👤 Author

**Kislaya**  
- GitHub: [@Kislaya-06](https://github.com/Kislaya-06)
