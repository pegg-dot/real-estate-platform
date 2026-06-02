import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "LOT — Land of Opportunity Terminal",
  description: "Find, score, and finance buy-and-hold rentals.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav>
          <span className="brand">LOT</span>
          <a href="/">Map</a>
          <a href="/leads">Leads</a>
          <a href="/deals">Pipeline</a>
          <span className="muted" style={{ marginLeft: "auto" }}>Charlottesville · functional preview</span>
        </nav>
        {children}
      </body>
    </html>
  );
}
