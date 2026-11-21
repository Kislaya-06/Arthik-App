import { StyleSheet } from 'react-native';
import { Spacing, BorderRadius, FontSize, FontFamily, LineHeight, ControlHeight } from '../config/theme';
import { EMPTY_STATE_TOP_OFFSET } from '../components/ui/EmptyState';

/** Must match `emptyContainer.marginTop` in the styles below. */
export const EMPTY_STATE_TOP_MARGIN = EMPTY_STATE_TOP_OFFSET;

export const SEARCH_CONTAINER_HEIGHT = 48;

export const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: Spacing.gutter,
  },
  listArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.block,
    marginBottom: Spacing.block,
  },
  headerTitle: {
    fontSize: FontSize.titleLarge,
    lineHeight: LineHeight.titleLarge,
  },
  searchButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  filterWrapper: {
    marginTop: 0,
    marginBottom: Spacing.element,
  },
  searchInnerWrapper: {
    paddingTop: Spacing.block,
    paddingBottom: Spacing.block,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.pill,
    paddingHorizontal: Spacing.surface,
    height: SEARCH_CONTAINER_HEIGHT,
  },
  searchInput: {
    flex: 1,
    marginLeft: Spacing.element,
    fontSize: FontSize.body,
    padding: 0,
  },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.block,
    marginBottom: Spacing.element,
  },
  sectionTitle: {
    fontSize: FontSize.caption,
    letterSpacing: 1,
    flex: 1,
    marginRight: Spacing.element,
  },
  sectionTotal: {
    fontSize: FontSize.caption,
    flexShrink: 0,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.section,
    marginTop: EMPTY_STATE_TOP_MARGIN,
  },
  searchClearBtn: {
    padding: Spacing.micro,
    marginLeft: Spacing.micro,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seeMoreBtn: {
    height: ControlHeight.compact,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    gap: Spacing.element,
    paddingHorizontal: Spacing.surface,
    borderRadius: BorderRadius.pill,
    borderWidth: 1,
    marginTop: Spacing.block,
    marginBottom: Spacing.element,
  },
  seeMoreText: {
    fontSize: FontSize.bodySmall,
    fontFamily: FontFamily.bold,
  },
});
