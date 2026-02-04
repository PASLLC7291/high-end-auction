/**
 * SectionHeader - Consistent heading treatment for page sections
 */

import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  align?: "left" | "center";
  className?: string;
  children?: React.ReactNode;
}

export function SectionHeader({
  title,
  subtitle,
  align = "left",
  className,
  children,
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        "mb-10 md:mb-12",
        align === "center" && "text-center",
        className
      )}
    >
      <h2 className="text-balance">{title}</h2>
      {subtitle && (
        <p className="mt-3 text-lg text-muted-foreground max-w-2xl mx-auto">
          {subtitle}
        </p>
      )}
      {children}
    </div>
  );
}

/**
 * PageHero - Consistent hero section for interior pages
 */
interface PageHeroProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  className?: string;
}

export function PageHero({ title, subtitle, children, className }: PageHeroProps) {
  return (
    <section
      className={cn(
        "border-b border-border/50 py-16 md:py-24",
        "bg-section-alt",
        className
      )}
    >
      <div className="container mx-auto px-4">
        <div className="max-w-3xl">
          <h1 className="text-balance">{title}</h1>
          {subtitle && (
            <p className="mt-4 text-xl text-muted-foreground leading-relaxed">
              {subtitle}
            </p>
          )}
          {children}
        </div>
      </div>
    </section>
  );
}

/**
 * Section - Consistent section wrapper
 */
interface SectionProps {
  id?: string;
  children: React.ReactNode;
  className?: string;
  background?: "default" | "alt" | "highlight";
  size?: "default" | "sm" | "lg";
}

export function Section({
  id,
  children,
  className,
  background = "default",
  size = "default",
}: SectionProps) {
  const bgClasses = {
    default: "",
    alt: "bg-section-alt",
    highlight: "bg-section-highlight",
  };

  const sizeClasses = {
    sm: "py-12 md:py-16",
    default: "py-16 md:py-24",
    lg: "py-20 md:py-32",
  };

  return (
    <section id={id} className={cn(bgClasses[background], sizeClasses[size], className)}>
      <div className="container mx-auto px-4">{children}</div>
    </section>
  );
}
