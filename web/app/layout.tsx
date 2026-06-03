import "./globals.css";
import type { ReactNode } from "react";
import TopNav from "./TopNav";

export const metadata = {
  title: "LOT — Land of Opportunity Terminal",
  description: "Find, score, and finance buy-and-hold rentals.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Tabler icon webfont (design system uses `ti ti-*`). Fonts (Newsreader/Hanken) load via tokens.css. */}
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.19.0/dist/tabler-icons.min.css" />
      </head>
      <body>
        <TopNav />
        {children}
      </body>
    </html>
  );
}
