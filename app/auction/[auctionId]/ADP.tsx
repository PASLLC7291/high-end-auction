"use client";

import { AuctionNav } from "@/components/auction-nav";
import { AuctionFooter } from "@/components/auction-footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Calendar, Clock, CheckCircle } from "lucide-react";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useSession } from "next-auth/react";

import { DateTime } from "luxon";
import { clientApiSchema } from "@bastaai/basta-js";
import { useClientApi } from "@bastaai/basta-js/client";
import { translateItemStatus, formatCurrency, toMajorCurrency } from "@/lib/utils";
import { getClientApiClient } from "@/lib/basta-client";
import { RegistrationModal, type SaleRegistration } from "@/components/registration-modal";
import { CountdownDisplay } from "./lot/[lotId]/countdown";

// Import the reusable filter system
import {
  useFilters,
  FilterPanel,
  FilterSheet,
  SortSelect,
  ActiveFilters,
  RangeFilter,
  buildTypesenseFilter,
  getSortString,
  type Facet,
  type SortOption,
  type RangeFilterConfig,
} from "@/lib/filters";

// Sort options for lots
type LotSortValue = "lotNumber" | "lotNumberDesc" | "lowEstimateAsc" | "lowEstimateDesc" | "highEstimateAsc" | "highEstimateDesc";

const SORT_OPTIONS: SortOption<LotSortValue>[] = [
  { value: "lotNumber", label: "Lot Number (Low to High)", sortBy: "itemNumber:asc" },
  { value: "lotNumberDesc", label: "Lot Number (High to Low)", sortBy: "itemNumber:desc" },
  { value: "lowEstimateAsc", label: "Low Estimate (Low to High)", sortBy: "lowEstimate:asc" },
  { value: "lowEstimateDesc", label: "Low Estimate (High to Low)", sortBy: "lowEstimate:desc" },
  { value: "highEstimateAsc", label: "High Estimate (Low to High)", sortBy: "highEstimate:asc" },
  { value: "highEstimateDesc", label: "High Estimate (High to Low)", sortBy: "highEstimate:desc" },
];

export type Lot = {
  id: string;
  lotNumber: number;
  title: string | undefined;
  lowEstimate: number | null;
  highEstimate: number | null;
  image: string | undefined;
  currentBid: number | null;
  startingBid: number | null;
  bidsCount: number | undefined;
  reserveMet: boolean | null;
  status: clientApiSchema.ItemStatus;
  closingDate: string | null;
};

export type Auction = {
  id: string;
  title: string | undefined;
  status: clientApiSchema.SaleStatus | undefined;
  location?: string | undefined;
  dates: {
    openDate: string | undefined;
    closingDate: string | undefined;
  };
  lots: Lot[];
  userSaleRegistrations?: SaleRegistration[];
};

// Estimate range config (values are in minor currency - cents)
const ESTIMATE_RANGE_CONFIG: RangeFilterConfig = {
  fieldName: "lowEstimate",
  label: "Estimate Range",
  min: 0,
  max: 10000000, // $100,000 in cents
  step: 50000,   // $500 in cents
  formatValue: (value: number) => formatCurrency(value),
};

