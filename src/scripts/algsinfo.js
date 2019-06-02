const algGroup = [
  {
    name: 'CPLL',
    cases: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
  },
  {
    name: 'EPLL',
    cases: [15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25],
  },
  {
    name: '1x3 Line',
    cases: [
      26,
      27,
      28,
      29,
      30,
      31,
      32,
      33,
      34,
      35,
      36,
      37,
      38,
      39,
      40,
      41,
      42,
      43,
      44,
    ],
  },
  {
    name: '2x2 Block',
    cases: [45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59],
  },
];

const algInfo = [
  {
    name: 'A1+',
    a: "(R' BR' R BR) (R' F' R BR') (R' BR F R)",
    a2: "F' R' F R U' R' F' R2 U R' U' R' F R",
  },
  {
    name: 'A1-',
    a: "(R' F' BR' R) (BR R' F R) (BR' R' BR R)",
    a2: "R' F' R U R U' R2' F R U R' F' R F",
  },
  {
    name: 'A2+',
    a: "BR' (R' U L U') (R' U L' U') R2 BR",
    a2: '',
  },
  {
    name: 'A2-',
    a: "BR' R2' (U L U' R) (U L' U' R) BR",
    a2: '',
  },
  {
    name: 'E1',
    a: "R' U' R' D' R U' R' D R U R' D' R U R' D R2",
    a2: "R U R' U R' U' R F' R U R' U' R' F R2 U' R2' U R",
  },
  {
    name: 'E2',
    a: "R2 U R' y (R U' R' U)3 y' R U' R2'",
    a2: '',
  },
  {
    name: 'E3',
    a: "L' R U R' (U R U' R')2 U R U2' R' L",
    a2: '',
  },
  {
    name: 'K1+',
    a: '',
    a2: '',
  },
  {
    name: 'K1-',
    a: '',
    a2: '',
  },
  {
    name: 'K2+',
    a: '',
    a2: '',
  },
  {
    name: 'K2-',
    a: '',
    a2: '',
  },
  {
    name: 'H1+',
    a: '',
    a2: '',
  },
  {
    name: 'H1-',
    a: '',
    a2: '',
  },
  {
    name: 'H2+',
    a: '',
    a2: '',
  },
  {
    name: 'H2-',
    a: '',
    a2: '',
  },
  {
    name: 'Q1+',
    a: '',
    a2: '',
  },
  {
    name: 'Q1-',
    a: '',
    a2: '',
  },
  {
    name: 'Q2+',
    a: '',
    a2: '',
  },
  {
    name: 'Q2-',
    a: '',
    a2: '',
  },
  {
    name: 'U1+',
    a: '',
    a2: '',
  },
  {
    name: 'U1-',
    a: '',
    a2: '',
  },
  {
    name: 'U2+',
    a: '',
    a2: '',
  },
  {
    name: 'U2-',
    a: '',
    a2: '',
  },
  {
    name: 'Z1',
    a: '',
    a2: '',
  },
  {
    name: 'Z2',
    a: '',
    a2: '',
  },
  {
    name: 'Z3',
    a: '',
    a2: '',
  },
  {
    name: 'D+',
    a: '',
    a2: '',
  },
  {
    name: 'D-',
    a: '',
    a2: '',
  },
  {
    name: 'F1+',
    a: '',
    a2: '',
  },
  {
    name: 'F1-',
    a: '',
    a2: '',
  },
  {
    name: 'F2+',
    a: '',
    a2: '',
  },
  {
    name: 'F2-',
    a: '',
    a2: '',
  },
  {
    name: 'F3+',
    a: '',
    a2: '',
  },
  {
    name: 'F3-',
    a: '',
    a2: '',
  },
  {
    name: 'F4+',
    a: '',
    a2: '',
  },
  {
    name: 'F4-',
    a: '',
    a2: '',
  },
  {
    name: 'F5+',
    a: '',
    a2: '',
  },
  {
    name: 'F5-',
    a: '',
    a2: '',
  },
  {
    name: 'J1+',
    a: '',
    a2: '',
  },
  {
    name: 'J1-',
    a: '',
    a2: '',
  },
  {
    name: 'J2+',
    a: '',
    a2: '',
  },
  {
    name: 'J2-',
    a: '',
    a2: '',
  },
  {
    name: 'J3+',
    a: '',
    a2: '',
  },
  {
    name: 'J3-',
    a: '',
    a2: '',
  },
  {
    name: 'M',
    a: '',
    a2: '',
  },
  {
    name: 'V1+',
    a: '',
    a2: '',
  },
  {
    name: 'V1-',
    a: '',
    a2: '',
  },
  {
    name: 'V2+',
    a: '',
    a2: '',
  },
  {
    name: 'V2-',
    a: '',
    a2: '',
  },
  {
    name: 'V3+',
    a: '',
    a2: '',
  },
  {
    name: 'V3-',
    a: '',
    a2: '',
  },
  {
    name: 'V4+',
    a: '',
    a2: '',
  },
  {
    name: 'V4-',
    a: '',
    a2: '',
  },
  {
    name: 'W',
    a: '',
    a2: '',
  },
  {
    name: 'Y1+',
    a: '',
    a2: '',
  },
  {
    name: 'Y1-',
    a: '',
    a2: '',
  },
  {
    name: 'Y2+',
    a: '',
    a2: '',
  },
  {
    name: 'Y2-',
    a: '',
    a2: '',
  },
  {
    name: 'Y3+',
    a: '',
    a2: '',
  },
  {
    name: 'Y3-',
    a: '',
    a2: '',
  },
];

export { algGroup, algInfo };
