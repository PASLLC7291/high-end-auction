/**
 * @basta/filters - Reusable Filter System
 * Utilities for building filter strings for various backends
 */

import type {
    SelectedFacets,
    SelectedRanges,
    FilterBuilderConfig,
    BuiltFilters,
} from "./types";

/**
 * Default field types for common auction/item fields
 */
const DEFAULT_FIELD_TYPES: Record<string, "boolean" | "array" | "string"> = {
    reserveMet: "boolean",
    reservemet: "boolean",
    reserve_met: "boolean",
    tags: "array",
    categories: "array",
    status: "string",
    itemStatus: "string",
};

/**
 * Detects if a field should be treated as a boolean
 */
function isBooleanField(fieldName: string, config?: FilterBuilderConfig): boolean {
    const fieldNameLower = fieldName.toLowerCase();

    // Check custom config first
    if (config?.fieldTypes?.[fieldName] === "boolean") return true;
    if (config?.fieldTypes?.[fieldNameLower] === "boolean") return true;

    // Check default mappings
    if (DEFAULT_FIELD_TYPES[fieldName] === "boolean") return true;
    if (DEFAULT_FIELD_TYPES[fieldNameLower] === "boolean") return true;

    // Heuristic detection
    return (
        fieldNameLower === "reservemet" ||
        fieldNameLower.includes("reservemet") ||
        fieldNameLower.includes("reserve_met") ||
        fieldNameLower.startsWith("is_") ||
        fieldNameLower.startsWith("has_") ||
        fieldNameLower.endsWith("_enabled") ||
        fieldNameLower.endsWith("_active")
    );
}

/**
 * Detects if a field should be treated as an array
 */
function isArrayField(fieldName: string, config?: FilterBuilderConfig): boolean {
    const fieldNameLower = fieldName.toLowerCase();

    // Check custom config first
    if (config?.fieldTypes?.[fieldName] === "array") return true;
    if (config?.fieldTypes?.[fieldNameLower] === "array") return true;

    // Check default mappings
    if (DEFAULT_FIELD_TYPES[fieldName] === "array") return true;
    if (DEFAULT_FIELD_TYPES[fieldNameLower] === "array") return true;

    // Heuristic detection
    return (
        fieldNameLower === "tags" ||
        fieldNameLower === "categories" ||
        fieldNameLower.endsWith("_ids") ||
        fieldNameLower.endsWith("_tags")
    );
}

/**
 * Escapes special characters in filter values for Typesense
 */
