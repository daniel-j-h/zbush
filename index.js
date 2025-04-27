// Spatial Index, built on top of a Z-Order Curve using BIGMIN pruning.
//
// The Z-Order implementation below is translated from my work over at
// https://github.com/tinygraph/tinygraph/blob/5f7af38f99c3aeec64f136fe4284dbf36e3c625d/tinygraph/tinygraph-zorder.c
//
// The Z-Order Curve based Spatial Index is translated from my work over at
// https://github.com/tinygraph/tinygraph/blob/5f7af38f99c3aeec64f136fe4284dbf36e3c625d/tinygraph/tinygraph-index.c
//
// The BIGMIN (also called nextJumpIn, GetNextZ-Address) implementation is translated from my work over at
// https://github.com/tinygraph/tinygraph/blob/5f7af38f99c3aeec64f136fe4284dbf36e3c625d/tinygraph/tinygraph-index.c#L353-408
//
//
// Notes
//
// - Please read comments, explanations, and references in
//     https://github.com/tinygraph/tinygraph/pull/68
//     https://github.com/tinygraph/tinygraph/issues/22
//     https://github.com/tinygraph/tinygraph/blob/5f7af38f99c3aeec64f136fe4284dbf36e3c625d/tinygraph/tinygraph-index.c
//     https://github.com/tinygraph/tinygraph/blob/5f7af38f99c3aeec64f136fe4284dbf36e3c625d/tinygraph/tinygraph-zorder.c
//
// - For further improvements and ideas read
//     https://github.com/tinygraph/tinygraph/issues/71
//
//
// For the JavaScript implementation
//
// - The Z-Order Curve as well as BIGMIN work on type BigInt. That was a decision I made
//   since primitive JavaScript numbers only support bit-wise operations as 32-bit ints.
//   We need to see how fast these implementations are; in C/C++ we have the hardware
//   instruction PDEP/PEXT that makes Z-Order encoding and decoding, respectively, fast.
//
// - At the moment we only support type u32 in the function add(x: u32, y: u32) since
//   the z-value of two u32 will be u64 and we are storing them all in BigUint64Array.
//   The question is if we want to keep it that way or somehow try and support the
//   primitive JavaScript number data type.

export default class ZBush {
  #ids;
  #xs;
  #ys;
  #zs;
  #finished;

  constructor() {
    this.#xs = [];
    this.#ys = [];

    this.#finished = false;
  }

  // Adds a 2d point to the index. At the moment the x and y
  // coordinates must be non-negative and fit into a 32-bit
  // type as their 64-bit Z-value will be computed on them.
  //
  // Returns a non-negative increasing id per point added
  // which will be returned for found items in the search.
  //
  // REQUIRES: x >= 0, y >= 0
  // REQUIRES: x <= 2^32-1, y <= 2^32-1
  add(x, y) {
    this.#xs.push(x);
    this.#ys.push(y);

    this.#finished = false;

    return this.#xs.length - 1;
  }

  // Indexes all points added. If indexing happened before
  // already this function is a noop. Before searching this
  // function must have been called.
  finish() {
    if (this.#finished) {
      return;
    }

    const mapped = [];

    for (let i = 0; i < this.#xs.length; ++i) {
      const x = this.#xs[i];
      const y = this.#ys[i];

      if (!fitsUintN(32, x)) {
        throw new Error("can not index point that is not an integral type in [0, 2^32-1]");
      }

      if (!fitsUintN(32, y)) {
        throw new Error("can not index point that is not an integral type in [0, 2^32-1]");
      }

      mapped.push({i: i, z: zencode64(x, y) });
    }

    mapped.sort((a, b) => {
      if (a.z > b.z) return +1;
      else if (a.z < b.z) return -1;
      else return 0;
    });

    this.#ids = mapped.map((v) => v.i);
    this.#xs = mapped.map((v) => this.#xs[v.i]);
    this.#ys = mapped.map((v) => this.#ys[v.i]);
    this.#zs = new BigUint64Array(mapped.map((v) => v.z));

    this.#finished = true;
  }


