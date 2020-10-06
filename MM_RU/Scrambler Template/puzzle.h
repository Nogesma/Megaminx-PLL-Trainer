/**********************************************
 * This code was generated by ksolve++ v1.0.0 *
 **********************************************/

#ifndef PUZZLE_H
#define PUZZLE_H

#include <sstream>

typedef char piece;

std::string printableMoveNames[8] = {"U", "U2", "U2'", "U'", "R", "R2", "R2'", "R'"};
std::string moveNames[8] = {"U", "U2", "U2'", "U'", "R", "R2", "R2'", "R'"};

int binomial[31][31] = {{1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0},{1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0},{1,2,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0},{1,3,3,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0},{1,4,6,4,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0},{1,5,10,10,5,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0},{1,6,15,20,15,6,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0},{1,7,21,35,35,21,7,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0},{1,8,28,56,70,56,28,8,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0},{1,9,36,84,126,126,84,36,9,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0},{1,10,45,120,210,252,210,120,45,10,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0},{1,11,55,165,330,462,462,330,165,55,11,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0},{1,12,66,220,495,792,924,792,495,220,66,12,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0},{1,13,78,286,715,1287,1716,1716,1287,715,286,78,13,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0},{1,14,91,364,1001,2002,3003,3432,3003,2002,1001,364,91,14,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0},{1,15,105,455,1365,3003,5005,6435,6435,5005,3003,1365,455,105,15,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0},{1,16,120,560,1820,4368,8008,11440,12870,11440,8008,4368,1820,560,120,16,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0},{1,17,136,680,2380,6188,12376,19448,24310,24310,19448,12376,6188,2380,680,136,17,1,0,0,0,0,0,0,0,0,0,0,0,0,0},{1,18,153,816,3060,8568,18564,31824,43758,48620,43758,31824,18564,8568,3060,816,153,18,1,0,0,0,0,0,0,0,0,0,0,0,0},{1,19,171,969,3876,11628,27132,50388,75582,92378,92378,75582,50388,27132,11628,3876,969,171,19,1,0,0,0,0,0,0,0,0,0,0,0},{1,20,190,1140,4845,15504,38760,77520,125970,167960,184756,167960,125970,77520,38760,15504,4845,1140,190,20,1,0,0,0,0,0,0,0,0,0,0},{1,21,210,1330,5985,20349,54264,116280,203490,293930,352716,352716,293930,203490,116280,54264,20349,5985,1330,210,21,1,0,0,0,0,0,0,0,0,0},{1,22,231,1540,7315,26334,74613,170544,319770,497420,646646,705432,646646,497420,319770,170544,74613,26334,7315,1540,231,22,1,0,0,0,0,0,0,0,0},{1,23,253,1771,8855,33649,100947,245157,490314,817190,1144066,1352078,1352078,1144066,817190,490314,245157,100947,33649,8855,1771,253,23,1,0,0,0,0,0,0,0},{1,24,276,2024,10626,42504,134596,346104,735471,1307504,1961256,2496144,2704156,2496144,1961256,1307504,735471,346104,134596,42504,10626,2024,276,24,1,0,0,0,0,0,0},{1,25,300,2300,12650,53130,177100,480700,1081575,2042975,3268760,4457400,5200300,5200300,4457400,3268760,2042975,1081575,480700,177100,53130,12650,2300,300,25,1,0,0,0,0,0},{1,26,325,2600,14950,65780,230230,657800,1562275,3124550,5311735,7726160,9657700,10400600,9657700,7726160,5311735,3124550,1562275,657800,230230,65780,14950,2600,325,26,1,0,0,0,0},{1,27,351,2925,17550,80730,296010,888030,2220075,4686825,8436285,13037895,17383860,20058300,20058300,17383860,13037895,8436285,4686825,2220075,888030,296010,80730,17550,2925,351,27,1,0,0,0},{1,28,378,3276,20475,98280,376740,1184040,3108105,6906900,13123110,21474180,30421755,37442160,40116600,37442160,30421755,21474180,13123110,6906900,3108105,1184040,376740,98280,20475,3276,378,28,1,0,0},{1,29,406,3654,23751,118755,475020,1560780,4292145,10015005,20030010,34597290,51895935,67863915,77558760,77558760,67863915,51895935,34597290,20030010,10015005,4292145,1560780,475020,118755,23751,3654,406,29,1,0},{1,30,435,4060,27405,142506,593775,2035800,5852925,14307150,30045015,54627300,86493225,119759850,145422675,155117520,145422675,119759850,86493225,54627300,30045015,14307150,5852925,2035800,593775,142506,27405,4060,435,30,1}};

