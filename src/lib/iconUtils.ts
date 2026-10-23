import React from 'react';
import HelpCircle from 'lucide-react-native/icons/circle-question-mark';
import { CATEGORY_ICONS } from './categoryIconRegistry';

type IconComponent = React.FC<{ size: number; color: string; strokeWidth?: number }>;

/**
 * Safely looks up a Lucide icon component by name string.
 * Falls back to HelpCircle if the icon name is not found.
 */
export const getCategoryIcon = (iconName: string): IconComponent => {
  return (CATEGORY_ICONS[iconName] as unknown as IconComponent) ?? (HelpCircle as unknown as IconComponent);
};
