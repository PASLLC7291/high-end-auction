"use client";

/**
 * @basta/filters - Reusable Filter System
 * Mobile-friendly filter sheet component
 */

import { Button } from "@/components/ui/button";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import { SlidersHorizontal } from "lucide-react";
import { FilterPanel } from "./filter-panel";
import type { FilterSheetProps } from "../types";

/**
 * Mobile filter sheet component
 * Opens as a slide-out drawer with filter options
 */
export function FilterSheet({
    trigger,
    title = "Filters",
    ...panelProps
}: FilterSheetProps) {
    const activeCount = Object.values(panelProps.selectedFacets).reduce(
        (sum, v) => sum + v.length,
        0
    );

    return (
        <Sheet>
            <SheetTrigger asChild>
                {trigger || (
                    <Button variant="outline" className="bg-transparent">
                        <SlidersHorizontal className="mr-2 h-4 w-4" />
                        Filters
                        {activeCount > 0 && (
                            <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                                {activeCount}
                            </span>
                        )}
                    </Button>
                )}
            </SheetTrigger>
            <SheetContent side="left" className="w-80 overflow-y-auto">
                <SheetHeader>
                    <SheetTitle>{title}</SheetTitle>
                </SheetHeader>
                <div className="mt-6">
                    <FilterPanel {...panelProps} />
                </div>
            </SheetContent>
        </Sheet>
    );
}

export default FilterSheet;

