import test from "node:test";
import assert from "node:assert";

import ZBush from "./index.js";


test("empty index", () => {
  const index = new ZBush();

  index.finish();

  const results = index.range(0, 0, 2**32-1, 2**32-1);

  assert.strictEqual(results.length, 0);
});


test("singular point", () => {
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


test("querying across a Z discontinuity", () => {
  const index = new ZBush();

  for (let i = 0; i < 4; ++i) {
    for (let j = 0; j < 4; ++j) {
      index.add(i, j);
    }
  }

  const results = index.range(1, 1, 2, 2);
  assert.strictEqual(results.length, 4);

  // Note that the returned results are not sorted
  // in any way, here we sort the ids and then check
  // against the four items in the window from above

  const sorted = results.sort((a, b) => a - b);

  assert.strictEqual(results[0], 5);
  assert.strictEqual(results[1], 6);
  assert.strictEqual(results[2], 9);
  assert.strictEqual(results[3], 10);
});


test("querying without explicit finish()", () => {
  const index = new ZBush();

  index.add(0, 0);
  index.add(1, 1);
  index.add(2, 2);
  index.add(3, 3);

  const results = index.range(2, 2, 3, 3);
  assert.strictEqual(results.length, 2);
});


test("querying after re-indexing without finish()", () => {
  const index = new ZBush();

  index.add(0, 0);
  index.add(1, 1);
  index.add(2, 2);
  index.add(3, 3);

  const results1 = index.range(2, 2, 3, 3);
  assert.strictEqual(results1.length, 2);

  index.add(2, 2);
  index.add(3, 3);

  const results2 = index.range(2, 2, 3, 3);
  assert.strictEqual(results2.length, 4);
});


test("indexing negative integral numbers not supported", () => {
  const index = new ZBush();

  index.add(-1, -1);
  index.add(-2, -2);
  index.add(-3, -3);
  index.add(-4, -4);

  index.add(1, 1);
  index.add(2, 2);
  index.add(3, 3);
  index.add(4, 4);

  assert.throws(index.finish, Error);
});


test("searching with negative integral numbers not supported", () => {
  const index = new ZBush();

  index.add(0, 0);

  index.finish();

  assert.throws(() => index.range(-1, -1, 1, 1), Error);
});


test("indexing integral numbers bigger than 2^32-1 (u32) not supported", () => {
  const index = new ZBush();

  // Z-order maps 2x UINT32_MAX (all bits set)
  // to 1x UINT64_MAX (all bits set), that's
  // the max. we support with BigUint64Array.
  // The UINT32_MAX value is equal to 2**32-1.
  index.add(2**32-1+1, 2**32-1+1);

  assert.throws(index.finish);
});


test("searching with integral numbers bigger than 2^32-1 (u32) not supported", () => {
  const index = new ZBush();

  index.add(0, 0);

  index.finish();

  assert.throws(() => index.range(0, 0, 2**32-1+1, 2**32-1+1), Error);
});


test("indexing floating point numbers not supported", () => {
  const index = new ZBush();

  index.add(2.3, 2.3);

  assert.throws(index.finish);
});


test("searching with floating point numbers not supported", () => {
  const index = new ZBush();

  index.add(0, 0);

  index.finish();

  assert.throws(() => index.range(0, 0, 0.1, 0.1), Error);
});


test("index internals are hidden in the exported class", () => {
  const index = new ZBush();

  index.add(0, 0);

  index.finish();

  assert.strictEqual(index.ids, undefined);
  assert.strictEqual(index.xs, undefined);
  assert.strictEqual(index.ys, undefined);
  assert.strictEqual(index.zs, undefined);
  assert.strictEqual(index.finished, undefined);
});
