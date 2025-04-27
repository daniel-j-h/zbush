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

  return (bitblast32(y) << 1n) | bitblast32(x);
}


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


export default class ZBush {
  constructor() {
    this.xs = [];
    this.ys = [];

    this.finished = false;
  }

  add(x, y) {
    this.xs.push(x);
    this.ys.push(y);

    this.finished = false;

    return this.xs.length - 1;
  }

  finish() {
    if (this.finished) {
      return;
    }

    const mapped = [];

    for (let i = 0; i < this.xs.length; ++i) {
      mapped.push({i: i, z: zencode64(this.xs[i], this.ys[i]) });
    }

    mapped.sort((a, b) => {
      if (a.z > b.z) return +1;
      else if (a.z < b.z) return -1;
      else return 0;
    });

    this.ids = mapped.map((v) => v.i);
    this.xs = mapped.map((v) => this.xs[v.i]);
    this.ys = mapped.map((v) => this.ys[v.i]);
    this.zs = new BigUint64Array(mapped.map((v) => v.z));

    this.finished = true;
  }

  range(xmin, ymin, xmax, ymax) {
    if (!this.finished) {
      this.finish();
    }

    const zmin = zencode64(xmin, ymin);
    const zmax = zencode64(xmax, ymax);

    let it = bsearchlt(this.zs, 0, this.zs.length, zmin);
    const last = bsearchlte(this.zs, it, this.zs.length, zmax);

    const results = [];

    while (it != last) {
      const x = this.xs[it];
      const y = this.ys[it];

      if (x >= xmin && x <= xmax && y >= ymin && y <= ymax) {
        results.push(this.ids[it]);
        it += 1;
      } else {
        const znext = bigmin(this.zs[it], zmin, zmax);
        it = bsearchlt(this.zs, it, last, znext);
      }
    }

    return results;
  }

}; // class ZBush


if (0) {
  const index = new ZBush();

  for (let i = 0; i < 10000000; ++i) {
    index.add(i, i);
  }

  console.log("creating..");
  index.finish();

  console.log("searching..");
  const ids = index.range(1024, 1024, 1024 + 64, 1024 + 64);
  console.log(ids);
}
