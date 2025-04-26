// Spatial Index, on top of a Z-Order Curve using BIGMIN pruning
//
// Z-Order impl. translated from my work over at
// https://github.com/tinygraph/tinygraph/blob/5f7af38f99c3aeec64f136fe4284dbf36e3c625d/tinygraph/tinygraph-zorder.c
//
// Z-Order Curve based Spatial Index translated from my work over at
// https://github.com/tinygraph/tinygraph/blob/5f7af38f99c3aeec64f136fe4284dbf36e3c625d/tinygraph/tinygraph-index.c
//
// BIGMIN (also called nextJumpIn, GetNextZ-Address) impl. translated from my work over at
// https://github.com/tinygraph/tinygraph/blob/5f7af38f99c3aeec64f136fe4284dbf36e3c625d/tinygraph/tinygraph-index.c#L353-408
//
// Notes:
//
// - Please read comments, explanations, and references in
//     https://github.com/tinygraph/tinygraph/pull/68
//     https://github.com/tinygraph/tinygraph/blob/5f7af38f99c3aeec64f136fe4284dbf36e3c625d/tinygraph/tinygraph-index.c
//
// - For further improvements and ideas read
//   https://github.com/tinygraph/tinygraph/issues/71


const _bitblast4 = [
  0x00n, 0x01n, 0x04n, 0x05n, 0x10n, 0x11n, 0x14n, 0x15n,
  0x40n, 0x41n, 0x44n, 0x45n, 0x50n, 0x51n, 0x54n, 0x55n,
];

function _bitblast8(x) {
  return (_bitblast4[(x >> 0n) & 0xfn] << 0n)
       | (_bitblast4[(x >> 4n) & 0xfn] << 8n);
}

function _bitblast16(x) {
  return (_bitblast8((x >> 0n) & 0xffn) << 0n)
       | (_bitblast8((x >> 8n) & 0xffn) << 16n);
}

function _bitblast32(x) {
  return (_bitblast16((x >> 0n) & 0xffffn) << 0n)
       | (_bitblast16((x >> 16n) & 0xffffn) << 32n);
}


// Maps two numbers on a one-dimensional Z-Order Curve.
// The two numbers must be non-negative and fit into a
// 32-bit type as the return type is unsigned 64-bit.
//
// The reason for this is that efficient and compact
// storage can then happen in form of BigUint64Array.
//
// REQUIRES: x >= 0, y >= 0
// REQUIRES: x <= 2^32-1, y <= 2^32-1
function zencode64(x, y) {
  x = BigInt.asUintN(32, BigInt(x));
  y = BigInt.asUintN(32, BigInt(y));

  return (_bitblast32(y) << 1n) | _bitblast32(x);
}


function _bsearchlt(a, f, l, v) {
  let i = f, step = 0, n = l - f;

  while (n > 0) {
    step = Math.floor(n / 2);
    i = f + step;

    if (a[i] < v) {  // lt
      f = i + 1;
      n -= step + 1;
    } else {
      n = step;
    }
  }

  return f;
}


function _bsearchlte(a, f, l, v) {
  let i = f, step = 0, n = l - f;

  while (n > 0) {
    step = Math.floor(n / 2);
    i = f + step;

    if (a[i] <= v) {  // lte
      f = i + 1;
      n -= step + 1;
    } else {
      n = step;
    }
  }

  return f;
}


function _bigmin(zval, zmin, zmax) {
  let bigmin = zmin;

  let loadmask = 0x5555555555555555n;
  let loadones = 0x2aaaaaaaaaaaaaaan;

  let mask = 0x8000000000000000n;

  while (mask) {
    const bzval = zval & mask;
    const bzmin = zmin & mask;
    const bzmax = zmax & mask;

    if (!bzval && !bzmin && !bzmax) {
      // pass
    } else if (!bzval && !bzmin && bzmax) {
      bigmin = (zmin & loadmask) | mask;
      zmax = (zmax & loadmask) | loadones;
    } else if (!bzval && bzmin && bzmax) {
      return zmin;
    } else if (bzval && !bzmin && !bzmax) {
      return bigmin;
    } else if (bzval && !bzmin && bzmax) {
      zmin = (zmin & loadmask) | mask;
    } else if (bzval && bzmin && bzmax) {
      // pass
    } else {
      // can not happen
    }

    mask >>= 1n;
    loadones >>= 1n;
    loadmask >>= 1n;
    loadmask |= 0x8000000000000000n;
  }

  return bigmin;
}


function createIndex(xs, ys, n) {
  const mapped = [];

  for (let i = 0; i < n; ++i) {
    mapped.push({
      i: i,
      x: xs[i],
      y: ys[i],
      z: zencode64(xs[i], ys[i]),
    });
  }

  mapped.sort((a, b) => {
    if (a.z > b.z) return +1;
    else if (a.z < b.z) return -1;
    else return 0;
  });

  return {
    length: mapped.length,
    ids: mapped.map((v) => v.i),
    xs: mapped.map((v) => v.x),
    ys: mapped.map((v) => v.y),
    zs: new BigUint64Array(mapped.map((v) => v.z)),
  };
}


function queryIndex(zbush, xmin, ymin, xmax, ymax) {
  const results = [];

  const zmin = zencode64(xmin, ymin);
  const zmax = zencode64(xmax, ymax);

  let it = _bsearchlt(zbush.zs, 0, zbush.length, zmin);
  const last = _bsearchlte(zbush.zs, it, zbush.length, zmax);

  while (it != last) {
    const x = zbush.xs[it];
    const y = zbush.ys[it];

    if (x >= xmin && x <= xmax && y >= ymin && y <= ymax) {
      results.push(zbush.ids[it]);
      it += 1;
    } else {
      const znext = _bigmin(zbush.zs[it], zmin, zmax);
      it = _bsearchlt(zbush.zs, it, last, znext);
    }
  }

  return results;
}


const n = 10;
const xs = Array.from(Array(n).keys());
const ys = Array.from(Array(n).keys());

const zbush = createIndex(xs, ys, n);
console.log(zbush.zs);

const results = queryIndex(zbush, 2, 2, 3, 3);
console.log(results);
