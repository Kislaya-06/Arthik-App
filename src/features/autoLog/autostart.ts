/**
 * Some phone makers stop apps in the background unless "Autostart" (or a similar switch) is on, and Android
 * cannot open that screen for us. These are the steps to show, per maker. Pure (tests/autoLogHelpers.test.ts).
 */

export interface AutostartGuide {
  brand: string;
  steps: string[];
}

const GUIDES: Array<[RegExp, AutostartGuide]> = [
  [/xiaomi|redmi|poco/i, {
    brand: 'Xiaomi, Redmi or POCO',
    steps: ['Open Settings → Apps → Manage apps → Arthik.', 'Turn on Autostart.', 'Tap Battery saver and choose No restrictions.'],
  }],
  [/oppo|realme|oneplus/i, {
    brand: 'OPPO, realme or OnePlus',
    steps: ['Open Settings → Apps → Arthik.', 'Turn on Allow auto launch (or Auto launch).', 'Tap Battery usage and allow background activity.'],
  }],
  [/vivo|iqoo/i, {
    brand: 'vivo or iQOO',
    steps: ['Open Settings → Apps → Autostart (or i Manager → App manager → Autostart).', 'Turn on Arthik.', 'In Battery → Background power use, allow Arthik.'],
  }],
  [/samsung/i, {
    brand: 'Samsung',
    steps: ['Open Settings → Apps → Arthik → Battery.', 'Choose Unrestricted.', 'In Battery → Background usage limits, make sure Arthik is not in Sleeping apps.'],
  }],
  [/huawei|honor/i, {
    brand: 'Huawei or Honor',
    steps: ['Open Settings → Battery → App launch.', 'Find Arthik and turn off Manage automatically.', 'Turn on Auto-launch and Run in background.'],
  }],
  [/asus/i, {
    brand: 'ASUS',
    steps: ['Open Mobile Manager → Auto-start manager.', 'Allow Arthik.', 'In Settings → Battery, allow Arthik in the background.'],
  }],
];

/** Steps for this phone maker (`Platform.constants.Manufacturer`), or null when nothing extra is needed. */
export const autostartGuide = (manufacturer: string | null | undefined): AutostartGuide | null => {
  if (!manufacturer) return null;
  return GUIDES.find(([re]) => re.test(manufacturer))?.[1] ?? null;
};