  // Searches for points in a range.
  //
  // Returns an array of non-negative increasing ids found
  // in the range and indexed before.
  //
  // At the moment the four numbers delimiting the range
  // must be non-negative and fit into a 32-bit type as
  // a 64-bit Z-value will be computed on them.
  //
  // REQUIRES: xmin >= 0, xmin <= 2^32-1
  // REQUIRES: ymin >= 0, ymin <= 2^32-1
  // REQUIRES: xmax >= 0, xmax <= 2^32-1
  // REQUIRES: ymax >= 0, ymax <= 2^32-1
  range(xmin, ymin, xmax, ymax) {
    if (!this.#finished) {
      this.finish();
    }

    if (!fitsUintN(32, xmin) || !fitsUintN(32, ymin) || !fitsUintN(32, xmax) || !fitsUintN(32, ymax)) {
      throw new Error("can not range query with values that are not of integral type in [0, 2^32-1]");
    }

    const zmin = zencode64(xmin, ymin);
    const zmax = zencode64(xmax, ymax);

    let it = bsearchlt(this.#zs, 0, this.#zs.length, zmin);
    const last = bsearchlte(this.#zs, it, this.#zs.length, zmax);

    const results = [];

    while (it != last) {
      const x = this.#xs[it];
      const y = this.#ys[it];

      if (x >= xmin && x <= xmax && y >= ymin && y <= ymax) {
        results.push(this.#ids[it]);
        it += 1;
      } else {
        const znext = bigmin(this.#zs[it], zmin, zmax);
        it = bsearchlt(this.#zs, it, last, znext);
      }
    }

    return results;
  }

}; // class ZBush


// Checks that v can be represented as a unsigned BigInt with
// bits number of bits. For example fitsUintN(32, v) checks if
// v can be represented as a unsigned 32-bit integral type.
function fitsUintN(bits, v) {
  try {
    return BigInt.asUintN(bits, BigInt(v)) === BigInt(v);
  } catch (RangeError) {
    return false;
  }
}


// Maps two numbers on a one-dimensional Z-Order Curve.
//
// Returns the Z value as a 64-bit unsigned BigInt.
//
// The two numbers must be non-negative and fit into a
// 32-bit type as the return type is unsigned 64-bit.
//
// The reason for this is that efficient and compact
// storage can then happen in form of BigUint64Array.
//
// The Z-Order implementation below is translated from my work over at
// https://github.com/tinygraph/tinygraph/blob/5f7af38f99c3aeec64f136fe4284dbf36e3c625d/tinygraph/tinygraph-zorder.c
//
// REQUIRES: x >= 0, y >= 0
// REQUIRES: x <= 2^32-1, y <= 2^32-1
function zencode64(x, y) {
  x = BigInt.asUintN(32, BigInt(x));
  y = BigInt.asUintN(32, BigInt(y));

  return (bitblast32(y) << 1n) | bitblast32(x);
}

const bitblast4 = [
  0x00n, 0x01n, 0x04n, 0x05n, 0x10n, 0x11n, 0x14n, 0x15n,
  0x40n, 0x41n, 0x44n, 0x45n, 0x50n, 0x51n, 0x54n, 0x55n,
];

function bitblast8(x) {
  return (bitblast4[(x >> 0n) & 0xfn] << 0n)
       | (bitblast4[(x >> 4n) & 0xfn] << 8n);
}

function bitblast16(x) {
  return (bitblast8((x >> 0n) & 0xffn) << 0n)
       | (bitblast8((x >> 8n) & 0xffn) << 16n);
}

function bitblast32(x) {
  return (bitblast16((x >> 0n) & 0xffffn) << 0n)
       | (bitblast16((x >> 16n) & 0xffffn) << 32n);
}


// Simple binary search in an array a, in its
// sub-range [f, l] for value v comparing "<"
//
// The binary search implementation below is translated from my work over at
// https://github.com/tinygraph/tinygraph/blob/5f7af38f99c3aeec64f136fe4284dbf36e3c625d/tinygraph/tinygraph-index.c#L299-L351
//
// REQUIRES: f >= 0
// REQUIRES: f <= l
// REQUIRES: l <= a.length
function bsearchlt(a, f, l, v) {
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

// Simple binary search in an array a, in its
// sub-range [f, l] for value v comparing "<="
//
// The binary search implementation below is translated from my work over at
// https://github.com/tinygraph/tinygraph/blob/5f7af38f99c3aeec64f136fe4284dbf36e3c625d/tinygraph/tinygraph-index.c#L299-L351
//
// REQUIRES: f >= 0
// REQUIRES: f <= l
// REQUIRES: l <= a.length
function bsearchlte(a, f, l, v) {
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


// The BIGMIN, nextJumpIn, GetNextZ-Address optimization:
//
// With a value on the Z-Order Curve zval and a range of
// [zmin, zmax] this function returns the next value after
// zval that is again within the bounding box.
//
// Multidimensional Range Search in Dynamically Balanced Trees, H. Tropf, H. Herzog
// https://www.vision-tools.com/h-tropf/multidimensionalrangequery.pdf
// https://hermanntropf.de/media/multidimensionalrangequery.pdf
//
// The BIGMIN implementation below is translated from my work over at
// https://github.com/tinygraph/tinygraph/blob/5f7af38f99c3aeec64f136fe4284dbf36e3c625d/tinygraph/tinygraph-index.c#L353-408
//
// REQUIRES: zval >= zmin
// REQUIRES: zval < zmax
// REQUIRES: zmin <= zmax
function bigmin(zval, zmin, zmax) {
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
