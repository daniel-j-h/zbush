import test from "node:test";
import assert from "node:assert";

import ZBush from "./index.js";


test("empty index", (t) => {
  const index = new ZBush();

  index.finish();

  const results = index.range(0, 0, 2**32-1, 2**32-1);

  assert.strictEqual(results.length, 0);
});


test("singular point", (t) => {
  const index = new ZBush();

  const id = index.add(0, 0);
  assert.strictEqual(id, 0);

  const results = index.range(0, 0, 0, 0);

  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0], 0);
});


test("all inside query window", () => {
  const index = new ZBush();

  for (let i = 5; i < 8; ++i) {
    for (let j = 5; j < 8; ++j) {
      index.add(i, j);
    }
  }

  const results = index.range(4, 4, 8, 8);

  assert.strictEqual(results.length, 3*3);
});


test("all outside query window", () => {
  const index = new ZBush();

  for (let i = 1; i < 3; ++i) {
    for (let j = 1; j < 3; ++j) {
      index.add(i, j);
    }
  }

  for (let i = 9; i < 12; ++i) {
    for (let j = 9; j < 12; ++j) {
      index.add(i, j);
    }
  }

  const results = index.range(4, 4, 8, 8);

  assert.strictEqual(results.length, 0);
});
