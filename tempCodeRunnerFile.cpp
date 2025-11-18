#include<bits/stdc++.h>
using namespace std;

int main(){
    int n,m, s;
    cin >> n >> m >> s;
    vector<vector<int>> graph(n, vector<int>(m));
    for(int i = 0; i < n; i++){
        for(int j = 0; j < m; j++){
            cin >> graph[i][j];
        }
    }
     if(n == 1 && m == 1){
        cout << 0;
        return 0;
    }
    vector<vector<vector<int>>> dp(n, vector<vector<int>>(m, vector<int>(s+1, INT_MAX)));
    queue<vector<int>> q;
    vector<int> start = {0, 0, s-graph[0][0]};
    dp[0][0][s-graph[0][0]] = 0;
    q.push(start);
    int minPath = INT_MAX;
    while(!q.empty()){
        vector<int> cur = q.front();
        q.pop();
        int row = cur[0], col = cur[1], strength = cur[2];
        if(strength < 0) continue;
        int curPath = dp[row][col][strength];
        if(row == n-1 && col == m-1){
            minPath = min(minPath, curPath);
            continue;
        }
        //up
        int newRow = row -1;
        if(newRow >= 0){
            int newStrength = strength - graph[newRow][col];
            if(newStrength >= 0){
                if(curPath+1 < dp[newRow][col][newStrength]){
                    dp[newRow][col][newStrength] = curPath+1;
                    vector<int> next = {newRow, col, newStrength};
                    q.push(next);
                }
            }
        }
        //down
        newRow = row +1;
        if(newRow < n){
            int newStrength = strength - graph[newRow][col];
            if(newStrength >= 0){
                if(curPath+1 < dp[newRow][col][newStrength]){
                    dp[newRow][col][newStrength] = curPath+1;
                    vector<int> next = {newRow, col, newStrength};
                    q.push(next);
                }
            }
        }
        //left
        int newCol = col - 1;
        if(newCol >= 0){
            int newStrength = strength - graph[row][newCol];
            if(newStrength >= 0){
                if(curPath+1 < dp[row][newCol][newStrength]){
                    dp[row][newCol][newStrength] = curPath+1;
                    vector<int> next = {row, newCol, newStrength};
                    q.push(next);
                }
            }
        }
        //right
        newCol = col + 1;
        if(newCol < m){
            int newStrength = strength - graph[row][newCol];
            if(newStrength >= 0){
                if(curPath+1 < dp[row][newCol][newStrength]){
                    dp[row][newCol][newStrength] = curPath+1;
                    vector<int> next = {row, newCol, newStrength};
                    q.push(next);
                }
            }
        }
    }
    if(minPath == INT_MAX){
        cout << "-1";
        return 0;
    }
    cout << minPath;
}