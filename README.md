# ZBush

A very fast spatial index for 2D points based on a Z-Order space filling curve and BIGMIN search space pruning.

Note: The core ideas implemented here are very flexible and allow e.g. to index more dimensions than two, indexing more shapes and not just points, have a fast WebAssembly version, and more.
If you come across limitations or have use-cases not covered here, please do open an issue and let us know.


## Installation

We publish this project as the package [zbush](https://www.npmjs.com/package/zbush) on NPM

```
npm install zbush
```


## Usage

```ts
const index = new ZBush();

for (const {x, y} of items) {
  index.add(x, y);
}

index.finish();

const foundIds = index.range(minX, minY, maxX, maxY);
```

Note: at the moment the x and y coordinates of points added must be non-negative and fit into 32-bit.
We might relax this constraint in the future.


## How It Works

The ideas implemented here originated as experiments in [tinygraph.org](https://tinygraph.org) but really go back to the 80s.
If you are interested in a high-level overview on check out [my blog post](https://www.openstreetmap.org/user/daniel-j-h/diary/406584).

For experiments, context, implementation details, and ideas for further improvements
- https://github.com/tinygraph/tinygraph/issues/22
- https://github.com/tinygraph/tinygraph/pull/68
- https://github.com/tinygraph/tinygraph/issues/71
- https://github.com/tinygraph/tinygraph/issues/70
- https://github.com/tinygraph/tinygraph/blob/main/tinygraph/tinygraph-zorder.c
- https://github.com/tinygraph/tinygraph/blob/main/tinygraph/tinygraph-index.c


## Similar

Similar projects for point indices using R-Tree or KD-Tree data structures
- https://github.com/mourner/rbush
- https://github.com/mourner/kdbush
- https://github.com/mourner/flatbush


## Release

Checklist
- [] Bump version in `package.json`
- [] Tag the release `git tag vx.y.z -a`, `git push origin vx.y.z`
- [] Use NPM token and `npm publish` the [zbush package](https://www.npmjs.com/package/zbush)

```bash
npm set //registry.npmjs.org/:_authToken=$NPM_TOKEN
npm publish
```


## License

Copyright © 2025 Daniel J. H.

Distributed under the MIT License (MIT).
