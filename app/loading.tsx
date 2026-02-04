import { Gavel } from "lucide-react";

export default function Loading() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="relative">
          <div className="h-16 w-16 border-2 border-primary/20 rounded-full mx-auto" />
          <div className="absolute inset-0 h-16 w-16 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Gavel className="h-6 w-6 text-primary/60" />
          </div>
        </div>
        <p className="mt-6 text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}
