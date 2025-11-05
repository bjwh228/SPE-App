#include<bits/stdc++.h>
using namespace std;
string bat(long);
int main(){
    int n, k;
    cin >> n >> k;
    string first = "N";
    string second = "A";
    string cur = "";
    for(int i = 2; i < n; i++){
        cur = first + second;
        first = second;
        second = cur;
    }
    cout << cur[k-1];
}
