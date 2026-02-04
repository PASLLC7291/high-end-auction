/**
 * Trust Badges - Various badges for trust indicators
 */

import {
  Shield,
  ShieldCheck,
  CheckCircle,
  Lock,
  Award,
  BadgeCheck,
  Star,
  FileCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface BadgeProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "text-xs px-2 py-0.5 gap-1",
  md: "text-sm px-3 py-1 gap-1.5",
  lg: "text-base px-4 py-1.5 gap-2",
};

const iconSizes = {
  sm: "h-3 w-3",
  md: "h-4 w-4",
  lg: "h-5 w-5",
};

/**
 * SecurityBadge - Shows secure checkout/payment
 */
export function SecurityBadge({ className, size = "md" }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-trust font-medium text-trust-foreground",
        sizeClasses[size],
        className
      )}
    >
      <Lock className={iconSizes[size]} />
      Secure Checkout
    </span>
  );
}

/**
 * VerifiedBadge - Shows verified seller/item
 */
interface VerifiedBadgeProps extends BadgeProps {
  label?: string;
}

export function VerifiedBadge({
  className,
  size = "md",
  label = "Verified",
}: VerifiedBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-primary font-medium text-primary-foreground",
        sizeClasses[size],
        className
      )}
    >
      <BadgeCheck className={iconSizes[size]} />
      {label}
    </span>
  );
}

/**
 * AuthenticityBadge - Shows item is authenticated
 */
export function AuthenticityBadge({ className, size = "md" }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-primary font-medium text-primary-foreground",
        sizeClasses[size],
        className
      )}
    >
      <ShieldCheck className={iconSizes[size]} />
      Authenticity Guaranteed
    </span>
  );
}

/**
 * ConditionReportBadge - Shows condition report available
 */
export function ConditionReportBadge({ className, size = "md" }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-border bg-card font-medium text-foreground",
        sizeClasses[size],
        className
      )}
    >
      <FileCheck className={iconSizes[size]} />
      Condition Report
    </span>
  );
}

/**
 * TrustedSellerBadge - Shows trusted seller status
 */
export function TrustedSellerBadge({ className, size = "md" }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-gold font-medium text-gold-foreground",
        sizeClasses[size],
        className
      )}
    >
      <Award className={iconSizes[size]} />
      Trusted Seller
    </span>
  );
}

/**
 * ProvenanceBadge - Shows provenance documented
 */
export function ProvenanceBadge({ className, size = "md" }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-border bg-card font-medium text-foreground",
        sizeClasses[size],
        className
      )}
    >
      <CheckCircle className={iconSizes[size]} />
      Provenance Documented
    </span>
  );
}

/**
 * StatusBadge - Dynamic auction/lot status badge
 */
interface StatusBadgeProps extends BadgeProps {
  status: "live" | "closing" | "open" | "closed" | "upcoming";
  pulse?: boolean;
}

const statusConfig = {
  live: { label: "Live Now", bg: "status-live" },
  closing: { label: "Closing Soon", bg: "status-closing" },
  open: { label: "Open for Bidding", bg: "status-open" },
  closed: { label: "Closed", bg: "status-closed" },
  upcoming: { label: "Upcoming", bg: "status-upcoming" },
};

export function StatusBadge({
  status,
  className,
  size = "md",
  pulse = true,
}: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium text-white",
        config.bg,
        sizeClasses[size],
        className
      )}
    >
      {status === "live" && pulse && (
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
        </span>
      )}
      {config.label}
    </span>
  );
}

/**
 * AffiliationBadges - Display industry affiliation logos
 */
interface Affiliation {
  name: string;
  logo?: string;
  url?: string;
}

interface AffiliationBadgesProps {
  affiliations: Affiliation[];
  className?: string;
}

export function AffiliationBadges({ affiliations, className }: AffiliationBadgesProps) {
  return (
    <div className={cn("flex flex-wrap items-center justify-center gap-6", className)}>
      {affiliations.map((affiliation, index) => (
        <div
          key={index}
          className="flex items-center gap-2 text-muted-foreground"
          title={affiliation.name}
        >
          {affiliation.logo ? (
            <img
              src={affiliation.logo}
              alt={affiliation.name}
              className="h-8 w-auto grayscale opacity-70 hover:grayscale-0 hover:opacity-100 transition-all"
            />
          ) : (
            <span className="text-sm font-medium">{affiliation.name}</span>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * TrustIndicators - Compact horizontal list of trust features
 */
interface TrustIndicator {
  icon: React.ReactNode;
  label: string;
}

interface TrustIndicatorsProps {
  indicators?: TrustIndicator[];
  className?: string;
}

const defaultIndicators: TrustIndicator[] = [
  { icon: <ShieldCheck className="h-4 w-4" />, label: "Authenticity Guaranteed" },
  { icon: <Lock className="h-4 w-4" />, label: "Secure Payments" },
  { icon: <Star className="h-4 w-4" />, label: "Expert Curation" },
  { icon: <Award className="h-4 w-4" />, label: "Trusted Since 2020" },
];

export function TrustIndicators({
  indicators = defaultIndicators,
  className,
}: TrustIndicatorsProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground",
        className
      )}
    >
      {indicators.map((indicator, index) => (
        <div key={index} className="flex items-center gap-1.5">
          <span className="text-primary/70">{indicator.icon}</span>
          <span>{indicator.label}</span>
        </div>
      ))}
    </div>
  );
}
