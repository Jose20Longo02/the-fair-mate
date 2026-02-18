import AdminNav from "@/components/AdminNav";
import type { Metadata } from "next";

const PAGE_BG = "#252525";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
      "max-image-preview": "none",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="min-h-screen font-sans"
      style={{ backgroundColor: PAGE_BG }}
    >
      <AdminNav />
      <div className="mx-auto max-w-6xl min-w-0 px-4 py-6 sm:px-6 sm:py-8 md:px-8 md:py-10">
        {children}
      </div>
    </div>
  );
}
