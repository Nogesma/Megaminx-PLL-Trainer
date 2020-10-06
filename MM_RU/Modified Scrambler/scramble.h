#ifndef SCRAMBLE_H
#define SCRAMBLE_H

class Scramble {
public:
  Puzzle *state;
  int startDepth;
  int maxDepth;
  int slack;
  int maxSolutions;
};

#endif // SCRAMBLE_H
