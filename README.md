# Arthik
> Apna kharcha, apna hisaab — a personal expense tracker built with React Native

<!-- ![Arthik Banner](./assets/readme-banner.png) -->
<!-- *Note: Add a hero banner image above* -->

[![React Native](https://img.shields.io/badge/React_Native-0.86.0-blue.svg)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo-57.0.4-black.svg)](https://expo.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview
Arthik is a standalone, premium personal expense tracking application designed to help individuals monitor their financial health. Rather than focusing on splitting bills, Arthik provides a dedicated space for users to log daily expenses, categorize their spending, and gain actionable insights into their financial habits.

With a focus on a fluid user experience and modern design aesthetics, Arthik makes it effortless to record expenses with details like category, custom notes, dates, and payment modes (Cash, UPI, Card).

## Features
- **Authentication**: Email/Password login and onboarding flow (currently supporting a seamless mock-mode for rapid UI testing).
- **Expense Management**: Add, edit, view, and delete expenses with an intuitive and fast interface.
- **Categories**: Comes pre-configured with default categories (Food, Shopping, Travel, etc.) and allows users to add/edit custom categories with personalized colors and icons.
- **Dashboard / Home**: A quick snapshot of your financial status featuring a summary card and a list of recent transactions.
- **History**: A comprehensive, filterable, and searchable list of all your expenses logically grouped by date.
- **Insights**: Visual breakdowns of your spending habits by category, complete with weekly, monthly, and yearly trend analysis.
- **Profile & Settings**: Manage user profile details, application preferences, and navigation configurations.

## Tech Stack
Arthik is built with a modern, performant, and scalable technology stack:
- **Framework**: [React Native](https://reactnative.dev/) & [Expo](https://expo.dev/) (SDK 57) - For rapid, cross-platform mobile development.
- **Language**: [TypeScript](https://www.typescriptlang.org/) - Ensuring robust type safety and a superior developer experience.
- **Navigation**: [React Navigation](https://reactnavigation.org/) (Native Stack & Bottom Tabs) - For smooth, native-feeling routing.
- **State Management**: [Zustand](https://github.com/pmndrs/zustand) - A small, fast, and scalable bearbones state-management solution.
- **Backend**: [Supabase](https://supabase.com/) - Integrated for backend database and authentication services.
- **Styling**: Vanilla React Native `StyleSheet` & `react-native-safe-area-context` - For precise and responsive layout control.
- **Icons**: `lucide-react-native` - Clean, modern vector icons.
- **Fonts**: `@expo-google-fonts/quicksand` - For a premium and modern typography experience.
- **Graphics & Charts**: `react-native-svg` - For custom background notches and insights charts.

## Screenshots

<!-- 
Add screenshots of key screens here using the markdown image syntax below:
| Home | Add Expense | Insights | Profile |
|------|-------------|----------|---------|
| ![Home](./assets/screenshots/home.png) | ![Add Expense](./assets/screenshots/add.png) | ![Insights](./assets/screenshots/insights.png) | ![Profile](./assets/screenshots/profile.png) |
-->

## Project Structure

```
src/
├── components/   # Reusable UI components (e.g., BottomNavBar, TabItem)
├── config/       # Configuration setup (e.g., Supabase client, environment flags)
├── hooks/        # Custom React hooks (e.g., useScrollDirection for animations)
├── lib/          # Utility functions and formatters (currency, dates, icons)
├── navigation/   # Application routing (Root Stack and Bottom Tabs)
├── screens/      # Full-screen components (Home, History, Insights, etc.)
├── store/        # Zustand global state stores (authStore, expenseStore, categoryStore)
└── types/        # TypeScript type definitions and interfaces
```

## Getting Started / Installation

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or newer recommended)
- npm or yarn
- [Expo CLI](https://docs.expo.dev/get-started/installation/)
- [Expo Go](https://expo.dev/client) app on your physical device, or Android Studio / Xcode for emulators

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/arthik.git
   cd arthik
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env` file in the root of the project and add your Supabase credentials:
   ```env
   EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Run the app**
   ```bash
   npx expo start
   ```
   *Press `a` to open on Android, `i` to open on iOS, or scan the QR code with the Expo Go app on your physical device.*

## Environment Variables

| Variable Name | Description |
|---------------|-------------|
| `EXPO_PUBLIC_SUPABASE_URL` | The REST URL for your Supabase project backend |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | The anonymous public API key for your Supabase project |

## Database Schema

The core backend structure relies on three primary entities managed via Supabase:

- **Profile**
  - `id` (UUID): Matches the Supabase Auth user ID
  - `first_name` (Text): User's first name
  - `last_name` (Text): User's last name (optional)
  - `email` (Text): User's email address

- **Category**
  - `id` (UUID): Unique category identifier
  - `user_id` (UUID, nullable): Owner of the category (null for default global categories)
  - `name` (Text): Display name
  - `icon` (Text): Lucide icon reference name
  - `color` (Text): Hex color code
  - `is_default` (Boolean): Flag for pre-installed categories

- **Expense**
  - `id` (UUID): Unique expense identifier
  - `user_id` (UUID): Owner of the expense record
  - `category_id` (UUID): Reference to the associated Category
  - `amount` (Numeric): Expense amount
  - `note` (Text, optional): Custom description
  - `payment_mode` (Text): `'cash'`, `'upi'`, or `'card'`
  - `expense_date` (Date): Formatted as `YYYY-MM-DD`
  - `created_at` (Timestamp): Record creation time

## Known Limitations / Roadmap

The UI and application flow are fully built and currently operate perfectly in a local "Mock Mode" designed for iterative UI testing. The following features are planned for future releases:

- **Supabase Realtime Sync**: Wire up the Zustand stores to push/pull real data to the Supabase PostgreSQL database (CRUD operations).
- **Authentication**: Replace mock login with real Supabase Auth (Email/Password) and implement the Google OAuth flow.
- **Image Picker Integration**: Enable users to upload custom avatar images to Supabase Storage via `expo-image-picker`.
- **Legal Pages**: Connect the Privacy Policy and Terms of Service placeholder buttons to actual webviews or screens.
- **Profile Editing**: Implement the "Edit Profile" screen.

## Contributing
This is currently a personal portfolio project. However, feedback, bug reports, and pull requests are always welcome!

## License
[MIT License](./LICENSE) *(Placeholder - License TBD)*

## Author
**[Your Name]**
- GitHub: [@yourusername](https://github.com/yourusername)
- LinkedIn: [Your LinkedIn Profile](https://linkedin.com/in/yourprofile)
