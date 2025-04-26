# ZBush

A very fast static spatial index for 2D points based on a Z-Order space filling curve and BIGMIN search space pruning.

**Note: Work in Progress**


## Installation

tbd


## Usage

```ts
const index = new ZBush(1000);

for (const {x, y} of items) {
  index.add(x, y)
}

index.finish();

const foundIds = index.range(minX, minY, maxX, maxY)
```

## Similar

- https://github.com/mourner/rbush
- https://github.com/mourner/kdbush
- https://github.com/mourner/flatbush


## Release

```bash
npm set //registry.npmjs.org/:_authToken=$NPM_TOKEN
npm publish
```


## License

Copyright © 2025 Daniel J. H.

Distributed under the MIT License (MIT).
