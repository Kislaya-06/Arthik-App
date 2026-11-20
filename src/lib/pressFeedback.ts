/**
 * pressFeedback.ts
 *
 * One meaning for "you are touching this" across the app.
 * - Rows, icon buttons, chips, links and small buttons: dim to PRESS_DIM_OPACITY while pressed
 *   (use `PressableOpacity activeOpacity={PRESS_DIM_OPACITY}`).
 * - Real buttons (Save, Cancel, Delete, Log Out ...): `AppButton` (scale 0.97 spring).
 * - Full-screen backdrops and invisible tap areas: no feedback.
 */
export const PRESS_DIM_OPACITY = 0.7;
