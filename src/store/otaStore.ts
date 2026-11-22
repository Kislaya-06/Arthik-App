import { create } from 'zustand';
import * as Updates from 'expo-updates';
import Constants from 'expo-constants';
import { OtaUpdateInfo } from '../components/OtaUpdateModal';

export type OtaStatus = 'idle' | 'checking' | 'available' | 'upToDate';

interface OtaState {
  visible: boolean;
  status: OtaStatus;
  info: OtaUpdateInfo | null;
  isDownloading: boolean;
  downloadText: string;
  error: string | null;
  showUpdateModal: (info?: OtaUpdateInfo, status?: OtaStatus) => void;
  hideUpdateModal: () => void;
  applyUpdate: () => Promise<void>;
  checkForUpdates: () => Promise<void>;
  checkStatusFromProfile: () => Promise<void>;
}

const resolveOtaInfo = (manifest?: any): OtaUpdateInfo => {
  const ota = (manifest?.extra?.expoClient?.extra || manifest?.extra || Constants.expoConfig?.extra)?.otaUpdate;
  return {
    version: ota?.version || manifest?.runtimeVersion || Constants.expoConfig?.version || '2.1.0',
    title: ota?.title || 'Smoother, Cleaner & More Consistent ✨',
    highlights: Array.isArray(ota?.highlights) && ota.highlights.length > 0
      ? ota.highlights
      : [
          'A Cleaner Add Transaction: the screen is calmer and better ordered, with date, split and note together in one neat card, the amount you type shows in red for spending and green for income, every category has its own coloured icon, and the button shows exactly what you will save (like "Save ₹250"). Fixed: the Save button always keeps its size, and "Yes, always" for transfers between your own accounts now works (it asks for a short note to remember)',
          'Same-Size Buttons & Tidier Lists: Buttons now come in three fixed sizes by role (big at the bottom of pages and sheets, medium in popups and cards, small for pills like Change and See More), notification times no longer repeat the day heading, quiet savings days say "Nothing spent", and the tab bar comes back when you reach the end of a list',
          'Small Touches: Category pills fade softly at the edges, the first category chip on Add Transaction no longer looks shaded, and the empty Ledger shows a button to add an expense to split',
          'Cleaner Details, Switches & Alerts: Expense details show Edit and Delete once at the bottom, switches fill with colour instead of saying ON / OFF, the spending chart uses spend colours, daily Gullak savings in your notifications fold into one row you can open, and Insights says "last week" instead of "prev week"',
          'A Calmer, Clearer Home: The spending ring now shows your real number (like 184% when you spend more than your budget), the card says each thing once, and "Available" replaces "Income" for your budget money, and the ring no longer replays every time you come back. Savings and Insights keep their bright purple and coral cards',
          'Smarter Automatic Logging: Undo right from the notification, categories learned from your own entries, alerts without an account number logged when you have one account at that bank, a weekly summary, names for your accounts, and easy steps to keep it running on Xiaomi, OPPO, vivo and Samsung phones',
          'Only Your Real Bank Accounts: Automatic Logging no longer lists extra accounts made up from mutual fund, insurance or bill messages that mention your account, and a bank that writes from two names (like slice) now shows once. See an account that isn\'t yours? Tap "Not my account" to hide it for good',
          'Tidier Savings & Notifications: Your savings history is now grouped by week with each week\'s total, and notifications are grouped into Today, Yesterday, This week and earlier. Insights no longer repeats "nothing spent" four times on a quiet week, and Profile settings are now in clear groups. Savings badges use the app\'s own icons instead of emoji, and the amount keypad is calmer so the Save button stands out. Home shows one offline message at a time, and History rows show the time instead of repeating the date. Finished weeks show what you really spent per day, and the offline notice no longer covers the top of the screen',
          'Clearer Money Text: Amounts with paise always show two digits (like ₹13,834.50), and spending exactly your budget now says "budget is used up" instead of "₹0 over". The help button next to Gullak is now a calm green "i" instead of an orange "!"',
          'A Living Streak Flame: Your savings streak now has a real fire, like an animated emoji: its flames lick and dance, little sparks of flame break off the top, and it grows a little bigger with every day you keep it going, and the Savings history filter no longer flickers when you open the tab',
          'Cleaner Forms & Help: Add Transaction fields all look the same, FAQs are laid out like a help centre, and names, notes and amounts are never cut off',
          'A Nicer Ledger: See at a glance how much each friend has paid back, with clear Owes you and Settled groups and a bigger Settle all button',
          'Easier to Read in Light Mode: Amounts, links, labels and error messages now use deeper green and coral, so they are clear on a white screen',
          'Snappier After Every Save: Less work happens in the background when you add or edit money, so the app stays smooth even with years of history',
          'Cleaner, More Consistent Look: Page titles are now centred and sit at the same height on every screen, empty screens share one friendly design, every back, popup and close button has the same size and feel, every tap gives instant feedback, and the red Delete buttons are easier to read in dark mode',
          'Opens Fast, Even Offline: The app now opens from the data saved on your phone, so it starts quickly on any network and keeps working without internet',
          'Budget Mode Starts Properly: When you switch Smart Budget & Gullak back on, your daily budget now starts right away on the first day with auto-save on, instead of showing ₹0',
          'Nothing Lost Offline: Budget changes, Gullak deposits and categories you save offline now always reach the server',
          'Self-Transfers Offline: Remembered transfer notes now work without internet',
          'Full Text, No More ...: Names, notes, titles and buttons now wrap or shrink to fit instead of being cut off',
          'Clear Error Messages: Short, simple messages instead of technical text',
          'Tactile Saves: A soft success buzz when you save an expense, deposit to Gullak or update your budget',
          'Safe Daily Spending Pace Precision: Today is now accurately counted as an active day in Weekly and Monthly Insights',
          'Insights Briefing Dock: Unified dual-tile financial summary for Safe Daily Pace and Auto-Saved Gullak with instant one-tap navigation to Savings',
          'History Gesture Polish: Eliminated button underlay blink during screen transitions for buttery-smooth swipe-to-delete',
          'Split an expense with a friend and see exactly what they owe you',
          'When a friend pays you back, it is no longer counted as income',
          'Safer Sign-In, App Lock & Alerts: sign-in links now work only with a one-time code, App Lock stays on after opening the app and covers open sheets, notification Undo and category buttons wait until you unlock, Log Out clears your notifications, and emails that only say "Paytm" or "CRED" go to Review instead of being logged',
        ],
  };
};

