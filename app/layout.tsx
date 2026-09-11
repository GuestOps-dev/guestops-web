import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GuestOpsHQ",
  description: "Guest operations inbox and property workspace",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
