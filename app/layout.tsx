import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BizStack",
  description: "Run the business. Not the paperwork."
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
