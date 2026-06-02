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
          <a href="/brief">Brief</a>
          <a href="/">Map</a>
          <a href="/leads">Leads</a>
          <a href="/deals">Pipeline</a>
          <a href="/thesis">Thesis</a>
          <span className="muted" style={{ opacity: 0.4 }}>·</span>
          <a href="/changes">Changes</a>
          <a href="/radar">Radar</a>
          <a href="/learn">Learn</a>
          <a href="/rents">Rents</a>
          <a href="/outreach">Outreach</a>
          <span className="muted" style={{ marginLeft: "auto" }}>Charlottesville · preview</span>
        </nav>
        {children}
      </body>
    </html>
  );
}
