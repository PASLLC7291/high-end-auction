"use client";

/**
 * @basta/filters - Reusable Filter System
 * Filter panel component that renders all facets
 */

import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { FacetFilter, BooleanFacetFilter } from "./facet-filter";
import type { FilterPanelProps, Facet } from "../types";

/**
 * Default fields to exclude from display
 */
const DEFAULT_EXCLUDE_FIELDS = [
    "lotnumber",
    "lot_number",
    "itemnumber",
    "item_number",
    "date",
    "created",
    "updated",
    "opendate",
    "closingdate",
    "open_date",
    "closing_date",
    "accountid",
    "account_id",
    "account",
    "saleid",
    "sale_id",
    "sale",
    "hidden",
    "id",
    "cursor",
];

/**
 * Check if a field should be treated as a boolean filter
 */
function isBooleanField(fieldName: string): boolean {
    const lower = fieldName.toLowerCase();
    return (
        lower === "reservemet" ||
        lower.includes("reservemet") ||
        lower.includes("reserve_met") ||
        lower.startsWith("is_") ||
        lower.startsWith("has_") ||
        lower.endsWith("_enabled") ||
        lower.endsWith("_active")
    );
}

/**
 * Check if a field should be excluded from display
 */
function shouldExcludeField(fieldName: string, excludeFields: string[]): boolean {
    const lower = fieldName.toLowerCase();
    return excludeFields.some((exclude) => lower.includes(exclude.toLowerCase()));
}

/**
 * Main filter panel component
 */
export function FilterPanel({
    facets,
    selectedFacets,
    onToggleFacet,
    onClearFacet,
    onClearAll,
    excludeFields = DEFAULT_EXCLUDE_FIELDS,
    labelRenderers = {},
    customRenderers = {},
    showClearAll = true,
    className,
}: FilterPanelProps) {
    // Filter out excluded fields
    const visibleFacets = facets.filter(
        (facet) => !shouldExcludeField(facet.fieldName, excludeFields)
    );

    // Check if any filters are active
    const hasActiveFilters = Object.keys(selectedFacets).length > 0;

    if (visibleFacets.length === 0) {
        return null;
    }

    return (
        <div className={cn("space-y-6", className)}>
            {/* Clear All Button */}
            {showClearAll && hasActiveFilters && (
                <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                        {Object.values(selectedFacets).reduce((sum, v) => sum + v.length, 0)} filters
                        applied
                    </span>
                    <Button variant="ghost" size="sm" onClick={onClearAll}>
                        <X className="mr-1 h-3 w-3" />
                        Clear All
                    </Button>
                </div>
            )}

            {/* Render each facet */}
            {visibleFacets.map((facet) => {
                const selectedValues = selectedFacets[facet.fieldName] || [];
                const CustomRenderer = customRenderers[facet.fieldName];

                // Use custom renderer if provided
                if (CustomRenderer) {
                    return (
                        <CustomRenderer
                            key={facet.fieldName}
                            facet={facet}
                            selectedValues={selectedValues}
                            onToggle={(value) => onToggleFacet(facet.fieldName, value)}
                            onClear={() => onClearFacet(facet.fieldName)}
                        />
                    );
                }

                // Use boolean filter for boolean fields
                if (isBooleanField(facet.fieldName)) {
                    return (
                        <BooleanFacetFilter
                            key={facet.fieldName}
                            facet={facet}
                            selectedValues={selectedValues}
                            onToggle={(value) => onToggleFacet(facet.fieldName, value)}
                            onClear={() => onClearFacet(facet.fieldName)}
                        />
                    );
                }

                // Default facet filter
                return (
                    <FacetFilter
                        key={facet.fieldName}
                        facet={facet}
                        selectedValues={selectedValues}
                        onToggle={(value) => onToggleFacet(facet.fieldName, value)}
                        onClear={() => onClearFacet(facet.fieldName)}
                        renderLabel={
                            labelRenderers[facet.fieldName]
                                ? (value) => labelRenderers[facet.fieldName](value)
                                : undefined
                        }
                    />
                );
            })}
        </div>
    );
}

export default FilterPanel;

