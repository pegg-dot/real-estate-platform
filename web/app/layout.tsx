import "./globals.css";
import "./workspace.css";
import "./mobile.css";
import type { ReactNode } from "react";
import WorkspaceShell from "./components/WorkspaceShell";
import { MARKET } from "./lib/db";

export const metadata = {
  title: { default: "LOT | Acquisition workspace", template: "%s | LOT" },
  description: "A property acquisition workspace built by Nate Pegg. Research public parcel data, evaluate your investment thesis, and manage deal decisions.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><head><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.19.0/dist/tabler-icons.min.css" /></head><body><WorkspaceShell market={MARKET}>{children}</WorkspaceShell></body></html>;
}
