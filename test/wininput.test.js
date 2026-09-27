import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertAction, parseHandle, sameElement, safeInt, ACTIONS } from "../lib/wininput.js";

describe("action guard", () => {
  it("accepts the three documented actions", () => {
    for (const a of ACTIONS) assert.equal(assertAction(a), a);
  });
  it("refuses anything else rather than passing it through", () => {
    assert.throws(() => assertAction("destroy"), /unsupported action/);
    assert.throws(() => assertAction(undefined), /unsupported action/);
  });
});

describe("handles", () => {
  it("parses epoch.index", () => {
    assert.deepEqual(parseHandle("1790525657168.6"), { epoch: 1790525657168, index: 6 });
  });
  it("returns null for anything else", () => {
    for (const bad of ["", "1", "a.b", "1.2.3", undefined, 7]) assert.equal(parseHandle(bad), null);
  });
});

describe("sameElement", () => {
  it("accepts an identical element", () => {
    assert.equal(sameElement({ controlType: "Button", name: "OK" }, { controlType: "Button", name: "OK" }), true);
  });
  it("rejects a renamed element", () => {
    assert.equal(sameElement({ controlType: "Button", name: "OK" }, { controlType: "Button", name: "Cancel" }), false);
  });
  it("rejects a retyped element", () => {
    assert.equal(sameElement({ controlType: "Button", name: "OK" }, { controlType: "Text", name: "OK" }), false);
  });
  it("rejects a missing side", () => {
    assert.equal(sameElement(null, { controlType: "Button", name: "OK" }), false);
    assert.equal(sameElement({ controlType: "Button", name: "OK" }, undefined), false);
  });
});

describe("safeInt", () => {
  it("keeps integers and truncates fractions", () => {
    assert.equal(safeInt(42), 42);
    assert.equal(safeInt(4.9), 4);
  });
  it("falls back on non-numbers", () => {
    assert.equal(safeInt(undefined), 0);
    assert.equal(safeInt("abc"), 0);
    assert.equal(safeInt(NaN, 7), 7);
  });
});
