import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reset Password | Auction House",
  description: "Reset your Auction House account password.",
};

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
