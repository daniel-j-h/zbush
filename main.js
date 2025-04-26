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


function createIndex(lngs, lats, n) {
  const mapped = [];

  for (let i = 0; i < n; ++i) {
    mapped.push({
      i: i,
      lng: lngs[i],
      lat: lats[i],
      z: zencode64(lngs[i], lats[i]),
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
    lngs: mapped.map((v) => v.lng),
    lats: mapped.map((v) => v.lat),
    zvals: new BigUint64Array(mapped.map((v) => v.z)),
  };
}


function _bsearchlt(a, f, l, v) {
  f = BigInt(f);
  l = BigInt(l);

  let i = f, step = 0n, n = l - f;

  while (n > 0n) {
    step = n / 2n;
    i = f + step;

    if (a[i] < v) {  // lt
      f = i + 1n;
      n -= step + 1n;
    } else {
      n = step;
    }
  }

  return f;
}

function _bsearchlte(a, f, l, v) {
  f = BigInt(f);
  l = BigInt(l);

  let i = f, step = 0n, n = l - f;

  while (n > 0n) {
    step = n / 2n;
    i = f + step;

    if (a[i] <= v) {  // lte
      f = i + 1n;
      n -= step + 1n;
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


function queryIndex(zbush, lngmin, latmin, lngmax, latmax) {
  const results = [];

  const zmin = zencode64(lngmin, latmin);
  const zmax = zencode64(lngmax, latmax);

  let it = _bsearchlt(zbush.zvals, 0, zbush.length, zmin);
  const last = _bsearchlte(zbush.zvals, it, zbush.length, zmax);

  while (it != last) {
    const lng = zbush.lngs[it];
    const lat = zbush.lats[it];

    if (lng >= lngmin && lng <= lngmax && lat >= latmin && lat <= latmax) {
      const id = zbush.ids[it];

      results.push(id);

      it += 1n;
    } else {
      const znext = _bigmin(zbush.zvals[it], zmin, zmax);

      it = _bsearchlt(zbush.zvals, it, last, znext);
    }
  }

  return results;
}


const zbush = createIndex(
  /*lngs=*/ [0, 1, 2, 3, 4],
  /*lats=*/ [0, 1, 2, 3, 4],
  /*n=*/ 5);

const results = queryIndex(zbush, 2, 2, 3, 3);

console.log(results);
