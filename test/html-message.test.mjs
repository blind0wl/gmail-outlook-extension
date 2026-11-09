import test from "node:test";
import assert from "node:assert/strict";
import { safeStyle } from "../src/popup/html-message.js";

test("inline styles drop viewport units while preserving ordinary values", () => {
  assert.equal(safeStyle("min-height:100vh;color:red"), "color:red");
  for (const prefix of ["", "s", "l", "d"]) {
    for (const unit of ["h", "w", "min", "max", "b", "i"]) {
      assert.equal(safeStyle(`height:50${prefix}v${unit}`), "");
    }
  }
  assert.equal(safeStyle("font-size:5vmin"), "");
  assert.equal(safeStyle("height:50 DVH"), "");
  assert.equal(safeStyle("font-family:Verdana;width:100px;height:50%"),
    "font-family:Verdana;width:100px;height:50%");
});
