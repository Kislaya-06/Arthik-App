/**
 * Largest system-font multiplier allowed for text that lives inside a FIXED-size shape
 * (pills, badges, keypad keys, calendar day cells, short buttons). Above this the text would clip or
 * overflow its shape. At normal and moderately large system fonts (up to 1.3x) nothing changes.
 * Text that sits in a container that can grow must NOT use this cap: it should just grow.
 * Never use `allowFontScaling={false}` for this (OPT-42).
 */
export const FIXED_SHAPE_MAX_FONT_SCALE = 1.3;