class Puzzle{
public:
    Puzzle(){
        reset();
    }

    void reset(){
        EDGES_p[0] = 1;
        EDGES_p[1] = 2;
        EDGES_p[2] = 3;
        EDGES_p[3] = 4;
        EDGES_p[4] = 5;
        EDGES_p[5] = 6;
        EDGES_p[6] = 7;
        EDGES_p[7] = 8;
        EDGES_p[8] = 9;
        CORNERS_p[0] = 1;
        CORNERS_p[1] = 2;
        CORNERS_p[2] = 3;
        CORNERS_p[3] = 4;
        CORNERS_p[4] = 5;
        CORNERS_p[5] = 6;
        CORNERS_p[6] = 7;
        CORNERS_p[7] = 8;
        CORNERS_o[0] = 0;
        CORNERS_o[1] = 0;
        CORNERS_o[2] = 0;
        CORNERS_o[3] = 0;
        CORNERS_o[4] = 0;
        CORNERS_o[5] = 0;
        CORNERS_o[6] = 0;
        CORNERS_o[7] = 0;
    }

    void move_0_1(){ // U
        piece x;
        x = EDGES_p[0];
        EDGES_p[0] = EDGES_p[1];
        EDGES_p[1] = EDGES_p[2];
        EDGES_p[2] = EDGES_p[3];
        EDGES_p[3] = EDGES_p[4];
        EDGES_p[4] = x;
        x = CORNERS_p[0];
        CORNERS_p[0] = CORNERS_p[1];
        CORNERS_p[1] = CORNERS_p[2];
        CORNERS_p[2] = CORNERS_p[3];
        CORNERS_p[3] = CORNERS_p[4];
        CORNERS_p[4] = x;
        x = CORNERS_o[0];
        CORNERS_o[0] = CORNERS_o[1];
        CORNERS_o[1] = CORNERS_o[2];
        CORNERS_o[2] = CORNERS_o[3];
        CORNERS_o[3] = CORNERS_o[4];
        CORNERS_o[4] = x;
    }

    void move_0_2(){ // U2
        piece x;
        x = EDGES_p[0];
        EDGES_p[0] = EDGES_p[2];
        EDGES_p[2] = EDGES_p[4];
        EDGES_p[4] = EDGES_p[1];
        EDGES_p[1] = EDGES_p[3];
        EDGES_p[3] = x;
        x = CORNERS_p[0];
        CORNERS_p[0] = CORNERS_p[2];
        CORNERS_p[2] = CORNERS_p[4];
        CORNERS_p[4] = CORNERS_p[1];
        CORNERS_p[1] = CORNERS_p[3];
        CORNERS_p[3] = x;
        x = CORNERS_o[0];
        CORNERS_o[0] = CORNERS_o[2];
        CORNERS_o[2] = CORNERS_o[4];
        CORNERS_o[4] = CORNERS_o[1];
        CORNERS_o[1] = CORNERS_o[3];
        CORNERS_o[3] = x;
    }

    void move_0_3(){ // U2'
        piece x;
        x = EDGES_p[0];
        EDGES_p[0] = EDGES_p[3];
        EDGES_p[3] = EDGES_p[1];
        EDGES_p[1] = EDGES_p[4];
        EDGES_p[4] = EDGES_p[2];
        EDGES_p[2] = x;
        x = CORNERS_p[0];
        CORNERS_p[0] = CORNERS_p[3];
        CORNERS_p[3] = CORNERS_p[1];
        CORNERS_p[1] = CORNERS_p[4];
        CORNERS_p[4] = CORNERS_p[2];
        CORNERS_p[2] = x;
        x = CORNERS_o[0];
        CORNERS_o[0] = CORNERS_o[3];
        CORNERS_o[3] = CORNERS_o[1];
        CORNERS_o[1] = CORNERS_o[4];
        CORNERS_o[4] = CORNERS_o[2];
        CORNERS_o[2] = x;
    }

    void move_0_4(){ // U'
        piece x;
        x = EDGES_p[0];
        EDGES_p[0] = EDGES_p[4];
        EDGES_p[4] = EDGES_p[3];
        EDGES_p[3] = EDGES_p[2];
        EDGES_p[2] = EDGES_p[1];
        EDGES_p[1] = x;
        x = CORNERS_p[0];
        CORNERS_p[0] = CORNERS_p[4];
        CORNERS_p[4] = CORNERS_p[3];
        CORNERS_p[3] = CORNERS_p[2];
        CORNERS_p[2] = CORNERS_p[1];
        CORNERS_p[1] = x;
        x = CORNERS_o[0];
        CORNERS_o[0] = CORNERS_o[4];
        CORNERS_o[4] = CORNERS_o[3];
        CORNERS_o[3] = CORNERS_o[2];
        CORNERS_o[2] = CORNERS_o[1];
        CORNERS_o[1] = x;
    }

