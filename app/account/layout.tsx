"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AuctionNav } from "@/components/auction-nav";
import { AuctionFooter } from "@/components/auction-footer";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  User,
  Gavel,
  Heart,
  Trophy,
  CreditCard,
  Settings,
  Shield,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const accountNavItems = [
  { href: "/account", label: "Overview", icon: User },
  { href: "/account/bids", label: "My Bids", icon: Gavel },
  { href: "/account/watchlist", label: "Watchlist", icon: Heart },
  { href: "/account/won", label: "Won Items", icon: Trophy },
  { href: "/account/payment", label: "Payment Methods", icon: CreditCard },
  { href: "/account/settings", label: "Settings", icon: Settings },
];

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const router = useRouter();

  // Redirect if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      const callback = encodeURIComponent(pathname || "/account");
      router.replace(`/login?callbackUrl=${callback}`);
    }
  }, [router, status, pathname]);

  // Show loading state (or pending redirect)
  if (status === "loading" || status === "unauthenticated") {
    return (
      <div className="min-h-screen bg-background">
        <AuctionNav />
        <div className="container mx-auto px-4 py-12">
          <div className="flex items-center justify-center">
            <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
        <AuctionFooter />
      </div>
    );
  }

  const user = session?.user;
  const getInitials = (name: string | null | undefined) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="min-h-screen bg-background">
      <AuctionNav />

      {/* Header */}
      <div className="border-b border-border bg-section-alt">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="bg-primary/10 text-primary text-xl font-medium">
                {getInitials(user?.name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-semibold">{user?.name || "My Account"}</h1>
              <p className="text-muted-foreground">{user?.email}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Navigation - Desktop */}
          <aside className="hidden lg:block lg:w-64 shrink-0">
            <nav className="space-y-1 sticky top-24">
              {accountNavItems.map((item) => {
                const isActive = pathname === item.href ||
                  (item.href !== "/account" && pathname.startsWith(item.href));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}

              {/* Trust indicator */}
              <div className="pt-6 mt-6 border-t border-border">
                <div className="flex items-center gap-2 px-4 text-xs text-muted-foreground">
                  <Shield className="h-4 w-4 text-primary" />
                  <span>Your data is secure</span>
                </div>
              </div>
            </nav>
          </aside>

          {/* Mobile Navigation */}
          <div className="lg:hidden">
            <div className="flex gap-2 overflow-x-auto pb-4 -mx-4 px-4">
              {accountNavItems.map((item) => {
                const isActive = pathname === item.href ||
                  (item.href !== "/account" && pathname.startsWith(item.href));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            {children}
          </main>
        </div>
      </div>

      <AuctionFooter />
    </div>
  );
}
