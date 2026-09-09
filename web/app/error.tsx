"use client";
import AsyncState from "./components/AsyncState";
export default function WorkspaceError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="page"><AsyncState error title="This view could not be loaded" description="Check that the database is running and your workspace is configured. Your data has not been changed." retry={reset} action={{ href: "/settings", label: "Open Settings & data" }} /></div>;
}