    void move_1_1(){ // R
        piece x;
        x = EDGES_p[4];
        EDGES_p[4] = EDGES_p[5];
        EDGES_p[5] = EDGES_p[6];
        EDGES_p[6] = EDGES_p[7];
        EDGES_p[7] = EDGES_p[8];
        EDGES_p[8] = x;
        x = CORNERS_p[3];
        CORNERS_p[3] = CORNERS_p[5];
        CORNERS_p[5] = CORNERS_p[6];
        CORNERS_p[6] = CORNERS_p[7];
        CORNERS_p[7] = CORNERS_p[4];
        CORNERS_p[4] = x;
        x = CORNERS_o[3];
        CORNERS_o[3] = (CORNERS_o[5]+1)%3;
        CORNERS_o[5] = (CORNERS_o[6]+2)%3;
        CORNERS_o[6] = CORNERS_o[7];
        CORNERS_o[7] = (CORNERS_o[4]+1)%3;
        CORNERS_o[4] = (x+2)%3;
    }

    void move_1_2(){ // R2
        piece x;
        x = EDGES_p[4];
        EDGES_p[4] = EDGES_p[6];
        EDGES_p[6] = EDGES_p[8];
        EDGES_p[8] = EDGES_p[5];
        EDGES_p[5] = EDGES_p[7];
        EDGES_p[7] = x;
        x = CORNERS_p[3];
        CORNERS_p[3] = CORNERS_p[6];
        CORNERS_p[6] = CORNERS_p[4];
        CORNERS_p[4] = CORNERS_p[5];
        CORNERS_p[5] = CORNERS_p[7];
        CORNERS_p[7] = x;
        x = CORNERS_o[3];
        CORNERS_o[3] = CORNERS_o[6];
        CORNERS_o[6] = (CORNERS_o[4]+1)%3;
        CORNERS_o[4] = CORNERS_o[5];
        CORNERS_o[5] = (CORNERS_o[7]+2)%3;
        CORNERS_o[7] = x;
    }

    void move_1_3(){ // R2'
        piece x;
        x = EDGES_p[4];
        EDGES_p[4] = EDGES_p[7];
        EDGES_p[7] = EDGES_p[5];
        EDGES_p[5] = EDGES_p[8];
        EDGES_p[8] = EDGES_p[6];
        EDGES_p[6] = x;
        x = CORNERS_p[3];
        CORNERS_p[3] = CORNERS_p[7];
        CORNERS_p[7] = CORNERS_p[5];
        CORNERS_p[5] = CORNERS_p[4];
        CORNERS_p[4] = CORNERS_p[6];
        CORNERS_p[6] = x;
        x = CORNERS_o[3];
        CORNERS_o[3] = CORNERS_o[7];
        CORNERS_o[7] = (CORNERS_o[5]+1)%3;
        CORNERS_o[5] = CORNERS_o[4];
        CORNERS_o[4] = (CORNERS_o[6]+2)%3;
        CORNERS_o[6] = x;
    }

    void move_1_4(){ // R'
        piece x;
        x = EDGES_p[4];
        EDGES_p[4] = EDGES_p[8];
        EDGES_p[8] = EDGES_p[7];
        EDGES_p[7] = EDGES_p[6];
        EDGES_p[6] = EDGES_p[5];
        EDGES_p[5] = x;
        x = CORNERS_p[3];
        CORNERS_p[3] = CORNERS_p[4];
        CORNERS_p[4] = CORNERS_p[7];
        CORNERS_p[7] = CORNERS_p[6];
        CORNERS_p[6] = CORNERS_p[5];
        CORNERS_p[5] = x;
        x = CORNERS_o[3];
        CORNERS_o[3] = (CORNERS_o[4]+1)%3;
        CORNERS_o[4] = (CORNERS_o[7]+2)%3;
        CORNERS_o[7] = CORNERS_o[6];
        CORNERS_o[6] = (CORNERS_o[5]+1)%3;
        CORNERS_o[5] = (x+2)%3;
    }

    void scramble(){
        int len = 10000 + dist(mt);
        for(int i=0; i<len; i++){
            doMove(dist(mt));
        }
    }

