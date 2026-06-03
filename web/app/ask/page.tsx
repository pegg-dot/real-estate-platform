import { redirect } from "next/navigation";
// Merged into the unified chat (spec 024). Kept as a redirect so old links/bookmarks still work.
export default function Page() { redirect("/chat"); }
