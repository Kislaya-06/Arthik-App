/**
 * quicksandMetrics.ts
 *
 * Horizontal advance widths of the Quicksand glyphs the app uses, in 1/1000 em, read straight from the
 * font files shipped in @expo-google-fonts/quicksand (hmtx table). Quicksand digits are PROPORTIONAL
 * (a '1' is much narrower than a '0'), so rolling-digit animation needs the real widths to keep the
 * layout identical before, during and after a roll. Kerning is ignored (it is tiny for digits).
 *
 * Generated once; regenerate only if the app switches font family.
 */

/** Characters covered, in the same order as every advance array below. */
export const METRIC_CHARS =
  " !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~₹−·–—×…";

export const QUICKSAND_ADVANCES: Record<string, number[]> = {
  Quicksand_400Regular: [
    273, 185, 383, 654, 562, 776, 679, 193, 374, 374, 309, 562, 194, 390, 181, 522,
    595, 370, 554, 524, 527, 545, 538, 513, 540, 558, 187, 199, 523, 519, 530, 485,
    972, 647, 651, 653, 719, 568, 566, 695, 720, 250, 572, 675, 532, 827, 728, 766,
    596, 775, 670, 562, 604, 713, 665, 966, 606, 559, 644, 397, 523, 397, 518, 667,
    226, 606, 606, 518, 606, 565, 360, 624, 568, 214, 270, 535, 230, 912, 578, 604,
    606, 606, 385, 469, 339, 569, 529, 752, 484, 568, 479, 427, 205, 427, 463, 569,
    518, 195, 510, 838, 463, 559,
  ],
  Quicksand_500Medium: [
    275, 213, 399, 667, 574, 790, 689, 200, 368, 368, 327, 567, 221, 392, 204, 538,
    601, 376, 559, 528, 547, 556, 543, 525, 543, 562, 216, 231, 524, 553, 528, 499,
    970, 644, 653, 645, 718, 570, 565, 695, 720, 259, 565, 669, 542, 824, 730, 764,
    599, 769, 676, 574, 611, 710, 669, 959, 622, 572, 646, 400, 538, 400, 551, 679,
    237, 614, 614, 519, 614, 573, 386, 629, 574, 221, 272, 547, 243, 916, 584, 611,
    614, 614, 401, 474, 363, 575, 540, 757, 485, 575, 481, 419, 219, 419, 489, 564,
    552, 204, 512, 854, 476, 581,
  ],
  Quicksand_600SemiBold: [
    278, 240, 414, 680, 585, 803, 699, 206, 363, 363, 345, 573, 248, 394, 226, 553,
    608, 383, 564, 533, 568, 566, 548, 537, 545, 565, 244, 262, 524, 586, 527, 513,
    967, 642, 654, 636, 716, 571, 563, 696, 719, 267, 559, 662, 552, 822, 733, 761,
    601, 762, 681, 585, 619, 708, 674, 951, 639, 584, 647, 404, 553, 404, 585, 692,
    248, 621, 621, 519, 621, 582, 411, 633, 580, 229, 273, 558, 257, 919, 590, 617,
    621, 621, 418, 478, 386, 581, 551, 763, 486, 581, 482, 410, 234, 410, 514, 558,
    585, 213, 514, 870, 488, 603,
  ],
  Quicksand_700Bold: [
    280, 267, 430, 693, 597, 816, 709, 212, 357, 357, 363, 578, 275, 396, 249, 568,
    614, 389, 569, 537, 588, 576, 553, 549, 548, 568, 273, 294, 525, 619, 525, 527,
    964, 639, 655, 627, 715, 572, 562, 696, 719, 275, 552, 655, 562, 819, 735, 759,
    603, 755, 687, 597, 626, 705, 678, 943, 655, 596, 648, 407, 568, 407, 618, 704,
    259, 628, 628, 520, 628, 590, 437, 638, 586, 236, 275, 569, 270, 922, 596, 624,
    628, 628, 434, 482, 409, 587, 562, 768, 487, 587, 484, 401, 248, 401, 540, 553,
    619, 222, 516, 886, 501, 625,
  ],
};
const FALLBACK_FAMILY = 'Quicksand_700Bold';

/** Advance width of one character, in em. Unknown characters fall back to the width of "0". */
export function getAdvanceEm(family: string | undefined, ch: string): number {
  const table = QUICKSAND_ADVANCES[family ?? FALLBACK_FAMILY] ?? QUICKSAND_ADVANCES[FALLBACK_FAMILY];
  const idx = METRIC_CHARS.indexOf(ch);
  const raw = idx >= 0 ? table[idx] : table[METRIC_CHARS.indexOf('0')];
  return raw / 1000;
}

/** Natural single-line width (px) of `text` set in `family` at `fontSize`. */
export function measureTextWidth(text: string, family: string | undefined, fontSize: number): number {
  let em = 0;
  for (const ch of text) em += getAdvanceEm(family, ch);
  return em * fontSize;
}

/** Widest digit advance (em) for a family — the clip-box width for a digit wheel. */
export function getMaxDigitEm(family: string | undefined): number {
  let max = 0;
  for (let d = 0; d <= 9; d++) max = Math.max(max, getAdvanceEm(family, String(d)));
  return max;
}
