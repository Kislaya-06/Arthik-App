import React from 'react';
import * as LucideIcons from 'lucide-react-native';

type IconComponent = React.FC<{ size: number; color: string }>;

/**
 * Safely looks up a Lucide icon component by name string.
 * Falls back to HelpCircle if the icon name is not found.
 * Eliminates the need for @ts-ignore + (LucideIcons as any)[icon] across all screens.
 */
export const getCategoryIcon = (iconName: string): IconComponent => {
  const icon = (LucideIcons as Record<string, unknown>)[iconName];
  return (icon as IconComponent) ?? LucideIcons.HelpCircle;
};
