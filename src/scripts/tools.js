import * as R from 'ramda';

const inverseScramble = R.pipe(
  R.reverse,
  R.map(R.ifElse(R.pipe(R.last, R.equals("'")), R.init, R.flip(R.concat)("'")))
);

const stripTopMovesLeft = R.ifElse(
  R.pipe(R.head, R.head, R.equals('U')),
  R.tail,
  R.identity
);

const transformScramble = R.pipe(
  R.split(' '),
  stripTopMovesLeft,
  inverseScramble,
  stripTopMovesLeft,
  R.join(' ')
);

const convertState = R.pipe(
  R.map(R.take(5)),
  ([e, c]) => {
    const co = R.move(
      0,
      -1,
      R.unnest(R.map((x) => [R.mathMod(x - 2, 5) + 1, x], c))
    );
    return R.unnest(R.times((i) => [co[i * 2], e[i], co[(i + 1) * 2 - 1]], 5));
  },
  R.concat(R.repeat(0, 11))
);

const stateConvert = R.pipe(R.drop(11), (x) => [
  R.times((y) => x[(y + 1) * 3 - 2], 5),
  R.times((y) => x[y * 3], 5),
]);

export { transformScramble, convertState };
