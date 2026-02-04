"use client";

/**
 * @basta/filters - Reusable Filter System
 * React hook for managing filter state
 */

import { useState, useCallback, useMemo, useEffect } from "react";
import type {
    SelectedFacets,
    SelectedRanges,
    RangeValue,
    UseFiltersConfig,
    UseFiltersReturn,
} from "./types";
import { buildQueryString, parseQueryString } from "./filter-builder";

/**
 * Hook for managing filter state with optional URL synchronization
 */
export function useFilters<TSortValue extends string = string>(
    config: UseFiltersConfig<TSortValue> = {}
): UseFiltersReturn<TSortValue> {
    const {
        defaultSortBy = "default" as TSortValue,
        initialFacets = {},
        initialRanges = {},
        initialPage = 1,
        onFiltersChange,
        syncWithUrl = false,
    } = config;

    // Initialize state from URL if syncWithUrl is enabled
    const getInitialState = useCallback(() => {
        if (syncWithUrl && typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search);
            const urlFacets = parseQueryString(params.toString());
            const urlSort = (params.get("sortBy") as TSortValue) || defaultSortBy;
            const urlPage = parseInt(params.get("page") || "1", 10);

            return {
                selectedFacets:
                    Object.keys(urlFacets).length > 0 ? urlFacets : initialFacets,
                selectedRanges: initialRanges,
                sortBy: urlSort,
                currentPage: urlPage,
            };
        }
        return {
            selectedFacets: initialFacets,
            selectedRanges: initialRanges,
            sortBy: defaultSortBy,
            currentPage: initialPage,
        };
    }, [syncWithUrl, initialFacets, initialRanges, defaultSortBy, initialPage]);

    const [selectedFacets, setSelectedFacets] = useState<SelectedFacets>(
        () => getInitialState().selectedFacets
    );
    const [selectedRanges, setSelectedRanges] = useState<SelectedRanges>(
        () => getInitialState().selectedRanges
    );
    const [sortBy, setSortByState] = useState<TSortValue>(
        () => getInitialState().sortBy
    );
    const [currentPage, setCurrentPageState] = useState<number>(
        () => getInitialState().currentPage
    );

    // Sync state to URL
    useEffect(() => {
        if (syncWithUrl && typeof window !== "undefined") {
            const queryString = buildQueryString(selectedFacets, sortBy);
            const params = new URLSearchParams(queryString);
            if (currentPage > 1) {
                params.set("page", currentPage.toString());
            }

            const newUrl = params.toString()
                ? `${window.location.pathname}?${params.toString()}`
                : window.location.pathname;

            window.history.replaceState(null, "", newUrl);
        }
    }, [selectedFacets, sortBy, currentPage, syncWithUrl]);

    // Notify on changes
    useEffect(() => {
        if (onFiltersChange) {
            onFiltersChange({ selectedFacets, selectedRanges, sortBy, currentPage });
        }
    }, [selectedFacets, selectedRanges, sortBy, currentPage, onFiltersChange]);

    // Toggle a single facet value on/off
    const toggleFacet = useCallback((fieldName: string, value: string) => {
        setSelectedFacets((prev) => {
            const currentValues = prev[fieldName] || [];
            const newValues = currentValues.includes(value)
                ? currentValues.filter((v) => v !== value)
                : [...currentValues, value];

            const updated = { ...prev };
            if (newValues.length > 0) {
                updated[fieldName] = newValues;
            } else {
                delete updated[fieldName];
            }
            return updated;
        });
        // Reset to page 1 when filters change
        setCurrentPageState(1);
    }, []);

    // Set specific values for a facet (replacing existing)
    const setFacetValues = useCallback((fieldName: string, values: string[]) => {
        setSelectedFacets((prev) => {
            const updated = { ...prev };
            if (values.length > 0) {
                updated[fieldName] = values;
            } else {
                delete updated[fieldName];
            }
            return updated;
        });
        setCurrentPageState(1);
    }, []);

    // Clear a specific facet
    const clearFacet = useCallback((fieldName: string) => {
        setSelectedFacets((prev) => {
            const updated = { ...prev };
            delete updated[fieldName];
            return updated;
        });
        setCurrentPageState(1);
    }, []);

    // Clear all facets
    const clearAllFacets = useCallback(() => {
        setSelectedFacets({});
        setSelectedRanges({});
        setCurrentPageState(1);
    }, []);

    // Set a range filter
    const setRange = useCallback((fieldName: string, value: RangeValue) => {
        setSelectedRanges((prev) => ({
            ...prev,
            [fieldName]: value,
        }));
        setCurrentPageState(1);
    }, []);

    // Clear a specific range filter
    const clearRange = useCallback((fieldName: string) => {
        setSelectedRanges((prev) => {
            const updated = { ...prev };
            delete updated[fieldName];
            return updated;
        });
        setCurrentPageState(1);
    }, []);

    // Clear all range filters
    const clearAllRanges = useCallback(() => {
        setSelectedRanges({});
        setCurrentPageState(1);
    }, []);

    // Set sort value
    const setSortBy = useCallback((value: TSortValue) => {
        setSortByState(value);
        setCurrentPageState(1);
    }, []);

    // Set current page
    const setCurrentPage = useCallback((page: number) => {
        setCurrentPageState(page);
    }, []);

    // Reset all filters to initial state
    const resetFilters = useCallback(() => {
        setSelectedFacets(initialFacets);
        setSelectedRanges(initialRanges);
        setSortByState(defaultSortBy);
        setCurrentPageState(initialPage);
    }, [initialFacets, initialRanges, defaultSortBy, initialPage]);

    // Computed values
    const hasActiveFilters = useMemo(
        () => Object.keys(selectedFacets).length > 0,
        [selectedFacets]
    );

    const hasActiveRanges = useMemo(
        () => Object.keys(selectedRanges).length > 0,
        [selectedRanges]
    );

    const activeFilterCount = useMemo(
        () =>
            Object.values(selectedFacets).reduce(
                (count, values) => count + values.length,
                0
            ) + Object.keys(selectedRanges).length,
        [selectedFacets, selectedRanges]
    );

    const serializedState = useMemo(
        () =>
            JSON.stringify({
                selectedFacets,
                selectedRanges,
                sortBy,
                currentPage,
            }),
        [selectedFacets, selectedRanges, sortBy, currentPage]
    );

    return {
        // State
        selectedFacets,
        selectedRanges,
        sortBy,
        currentPage,
        // Actions
        toggleFacet,
        setFacetValues,
        clearFacet,
        clearAllFacets,
        setRange,
        clearRange,
        clearAllRanges,
        setSortBy,
        setCurrentPage,
        resetFilters,
        // Computed
        hasActiveFilters,
        hasActiveRanges,
        activeFilterCount,
        serializedState,
    };
}

