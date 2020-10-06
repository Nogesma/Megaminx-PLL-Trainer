#include <iostream>
#include <vector>
//#include <emscripten.h>

#include <chrono>
#include <random>
uint64_t seed = std::chrono::system_clock::now().time_since_epoch().count();
std::mt19937 mt(seed);
std::uniform_int_distribution<> dist(0, 7);

#include "pruning.h"
#include "puzzle.h"
#include "scramble.h"
#include "solver.h"

int main(int argc, char *argv[]) {
  loadPruningTables();
  std::cout << "done\n" << std::flush;
  Puzzle *p = new Puzzle();

  std::vector<int> edgesSet = {5, 2, 3, 1, 4, 6, 7, 8, 9};
  std::vector<int> cornersSet = {1, 2, 3, 4, 5, 6, 7, 8};

  p->set_EDGES_p(edgesSet);
  p->set_CORNERS_p(cornersSet);

  Scramble *scr = new Scramble();
  scr->state = p;
  scr->startDepth = 12;
  scr->maxDepth = 1000;
  scr->slack = 0;
  scr->maxSolutions = 1;

  Solver s(scr);
  s.solve();

  std::cout << s.solution << std::flush;
  return 0;
}
