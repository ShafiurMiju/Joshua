import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Joshua - GHL Opportunity Manager",
  description: "Fast opportunity management powered by GoHighLevel",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