    void doMove(int move){
        if(move == 0) move_0_1();
        else if(move == 1) move_0_2();
        else if(move == 2) move_0_3();
        else if(move == 3) move_0_4();
        else if(move == 4) move_1_1();
        else if(move == 5) move_1_2();
        else if(move == 6) move_1_3();
        else if(move == 7) move_1_4();
    }

    bool solved(){
        return
        EDGES_p[0] == 1 &&
        EDGES_p[1] == 2 &&
        EDGES_p[2] == 3 &&
        EDGES_p[3] == 4 &&
        EDGES_p[4] == 5 &&
        EDGES_p[5] == 6 &&
        EDGES_p[6] == 7 &&
        EDGES_p[7] == 8 &&
        EDGES_p[8] == 9 &&
        CORNERS_p[0] == 1 &&
        CORNERS_p[1] == 2 &&
        CORNERS_p[2] == 3 &&
        CORNERS_p[3] == 4 &&
        CORNERS_p[4] == 5 &&
        CORNERS_p[5] == 6 &&
        CORNERS_p[6] == 7 &&
        CORNERS_p[7] == 8 &&
        CORNERS_o[0] == 0 &&
        CORNERS_o[1] == 0 &&
        CORNERS_o[2] == 0 &&
        CORNERS_o[3] == 0 &&
        CORNERS_o[4] == 0 &&
        CORNERS_o[5] == 0 &&
        CORNERS_o[6] == 0 &&
        CORNERS_o[7] == 0;
    }

    uint64_t encode_EDGES_p(){
        uint64_t t = 0;
        for(int i=0; i<8; i++){
            t *= 9-i;
            for(int j=i+1; j<9; j++){
                if(EDGES_p[i] > EDGES_p[j]) t++;
            }
        }
        return t;
    }

    void decode_EDGES_p(uint64_t t){
        EDGES_p[8] = 1;
        for(int i=7; i>=0; i--){
            EDGES_p[i] = 1+t%(9-i);
            t /= 9-i;
            for(int j=i+1; j<9; j++){
                if(EDGES_p[j] >= EDGES_p[i]) EDGES_p[j]++;
            }
        }
    }

    uint64_t encode_CORNERS_p(){
        uint64_t t = 0;
        for(int i=0; i<7; i++){
            t *= 8-i;
            for(int j=i+1; j<8; j++){
                if(CORNERS_p[i] > CORNERS_p[j]) t++;
            }
        }
        return t;
    }

    void decode_CORNERS_p(uint64_t t){
        CORNERS_p[7] = 1;
        for(int i=6; i>=0; i--){
            CORNERS_p[i] = 1+t%(8-i);
            t /= 8-i;
            for(int j=i+1; j<8; j++){
                if(CORNERS_p[j] >= CORNERS_p[i]) CORNERS_p[j]++;
            }
        }
    }

    uint64_t encode_CORNERS_o(){
        uint64_t t = 0;
        for(int i=0; i<7; i++){
            t = 3*t + CORNERS_o[i];
        }
        return t;
    }

    void decode_CORNERS_o(uint64_t t){
        char s = 0;
        for(int i=6; i>=0; i--){
            CORNERS_o[i] = t%3;
            s += 3 - CORNERS_o[i];
            t /= 3;
        }
        CORNERS_o[7] = s % 3;
    }

    void set_EDGES_p(std::vector<int> v){
        for(int i=0; i<9; i++){
            EDGES_p[i] = v[i];
        }
    }
    
    void set_CORNERS_p(std::vector<int> v){
        for(int i=0; i<8; i++){
            CORNERS_p[i] = v[i];
        }
    }
    
    void set_CORNERS_o(std::vector<int> v){
        for(int i=0; i<8; i++){
            CORNERS_o[i] = v[i];
        }
    }
    
    void print(){
        std::cout << "EDGES\n";
        for(int i=0; i<9; i++){
            std::cout << (int)EDGES_p[i] << " ";
        }
        std::cout << "\n";
        std::cout << "CORNERS\n";
        for(int i=0; i<8; i++){
            std::cout << (int)CORNERS_p[i] << " ";
        }
        std::cout << "\n";
        for(int i=0; i<8; i++){
            std::cout << (int)CORNERS_o[i] << " ";
        }
        std::cout << "\n";
        std::cout << "\n" << std::flush;
    }

private:
    piece EDGES_p[9];
    piece CORNERS_p[8];
    piece CORNERS_o[8];
};

#endif // PUZZLE_H
