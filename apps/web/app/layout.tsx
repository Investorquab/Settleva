import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Settleva — Conditional payment infrastructure",
  description: "Define payment conditions, verify authoritative evidence, and settle USDC with reusable developer infrastructure.",
  openGraph: {
    title: "Settleva — Conditional payment infrastructure",
    description: "Your rules. Your evidence. Payments that follow through.",
    type: "website"
  }
};

export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="en"><body>{children}</body></html>;
}
