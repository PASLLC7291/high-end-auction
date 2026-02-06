import Link from "next/link";
import { AuctionNav } from "@/components/auction-nav";
import { AuctionFooter } from "@/components/auction-footer";
import { Button } from "@/components/ui/button";
import { Search, Home } from "lucide-react";

export default function AuctionNotFound() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AuctionNav />

      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="max-w-md text-center">
          <div className="flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Search className="h-8 w-8 text-muted-foreground" />
            </div>
          </div>
          <h1 className="mt-6 text-2xl font-semibold">Auction not found</h1>
          <p className="mt-4 text-muted-foreground">
            The auction you&apos;re looking for doesn&apos;t exist or may have been removed.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/">
              <Button className="w-full sm:w-auto gap-2">
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