function escapeTypesenseValue(value: string): string {
    // Escape special characters in Typesense filter values
    return value.replace(/[\\`]/g, "\\$&");
}

/**
 * Builds a Typesense-compatible filter string
 */
export function buildTypesenseFilter(
    selectedFacets: SelectedFacets,
    config?: FilterBuilderConfig,
    selectedRanges?: SelectedRanges
): string {
    const filters: string[] = [];

    // Add base filters first
    if (config?.baseFilters) {
        Object.entries(config.baseFilters).forEach(([field, value]) => {
            filters.push(`${field}:${value}`);
        });
    }

    // Add selected facets
    Object.entries(selectedFacets).forEach(([fieldName, values]) => {
        if (!values || values.length === 0) return;

        // Apply field name mapping if configured
        const mappedFieldName = config?.fieldMappings?.[fieldName] || fieldName;

        if (isBooleanField(fieldName, config)) {
            // Boolean fields: normalize the value and use correct Typesense syntax
            const boolValue = values[0].toLowerCase();
            // Convert string representations to actual boolean values for Typesense
            const normalizedValue =
                boolValue === "true" || boolValue === "yes" || boolValue === "1"
                    ? "true"
                    : boolValue === "false" || boolValue === "no" || boolValue === "0"
                        ? "false"
                        : values[0]; // Use original value if not recognized
            // Typesense boolean syntax: for boolean fields, use field:=true or field:=false
            // Note: The = operator ensures exact match for boolean values
            filters.push(`${mappedFieldName}:=${normalizedValue}`);
        } else if (isArrayField(fieldName, config)) {
            // Array fields: always use array syntax
            const escapedValues = values.map(escapeTypesenseValue);
            filters.push(`${mappedFieldName}:[${escapedValues.join(",")}]`);
        } else {
            // String/other fields
            if (values.length === 1) {
                filters.push(`${mappedFieldName}:=${escapeTypesenseValue(values[0])}`);
            } else {
                // Multiple values: use array syntax for OR
                const escapedValues = values.map(escapeTypesenseValue);
                filters.push(`${mappedFieldName}:[${escapedValues.join(",")}]`);
            }
        }
    });

    // Add range filters
    if (selectedRanges) {
        Object.entries(selectedRanges).forEach(([fieldName, range]) => {
            if (range && range.min !== undefined && range.max !== undefined) {
                const mappedFieldName = config?.fieldMappings?.[fieldName] || fieldName;

                // Special handling for estimate ranges: use two conditions
                // Show items whose estimate range overlaps with the selected range
                // lowEstimate:<=max && highEstimate:>=min
                const fieldNameLower = fieldName.toLowerCase();
                const isEstimateRange =
                    fieldNameLower === "lowestimate" ||
                    fieldNameLower === "low_estimate" ||
                    fieldNameLower.includes("estimate");

                if (isEstimateRange) {
                    // For estimates, we want items whose estimate range overlaps with the selected range:
                    // - lowEstimate <= max (item's low estimate is at most the search maximum, so it starts within or before the range)
                    // - highEstimate >= min (item's high estimate is at least the search minimum, so it ends within or after the range)
                    // Example: Item with $100-$100000 will match search range $200-$500 because ranges overlap
                    filters.push(`lowEstimate:<=${range.max}`);
                    filters.push(`highEstimate:>=${range.min}`);
                } else {
                    // Standard range syntax: field:[min..max]
                    filters.push(`${mappedFieldName}:[${range.min}..${range.max}]`);
                }
            }
        });
    }

    // Join with AND operator
    return filters.join(" && ");
}

/**
 * Builds a Typesense range filter string for a single field
 */
export function buildRangeFilter(
    fieldName: string,
    min: number,
    max: number
): string {
    return `${fieldName}:[${min}..${max}]`;
}

/**
 * Builds a filter object for non-Typesense backends
 */
export function buildFilterObject(
    selectedFacets: SelectedFacets,
    config?: FilterBuilderConfig
): Record<string, string | string[] | boolean | number> {
    const result: Record<string, string | string[] | boolean | number> = {};

    // Add base filters
    if (config?.baseFilters) {
        Object.entries(config.baseFilters).forEach(([field, value]) => {
            result[field] = value;
        });
    }

    // Add selected facets
    Object.entries(selectedFacets).forEach(([fieldName, values]) => {
        if (!values || values.length === 0) return;

        const mappedFieldName = config?.fieldMappings?.[fieldName] || fieldName;

        if (isBooleanField(fieldName, config)) {
            // Convert to actual boolean
            const boolValue = values[0].toLowerCase();
            result[mappedFieldName] = boolValue === "true" || boolValue === "yes" || boolValue === "1";
        } else if (values.length === 1) {
            result[mappedFieldName] = values[0];
        } else {
            result[mappedFieldName] = values;
        }
    });

    return result;
}

/**
 * Builds a URL-safe query string from selected facets
 */
export function buildQueryString(
    selectedFacets: SelectedFacets,
    sortBy?: string
): string {
    const params = new URLSearchParams();

    Object.entries(selectedFacets).forEach(([fieldName, values]) => {
        if (values && values.length > 0) {
            params.set(fieldName, values.join(","));
        }
    });

    if (sortBy) {
        params.set("sortBy", sortBy);
    }

    return params.toString();
}

/**
 * Parses a query string back into selected facets
 */
export function parseQueryString(
    queryString: string,
    excludeParams: string[] = ["sortBy", "page"]
): SelectedFacets {
    const params = new URLSearchParams(queryString);
    const result: SelectedFacets = {};

    params.forEach((value, key) => {
        if (!excludeParams.includes(key)) {
            result[key] = value.split(",").filter(Boolean);
        }
    });

    return result;
}

/**
 * Builds filters in multiple formats at once
 */
export function buildFilters(
    selectedFacets: SelectedFacets,
    config?: FilterBuilderConfig,
    sortBy?: string
): BuiltFilters {
    return {
        typesense: buildTypesenseFilter(selectedFacets, config),
        object: buildFilterObject(selectedFacets, config),
        queryString: buildQueryString(selectedFacets, sortBy),
    };
}

/**
 * Creates a filter builder with preset configuration
 */
export function createFilterBuilder(config: FilterBuilderConfig) {
    return {
        buildTypesense: (facets: SelectedFacets) =>
            buildTypesenseFilter(facets, config),
        buildObject: (facets: SelectedFacets) =>
            buildFilterObject(facets, config),
        buildAll: (facets: SelectedFacets, sortBy?: string) =>
            buildFilters(facets, config, sortBy),
    };
}

/**
 * Utility to get sort string from sort option value
 */
export function getSortString(
    value: string,
    sortOptions: Array<{ value: string; sortBy?: string }>
): string {
    const option = sortOptions.find((opt) => opt.value === value);
    return option?.sortBy || value;
}

