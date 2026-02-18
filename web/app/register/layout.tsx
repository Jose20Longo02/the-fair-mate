import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Register — FairMate",
  description: "Create your FairMate account and start playing.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function RegisterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
