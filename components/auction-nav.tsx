"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import {
  User,
  Menu,
  LogOut,
  Gavel,
  Settings,
  Heart,
  CreditCard,
  ChevronDown,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle, SheetClose } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/auctions", label: "Auctions" },
  { href: "/about", label: "About" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/consign", label: "Sell With Us" },
];

export function AuctionNav() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogout = async () => {
    await signOut({ callbackUrl: "/", redirect: true });
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const isLoading = status === "loading";
  const user = session?.user;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      {/* Optional: Top trust bar - can be enabled for extra trust */}
      {/* <div className="border-b border-border/30 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 py-1.5 text-center text-xs">
          <Shield className="mr-1.5 inline h-3 w-3" />
          Trusted by 5,000+ collectors worldwide
        </div>
      </div> */}

      <div className="container mx-auto px-4">
        <nav className="flex h-16 items-center justify-between gap-4 md:h-18">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Gavel className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-serif text-lg font-semibold leading-none tracking-tight">
                AUCTION
              </span>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                House
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden items-center gap-1 md:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "px-4 py-2 text-sm font-medium transition-colors rounded-md",
                  pathname === link.href
                    ? "text-foreground bg-accent"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            {/* Desktop auth */}
            <div className="hidden md:flex items-center gap-2">
              {!mounted || isLoading ? (
                <div
                  className="h-9 w-[140px] rounded-md bg-muted/60"
                  aria-hidden="true"
                />
              ) : user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="gap-2 pl-2 pr-3">
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                          {getInitials(user.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium max-w-[100px] truncate">
                        {user.name?.split(" ")[0]}
                      </span>
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium">{user.name}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/account" className="cursor-pointer">
                        <User className="mr-2 h-4 w-4" />
                        My Account
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/account/bids" className="cursor-pointer">
                        <Gavel className="mr-2 h-4 w-4" />
                        My Bids
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/account/watchlist" className="cursor-pointer">
                        <Heart className="mr-2 h-4 w-4" />
                        Watchlist
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/account/payment" className="cursor-pointer">
                        <CreditCard className="mr-2 h-4 w-4" />
                        Payment Methods
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/account/settings" className="cursor-pointer">
                        <Settings className="mr-2 h-4 w-4" />
                        Settings
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={handleLogout}
                      className="text-destructive focus:text-destructive cursor-pointer"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Log out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <>
                  <Link href="/login">
                    <Button variant="ghost" size="sm">
                      Log in
                    </Button>
                  </Link>
                  <Link href="/signup">
                    <Button size="sm">Sign up</Button>
                  </Link>
                </>
              )}
            </div>

            {/* Mobile menu */}
            {mounted ? (
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="md:hidden">
                    <Menu className="h-5 w-5" />
                    <span className="sr-only">Open menu</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[300px] sm:w-[350px]">
                  <SheetHeader>
                    <SheetTitle className="text-left">Menu</SheetTitle>
                  </SheetHeader>
                  <div className="flex flex-col gap-1 pt-6">
                    {navLinks.map((link) => (
                      <SheetClose asChild key={link.href}>
                        <Link
                          href={link.href}
                          className={cn(
                            "px-3 py-3 text-base font-medium rounded-md transition-colors",
                            pathname === link.href
                              ? "bg-accent text-foreground"
                              : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                          )}
                        >
                          {link.label}
                        </Link>
                      </SheetClose>
                    ))}
                  </div>

                  <div className="mt-6 border-t border-border pt-6">
                    {user ? (
                      <div className="space-y-1">
                        <div className="flex items-center gap-3 px-3 py-2">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-primary/10 text-primary font-medium">
                              {getInitials(user.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{user.name}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {user.email}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 space-y-1">
                          <SheetClose asChild>
                            <Link
                              href="/account"
                              className="flex items-center gap-3 px-3 py-2.5 text-sm rounded-md hover:bg-accent"
                            >
                              <User className="h-4 w-4 text-muted-foreground" />
                              My Account
                            </Link>
                          </SheetClose>
                          <SheetClose asChild>
                            <Link
                              href="/account/bids"
                              className="flex items-center gap-3 px-3 py-2.5 text-sm rounded-md hover:bg-accent"
                            >
                              <Gavel className="h-4 w-4 text-muted-foreground" />
                              My Bids
                            </Link>
                          </SheetClose>
                          <SheetClose asChild>
                            <Link
                              href="/account/watchlist"
                              className="flex items-center gap-3 px-3 py-2.5 text-sm rounded-md hover:bg-accent"
                            >
                              <Heart className="h-4 w-4 text-muted-foreground" />
                              Watchlist
                            </Link>
                          </SheetClose>
                          <SheetClose asChild>
                            <Link
                              href="/account/payment"
                              className="flex items-center gap-3 px-3 py-2.5 text-sm rounded-md hover:bg-accent"
                            >
                              <CreditCard className="h-4 w-4 text-muted-foreground" />
                              Payment Methods
                            </Link>
                          </SheetClose>
                        </div>

                        <div className="mt-4 pt-4 border-t border-border">
                          <Button
                            variant="ghost"
                            className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={handleLogout}
                          >
                            <LogOut className="mr-2 h-4 w-4" />
                            Log out
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <Link href="/login" className="block">
                          <Button variant="outline" className="w-full">
                            Log in
                          </Button>
                        </Link>
                        <Link href="/signup" className="block">
                          <Button className="w-full">Sign up</Button>
                        </Link>
                      </div>
                    )}
                  </div>

                  {/* Mobile trust indicator */}
                  <div className="absolute bottom-6 left-6 right-6">
                    <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                      <Shield className="h-3.5 w-3.5" />
                      <span>Secure & Trusted</span>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                disabled
                aria-hidden="true"
                tabIndex={-1}
              >
                <Menu className="h-5 w-5" />
                <span className="sr-only">Open menu</span>
              </Button>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
