// Benchmarking our simple implementation below against the C/C++ version in tinygraph.
//
// Index construction 10M points
// - C/C++: <1s
// - Js: ~4s
//
// Range query 1M bounding boxes
// - C/C++: ~7s
// - Js: ~50s
//
// That's roughly 4x slower index construction and 7x slower querying.
//
// Profile trace below, showing how the bit arithmetic on BigInt is very
// expensive compared to C/C++ where bit arithmetic is pretty much for
// free compared to memory access latency and we have access to hardware
// instructions PDEP/PEXT for Z-Order bit interleaving.
//
//   ticks  total  nonlib   name
//   5220    9.9%   26.7%  JS: *range file:///data/bench/node_modules/zbush/index.js:122:8
//   5136    9.7%   26.3%  Builtin: BigIntShiftRightNoThrow
//   3766    7.1%   19.3%  Builtin: BigIntBitwiseAndNoThrow
//   1053    2.0%    5.4%  Builtin: BigIntBitwiseOrNoThrow
//
// Optimizing this JavaScript implementation means finding ways to reduce
// the BigInt bit operations (e.g. BIGMIN computation) or seeing if we can
// get rid of the BigInt type completely, or if we really want to we could
// write a native Node.js addon or use WebAssembly.

//import RBush from "rbush";
//import Flatbush from "flatbush";
import KDBush from "kdbush";
import ZBush from "zbush";

function randomInt(lo, hi) { return Math.floor(Math.random() * (Math.floor(hi) - Math.ceil(lo)) + Math.ceil(lo)); }
function randomUint32() { return randomInt(0, 2**32); }


function make1() {
  const n = 1000000;

  const index = new ZBush();

  // Fixed point coordinates somewhere in Berlin
  for (let i = 0; i < n; ++i) {
    const lng = randomInt(0, 5691629) + 1931634267;
    const lat = randomInt(0, 2723174) + 1423721609;

    index.add(lng, lat);
  }

  index.finish();

  return index;
}

function bench1() {
  console.log("indexing")

  const index = make1();

  console.log("querying")

  const m = 1000000;

  for (let i = 0; i < m; ++i) {
    const lng = randomInt(0, 5691629) + 1931634267;
    const lat = randomInt(0, 2723174) + 1423721609;

    const results = index.range(lng, lat, lng + 10000, lat + 10000);
  }
}


function make2() {
  const n = 1000000;

  const index = new KDBush(n);

  // Fixed point coordinates somewhere in Berlin
  for (let i = 0; i < n; ++i) {
    const lng = randomInt(0, 5691629) + 1931634267;
    const lat = randomInt(0, 2723174) + 1423721609;

    index.add(lng, lat);
  }

  index.finish();

  return index;
}

function bench2() {
  console.log("indexing")

  const index = make2();

  console.log("querying")

  const m = 1000000;

  for (let i = 0; i < m; ++i) {
    const lng = randomInt(0, 5691629) + 1931634267;
    const lat = randomInt(0, 2723174) + 1423721609;

    const results = index.range(lng, lat, lng + 10000, lat + 10000);
  }
}


//bench1();
//bench2();
