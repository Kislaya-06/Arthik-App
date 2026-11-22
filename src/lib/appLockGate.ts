/**
 * Whether the App Lock screen covers the app. The splash shows its own prompt, so the cover waits
 * for the route to leave 'Splash'; the overlay must re-render on every route change for this to hold.
 */
export const isLockScreenShown = (s: { hasUser: boolean; enabled: boolean; rendered: boolean; route: string | undefined }) =>
  s.hasUser && s.enabled && s.rendered && s.route !== 'Splash';
