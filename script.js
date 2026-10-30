document.addEventListener("DOMContentLoaded", () => {
    const gameBoard = document.getElementById("game-board");
    const turnDisplay = document.getElementById("turn");
    const player1Progress = document.querySelector(".p1p progress");
    const player2Progress = document.querySelector(".p2p progress");
    const ROWS = 7;
    const COLS = 7;
    let currentPlayer = 1;
    let firstMove1 = true;
    let firstMove2 = true;
    const board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));

    function createBoard() {
        for (let row = 0; row < ROWS; row++) {
            for (let col = 0; col < COLS; col++) {
                const cell = document.createElement("div");
                cell.classList.add("cell");
                cell.dataset.row = row;
                cell.dataset.col = col;
                cell.addEventListener("click", handleCellClick);
                gameBoard.appendChild(cell);
            }
        }
    }

    function handleCellClick(event) {
        const cell = event.target.closest(".cell"); 
        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);

        if (isNaN(row) || isNaN(col) || row < 0 || row >= ROWS || col < 0 || col >= COLS) {
            return; 
        }

        if ((currentPlayer === 1 && firstMove1) || (currentPlayer === 2 && firstMove2)) {
            
            if (!board[row][col]) {
                placeCoin(cell, row, col);
                if (currentPlayer === 1) {
                    firstMove1 = false;
                } else {
                    firstMove2 = false;
                }
                switchTurn();
            }
        } else {
            const coin = board[row][col];
            if (coin && coin.player === currentPlayer) {
                incrementPoints(cell, row, col);
                switchTurn();
            }
        }

        updateProgress(); 
        checkGameOver(); 

        if (currentPlayer === 1) {
            document.querySelector('.player.player1c').style.backgroundColor = 'var(--p1)';
            document.querySelector('.player.player2c').style.backgroundColor = '';
        } else {
            document.querySelector('.player.player1c').style.backgroundColor = '';
            document.querySelector('.player.player2c').style.backgroundColor = 'var(--p2)';
        }
    }

    function placeCoin(cell, row, col) {
        board[row][col] = { player: currentPlayer, points: 1 };
        updateCell(cell, currentPlayer, 1);
    }

    function incrementPoints(cell, row, col) {
        const coin = board[row][col];
        coin.points++;
        if (coin.points >= 4) {
            coin.points = 1;
            spreadPoints(row, col, coin.player);
        }
        updateCell(cell, coin.player, coin.points);
    }

    function spreadPoints(row, col, player) {
        const directions = [
            [0, 1], [1, 0], [0, -1], [-1, 0]
        ];
    
        board[row][col] = null;
        const centerCell = document.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
        updateCell(centerCell, null, 0);
    
        directions.forEach(([dx, dy]) => {
            let newRow = row + dx;
            let newCol = col + dy;
    
            while (newRow >= 0 && newRow < ROWS && newCol >= 0 && newCol < COLS) {
                const adjacentCell = document.querySelector(`.cell[data-row="${newRow}"][data-col="${newCol}"]`);
                let adjacentCoin = board[newRow][newCol];
    
                if (!adjacentCoin) {
                    // Place a new coin if the cell is empty
                    adjacentCoin = { player: player, points: 1 };
                    board[newRow][newCol] = adjacentCoin;
                    updateCell(adjacentCell, player, 1);
                } else {
                    if (adjacentCoin.player !== player) {
                        // Spread points to the adjacent cell
                        adjacentCoin.player = player;
                        incrementPoints(adjacentCell, newRow, newCol);
                    }
                }
    
                // Check if the adjacent cell will spread further
                if (adjacentCoin.points < 4) {
                    break; // Stop spreading if points are less than 4
                }
    
                // Move to the next adjacent cell
                newRow += dx;
                newCol += dy;
            }
        });
    }
    
    
    function updateCell(cell, player, points) {
        if (points === 0 || points === null) {
            cell.className = 'cell';
            cell.innerHTML = '';
        } else {
            cell.className = `cell player${player}`;
            cell.innerHTML = '';
            for (let i = 0; i < points; i++) {
                const dot = document.createElement("div");
                dot.classList.add("dot");
                cell.appendChild(dot);
            }
        }
    }
        

    function switchTurn() {
        currentPlayer = currentPlayer === 1 ? 2 : 1;
        turnDisplay.textContent = `Player ${currentPlayer}'s Turn`;
    }

    function updateProgress() {
        const player1Coins = board.flat().filter(coin => coin && coin.player === 1).length;
        const player2Coins = board.flat().filter(coin => coin && coin.player === 2).length;
        if (player1Progress && player2Progress) {
            player1Progress.value = player1Coins;
            player2Progress.value = player2Coins;
        }
    }

    function checkGameOver() {
        const player1Coins = board.flat().filter(coin => coin && coin.player === 1).length;
        const player2Coins = board.flat().filter(coin => coin && coin.player === 2).length;

        if (!firstMove1 && !firstMove2) {
            if (player1Coins === 0) {
                turnDisplay.textContent = "Player 2 Wins!";
                document.querySelector('.player.player2c').style.backgroundColor = 'var(--theme)';
            } else if (player2Coins === 0) {
                turnDisplay.textContent = "Player 1 Wins!";
                document.querySelector('.player.player1c').style.backgroundColor = 'var(--theme)';
            }
        }
    }

    createBoard();
});


