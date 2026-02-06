"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AuctionNav } from "@/components/auction-nav";
import { AuctionFooter } from "@/components/auction-footer";
import { Button } from "@/components/ui/button";
import { AlertCircle, Home, RefreshCw } from "lucide-react";

export default function AccountError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AuctionNav />

      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="max-w-md text-center">
          <div className="flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
          </div>
          <h1 className="mt-6 text-2xl font-semibold">Something went wrong</h1>
          <p className="mt-4 text-muted-foreground">
            We had trouble loading this page. Please try again.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Button onClick={reset} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Try Again
            </Button>
            <Link href="/">
              <Button variant="outline" className="w-full sm:w-auto gap-2">
                <Home className="h-4 w-4" />
                Browse Auctions
              </Button>
            </Link>
          </div>
        </div>
      </main>

      <AuctionFooter />
    </div>
  );
}
