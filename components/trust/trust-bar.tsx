/**
 * TrustBar - Horizontal strip showing key trust metrics
 * Use at the top of homepage or below hero
 */

import { Shield, Award, Users, TrendingUp } from "lucide-react";

export interface TrustMetric {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

interface TrustBarProps {
  metrics?: TrustMetric[];
  className?: string;
}

const defaultMetrics: TrustMetric[] = [
  {
    value: "Est. 2020",
    label: "Trusted Since",
    icon: <Shield className="h-5 w-5" />,
  },
  {
    value: "500+",
    label: "Auctions Held",
    icon: <Award className="h-5 w-5" />,
  },
  {
    value: "$10M+",
    label: "Total Sales",
    icon: <TrendingUp className="h-5 w-5" />,
  },
  {
    value: "5,000+",
    label: "Happy Bidders",
    icon: <Users className="h-5 w-5" />,
  },
];

export function TrustBar({ metrics = defaultMetrics, className }: TrustBarProps) {
  return (
    <div className={`border-y border-border/50 bg-section-alt py-6 ${className ?? ""}`}>
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4 md:gap-8">
          {metrics.map((metric, index) => (
            <div key={index} className="flex items-center justify-center gap-3 text-center md:justify-start">
              {metric.icon && (
                <div className="hidden text-primary/70 sm:block">
                  {metric.icon}
                </div>
              )}
              <div>
                <p className="font-serif text-xl font-medium text-foreground md:text-2xl">
                  {metric.value}
                </p>
                <p className="text-xs text-muted-foreground md:text-sm">
                  {metric.label}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
