"use client";

/**
 * @basta/filters - Reusable Filter System
 * Range filter component with dual slider
 */

import { useState, useEffect, useCallback } from "react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RangeFilterProps, RangeValue } from "../types";

/**
 * Default value formatter (currency)
 */
function defaultFormatValue(value: number): string {
    return `$${value.toLocaleString()}`;
}

/**
 * Range filter component with dual-thumb slider
 */
export function RangeFilter({
    config,
    value,
    onChange,
    onClear,
    className,
}: RangeFilterProps) {
    const {
        fieldName,
        label,
        min,
        max,
        step = 1,
        formatValue = defaultFormatValue,
    } = config;

    // Local state for the slider (for smooth dragging)
    const [localValue, setLocalValue] = useState<[number, number]>([
        value?.min ?? min,
        value?.max ?? max,
    ]);

    // Sync local state with external value
    useEffect(() => {
        if (value) {
            setLocalValue([value.min, value.max]);
        } else {
            setLocalValue([min, max]);
        }
    }, [value, min, max]);

    // Check if filter is active (different from defaults)
    const isActive = value && (value.min !== min || value.max !== max);

    // Handle slider change (local state only for smooth dragging)
    const handleSliderChange = useCallback((newValue: number[]) => {
        setLocalValue([newValue[0], newValue[1]]);
    }, []);

    // Commit the value when slider is released
    const handleSliderCommit = useCallback(
        (newValue: number[]) => {
            const rangeValue: RangeValue = {
                min: newValue[0],
                max: newValue[1],
            };
            // Only trigger onChange if values are different from defaults
            if (newValue[0] !== min || newValue[1] !== max) {
                onChange(rangeValue);
            } else {
                onClear();
            }
        },
        [onChange, onClear, min, max]
    );

    return (
        <div className={cn("space-y-4", className)}>
            <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">{label}</h3>
                {isActive && (
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

            <div className="px-1">
                <Slider
                    value={localValue}
                    min={min}
                    max={max}
                    step={step}
                    onValueChange={handleSliderChange}
                    onValueCommit={handleSliderCommit}
                    className="w-full"
                />
            </div>

            <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{formatValue(localValue[0])}</span>
                <span>{formatValue(localValue[1])}</span>
            </div>
        </div>
    );
}

export default RangeFilter;

