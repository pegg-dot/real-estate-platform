import { describe, it, expect } from "vitest";
import { moneyHorizon } from "./horizon.js";

describe("moneyHorizon — today / tomorrow / forever money", () => {
  it("classifies wholesale and flip as TODAY money", () => {
    expect(moneyHorizon({ recommendedUse: "wholesale" }).horizon).toBe("today");
    expect(moneyHorizon({ recommendedUse: "flip" }).horizon).toBe("today");
  });

  it("classifies develop / corridor as TOMORROW money", () => {
    expect(moneyHorizon({ recommendedUse: "develop" }).horizon).toBe("tomorrow");
    expect(moneyHorizon({ corridor: true }).horizon).toBe("tomorrow");
  });

  it("classifies buy-and-hold rentals as FOREVER money", () => {
    expect(moneyHorizon({ recommendedUse: "hold", exitStrategy: "by_room" }).horizon).toBe("forever");
    expect(moneyHorizon({ exitStrategy: "section8" }).horizon).toBe("forever");
  });

  it("defaults to forever (the buy-and-hold thesis) with no signal", () => {
    expect(moneyHorizon({}).horizon).toBe("forever");
  });
});
