"use client";

/**
 * @basta/filters - Reusable Filter System
 * Facet filter component for individual filter groups
 */

import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FacetFilterProps, Facet } from "../types";

/**
 * Default label renderer - converts camelCase to Title Case
 */
function defaultRenderLabel(value: string): string {
    return value
        .replace(/_/g, " ")
        .replace(/([A-Z])/g, " $1")
        .replace(/\b\w/g, (l) => l.toUpperCase())
        .trim();
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
 * Single facet filter group with checkboxes
 */
export function FacetFilter({
    facet,
    selectedValues,
    onToggle,
    onClear,
    renderLabel = defaultRenderLabel,
    showCounts = true,
    maxVisibleItems = 10,
    className,
}: FacetFilterProps) {
    if (!facet.counts || facet.counts.length === 0) {
        return null;
    }

    const hasSelected = selectedValues.length > 0;

    return (
        <div className={cn("space-y-2", className)}>
            <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">
                    {formatFieldName(facet.fieldName)}
                </h3>
                {hasSelected && (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={onClear}
                    >
                        <X className="h-3 w-3" />
                    </Button>
                )}
            </div>

            <div
                className={cn(
                    "space-y-1",
                    facet.counts.length > maxVisibleItems && "max-h-64 overflow-y-auto pr-2"
                )}
            >
                {facet.counts.map((count) => {
                    const isSelected = selectedValues.includes(count.value);
                    const displayLabel = renderLabel(count.value, facet);

                    return (
                        <div
                            key={count.value}
                            className="flex items-center space-x-2 cursor-pointer hover:bg-muted/50 p-2 rounded transition-colors"
                            onClick={() => onToggle(count.value)}
                        >
                            <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => onToggle(count.value)}
                            />
                            <label className="text-sm flex-1 cursor-pointer select-none">
                                {displayLabel}
                            </label>
                            {showCounts && (
                                <span className="text-xs text-muted-foreground">
                                    ({count.count})
                                </span>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

/**
 * Boolean facet filter (e.g., "Reserve Met")
 * Shows as a single checkbox instead of listing all values
 */
export function BooleanFacetFilter({
    facet,
    selectedValues,
    onToggle,
    onClear,
    label,
    showCounts = true,
    className,
}: Omit<FacetFilterProps, "renderLabel" | "maxVisibleItems"> & {
    label?: string;
}) {
    if (!facet.counts || facet.counts.length === 0) {
        return null;
    }

    // Find the "true" value from counts
    // Check for various representations of true
    const trueValue = facet.counts.find(
        (count) => {
            const val = count.value.toLowerCase();
            return val === "true" || val === "yes" || val === "1";
        }
    );

    // Also check for false values to ensure we're using the right one
    const falseValue = facet.counts.find(
        (count) => {
            const val = count.value.toLowerCase();
            return val === "false" || val === "no" || val === "0";
        }
    );

    // For "Yes" checkbox, we always want to use the true value
    // If no true value exists, try to find a value that's not false
    // If only false exists, we can't show this filter (return null)
    let valueToUse: string | undefined;
    let countToShow = 0;

    if (trueValue) {
        valueToUse = trueValue.value;
        countToShow = trueValue.count;
    } else if (falseValue && facet.counts.length > 1) {
        // If there's a false value but also other values, use the first non-false value
        const nonFalseValue = facet.counts.find(c => c.value.toLowerCase() !== falseValue.value.toLowerCase());
        valueToUse = nonFalseValue?.value;
        countToShow = nonFalseValue?.count || 0;
    } else if (!falseValue && facet.counts.length > 0) {
        // If there's no false value, use the first value (might be a different representation)
        valueToUse = facet.counts[0].value;
        countToShow = facet.counts[0].count;
    }

    if (!valueToUse) return null;

    const isSelected = selectedValues.length > 0 && selectedValues.includes(valueToUse);
    const displayLabel = label || formatFieldName(facet.fieldName);

    const handleToggle = () => {
        if (isSelected) {
            onClear();
        } else {
            onToggle(valueToUse!); // Safe to use ! here since we checked above
        }
    };

    return (
        <div className={cn("space-y-2", className)}>
            <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">{displayLabel}</h3>
                {isSelected && (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={onClear}
                    >
                        <X className="h-3 w-3" />
                    </Button>
                )}
            </div>

            <div
                className="flex items-center space-x-2 cursor-pointer hover:bg-muted/50 p-2 rounded transition-colors"
                onClick={handleToggle}
            >
                <Checkbox
                    checked={isSelected}
                    onCheckedChange={handleToggle}
                />
                <label className="text-sm flex-1 cursor-pointer select-none">
                    Yes
                </label>
                {showCounts && countToShow > 0 && (
                    <span className="text-xs text-muted-foreground">
                        ({countToShow})
                    </span>
                )}
            </div>
        </div>
    );
}

export default FacetFilter;