export default function AuctionDetailPage({
  auctionDetails,
  facets = [],
  accountId,
}: {
  auctionDetails: Auction;
  facets?: Facet[];
  accountId: string;
}) {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const client = useClientApi();

  const [lots, setLots] = useState<Lot[]>(auctionDetails.lots.slice(0, 12));
  const [loading, setLoading] = useState(false);
  const [filteredTotal, setFilteredTotal] = useState(auctionDetails.lots.length);

  // Memoize subscription query to prevent re-subscription on re-renders
  // Note: We only fetch Item fields (not Sale.status) to avoid GraphQL field type conflict
  // Sale status is derived from lot statuses for more accurate staggered closing handling
  const subscriptionQuery = useMemo(
    () =>
      client.subscription({
        saleActivity: {
          __args: {
            saleId: auctionDetails.id,
          },
          on_Item: {
            __typename: true,
            id: true,
            itemNumber: true,
            title: true,
            status: true,
            estimates: {
              low: true,
              high: true,
            },
            currentBid: true,
            startingBid: true,
            totalBids: true,
            reserveMet: true,
            images: { url: true },
            dates: {
              closingEnd: true,
            },
          },
          on_Sale: {
            __typename: true,
            id: true,
            userSaleRegistrations: {
              id: true,
              registrationType: true,
              saleId: true,
              userId: true,
            },
          },
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [auctionDetails.id]
  );

  const [{ data: saleActivityData }] = client.useSubscription({
    query: subscriptionQuery,
  });

  // Handle real-time updates from subscription
  useEffect(() => {
    if (saleActivityData?.saleActivity?.__typename === "Item") {
      const updatedItem = saleActivityData.saleActivity;
      setLots((prevLots) =>
        prevLots.map((lot) =>
          lot.id === updatedItem.id
            ? {
                ...lot,
                status: updatedItem.status,
                currentBid: updatedItem.currentBid,
                bidsCount: updatedItem.totalBids,
                reserveMet: updatedItem.reserveMet ?? null,
                closingDate: updatedItem.dates?.closingEnd ?? null,
              }
            : lot
        )
      );
    }
    if (saleActivityData?.saleActivity?.__typename === "Sale") {
      const updatedSale = saleActivityData.saleActivity;
      // Update user registrations
      if (updatedSale.userSaleRegistrations) {
        setUserRegistrations(updatedSale.userSaleRegistrations);
      }
    }
  }, [saleActivityData]);
  const itemsPerPage = 12;

  // Registration state
  const [registrationModalOpen, setRegistrationModalOpen] = useState(false);
  const [userRegistrations, setUserRegistrations] = useState<SaleRegistration[]>(
    auctionDetails.userSaleRegistrations || []
  );

  // Check if user is registered for this auction
  const isRegistered = userRegistrations.length > 0;
  const registrationStatus = userRegistrations[0]?.status;

  // Handle register button click - redirect to login if not authenticated
  const handleRegisterClick = () => {
    if (!session?.user) {
      // Redirect to login with return URL
      router.push(`/login?callbackUrl=/auction/${auctionDetails.id}`);
      return;
    }
    setRegistrationModalOpen(true);
  };

  // Calculate estimate range from lots
  const estimateRange = useMemo(() => {
    const estimates = auctionDetails.lots
      .filter((lot) => lot.lowEstimate !== null && lot.highEstimate !== null)
      .flatMap((lot) => [lot.lowEstimate!, lot.highEstimate!]);

    if (estimates.length === 0) {
      return { min: 0, max: 100000 };
    }

    return {
      min: 0,
      max: Math.ceil(Math.max(...estimates) / 1000) * 1000, // Round up to nearest 1000
    };
  }, [auctionDetails.lots]);

  // Dynamic estimate config based on actual data
  const dynamicEstimateConfig: RangeFilterConfig = {
    ...ESTIMATE_RANGE_CONFIG,
    min: estimateRange.min,
    max: estimateRange.max,
    step: Math.max(100, Math.floor(estimateRange.max / 100)),
  };

  // Use the reusable filter hook
  const filters = useFilters<LotSortValue>({
    defaultSortBy: "lotNumber",
    onFiltersChange: () => {
      // Filters changed - can be used for analytics
    },
  });

  const totalPages = Math.ceil(filteredTotal / itemsPerPage);

  // Create a stable string representation of filters for dependency tracking
  const filtersKey = useMemo(
    () => JSON.stringify({ facets: filters.selectedFacets, ranges: filters.selectedRanges }),
    [filters.selectedFacets, filters.selectedRanges]
  );

  // Fetch filtered lots when filters or sort change
  useEffect(() => {
    const loadFilteredLots = async () => {
      // Wait for session to load before making API calls (to get bidder token)
      if (sessionStatus === "loading") {
        return;
      }

      // Fallback to local filtering if no accountId
      if (!accountId) {
        let filtered = [...auctionDetails.lots];
        filtered.sort((a, b) => {
          switch (filters.sortBy) {
            case "lotNumber":
              return a.lotNumber - b.lotNumber;
            case "lotNumberDesc":
              return b.lotNumber - a.lotNumber;
            case "lowEstimateAsc":
              return (a.lowEstimate || 0) - (b.lowEstimate || 0);
            case "lowEstimateDesc":
              return (b.lowEstimate || 0) - (a.lowEstimate || 0);
            case "highEstimateAsc":
              return (a.highEstimate || 0) - (b.highEstimate || 0);
            case "highEstimateDesc":
              return (b.highEstimate || 0) - (a.highEstimate || 0);
            default:
              return 0;
          }
        });
        const startIndex = (filters.currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        setLots(filtered.slice(startIndex, endIndex));
        setFilteredTotal(filtered.length);
        return;
      }

      // Always make API call when we have an accountId
      setLoading(true);
      try {
        const client = getClientApiClient(session?.bidderToken);

        // Use the reusable filter builder with range support
        const filterBy = buildTypesenseFilter(
          filters.selectedFacets,
          { baseFilters: { saleId: auctionDetails.id } },
          filters.selectedRanges
        );
        const sortByValue = getSortString(filters.sortBy, SORT_OPTIONS);

        const searchData = await client.query({
          search: {
            __args: {
              accountId: accountId,
              type: "ITEM",
              query: "*",
              filterBy,
              orderBy: sortByValue,
              page: filters.currentPage,
              first: itemsPerPage,
            },
            edges: {
              node: {
                __typename: true,
                on_Item: {
                  id: true,
                  cursor: true,
                  saleId: true,
                  itemNumber: true,
                  status: true,
                  title: true,
                  estimates: {
                    low: true,
                    high: true,
                  },
                  currentBid: true,
                  bidStatus: true,
                  startingBid: true,
                  totalBids: true,
                  reserveMet: true,
                  images: {
                    url: true,
                  },
                  dates: {
                    openDate: true,
                    closingEnd: true,
                    closingStart: true,
                  },
                },
              },
            },
            pageInfo: {
              totalRecords: true,
              hasNextPage: true,
            },
          },
        });

        const searchResult = searchData.search;
        const fetchedLots: Lot[] =
          (searchResult?.edges
            ?.map((edge) => {
              if (edge.node.__typename === "Item") {
                const lot = edge.node;
                return {
                  id: lot.id,
                  lotNumber: lot.itemNumber,
                  title: lot.title ?? undefined,
                  lowEstimate: lot.estimates?.low,
                  highEstimate: lot.estimates?.high,
                  image: lot.images?.[0]?.url,
                  currentBid: lot.currentBid,
                  startingBid: lot.startingBid,
                  bidsCount: lot.totalBids,
                  reserveMet: lot.reserveMet ?? null,
                  status: lot.status,
                  closingDate: lot.dates?.closingEnd ?? null,
                } as Lot;
              }
              return null;
            })
            .filter((lot): lot is Lot => lot !== null) || []) as Lot[];

        setLots(fetchedLots);
        setFilteredTotal(searchResult?.pageInfo?.totalRecords || 0);
      } catch (error) {
        console.error("Error fetching filtered lots:", error);
        setLots([]);
        setFilteredTotal(0);
      } finally {
        setLoading(false);
      }
    };

    loadFilteredLots();
  }, [
    filtersKey,
    filters.sortBy,
    filters.currentPage,
    accountId,
    auctionDetails.id,
    auctionDetails.lots,
    itemsPerPage,
    sessionStatus,
    session?.bidderToken,
  ]);

  const dt = auctionDetails.dates.openDate
    ? DateTime.fromISO(auctionDetails.dates.openDate)
    : undefined;

  // Derive effective status from lot statuses (handles staggered closing)
  // Uses real-time lot statuses to determine the most accurate auction status
  const derivedStatus = useMemo(() => {
    // Check lot statuses first - they update in real-time
    const hasClosingLots = lots.some((lot) => lot.status === "ITEM_CLOSING");
    const hasOpenLots = lots.some(
      (lot) => lot.status === "ITEM_OPEN" || lot.status === "ITEM_NOT_OPEN"
    );
    const allClosed = lots.every((lot) => lot.status === "ITEM_CLOSED");
    
    // If all lots are closed, show as closed
    if (allClosed && lots.length > 0) return "CLOSED";
    
    // If any lots are closing, show as closing
    if (hasClosingLots) return "CLOSING";
    
    // If any lots are open, show as opened
    if (hasOpenLots) return "OPENED";
    
    // Fall back to initial sale status
    return auctionDetails?.status;
  }, [auctionDetails?.status, lots]);

  // Format status for display
  const getStatusDisplay = (status: string | undefined) => {
    if (!status) return { label: "Unknown", className: "bg-muted text-foreground" };

    const statusMap: Record<string, { label: string; className: string }> = {
      LIVE: {
        label: "Live Now",
        className: "bg-green-500/90 text-white border-0",
      },
      OPENED: {
        label: "Open For Bidding",
        className: "bg-blue-500/90 text-white border-0",
      },
      PUBLISHED: {
        label: "Upcoming",
        className: "bg-amber-500/90 text-white border-0",
      },
      CLOSING: {
        label: "Closing",
        className: "bg-orange-500/90 text-white border-0",
      },
      CLOSED: {
        label: "Closed",
        className: "bg-muted text-muted-foreground border-border",
      },
      PROCESSING: {
        label: "Closed",
        className: "bg-muted text-muted-foreground border-border",
      },
    };

    return (
      statusMap[status] || {
        label: status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
        className: "bg-muted text-foreground",
      }
    );
  };

  const statusDisplay = getStatusDisplay(derivedStatus);

  // Map SaleStatus to ItemStatus for countdown component
  const mapSaleStatusToItemStatus = (saleStatus: string | undefined): clientApiSchema.ItemStatus => {
    switch (saleStatus) {
      case "PUBLISHED":
        return "ITEM_NOT_OPEN";
      case "OPENED":
      case "LIVE":
        return "ITEM_OPEN";
      case "CLOSING":
        return "ITEM_CLOSING";
      case "CLOSED":
        return "ITEM_CLOSED";
      default:
        return "ITEM_NOT_OPEN";
    }
  };

  // Custom label renderer for item status values
  const labelRenderers = {
    status: translateItemStatus,
    itemStatus: translateItemStatus,
  };

  // Filter out estimate facets since we're using a range slider instead
  // Also filter out reserveMet as it shouldn't be shown in filters
  const filteredFacets = facets.filter(
    (facet) => facet.fieldName !== "lowEstimate" && facet.fieldName !== "highEstimate" && facet.fieldName !== "reserveMet"
  );

  // Filter sidebar content (reused in desktop and mobile)
  const FilterSidebarContent = () => (
    <div className="space-y-6">
      {/* Sort Select */}
      <SortSelect
        value={filters.sortBy}
        onChange={filters.setSortBy}
        options={SORT_OPTIONS}
      />

      {/* Estimate Range Filter */}
      <RangeFilter
        config={dynamicEstimateConfig}
        value={filters.selectedRanges.lowEstimate}
        onChange={(value) => filters.setRange("lowEstimate", value)}
        onClear={() => filters.clearRange("lowEstimate")}
      />

      {/* Facet Filters (excludes estimate facets - using range slider instead) */}
      <FilterPanel
        facets={filteredFacets}
        selectedFacets={filters.selectedFacets}
        onToggleFacet={filters.toggleFacet}
        onClearFacet={filters.clearFacet}
        onClearAll={filters.clearAllFacets}
        labelRenderers={labelRenderers}
        showClearAll={false}
      />
    </div>
  );

  return (
    <div className="min-h-screen">
      <AuctionNav />

      {/* Auction Header */}
      <section className="border-b border-border bg-muted/30 py-12">
        <div className="container mx-auto px-4">
          <div className="flex items-start justify-between gap-8">
            <div className="flex-1">
              <Badge className={`mb-4 ${statusDisplay.className}`}>
                {derivedStatus === "LIVE" && (
                  <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                )}
                {statusDisplay.label}
              </Badge>
              <h1 className="font-serif text-4xl font-bold md:text-5xl">
                {auctionDetails?.title}
              </h1>
              <div className="mt-6 flex flex-wrap items-center gap-6 text-muted-foreground">
                {auctionDetails?.location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    <span>{auctionDetails?.location}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>{dt ? dt.toFormat("dd LLL yyyy") : "TBA"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>{dt ? dt.toFormat("HH:mm") : "TBA"}</span>
                </div>
                {/* Countdown - only show when auction is in CLOSING status and date hasn't passed */}
                {auctionDetails.dates.closingDate && 
                  derivedStatus === "CLOSING" && 
                  new Date(auctionDetails.dates.closingDate) > new Date() && (
                  <div className="flex items-center gap-2">
                    <CountdownDisplay
                      closingDate={auctionDetails.dates.closingDate}
                      status={mapSaleStatusToItemStatus(derivedStatus)}
                      variant="compact"
                    />
                  </div>
                )}
              </div>
            </div>
            {derivedStatus !== "CLOSED" &&
              derivedStatus !== "PROCESSING" && (
                <div className="hidden flex-col items-end gap-2 md:flex">
                  {isRegistered ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-500" />
                      <span className="text-sm">
                        {registrationStatus === "APPROVED"
                          ? "Registered"
                          : registrationStatus === "PENDING"
                            ? "Pending approval"
                            : "Registered"}
                      </span>
                    </div>
                  ) : (
                    <Button size="lg" onClick={handleRegisterClick}>
                      Register to Bid
                    </Button>
                  )}
                </div>
              )}
          </div>
        </div>
      </section>

      {/* Lots Grid with Filters */}
      <section className="container mx-auto px-4 py-12">
        <div className="flex gap-8">
          {/* Desktop Filters Sidebar */}
          <aside className="hidden w-64 shrink-0 lg:block">
            <div className="sticky top-24">
              <FilterSidebarContent />
            </div>
          </aside>

          {/* Lots Grid */}
          <div className="flex-1">
            <div className="mb-6 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {lots.length} of {filteredTotal} lots
              </p>

              {/* Mobile Filter Button */}
              <div className="lg:hidden">
                <FilterSheet
                  facets={filteredFacets}
                  selectedFacets={filters.selectedFacets}
                  onToggleFacet={filters.toggleFacet}
                  onClearFacet={filters.clearFacet}
                  onClearAll={filters.clearAllFacets}
                  labelRenderers={labelRenderers}
                />
              </div>
            </div>

            {/* Active Filters Display */}
            {(filters.hasActiveFilters || filters.hasActiveRanges) && (
              <div className="mb-6">
                <ActiveFilters
                  selectedFacets={filters.selectedFacets}
                  facets={filteredFacets}
                  onRemove={filters.toggleFacet}
                  onClearAll={() => {
                    filters.clearAllFacets();
                    filters.clearAllRanges();
                  }}
                  renderLabel={(fieldName, value) => {
                    const renderer = labelRenderers[fieldName as keyof typeof labelRenderers];
                    return renderer ? renderer(value) : value;
                  }}
                />
                {/* Show range filter badges */}
                {filters.selectedRanges.lowEstimate && (
                  <Badge variant="secondary" className="mt-2 mr-2">
                    Estimate: {formatCurrency(filters.selectedRanges.lowEstimate.min)} - {formatCurrency(filters.selectedRanges.lowEstimate.max)}
                    <button
                      className="ml-2 hover:text-destructive"
                      onClick={() => filters.clearRange("lowEstimate")}
                    >
                      ×
                    </button>
                  </Badge>
                )}
              </div>
            )}

            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {lots.map((lot) => (
                <Link
                  key={lot.id}
                  href={`/auction/${auctionDetails.id}/lot/${lot.id}`}
                >
                  <Card className="group overflow-hidden transition-shadow hover:shadow-lg">
                    <div className="relative aspect-4/3 overflow-hidden bg-muted">
                      <img
                        src={lot.image || "/placeholder.svg"}
                        alt={lot.title}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <Badge className="absolute left-4 top-4 bg-background/90 text-foreground">
                        Lot {lot.lotNumber}
                      </Badge>
                    </div>
                    <CardContent className="p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <h3 className="font-serif text-base font-semibold leading-tight text-balance">
                          {lot.title}
                        </h3>
                      </div>
                      {/* Countdown for active lots */}
                      <div className="mb-2">
                        <CountdownDisplay
                          closingDate={lot.closingDate}
                          status={lot.status}
                          variant="compact"
                          size="sm"
                          showLabel
                        />
                      </div>
                      <div className="mt-4 border-t border-border pt-3">
                        {lot.lowEstimate !== null && lot.lowEstimate !== undefined &&
                          lot.highEstimate !== null && lot.highEstimate !== undefined &&
                          (lot.lowEstimate > 0 || lot.highEstimate > 0) && (
                            <>
                              <p className="text-xs text-muted-foreground">Estimate</p>
                              <p className="font-semibold">
                                {formatCurrency(lot.lowEstimate)} - {formatCurrency(lot.highEstimate)}
                              </p>
                            </>
                          )}
                        {lot.currentBid ? (
                          <div className="mt-1 flex items-center justify-between">
                            <p className="text-sm font-medium text-primary">
                              Current bid: {formatCurrency(lot.currentBid)}
                            </p>
                            {lot.bidsCount !== undefined && lot.bidsCount > 0 && (
                              <p className="text-xs text-muted-foreground">
                                {lot.bidsCount} {lot.bidsCount === 1 ? "bid" : "bids"}
                              </p>
                            )}
                          </div>
                        ) : lot.startingBid ? (
                          <p className="mt-1 text-sm font-medium text-muted-foreground">
                            Starting bid: {formatCurrency(lot.startingBid)}
                          </p>
                        ) : null}
                        {lot.reserveMet === true && (
                          <div className="mt-2">
                            <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                              Reserve Met
                            </Badge>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-8 flex justify-center">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          if (filters.currentPage > 1) {
                            filters.setCurrentPage(filters.currentPage - 1);
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }
                        }}
                        className={
                          filters.currentPage === 1
                            ? "pointer-events-none opacity-50"
                            : "cursor-pointer"
                        }
                      />
                    </PaginationItem>

                    {/* Page numbers */}
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                      if (
                        page === 1 ||
                        page === totalPages ||
                        (page >= filters.currentPage - 1 &&
                          page <= filters.currentPage + 1)
                      ) {
                        return (
                          <PaginationItem key={page}>
                            <PaginationLink
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                filters.setCurrentPage(page);
                                window.scrollTo({ top: 0, behavior: "smooth" });
                              }}
                              isActive={filters.currentPage === page}
                              className="cursor-pointer"
                            >
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      } else if (
                        page === filters.currentPage - 2 ||
                        page === filters.currentPage + 2
                      ) {
                        return (
                          <PaginationItem key={page}>
                            <PaginationEllipsis />
                          </PaginationItem>
                        );
                      }
                      return null;
                    })}

                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          if (filters.currentPage < totalPages) {
                            filters.setCurrentPage(filters.currentPage + 1);
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }
                        }}
                        className={
                          filters.currentPage === totalPages
                            ? "pointer-events-none opacity-50"
                            : "cursor-pointer"
                        }
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}

            {loading && (
              <div className="mt-8 flex justify-center">
                <div className="text-sm text-muted-foreground">Loading lots...</div>
              </div>
            )}
          </div>
        </div>
      </section>

      <AuctionFooter />

      {/* Registration Modal */}
      <RegistrationModal
        open={registrationModalOpen}
        onOpenChange={setRegistrationModalOpen}
        auctionId={auctionDetails.id}
        auctionTitle={auctionDetails.title || "This Auction"}
        onRegistrationComplete={(registration) => {
          setUserRegistrations([...userRegistrations, registration]);
        }}
      />
    </div>
  );
}
