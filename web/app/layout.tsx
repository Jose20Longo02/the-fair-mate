import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://thefairmate.com"),
  title: "FairMate — 1v1 Chess for USDC",
  description: "Play competitive 1v1 chess for USDC stakes with fair matchmaking, transparent payouts, and skill-based outcomes.",
  keywords: [
    "play chess for USDC",
    "USDC chess platform",
    "1v1 chess with stakes",
    "FairMate",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "https://thefairmate.com",
    title: "FairMate — 1v1 Chess for USDC",
    description: "Play competitive 1v1 chess for USDC stakes with fair matchmaking and transparent payouts.",
    siteName: "FairMate",
    images: [
      {
        url: "/images/FairMate%20Logo.jpg?v=3",
        width: 1200,
        height: 630,
        alt: "FairMate logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "FairMate — 1v1 Chess for USDC",
    description: "Play competitive 1v1 chess for USDC stakes with fair matchmaking and transparent payouts.",
    images: ["/images/FairMate%20Logo.jpg?v=3"],
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
  },
  icons: {
    icon: [
      { url: "/images/FairMate%20Logo.jpg?v=3", type: "image/jpeg" },
    ],
    shortcut: [{ url: "/images/FairMate%20Logo.jpg?v=3", type: "image/jpeg" }],
    apple: [{ url: "/images/FairMate%20Logo.jpg?v=3", type: "image/jpeg" }],
  },
};

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "FairMate",
  url: "https://thefairmate.com",
  logo: "https://thefairmate.com/images/FairMate%20Logo.jpg?v=3",
  sameAs: [],
};

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "FairMate",
  url: "https://thefairmate.com",
  potentialAction: {
    "@type": "SearchAction",
    target: "https://thefairmate.com/ranking?search={search_term_string}",
    "query-input": "required name=search_term_string",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${geistMono.variable} flex min-h-screen min-h-[100dvh] flex-col antialiased font-sans`}
        style={{ backgroundColor: "#252525" }}
      >
        <Header />
        <div className="flex-1">{children}</div>
        <Footer />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
      </body>
    </html>
  );
}
