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
- **Expense Management** — Add, edit, view, and delete expenses with an intuitive custom number keypad
- **Categories** — Pre-loaded default categories + create fully custom ones with your own icon and color
- **Dashboard** — Snapshot of monthly spending with a donut chart and recent transactions
- **History** — Full searchable and filterable expense history, grouped by date
- **Insights** — Visual spending breakdowns by category with weekly, monthly, and yearly trends
- **Payment Modes** — Track whether each expense was Cash, UPI, or Card
- **Profile** — Edit your name, manage categories, and logout securely
- **Cloud Sync** — All data stored securely in Supabase — accessible across reinstalls

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
