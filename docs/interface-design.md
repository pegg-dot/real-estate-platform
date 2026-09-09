# Acquisition workspace interface

The interface is organized around the next investment decision, rather than a directory of every feature. All existing product destinations remain available in grouped navigation.

## Research translated into behavior

- [Linear: How we redesigned the Linear UI](https://linear.app/now/how-we-redesigned-the-linear-ui): consistent sidebar, header, and content hierarchy; quieter chrome without removing power-user functionality. LOT uses a shared sidebar/header, task groups, and keyboard page search.
- [Linear: UI refresh, March 12, 2026](https://linear.app/changelog/2026-03-12-ui-refresh): calmer sidebar and consistent headers. LOT reserves its accent for actions and active navigation, rather than coloring every surface.
- [Attio: Create and view records](https://attio.com/help/reference/managing-your-data/records/create-and-view-records): keep the record identity and useful actions together, with secondary detail organized into focused views. The property dossier retains its analytical content in Overview, Underwriting, Owner, and Research tabs.
- [Regrid: The property app gets a makeover](https://regrid.com/blog/the-regrid-property-app-gets-a-makeover): simplify access to mapping tools without losing capability. LOT separates address search from optional AI filtering, makes map layers secondary, clusters map points, and keeps a useful property list when no Mapbox token is configured.

These references inform interaction patterns, not copied branding or proprietary assets.

## Product boundaries

The overview derives counts and a shortlist from the existing parcel endpoint, not invented portfolio metrics. Its refresh timestamp denotes a job start, not confirmation of completion. Estimated values are not listing prices. Cash-on-cash values, financing hypotheses, and seller motivation remain labeled as analytical or inferred. Screening failures and attorney-review warnings remain visible.

The property list and map use the same filtered records. Local address search, quick filters, sorting, and pagination require no AI provider. All five original map metrics and the growth-corridor/development controls are retained. Cluster counts are not average investment scores. Map legends show the units of the selected color metric.

Tracking a property does not execute a transaction. Pipeline advancement/passing still records the existing reason codes. Lead drafting, coaching, inbound-reply recording, chat context, and server-enforced action controls are preserved. Recording an inbound reply now asks for confirmation. Runner passcodes stay in component memory rather than sessionStorage; users unlock controls again when they revisit Settings.

No scoring, underwriting, authentication, or provider execution rules are relaxed by this redesign. No production mock data or public test routes are introduced.

## Verification

`npm test` includes presentation tests for filtering, sorting, null values, even/odd medians, map-legend units, and navigation coverage. Root type checking and the existing Docker/self-host test remain in place.

`tests/browser/workspace.spec.py` exercises the real React interface using synthetic, explicitly labeled API fixtures, including missing providers, failures, retry, keyboard navigation, property deep links, and mobile layout. The optional `prepare-fixtures.py` creates disposable render routes for the server-fed pipeline and leads components. Those routes must be removed after testing and are not part of the shipped application.

Browser fixture tests do not claim end-to-end verification of paid providers, live county ingestion, external sends, or production data. The normal self-host workflow separately validates the clean Docker/PostgreSQL boundary.
