/**
 * TestimonialCard - Display client testimonials with photo and quote
 */

import { Quote } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export interface Testimonial {
  quote: string;
  author: string;
  title?: string;
  location?: string;
  image?: string;
  rating?: number;
}

interface TestimonialCardProps {
  testimonial: Testimonial;
  variant?: "default" | "featured";
  className?: string;
}

export function TestimonialCard({
  testimonial,
  variant = "default",
  className,
}: TestimonialCardProps) {
  const initials = testimonial.author
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  if (variant === "featured") {
    return (
      <Card className={`border-0 bg-section-alt shadow-none ${className ?? ""}`}>
        <CardContent className="p-8 md:p-12">
          <Quote className="h-10 w-10 text-primary/20" />
          <blockquote className="mt-6 font-serif text-2xl font-medium leading-relaxed text-foreground md:text-3xl">
            "{testimonial.quote}"
          </blockquote>
          <div className="mt-8 flex items-center gap-4">
            <Avatar className="h-14 w-14">
              <AvatarImage src={testimonial.image} alt={testimonial.author} />
              <AvatarFallback className="bg-primary/10 text-primary font-medium">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium text-foreground">{testimonial.author}</p>
              {(testimonial.title || testimonial.location) && (
                <p className="text-sm text-muted-foreground">
                  {[testimonial.title, testimonial.location].filter(Boolean).join(" • ")}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`border-border/50 ${className ?? ""}`}>
      <CardContent className="p-6">
        <Quote className="h-6 w-6 text-primary/30" />
        <blockquote className="mt-4 text-base leading-relaxed text-foreground">
          "{testimonial.quote}"
        </blockquote>
        <div className="mt-6 flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={testimonial.image} alt={testimonial.author} />
            <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-medium text-foreground">{testimonial.author}</p>
            {(testimonial.title || testimonial.location) && (
              <p className="text-xs text-muted-foreground">
                {[testimonial.title, testimonial.location].filter(Boolean).join(" • ")}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface TestimonialGridProps {
  testimonials: Testimonial[];
  columns?: 2 | 3;
  className?: string;
}

export function TestimonialGrid({
  testimonials,
  columns = 3,
  className,
}: TestimonialGridProps) {
  const gridCols = columns === 2 ? "md:grid-cols-2" : "md:grid-cols-2 lg:grid-cols-3";

  return (
    <div className={`grid gap-6 ${gridCols} ${className ?? ""}`}>
      {testimonials.map((testimonial, index) => (
        <TestimonialCard key={index} testimonial={testimonial} />
      ))}
    </div>
  );
}
