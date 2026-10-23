export default function createLucideIcon(data: any) {
  const Icon = () => null;
  Icon.displayName = data?.name || 'LucideIcon';
  return Icon;
}
