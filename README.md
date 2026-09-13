# Arthik

> A premium personal expense tracker built with React Native & Supabase

[![React Native](https://img.shields.io/badge/React_Native-0.86-blue.svg)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo-SDK_57-black.svg)](https://expo.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Backend-Supabase-3ECF8E.svg)](https://supabase.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 📲 Download & Install

**Arthik is distributed as a direct APK — no Play Store needed.**

1. Go to the [**Releases**](../../releases) section of this repository
2. Open the **latest release**
3. Under **Assets**, tap/click `arthik-v1.0.0.apk` to download
4. On your Android phone:
   - Open the downloaded file
   - If prompted, tap **"Install anyway"** (since it's not from the Play Store)
   - You may need to enable **"Install from unknown sources"** in your phone settings:
     `Settings → Security → Install unknown apps → Allow`
5. Done! Open **Arthik** from your home screen

> **Minimum Android version:** Android 8.0 (Oreo) and above

---

## ✨ Features

- **Secure Authentication** — Email/password signup & login, Google OAuth, and password reset via email
- **Unified Expense Form (`ExpenseFormScreen`)** — Single consolidated, adaptive component handling both expense creation and modification with seamless auto-focus and state hydration
- **Custom In-App Number Keypad** — Fast, tactile expense entry with animated pill-shaped numeric keys and backspace
- **Theme-Aware Custom Date Picker** — Fully custom in-app calendar modal with quick "Today" and "Yesterday" pill shortcuts, seamlessly integrated with Arthik's dark/light design system
- **Expense Management** — Add, edit, view, and delete expenses with full real-time state synchronization
- **Categories** — Pre-loaded default categories + create fully custom ones with your own icon and color
- **Dashboard** — Snapshot of monthly spending with zero-state aware donut chart and recent transactions
- **History** — Full searchable and filterable expense history, grouped by date
- **Insights** — Visual spending breakdowns by category with weekly, monthly, and yearly trends
- **Payment Modes** — Track whether each expense was Cash, UPI, or Card with streamlined pill toggles
- **Profile** — Edit your name, manage categories, toggle dark mode, and logout securely
- **Timezone-Safe Date Storage** — Strict ISO parsing eliminating off-by-one date shifts
- **Cloud Sync & Clean Cache** — Stored securely in Supabase with memory lifecycle management across sessions

---

## 🎨 UI/UX & Design Modernization

Recent major enhancements to elevate the app's visual consistency, user experience, and codebase architecture:

### 1. Unified Pill Design Language
All interactive touchpoints across the expense flow now share a cohesive pill/stadium aesthetic (`borderRadius: 9999`):
- **Primary CTA Buttons:** "Save Expense" and "Update Expense" buttons enlarged to standard `height: 60px`, `borderRadius: 9999`, and `fontSize: 18px` (`Quicksand_700Bold`), perfectly matching primary actions across Auth, Onboarding, and Detail screens.
- **Keypad Digit Tiles:** Replaced standard rectangular keys with modern pill-shaped tiles featuring spring animations and theme-aware borders.
- **Input & Date Containers:** Note input field and Date selector container styled with matching pill borders for design uniformity.
- **Category Chips & Payment Toggles:** Smooth pill chips with accent highlights (`#B8E0C8` Mint Green & `#F4B8AE` Peach Coral).

### 2. Proportional Spacing & Layout Hierarchy
- **Normalized Gap Ratios:** Adjusted the spacing between Category Selector, Note input, and Date picker to an exact, consistent `16px` rhythm.
- **Screen Viewport Fit:** Freed up vertical real estate so that the Amount, Category list, Note input, Date selector, numeric keypad, and Save button remain 100% visible on screen without occluding one another.

### 3. Custom DatePicker Modal (`CustomDatePickerModal`)
- Replaced the stock Android dialog (generic teal header, white background, and system Roboto fonts) with a proprietary in-app calendar modal:
  - **Surface & Elevation:** Uses Arthik's dark navy card background (`#131D2F`), subtle borders (`#182335`), and `28px` rounded corners.
  - **Quick Shortcuts:** Dedicated **"Today"** and **"Yesterday"** pill buttons for one-tap date logging.
  - **Month & Year Navigator:** Fluid chevron navigation (`<` and `>`) with header date preview.
  - **Selected & Today Indicators:** Active selection highlighted with solid Mint Green (`#B8E0C8`) pill circle; current day marked with subtle accent outline.
  - **Typography:** Fully integrated with Google Fonts `Quicksand` weights.

### 4. Codebase Optimization & Screen Consolidation
- **Single Component Architecture:** Unified duplicate `AddExpenseScreen.tsx` and `EditExpenseScreen.tsx` (over 1,200 lines combined) into a single, high-performance `ExpenseFormScreen.tsx` (~600 lines) — cutting redundant code by **over 50%**.
- **Declarative Loops:** Replaced verbose duplicate JSX blocks for Payment Modes and Keypad rows with concise `.map()` arrays (`PAYMENT_OPTIONS`, `KEYPAD_ROWS`).
- **StyleSheet Sanitization:** Removed obsolete, empty style objects and duplicate inline styles.

### 5. App-Wide Audit & Architecture Hardening
- **Zero-State Donut Chart:** Guarded `HomeScreen` donut calculations when `total === 0` to render a clean, neutral track instead of an erroneous 100% green circle for zero-income states.
- **Timezone-Safe ISO Dates:** Switched all date instantiation to `parseISO` across form, detail, and history views, eliminating calendar date shifts caused by UTC midnight parsing.
- **Store Lifecycle & Cache Clearing:** Implemented `resetCategories()` and `resetExpenses()` called on user sign-out, eliminating data leaks and stale cache reuse across accounts.
- **Consistent Currency Formatting:** Enforced Indian Rupee symbol alignment and numeric comma grouping (`.toLocaleString('en-IN')`) across all screens.
- **Defensive Navigation:** Guarded back button rendering on `AuthScreen` with `navigation.canGoBack()` and connected inactive badges.

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Framework | React Native + Expo SDK 57 |
| Language | TypeScript |
| Navigation | React Navigation (Native Stack + Bottom Tabs) |
| State Management | Zustand |
| Backend & Auth | Supabase (PostgreSQL + Auth) |
| Icons | lucide-react-native |
| Fonts | Quicksand (Google Fonts via Expo) |
| Charts | react-native-svg |

---

## 📁 Project Structure

```
src/
├── components/   # Reusable UI components
├── config/       # Supabase client & environment config
├── hooks/        # Custom React hooks (scroll direction, etc.)
├── lib/          # Utility functions (formatters, icon utils)
├── navigation/   # App routing (Root Stack + Bottom Tabs)
├── screens/      # All full-screen views
├── store/        # Zustand stores (auth, expenses, categories)
└── types/        # TypeScript type definitions
```

---

## 🧑‍💻 Developer Setup

Want to run this locally or contribute?

### Prerequisites
- [Node.js](https://nodejs.org/) v18+
- [Expo CLI](https://docs.expo.dev/get-started/installation/)
- A [Supabase](https://supabase.com/) project (free tier works)

### Steps

1. **Clone the repo**
   ```bash
   git clone https://github.com/Kislaya-06/Arthik-App.git
   cd Arthik-App
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment**  
   Create a `.env` file in the root:
   ```env
   EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Run the database schema**  
   In Supabase SQL Editor, paste and run the contents of `schema.sql`

5. **Start the dev server**
   ```bash
   npx expo start
   ```
   Press `a` to open on Android emulator, or scan the QR code with [Expo Go](https://expo.dev/client)

---

## 🗄 Database Schema

Three core tables in Supabase:

**`profiles`** — User profile info linked to Supabase Auth  
**`categories`** — Expense categories (global defaults + user-created)  
**`expenses`** — All expense records with amount, category, date, mode, and note

See [`schema.sql`](./schema.sql) for the full DDL.

---

## 🚧 Roadmap

- [ ] Avatar / profile picture upload via `expo-image-picker`
- [ ] Budget limits per category with alerts
- [ ] Export expenses to CSV
- [ ] Income tracking alongside expenses
- [ ] iOS support

---

## 🤝 Contributing

This is a personal project, but PRs, bug reports, and suggestions are welcome!

1. Fork the repo
2. Create your feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'Add your feature'`
4. Push and open a Pull Request

---

## 📄 License

[MIT License](./LICENSE)

---

## 👤 Author

**Kislaya**  
- GitHub: [@Kislaya-06](https://github.com/Kislaya-06)