export const useOtaStore = create<OtaState>((set, get) => ({
  visible: false,
  status: 'idle',
  info: null,
  isDownloading: false,
  downloadText: 'Downloading update...',
  error: null,

  showUpdateModal: (info, status = 'available') => set({
    visible: true,
    status,
    info: info || resolveOtaInfo(),
    isDownloading: false,
    error: null,
  }),

  hideUpdateModal: () => {
    if (!get().isDownloading) set({ visible: false, error: null });
  },

  applyUpdate: async () => {
    try {
      set({ isDownloading: true, downloadText: 'Downloading update...', error: null });
      if (!__DEV__ && Updates.isEnabled) {
        await Updates.fetchUpdateAsync();
        set({ downloadText: 'Restarting Arthik...' });
        await Updates.reloadAsync();
      } else {
        await new Promise((r) => setTimeout(r, 1000));
        set({ downloadText: 'Restarting Arthik...' });
        await new Promise((r) => setTimeout(r, 800));
        set({ visible: false, isDownloading: false });
      }
    } catch {
      set({ isDownloading: false, error: 'Could not apply update. Please check connection and try again.' });
    }
  },

  checkForUpdates: async () => {
    if (__DEV__ || !Updates.isEnabled) return;
    try {
      const update = await Updates.checkForUpdateAsync();
      if (update.isAvailable) {
        set({
          visible: true,
          status: 'available',
          info: resolveOtaInfo(update.manifest),
          isDownloading: false,
          error: null,
        });
      } else {
        set({ status: 'upToDate' });
      }
    } catch (e) {
      if (__DEV__) console.log('Update check failed:', e);
    }
  },

  checkStatusFromProfile: async () => {
    if (get().isDownloading || get().status === 'checking') return;

    set({ status: 'checking', error: null });

    if (!Updates.isEnabled) {
      set({
        visible: true,
        status: 'upToDate',
        info: resolveOtaInfo(),
        isDownloading: false,
        error: null,
      });
      return;
    }

    try {
      const update = await Updates.checkForUpdateAsync();
      if (update.isAvailable) {
        set({
          visible: true,
          status: 'available',
          info: resolveOtaInfo(update.manifest),
          isDownloading: false,
          error: null,
        });
      } else {
        set({
          visible: true,
          status: 'upToDate',
          info: resolveOtaInfo(),
          isDownloading: false,
          error: null,
        });
      }
    } catch (e) {
      if (__DEV__) console.log('Update check failed:', e);
      set({
        visible: true,
        status: 'upToDate',
        info: resolveOtaInfo(),
        isDownloading: false,
        error: null,
      });
    }
  },
}));
