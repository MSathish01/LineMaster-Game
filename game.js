class ShisimaGame {
    constructor() {
        this.board = Array(9).fill(null);
        this.currentPlayer = 1;
        this.phase = 'placement'; // 'placement' or 'movement'
        this.coinsPlaced = { 1: 0, 2: 0 };
        this.selectedCoin = null;
        this.gameMode = 'pvp'; // 'pvp' or 'pvc'
        this.gameOver = false;
        this.moveHistory = [];
        
        // Adjacent connections for each position
        this.adjacency = {
            0: [1, 3, 4],
            1: [0, 2, 4],
            2: [1, 4, 5],
            3: [0, 4, 6],
            4: [0, 1, 2, 3, 5, 6, 7, 8], // center connects to all
            5: [2, 4, 8],
            6: [3, 4, 7],
            7: [4, 6, 8],
            8: [4, 5, 7]
        };
        
        this.winPatterns = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
            [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
            [0, 4, 8], [2, 4, 6]              // diagonals
        ];
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.updateUI();
    }
    
    setupEventListeners() {
        // Mode selection
        document.getElementById('pvpMode').addEventListener('click', () => this.setMode('pvp'));
        document.getElementById('pvcMode').addEventListener('click', () => this.setMode('pvc'));
        
        // Board clicks for placement
        document.querySelectorAll('.node').forEach((node, index) => {
            node.addEventListener('click', () => this.handleNodeClick(index));
        });
        
        // Control buttons
        document.getElementById('resetBtn').addEventListener('click', () => this.reset());
        document.getElementById('undoBtn').addEventListener('click', () => this.undoMove());
        document.getElementById('playAgainBtn').addEventListener('click', () => this.reset());
        
        // Drag and drop setup
        this.setupDragAndDrop();
    }
    
    setupDragAndDrop() {
        let draggedCoin = null;
        let dragStartPos = null;
        let offset = { x: 0, y: 0 };
        
        document.addEventListener('mousedown', (e) => {
            if (this.phase !== 'movement' || this.gameOver) return;
            
            const coin = e.target.closest('.coin');
            if (coin && parseInt(coin.dataset.player) === this.currentPlayer) {
                draggedCoin = coin;
                dragStartPos = parseInt(coin.dataset.pos);
                
                const rect = coin.getBoundingClientRect();
                offset.x = e.clientX - rect.left - rect.width / 2;
                offset.y = e.clientY - rect.top - rect.height / 2;
                
                coin.classList.add('dragging');
                this.selectedCoin = dragStartPos;
                this.showValidMoves(dragStartPos);
            }
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!draggedCoin) return;
            
            const boardRect = document.getElementById('board').getBoundingClientRect();
            draggedCoin.style.left = (e.clientX - boardRect.left - offset.x) + 'px';
            draggedCoin.style.top = (e.clientY - boardRect.top - offset.y) + 'px';
        });
        
        document.addEventListener('mouseup', (e) => {
            if (!draggedCoin) return;
            
            const nodes = document.querySelectorAll('.node');
            let targetNode = null;
            let minDist = Infinity;
            
            nodes.forEach((node, index) => {
                const rect = node.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;
                const dist = Math.hypot(e.clientX - centerX, e.clientY - centerY);
                
                if (dist < minDist && dist < 80) {
                    minDist = dist;
                    targetNode = index;
                }
            });
            
            draggedCoin.classList.remove('dragging');
            
            if (targetNode !== null && this.isValidMove(dragStartPos, targetNode)) {
                this.moveCoin(dragStartPos, targetNode);
            } else {
                this.animateCoinToPosition(draggedCoin, dragStartPos);
            }
            
            this.clearValidMoves();
            draggedCoin = null;
            dragStartPos = null;
            this.selectedCoin = null;
        });
        
        // Touch support
        document.addEventListener('touchstart', (e) => {
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousedown', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            document.dispatchEvent(mouseEvent);
        });
        
        document.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousemove', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            document.dispatchEvent(mouseEvent);
        }, { passive: false });
        
        document.addEventListener('touchend', (e) => {
            const touch = e.changedTouches[0];
            const mouseEvent = new MouseEvent('mouseup', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            document.dispatchEvent(mouseEvent);
        });
    }
    
    setMode(mode) {
        this.gameMode = mode;
        document.getElementById('pvpMode').classList.toggle('active', mode === 'pvp');
        document.getElementById('pvcMode').classList.toggle('active', mode === 'pvc');
        this.reset();
    }
    
    handleNodeClick(position) {
        if (this.gameOver) return;
        
        if (this.phase === 'placement') {
            this.placeCoin(position);
        } else if (this.phase === 'movement') {
            if (this.selectedCoin === null) {
                // Select a coin
                if (this.board[position] === this.currentPlayer) {
                    this.selectedCoin = position;
                    this.showValidMoves(position);
                }
            } else {
                // Move the selected coin
                if (this.isValidMove(this.selectedCoin, position)) {
                    this.moveCoin(this.selectedCoin, position);
                    this.clearValidMoves();
                    this.selectedCoin = null;
                } else if (this.board[position] === this.currentPlayer) {
                    // Select different coin
                    this.clearValidMoves();
                    this.selectedCoin = position;
                    this.showValidMoves(position);
                } else {
                    this.clearValidMoves();
                    this.selectedCoin = null;
                }
            }
        }
    }
    
    placeCoin(position) {
        if (this.board[position] !== null) return;
        
        // Check if placement would create a win (not allowed in placement phase)
        const testBoard = [...this.board];
        testBoard[position] = this.currentPlayer;
        if (this.checkWin(testBoard, this.currentPlayer)) {
            this.showMessage("Cannot form a line during placement!");
            return;
        }
        
        this.board[position] = this.currentPlayer;
        this.coinsPlaced[this.currentPlayer]++;
        this.moveHistory.push({ type: 'place', player: this.currentPlayer, position });
        
        this.createCoin(position, this.currentPlayer);
        
        if (this.coinsPlaced[1] === 3 && this.coinsPlaced[2] === 3) {
            this.phase = 'movement';
        }
        
        this.switchPlayer();
        this.updateUI();
    }
    
    moveCoin(from, to) {
        if (!this.isValidMove(from, to)) return;
        
        this.moveHistory.push({ 
            type: 'move', 
            player: this.currentPlayer, 
            from, 
            to 
        });
        
        this.board[to] = this.board[from];
        this.board[from] = null;
        
        const coin = document.querySelector(`.coin[data-pos="${from}"]`);
        coin.dataset.pos = to;
        this.animateCoinToPosition(coin, to);
        
        if (this.checkWin(this.board, this.currentPlayer)) {
            this.endGame(this.currentPlayer);
            return;
        }
        
        this.switchPlayer();
        this.updateUI();
    }
    
    isValidMove(from, to) {
        if (this.board[to] !== null) return false;
        return this.adjacency[from].includes(to);
    }
    
    showValidMoves(position) {
        this.clearValidMoves();
        this.adjacency[position].forEach(pos => {
            if (this.board[pos] === null) {
                const node = document.querySelector(`.node[data-pos="${pos}"]`);
                node.classList.add('valid-move');
                this.createGhostCoin(pos, this.currentPlayer);
            }
        });
        this.highlightConnections(position);
    }
    
    clearValidMoves() {
        document.querySelectorAll('.node').forEach(node => {
            node.classList.remove('valid-move');
        });
        document.querySelectorAll('.ghost-coin').forEach(ghost => ghost.remove());
        this.clearHighlightedConnections();
    }
    
    highlightConnections(position) {
        const lines = document.querySelectorAll('.connection-line');
        // This is a simplified version - you could map specific lines to positions
        lines.forEach(line => line.classList.add('highlight'));
    }
    
    clearHighlightedConnections() {
        document.querySelectorAll('.connection-line').forEach(line => {
            line.classList.remove('highlight');
        });
    }
    
    createCoin(position, player) {
        const coin = document.createElement('div');
        coin.className = `coin player${player}`;
        coin.dataset.pos = position;
        coin.dataset.player = player;
        
        document.getElementById('board').appendChild(coin);
        
        // Animate in
        setTimeout(() => this.animateCoinToPosition(coin, position), 10);
    }
    
    createGhostCoin(position, player) {
        const ghost = document.createElement('div');
        ghost.className = `coin player${player} ghost-coin`;
        ghost.dataset.pos = position;
        
        document.getElementById('board').appendChild(ghost);
        this.animateCoinToPosition(ghost, position);
    }
    
    animateCoinToPosition(coin, position) {
        const node = document.querySelector(`.node[data-pos="${position}"]`);
        const rect = node.getBoundingClientRect();
        const boardRect = document.getElementById('board').getBoundingClientRect();
        
        const x = rect.left - boardRect.left + rect.width / 2 - 30;
        const y = rect.top - boardRect.top + rect.height / 2 - 30;
        
        coin.style.left = x + 'px';
        coin.style.top = y + 'px';
    }
    
    checkWin(board, player) {
        return this.winPatterns.some(pattern => 
            pattern.every(pos => board[pos] === player)
        );
    }
    
    endGame(winner) {
        this.gameOver = true;
        
        // Highlight winning coins
        const winningPattern = this.winPatterns.find(pattern =>
            pattern.every(pos => this.board[pos] === winner)
        );
        
        if (winningPattern) {
            winningPattern.forEach(pos => {
                const coin = document.querySelector(`.coin[data-pos="${pos}"]`);
                if (coin) coin.classList.add('winning');
            });
        }
        
        setTimeout(() => {
            const winnerName = winner === 1 ? 'Player 1' : 
                              (this.gameMode === 'pvc' ? 'Robot' : 'Player 2');
            document.getElementById('winMessage').textContent = `${winnerName} Wins!`;
            document.getElementById('winModal').classList.add('show');
        }, 500);
    }
    
    switchPlayer() {
        this.currentPlayer = this.currentPlayer === 1 ? 2 : 1;
        
        if (this.gameMode === 'pvc' && this.currentPlayer === 2 && !this.gameOver) {
            setTimeout(() => this.makeAIMove(), 500);
        }
    }
    
    makeAIMove() {
        if (this.phase === 'placement') {
            const move = this.getAIPlacementMove();
            if (move !== null) {
                this.placeCoin(move);
            }
        } else {
            const move = this.getAIMovementMove();
            if (move) {
                this.moveCoin(move.from, move.to);
            }
        }
    }
    
    getAIPlacementMove() {
        // Try to block opponent from winning
        for (let i = 0; i < 9; i++) {
            if (this.board[i] === null) {
                const testBoard = [...this.board];
                testBoard[i] = 1;
                if (this.checkWin(testBoard, 1)) {
                    // Block this position
                    const testBoard2 = [...this.board];
                    testBoard2[i] = 2;
                    if (!this.checkWin(testBoard2, 2)) {
                        return i;
                    }
                }
            }
        }
        
        // Prefer center
        if (this.board[4] === null) {
            const testBoard = [...this.board];
            testBoard[4] = 2;
            if (!this.checkWin(testBoard, 2)) return 4;
        }
        
        // Random valid move
        const validMoves = [];
        for (let i = 0; i < 9; i++) {
            if (this.board[i] === null) {
                const testBoard = [...this.board];
                testBoard[i] = 2;
                if (!this.checkWin(testBoard, 2)) {
                    validMoves.push(i);
                }
            }
        }
        
        return validMoves.length > 0 ? 
               validMoves[Math.floor(Math.random() * validMoves.length)] : null;
    }
    
    getAIMovementMove() {
        const moves = this.getAllPossibleMoves(2);
        
        // Check for winning move
        for (const move of moves) {
            const testBoard = [...this.board];
            testBoard[move.to] = testBoard[move.from];
            testBoard[move.from] = null;
            if (this.checkWin(testBoard, 2)) {
                return move;
            }
        }
        
        // Check for blocking move
        const opponentMoves = this.getAllPossibleMoves(1);
        for (const oppMove of opponentMoves) {
            const testBoard = [...this.board];
            testBoard[oppMove.to] = testBoard[oppMove.from];
            testBoard[oppMove.from] = null;
            if (this.checkWin(testBoard, 1)) {
                // Try to block by occupying the winning position
                for (const move of moves) {
                    if (move.to === oppMove.to) {
                        return move;
                    }
                }
            }
        }
        
        // Use minimax for best move
        let bestMove = null;
        let bestScore = -Infinity;
        
        for (const move of moves) {
            const testBoard = [...this.board];
            testBoard[move.to] = testBoard[move.from];
            testBoard[move.from] = null;
            
            const score = this.minimax(testBoard, 0, false, -Infinity, Infinity);
            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
        }
        
        return bestMove || (moves.length > 0 ? moves[0] : null);
    }
    
    getAllPossibleMoves(player) {
        const moves = [];
        for (let i = 0; i < 9; i++) {
            if (this.board[i] === player) {
                this.adjacency[i].forEach(adj => {
                    if (this.board[adj] === null) {
                        moves.push({ from: i, to: adj });
                    }
                });
            }
        }
        return moves;
    }
    
    minimax(board, depth, isMaximizing, alpha, beta) {
        if (this.checkWin(board, 2)) return 10 - depth;
        if (this.checkWin(board, 1)) return depth - 10;
        if (depth >= 4) return 0; // Depth limit
        
        const player = isMaximizing ? 2 : 1;
        const moves = [];
        
        for (let i = 0; i < 9; i++) {
            if (board[i] === player) {
                this.adjacency[i].forEach(adj => {
                    if (board[adj] === null) {
                        moves.push({ from: i, to: adj });
                    }
                });
            }
        }
        
        if (moves.length === 0) return 0;
        
        if (isMaximizing) {
            let maxScore = -Infinity;
            for (const move of moves) {
                const newBoard = [...board];
                newBoard[move.to] = newBoard[move.from];
                newBoard[move.from] = null;
                const score = this.minimax(newBoard, depth + 1, false, alpha, beta);
                maxScore = Math.max(maxScore, score);
                alpha = Math.max(alpha, score);
                if (beta <= alpha) break;
            }
            return maxScore;
        } else {
            let minScore = Infinity;
            for (const move of moves) {
                const newBoard = [...board];
                newBoard[move.to] = newBoard[move.from];
                newBoard[move.from] = null;
                const score = this.minimax(newBoard, depth + 1, true, alpha, beta);
                minScore = Math.min(minScore, score);
                beta = Math.min(beta, score);
                if (beta <= alpha) break;
            }
            return minScore;
        }
    }
    
    undoMove() {
        if (this.moveHistory.length === 0 || this.gameOver) return;
        
        const lastMove = this.moveHistory.pop();
        
        if (lastMove.type === 'place') {
            this.board[lastMove.position] = null;
            this.coinsPlaced[lastMove.player]--;
            const coin = document.querySelector(`.coin[data-pos="${lastMove.position}"]`);
            if (coin) coin.remove();
            
            if (this.phase === 'movement') {
                this.phase = 'placement';
            }
        } else if (lastMove.type === 'move') {
            this.board[lastMove.from] = lastMove.player;
            this.board[lastMove.to] = null;
            const coin = document.querySelector(`.coin[data-pos="${lastMove.to}"]`);
            if (coin) {
                coin.dataset.pos = lastMove.from;
                this.animateCoinToPosition(coin, lastMove.from);
            }
        }
        
        this.currentPlayer = lastMove.player;
        this.updateUI();
    }
    
    reset() {
        this.board = Array(9).fill(null);
        this.currentPlayer = 1;
        this.phase = 'placement';
        this.coinsPlaced = { 1: 0, 2: 0 };
        this.selectedCoin = null;
        this.gameOver = false;
        this.moveHistory = [];
        
        document.querySelectorAll('.coin').forEach(coin => coin.remove());
        document.getElementById('winModal').classList.remove('show');
        this.clearValidMoves();
        this.updateUI();
    }
    
    updateUI() {
        // Update player status
        document.getElementById('player1Status').classList.toggle('active', this.currentPlayer === 1);
        document.getElementById('player2Status').classList.toggle('active', this.currentPlayer === 2);
        
        // Update coins left
        document.getElementById('p1Coins').textContent = 
            this.phase === 'placement' ? `${3 - this.coinsPlaced[1]} coins left` : '3 coins';
        document.getElementById('p2Coins').textContent = 
            this.phase === 'placement' ? `${3 - this.coinsPlaced[2]} coins left` : '3 coins';
        
        // Update phase indicator
        document.getElementById('phaseIndicator').textContent = 
            this.phase === 'placement' ? 'Placement Phase' : 'Movement Phase';
        
        // Update undo button
        document.getElementById('undoBtn').disabled = this.moveHistory.length === 0 || this.gameOver;
        
        // Update message
        if (!this.gameOver) {
            const playerName = this.currentPlayer === 1 ? 'Player 1' : 
                              (this.gameMode === 'pvc' ? 'Robot' : 'Player 2');
            const action = this.phase === 'placement' ? 'place a coin' : 'move a coin';
            this.showMessage(`${playerName}'s turn to ${action}`);
        }
    }
    
    showMessage(text) {
        document.getElementById('message').textContent = text;
    }
}

// Initialize game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ShisimaGame();
});