/**
 * Hook for paginated filter state with total count tracking
 */
export function usePaginatedFilters<TSortValue extends string = string>(
    config: UseFiltersConfig<TSortValue> & {
        itemsPerPage?: number;
        totalItems?: number;
    }
) {
    const { itemsPerPage = 12, totalItems = 0, ...filterConfig } = config;
    const filters = useFilters<TSortValue>(filterConfig);

    const totalPages = useMemo(
        () => Math.ceil(totalItems / itemsPerPage),
        [totalItems, itemsPerPage]
    );

    const paginationInfo = useMemo(
        () => ({
            currentPage: filters.currentPage,
            totalPages,
            itemsPerPage,
            totalItems,
            startIndex: (filters.currentPage - 1) * itemsPerPage,
            endIndex: Math.min(filters.currentPage * itemsPerPage, totalItems),
            hasNextPage: filters.currentPage < totalPages,
            hasPreviousPage: filters.currentPage > 1,
        }),
        [filters.currentPage, totalPages, itemsPerPage, totalItems]
    );

    const goToNextPage = useCallback(() => {
        if (paginationInfo.hasNextPage) {
            filters.setCurrentPage(filters.currentPage + 1);
        }
    }, [filters, paginationInfo.hasNextPage]);

    const goToPreviousPage = useCallback(() => {
        if (paginationInfo.hasPreviousPage) {
            filters.setCurrentPage(filters.currentPage - 1);
        }
    }, [filters, paginationInfo.hasPreviousPage]);

    const goToPage = useCallback(
        (page: number) => {
            if (page >= 1 && page <= totalPages) {
                filters.setCurrentPage(page);
            }
        },
        [filters, totalPages]
    );

    return {
        ...filters,
        paginationInfo,
        goToNextPage,
        goToPreviousPage,
        goToPage,
    };
}

export default useFilters;
