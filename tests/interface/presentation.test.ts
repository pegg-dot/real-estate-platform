import { describe, expect, it } from "vitest";
import { ALL_NAV, activeRoute, searchNavigation } from "../../web/app/components/navigation";
import { displayParcels, median, numberOrNull, lensLegend, type ParcelFeature } from "../../web/app/lib/propertyPresentation";
const feature = (id: string, score: number, price: number | null, coc: number | null, extras = {}): ParcelFeature => ({ type: "Feature", geometry: { type: "Point", coordinates: [-78.5,38.03] }, properties: { apn: id, address: `${id} Example Street`, score, colorValue: score, price, coc, bestUseCoc: coc, byRoom: null, gatePassed: true, structure: null, use: null, distress: false, ...extras } });
const rows = [feature("A", 81, 400000, .08), feature("B", 72, 500000, .09, { byRoom: true, gatePassed: false }), feature("C", 50, null, null), feature("D", 40, 501000, .02, { distress: true })];
describe("property presentation without changing underwriting", () => {
  it("calculates even and odd medians correctly", () => { expect(median([1,9,3,5])).toBe(4); expect(median([1,9,3])).toBe(3); });
  it("does not invent a value for missing or nonfinite input", () => { expect(median([null, undefined, NaN, Infinity])).toBeNull(); expect(numberOrNull(null)).toBeNull(); expect(numberOrNull("")).toBeNull(); expect(numberOrNull(false)).toBeNull(); expect(numberOrNull("123")).toBe(123); });
  it("searches address and parcel ID case insensitively", () => { expect(displayParcels(rows, "b example", "all", "score").map(x => x.properties.apn)).toEqual(["B"]); });
  it("sorts thesis scores descending without mutating the input", () => { const input = [...rows].reverse(); expect(displayParcels(input,"","all","score")[0]?.properties.apn).toBe("A"); expect(input[0]?.properties.apn).toBe("D"); });
  it("sorts known estimated values ascending and nulls last", () => { expect(displayParcels(rows,"","all","value").map(x => x.properties.apn)).toEqual(["A","B","D","C"]); });
  it("sorts modeled returns descending and nulls last", () => { expect(displayParcels(rows,"","all","return").map(x => x.properties.apn)).toEqual(["B","A","D","C"]); });
  it("uses the strong-fit threshold exactly", () => { expect(displayParcels([...rows,feature("E",70,1,0)],"","strong","score").length).toBe(3); });
  it("includes the price boundary but does not treat unknown price as free", () => { expect(displayParcels(rows,"","affordable","score").map(x => x.properties.apn)).toEqual(["A","B"]); });
  it("requires an affirmative by-room signal", () => { expect(displayParcels(rows,"","byRoom","score").map(x => x.properties.apn)).toEqual(["B"]); });
  it("does not discard gate failures or distress flags", () => { expect(displayParcels(rows,"","review","score")[0]?.properties.apn).toBe("B"); expect(displayParcels(rows,"","distress","score")[0]?.properties.apn).toBe("D"); });
  it("shows units that match the server's color normalization", () => { expect(lensLegend("score").unit).toBe("Score out of 100"); expect(lensLegend("best_use").strong).toContain("8.4%"); expect(lensLegend("appreciation").unit).toContain("not forecast"); });
});
describe("workspace navigation", () => {
  it("keeps all existing product destinations discoverable", () => { expect(ALL_NAV.map(n=>n.href).sort()).toEqual(["/","/map","/chat","/brief","/portfolio","/leads","/deals","/thesis","/playbook","/changes","/radar","/learn","/rents","/outreach","/schedule","/activity","/settings"].sort()); });
  it("does not mark root or unrelated prefix routes active", () => { expect(activeRoute("/map", "/")).toBe(false); expect(activeRoute("/maple", "/map")).toBe(false); expect(activeRoute("/map/detail", "/map")).toBe(true); });
  it("supports multiple words and descriptive workflow search", () => { expect(searchNavigation("investment thesis")[0]?.href).toBe("/thesis"); expect(searchNavigation("approve sends")[0]?.href).toBe("/outreach"); expect(searchNavigation("impossible route xyz")).toEqual([]); });
});
