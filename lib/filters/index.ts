/**
 * @basta/filters - Reusable Filter System
 *
 * A complete, reusable filter system for React applications.
 * Designed to work with Typesense and other search backends.
 *
 * @example Basic Usage
 * ```tsx
 * import { useFilters, FilterPanel, buildTypesenseFilter } from '@/lib/filters';
 *
 * function MyComponent({ facets }) {
 *   const filters = useFilters({ defaultSortBy: 'date' });
 *
 *   // Build filter string for Typesense
 *   const filterString = buildTypesenseFilter(filters.selectedFacets, {
 *     baseFilters: { saleId: 'my-sale-123' }
 *   });
 *
 *   return (
 *     <FilterPanel
 *       facets={facets}
 *       selectedFacets={filters.selectedFacets}
 *       onToggleFacet={filters.toggleFacet}
 *       onClearFacet={filters.clearFacet}
 *       onClearAll={filters.clearAllFacets}
 *     />
 *   );
 * }
 * ```
 *
 * @example With Pagination
 * ```tsx
 * import { usePaginatedFilters, FilterPanel } from '@/lib/filters';
 *
 * function MyComponent({ facets, totalItems }) {
 *   const filters = usePaginatedFilters({
 *     defaultSortBy: 'date',
 *     itemsPerPage: 20,
 *     totalItems
 *   });
 *
 *   return (
 *     <div>
 *       <FilterPanel {...} />
 *       <div>
 *         Page {filters.paginationInfo.currentPage} of {filters.paginationInfo.totalPages}
 *       </div>
 *     </div>
 *   );
 * }
 * ```
 *
 * @example URL Sync
 * ```tsx
 * const filters = useFilters({
 *   syncWithUrl: true,
 *   defaultSortBy: 'lotNumber'
 * });
 * // Filter state will be persisted in the URL
 * ```
 */

// Types
export type {
    Facet,
    FacetCount,
    SortOption,
    SelectedFacets,
    SelectedRanges,
    RangeValue,
    RangeFilterConfig,
    FilterState,
    FilterActions,
    UseFiltersConfig,
    UseFiltersReturn,
    FilterBuilderConfig,
    BuiltFilters,
    FacetFilterProps,
    FilterPanelProps,
    SortSelectProps,
    FilterSheetProps,
    RangeFilterProps,
} from "./types";

// Hooks
export { useFilters, usePaginatedFilters } from "./use-filters";

// Filter Builders
export {
    buildTypesenseFilter,
    buildRangeFilter,
    buildFilterObject,
    buildQueryString,
    parseQueryString,
    buildFilters,
    createFilterBuilder,
    getSortString,
} from "./filter-builder";

// Components
export {
    FacetFilter,
    BooleanFacetFilter,
    SortSelect,
    FilterPanel,
    FilterSheet,
    ActiveFilters,
    RangeFilter,
} from "./components";

/**
 * Default sort options for auction lots
 */
export const DEFAULT_LOT_SORT_OPTIONS = [
    { value: "lotNumber", label: "Lot Number (Low to High)", sortBy: "itemNumber:asc" },
    { value: "lotNumberDesc", label: "Lot Number (High to Low)", sortBy: "itemNumber:desc" },
    { value: "priceAsc", label: "Price (Low to High)", sortBy: "currentBid:asc" },
    { value: "priceDesc", label: "Price (High to Low)", sortBy: "currentBid:desc" },
    { value: "estimateAsc", label: "Estimate (Low to High)", sortBy: "lowEstimate:asc" },
    { value: "estimateDesc", label: "Estimate (High to Low)", sortBy: "highEstimate:desc" },
] as const;

/**
 * Default sort options for auctions
 */
export const DEFAULT_AUCTION_SORT_OPTIONS = [
    { value: "dateAsc", label: "Date (Earliest First)", sortBy: "openDate:asc" },
    { value: "dateDesc", label: "Date (Latest First)", sortBy: "openDate:desc" },
    { value: "titleAsc", label: "Title (A-Z)", sortBy: "title:asc" },
    { value: "titleDesc", label: "Title (Z-A)", sortBy: "title:desc" },
] as const;

