"use client";

/**
 * @basta/filters - Reusable Filter System
 * Sort select component
 */

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { SortSelectProps } from "../types";

/**
 * Sort dropdown component
 */
export function SortSelect<T extends string = string>({
    value,
    onChange,
    options,
    label = "Sort By",
    className,
}: SortSelectProps<T>) {
    return (
        <div className={cn("space-y-2", className)}>
            {label && <h3 className="font-semibold text-sm">{label}</h3>}
            <Select value={value} onValueChange={onChange}>
                <SelectTrigger>
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {options.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                            {option.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}

export default SortSelect;

