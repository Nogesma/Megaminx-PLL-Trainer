#ifndef SOLVER_H
#define SOLVER_H

#include "pruning.h"
#include "puzzle.h"
#include <stack>

class Solver {
public:
  Solver(Scramble *s) {
    scramble = s;
    puzzle = s->state;
  }

  void solve() {
    nodes = 0;
    numSolutions = 0;
    bool solved = false;
    int slackCounter = 0;

    if (EDGES_p_table[puzzle->encode_EDGES_p()] == -1) {
      std::cerr << "Found unsolvable piece set: EDGES_p\n";
      return;
    }
    if (CORNERS_p_table[puzzle->encode_CORNERS_p()] == -1) {
      std::cerr << "Found unsolvable piece set: CORNERS_p\n";
      return;
    }
    if (CORNERS_o_table[puzzle->encode_CORNERS_o()] == -1) {
      std::cerr << "Found unsolvable piece set: CORNERS_o\n";
      return;
    }

    time_t t = clock();
    for (int i = scramble->startDepth; i <= scramble->maxDepth; i++) {
      if (solved && slackCounter == scramble->slack)
        break;
      if (solved)
        slackCounter++;
      if (search(i))
        solved = true;
    }
  }

  bool search(int depth) {
    if (prune(puzzle, depth)) {
      return false;
    }

    bool s = false;
    puzzle->move_0_1(); // U
    soln.push(0);
    nodes++;
    if (search_move_0_1(depth - 1))
      s = true; // U
    soln.pop();
    puzzle->move_0_1(); // U
    soln.push(1);
    nodes++;
    if (search_move_0_2(depth - 1))
      s = true; // U2
    soln.pop();
    puzzle->move_0_1(); // U
    soln.push(2);
    nodes++;
    if (search_move_0_3(depth - 1))
      s = true; // U2'
    soln.pop();
    puzzle->move_0_1(); // U
    soln.push(3);
    nodes++;
    if (search_move_0_4(depth - 1))
      s = true; // U'
    soln.pop();
    puzzle->move_0_1(); // U
    puzzle->move_1_1(); // R
    soln.push(4);
    nodes++;
    if (search_move_1_1(depth - 1))
      s = true; // R
    soln.pop();
    puzzle->move_1_1(); // R
    soln.push(5);
    nodes++;
    if (search_move_1_2(depth - 1))
      s = true; // R2
    soln.pop();
    puzzle->move_1_1(); // R
    soln.push(6);
    nodes++;
    if (search_move_1_3(depth - 1))
      s = true; // R2'
    soln.pop();
    puzzle->move_1_1(); // R
    soln.push(7);
    nodes++;
    if (search_move_1_4(depth - 1))
      s = true; // R'
    soln.pop();
    puzzle->move_1_1(); // R
    return s;
  }

  bool search_move_0_1(int depth) { // U
    if (numSolutions == scramble->maxSolutions)
      return true;
    if (depth == 0)
      return checkSolved();
    if (prune(puzzle, depth))
      return false;

    bool s = false;
    puzzle->move_1_1(); // R
    soln.push(4);
    nodes++;
    if (search_move_1_1(depth - 1))
      s = true; // R
    soln.pop();
    puzzle->move_1_1(); // R
    soln.push(5);
    nodes++;
    if (search_move_1_2(depth - 1))
      s = true; // R2
    soln.pop();
    puzzle->move_1_1(); // R
    soln.push(6);
    nodes++;
    if (search_move_1_3(depth - 1))
      s = true; // R2'
    soln.pop();
    puzzle->move_1_1(); // R
    soln.push(7);
    nodes++;
    if (search_move_1_4(depth - 1))
      s = true; // R'
    soln.pop();
    puzzle->move_1_1(); // R
    return s;
  }

  bool search_move_0_2(int depth) { // U2
    if (numSolutions == scramble->maxSolutions)
      return true;
    if (depth == 0)
      return checkSolved();
    if (prune(puzzle, depth))
      return false;

    bool s = false;
    puzzle->move_1_1(); // R
    soln.push(4);
    nodes++;
    if (search_move_1_1(depth - 1))
      s = true; // R
    soln.pop();
    puzzle->move_1_1(); // R
    soln.push(5);
    nodes++;
    if (search_move_1_2(depth - 1))
      s = true; // R2
    soln.pop();
    puzzle->move_1_1(); // R
    soln.push(6);
    nodes++;
    if (search_move_1_3(depth - 1))
      s = true; // R2'
    soln.pop();
    puzzle->move_1_1(); // R
    soln.push(7);
    nodes++;
    if (search_move_1_4(depth - 1))
      s = true; // R'
    soln.pop();
    puzzle->move_1_1(); // R
    return s;
  }

  bool search_move_0_3(int depth) { // U2'
    if (numSolutions == scramble->maxSolutions)
      return true;
    if (depth == 0)
      return checkSolved();
    if (prune(puzzle, depth))
      return false;

    bool s = false;
    puzzle->move_1_1(); // R
    soln.push(4);
    nodes++;
    if (search_move_1_1(depth - 1))
      s = true; // R
    soln.pop();
    puzzle->move_1_1(); // R
    soln.push(5);
    nodes++;
    if (search_move_1_2(depth - 1))
      s = true; // R2
    soln.pop();
    puzzle->move_1_1(); // R
    soln.push(6);
    nodes++;
    if (search_move_1_3(depth - 1))
      s = true; // R2'
    soln.pop();
    puzzle->move_1_1(); // R
    soln.push(7);
    nodes++;
    if (search_move_1_4(depth - 1))
      s = true; // R'
    soln.pop();
    puzzle->move_1_1(); // R
    return s;
  }

