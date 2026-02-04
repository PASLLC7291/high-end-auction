/**
 * @basta/filters - Reusable Filter System
 * Type definitions for the filter system
 */

/**
 * Represents a single facet value with its count
 */
export interface FacetCount {
    value: string;
    count: number;
}

/**
 * Represents a facet field with its available values
 */
export interface Facet {
    fieldName: string;
    counts: FacetCount[];
}

/**
 * Configuration for a sort option
 */
export interface SortOption<T extends string = string> {
    value: T;
    label: string;
    /** The actual sort string to send to the backend (e.g., "itemNumber:asc") */
    sortBy?: string;
}

/**
 * Selected facet values keyed by field name
 */
export type SelectedFacets = Record<string, string[]>;

/**
 * Range filter value
 */
export interface RangeValue {
    min: number;
    max: number;
}

/**
 * Selected range filters keyed by field name
 */
export type SelectedRanges = Record<string, RangeValue>;

/**
 * Range filter configuration
 */
export interface RangeFilterConfig {
    fieldName: string;
    label: string;
    min: number;
    max: number;
    step?: number;
    formatValue?: (value: number) => string;
}

/**
 * Filter state returned by useFilters hook
 */
export interface FilterState<TSortValue extends string = string> {
    selectedFacets: SelectedFacets;
    selectedRanges: SelectedRanges;
    sortBy: TSortValue;
    currentPage: number;
}

/**
 * Filter actions returned by useFilters hook
 */
export interface FilterActions<TSortValue extends string = string> {
    toggleFacet: (fieldName: string, value: string) => void;
    setFacetValues: (fieldName: string, values: string[]) => void;
    clearFacet: (fieldName: string) => void;
    clearAllFacets: () => void;
    setRange: (fieldName: string, value: RangeValue) => void;
    clearRange: (fieldName: string) => void;
    clearAllRanges: () => void;
    setSortBy: (value: TSortValue) => void;
    setCurrentPage: (page: number) => void;
    resetFilters: () => void;
}

/**
 * Complete filter hook return type
 */
export interface UseFiltersReturn<TSortValue extends string = string>
    extends FilterState<TSortValue>,
    FilterActions<TSortValue> {
    /** Whether any filters are currently active */
    hasActiveFilters: boolean;
    /** Whether any range filters are active */
    hasActiveRanges: boolean;
    /** Count of active filter values */
    activeFilterCount: number;
    /** Serialized filter state for URL or API calls */
    serializedState: string;
}

/**
 * Configuration for the useFilters hook
 */
export interface UseFiltersConfig<TSortValue extends string = string> {
    /** Default sort value */
    defaultSortBy?: TSortValue;
    /** Initial selected facets */
    initialFacets?: SelectedFacets;
    /** Initial selected ranges */
    initialRanges?: SelectedRanges;
    /** Initial page number */
    initialPage?: number;
    /** Callback when filters change */
    onFiltersChange?: (state: FilterState<TSortValue>) => void;
    /** Whether to sync state with URL */
    syncWithUrl?: boolean;
    /** URL parameter name for filters */
    urlParamName?: string;
}

/**
 * Configuration for filter builder
 */
export interface FilterBuilderConfig {
    /** Base filters to always include (e.g., saleId) */
    baseFilters?: Record<string, string>;
    /** Field type mappings for special handling */
    fieldTypes?: Record<string, 'boolean' | 'array' | 'string' | 'number'>;
    /** Custom field name mappings */
    fieldMappings?: Record<string, string>;
}

/**
 * Result from building filters
 */
export interface BuiltFilters {
    /** Filter string for Typesense */
    typesense: string;
    /** Filter object for other backends */
    object: Record<string, string | string[] | boolean | number>;
    /** URL-safe query string */
    queryString: string;
}

/**
 * Props for FacetFilter component
 */
export interface FacetFilterProps {
    facet: Facet;
    selectedValues: string[];
    onToggle: (value: string) => void;
    onClear: () => void;
    /** Custom label renderer */
    renderLabel?: (value: string, facet: Facet) => string;
    /** Whether to show counts */
    showCounts?: boolean;
    /** Maximum items before scrolling */
    maxVisibleItems?: number;
    /** Custom class names */
    className?: string;
}

/**
 * Props for FilterPanel component
 */
export interface FilterPanelProps {
    facets: Facet[];
    selectedFacets: SelectedFacets;
    onToggleFacet: (fieldName: string, value: string) => void;
    onClearFacet: (fieldName: string) => void;
    onClearAll?: () => void;
    /** Fields to exclude from display */
    excludeFields?: string[];
    /** Custom label renderer per field */
    labelRenderers?: Record<string, (value: string) => string>;
    /** Custom component for specific fields */
    customRenderers?: Record<string, React.ComponentType<FacetFilterProps>>;
    /** Whether to show the clear all button */
    showClearAll?: boolean;
    className?: string;
}

/**
 * Props for SortSelect component
 */
export interface SortSelectProps<T extends string = string> {
    value: T;
    onChange: (value: T) => void;
    options: SortOption<T>[];
    label?: string;
    className?: string;
}

/**
 * Props for FilterSheet (mobile) component
 */
export interface FilterSheetProps extends FilterPanelProps {
    trigger?: React.ReactNode;
    title?: string;
}

/**
 * Props for RangeFilter component
 */
export interface RangeFilterProps {
    config: RangeFilterConfig;
    value?: RangeValue;
    onChange: (value: RangeValue) => void;
    onClear: () => void;
    className?: string;
}

