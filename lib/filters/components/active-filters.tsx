"use client";

/**
 * @basta/filters - Reusable Filter System
 * Active filters display component (filter chips/tags)
 */

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SelectedFacets, Facet } from "../types";

interface ActiveFiltersProps {
    selectedFacets: SelectedFacets;
    facets?: Facet[];
    onRemove: (fieldName: string, value: string) => void;
    onClearAll?: () => void;
    /** Custom label renderer */
    renderLabel?: (fieldName: string, value: string) => string;
    className?: string;
}

/**
 * Format field name for display
 */
function formatFieldName(fieldName: string): string {
    return fieldName
        .replace(/([A-Z])/g, " $1")
        .replace(/_/g, " ")
        .replace(/\b\w/g, (l) => l.toUpperCase())
        .trim();
}

/**
 * Format value for display
 */
function formatValue(value: string): string {
    // Handle boolean values
    if (value.toLowerCase() === "true" || value === "1") return "Yes";
    if (value.toLowerCase() === "false" || value === "0") return "No";

    return value
        .replace(/_/g, " ")
        .replace(/\b\w/g, (l) => l.toUpperCase())
        .trim();
}

/**
 * Active filters display - shows currently applied filters as removable chips
 */
export function ActiveFilters({
    selectedFacets,
    facets = [],
    onRemove,
    onClearAll,
    renderLabel,
    className,
}: ActiveFiltersProps) {
    const allFilters = Object.entries(selectedFacets).flatMap(([fieldName, values]) =>
        values.map((value) => ({
            fieldName,
            value,
            label: renderLabel
                ? renderLabel(fieldName, value)
                : `${formatFieldName(fieldName)}: ${formatValue(value)}`,
        }))
    );

    if (allFilters.length === 0) {
        return null;
    }

    return (
        <div className={cn("flex flex-wrap items-center gap-2", className)}>
            {allFilters.map(({ fieldName, value, label }) => (
                <Badge
                    key={`${fieldName}-${value}`}
                    variant="secondary"
                    className="pl-3 pr-1 py-1 gap-1"
                >
                    <span className="text-xs">{label}</span>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0 hover:bg-transparent"
                        onClick={() => onRemove(fieldName, value)}
                    >
                        <X className="h-3 w-3" />
                    </Button>
                </Badge>
            ))}

            {onClearAll && allFilters.length > 1 && (
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={onClearAll}
                >
                    Clear All
                </Button>
            )}
        </div>
    );
}

export default ActiveFilters;