  bool search_move_0_4(int depth) { // U'
    if (numSolutions == scramble->maxSolutions)
      return true;
    if (depth == 0)
      return checkSolved();
    if (prune(puzzle, depth))
      return false;

    bool s = false;
    puzzle->move_1_1(); // R
    soln.push(4);
    nodes++;
    if (search_move_1_1(depth - 1))
      s = true; // R
    soln.pop();
    puzzle->move_1_1(); // R
    soln.push(5);
    nodes++;
    if (search_move_1_2(depth - 1))
      s = true; // R2
    soln.pop();
    puzzle->move_1_1(); // R
    soln.push(6);
    nodes++;
    if (search_move_1_3(depth - 1))
      s = true; // R2'
    soln.pop();
    puzzle->move_1_1(); // R
    soln.push(7);
    nodes++;
    if (search_move_1_4(depth - 1))
      s = true; // R'
    soln.pop();
    puzzle->move_1_1(); // R
    return s;
  }

  bool search_move_1_1(int depth) { // R
    if (numSolutions == scramble->maxSolutions)
      return true;
    if (depth == 0)
      return checkSolved();
    if (prune(puzzle, depth))
      return false;

    bool s = false;
    puzzle->move_0_1(); // U
    soln.push(0);
    nodes++;
    if (search_move_0_1(depth - 1))
      s = true; // U
    soln.pop();
    puzzle->move_0_1(); // U
    soln.push(1);
    nodes++;
    if (search_move_0_2(depth - 1))
      s = true; // U2
    soln.pop();
    puzzle->move_0_1(); // U
    soln.push(2);
    nodes++;
    if (search_move_0_3(depth - 1))
      s = true; // U2'
    soln.pop();
    puzzle->move_0_1(); // U
    soln.push(3);
    nodes++;
    if (search_move_0_4(depth - 1))
      s = true; // U'
    soln.pop();
    puzzle->move_0_1(); // U
    return s;
  }

  bool search_move_1_2(int depth) { // R2
    if (numSolutions == scramble->maxSolutions)
      return true;
    if (depth == 0)
      return checkSolved();
    if (prune(puzzle, depth))
      return false;

    bool s = false;
    puzzle->move_0_1(); // U
    soln.push(0);
    nodes++;
    if (search_move_0_1(depth - 1))
      s = true; // U
    soln.pop();
    puzzle->move_0_1(); // U
    soln.push(1);
    nodes++;
    if (search_move_0_2(depth - 1))
      s = true; // U2
    soln.pop();
    puzzle->move_0_1(); // U
    soln.push(2);
    nodes++;
    if (search_move_0_3(depth - 1))
      s = true; // U2'
    soln.pop();
    puzzle->move_0_1(); // U
    soln.push(3);
    nodes++;
    if (search_move_0_4(depth - 1))
      s = true; // U'
    soln.pop();
    puzzle->move_0_1(); // U
    return s;
  }

  bool search_move_1_3(int depth) { // R2'
    if (numSolutions == scramble->maxSolutions)
      return true;
    if (depth == 0)
      return checkSolved();
    if (prune(puzzle, depth))
      return false;

    bool s = false;
    puzzle->move_0_1(); // U
    soln.push(0);
    nodes++;
    if (search_move_0_1(depth - 1))
      s = true; // U
    soln.pop();
    puzzle->move_0_1(); // U
    soln.push(1);
    nodes++;
    if (search_move_0_2(depth - 1))
      s = true; // U2
    soln.pop();
    puzzle->move_0_1(); // U
    soln.push(2);
    nodes++;
    if (search_move_0_3(depth - 1))
      s = true; // U2'
    soln.pop();
    puzzle->move_0_1(); // U
    soln.push(3);
    nodes++;
    if (search_move_0_4(depth - 1))
      s = true; // U'
    soln.pop();
    puzzle->move_0_1(); // U
    return s;
  }

  bool search_move_1_4(int depth) { // R'
    if (numSolutions == scramble->maxSolutions)
      return true;
    if (depth == 0)
      return checkSolved();
    if (prune(puzzle, depth))
      return false;

    bool s = false;
    puzzle->move_0_1(); // U
    soln.push(0);
    nodes++;
    if (search_move_0_1(depth - 1))
      s = true; // U
    soln.pop();
    puzzle->move_0_1(); // U
    soln.push(1);
    nodes++;
    if (search_move_0_2(depth - 1))
      s = true; // U2
    soln.pop();
    puzzle->move_0_1(); // U
    soln.push(2);
    nodes++;
    if (search_move_0_3(depth - 1))
      s = true; // U2'
    soln.pop();
    puzzle->move_0_1(); // U
    soln.push(3);
    nodes++;
    if (search_move_0_4(depth - 1))
      s = true; // U'
    soln.pop();
    puzzle->move_0_1(); // U
    return s;
  }

  bool checkSolved() {
    if (puzzle->solved()) {
      std::stack<int> soln2 = soln;
      std::string tempSolution = moveNames[soln2.top()];
      soln2.pop();
      while (!soln2.empty()) {
        tempSolution = moveNames[soln2.top()] + " " + tempSolution;
        soln2.pop();
      }

      solution = tempSolution;
      numSolutions++;
      return true;
    } else
      return false;
  }

  Scramble *scramble;
  Puzzle *puzzle;
  std::stack<int> soln;
  std::string solution;
  uint64_t nodes;
  int numSolutions;
};

#endif // SOLVER_H
