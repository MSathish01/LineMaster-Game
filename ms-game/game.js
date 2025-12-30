class ShisimaGame {
    constructor() {
        this.board = Array(9).fill(null);
        this.currentPlayer = 1;
        this.phase = 'placement';
        this.coinsPlaced = { 1: 0, 2: 0 };
        this.selectedCoin = null;
        this.gameMode = 'pvp';
        this.gameOver = false;
        this.moveHistory = [];
        this.isDragging = false;
        this.isMobile = 'ontouchstart' in window;
        
        this.adjacency = {
            0: [1, 3, 4],
            1: [0, 2, 4],
            2: [1, 4, 5],
            3: [0, 4, 6],
            4: [0, 1, 2, 3, 5, 6, 7, 8],
            5: [2, 4, 8],
            6: [3, 4, 7],
            7: [4, 6, 8],
            8: [4, 5, 7]
        };
        
        this.winPatterns = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8],
            [0, 3, 6], [1, 4, 7], [2, 5, 8],
            [0, 4, 8], [2, 4, 6]
        ];
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.updateUI();
        window.addEventListener('resize', () => this.repositionAllCoins());
    }
    
    setupEventListeners() {
        document.getElementById('pvpMode').addEventListener('click', () => this.setMode('pvp'));
        document.getElementById('pvcMode').addEventListener('click', () => this.setMode('pvc'));
        
        document.querySelectorAll('.node').forEach((node, index) => {
            node.addEventListener('click', (e) => {
                if (!this.isDragging) this.handleNodeClick(index);
            });
            
            // Touch on nodes for placement
            node.addEventListener('touchend', (e) => {
                if (!this.isDragging && this.phase === 'placement') {
                    e.preventDefault();
                    this.handleNodeClick(index);
                }
            });
        });
        
        document.getElementById('resetBtn').addEventListener('click', () => this.reset());
        document.getElementById('undoBtn').addEventListener('click', () => this.undoMove());
        document.getElementById('playAgainBtn').addEventListener('click', () => this.reset());
        
        this.setupDragAndDrop();
    }
    
    setupDragAndDrop() {
        let draggedCoin = null;
        let dragStartPos = null;
        let startX, startY;
        let hasMoved = false;
        
        const getCoordinates = (e) => {
            if (e.touches && e.touches.length > 0) {
                return { x: e.touches[0].clientX, y: e.touches[0].clientY };
            } else if (e.changedTouches && e.changedTouches.length > 0) {
                return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
            }
            return { x: e.clientX, y: e.clientY };
        };
        
        const startDrag = (e) => {
            if (this.phase !== 'movement' || this.gameOver) return;
            
            const coords = getCoordinates(e);
            const target = document.elementFromPoint(coords.x, coords.y);
            const coin = target?.closest('.coin');
            
            if (coin && !coin.classList.contains('ghost-coin') && 
                parseInt(coin.dataset.player) === this.currentPlayer) {
                
                draggedCoin = coin;
                dragStartPos = parseInt(coin.dataset.pos);
                startX = coords.x;
                startY = coords.y;
                hasMoved = false;
                
                coin.classList.add('dragging');
                this.selectedCoin = dragStartPos;
                this.showValidMoves(dragStartPos);
                this.highlightSelectedCoin(dragStartPos);
                
                // Haptic feedback
                if (navigator.vibrate) navigator.vibrate(10);
            }
        };
        
        const moveDrag = (e) => {
            if (!draggedCoin) return;
            e.preventDefault();
            
            const coords = getCoordinates(e);
            const moveDistance = Math.hypot(coords.x - startX, coords.y - startY);
            
            if (moveDistance > 10) {
                hasMoved = true;
                this.isDragging = true;
            }
            
            if (hasMoved) {
                const boardRect = document.getElementById('board').getBoundingClientRect();
                const coinSize = draggedCoin.offsetWidth / 2;
                
                draggedCoin.style.left = (coords.x - boardRect.left - coinSize) + 'px';
                draggedCoin.style.top = (coords.y - boardRect.top - coinSize) + 'px';
            }
        };
        
        const endDrag = (e) => {
            if (!draggedCoin) return;
            
            const coords = getCoordinates(e);
            draggedCoin.classList.remove('dragging');
            
            if (hasMoved) {
                const nodes = document.querySelectorAll('.node');
                let targetNode = null;
                let minDist = Infinity;
                const snapDistance = this.isMobile ? 60 : 80;
                
                nodes.forEach((node, index) => {
                    const rect = node.getBoundingClientRect();
                    const centerX = rect.left + rect.width / 2;
                    const centerY = rect.top + rect.height / 2;
                    const dist = Math.hypot(coords.x - centerX, coords.y - centerY);
                    
                    if (dist < minDist && dist < snapDistance) {
                        minDist = dist;
                        targetNode = index;
                    }
                });
                
                if (targetNode !== null && this.isValidMove(dragStartPos, targetNode)) {
                    this.moveCoin(dragStartPos, targetNode);
                    if (navigator.vibrate) navigator.vibrate(20);
                } else {
                    this.animateCoinToPosition(draggedCoin, dragStartPos);
                }
            } else {
                // Tap without drag - toggle selection
                this.animateCoinToPosition(draggedCoin, dragStartPos);
            }
            
            this.clearValidMoves();
            this.clearSelectedCoin();
            
            setTimeout(() => { this.isDragging = false; }, 50);
            draggedCoin = null;
            dragStartPos = null;
            this.selectedCoin = null;
        };
        
        // Mouse events
        document.addEventListener('mousedown', startDrag);
        document.addEventListener('mousemove', moveDrag);
        document.addEventListener('mouseup', endDrag);
        
        // Touch events
        document.addEventListener('touchstart', startDrag, { passive: true });
        document.addEventListener('touchmove', moveDrag, { passive: false });
        document.addEventListener('touchend', endDrag);
        document.addEventListener('touchcancel', endDrag);
    }
    
    highlightSelectedCoin(position) {
        document.querySelectorAll('.coin').forEach(c => c.classList.remove('selected'));
        const coin = document.querySelector(`.coin[data-pos="${position}"]:not(.ghost-coin)`);
        if (coin) coin.classList.add('selected');
    }
    
    clearSelectedCoin() {
        document.querySelectorAll('.coin').forEach(c => c.classList.remove('selected'));
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
                if (this.board[position] === this.currentPlayer) {
                    this.selectedCoin = position;
                    this.showValidMoves(position);
                    this.highlightSelectedCoin(position);
                }
            } else {
                if (this.isValidMove(this.selectedCoin, position)) {
                    this.moveCoin(this.selectedCoin, position);
                    this.clearValidMoves();
                    this.clearSelectedCoin();
                    this.selectedCoin = null;
                } else if (this.board[position] === this.currentPlayer) {
                    this.clearValidMoves();
                    this.clearSelectedCoin();
                    this.selectedCoin = position;
                    this.showValidMoves(position);
                    this.highlightSelectedCoin(position);
                } else {
                    this.clearValidMoves();
                    this.clearSelectedCoin();
                    this.selectedCoin = null;
                }
            }
        }
    }
    
    placeCoin(position) {
        if (this.board[position] !== null) return;
        
        const testBoard = [...this.board];
        testBoard[position] = this.currentPlayer;
        if (this.checkWin(testBoard, this.currentPlayer)) {
            this.showMessage("Cannot form a line during placement!");
            if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
            return;
        }
        
        this.board[position] = this.currentPlayer;
        this.coinsPlaced[this.currentPlayer]++;
        this.moveHistory.push({ type: 'place', player: this.currentPlayer, position });
        
        this.createCoin(position, this.currentPlayer);
        if (navigator.vibrate) navigator.vibrate(15);
        
        if (this.coinsPlaced[1] === 3 && this.coinsPlaced[2] === 3) {
            this.phase = 'movement';
        }
        
        this.switchPlayer();
        this.updateUI();
    }
    
    moveCoin(from, to) {
        if (!this.isValidMove(from, to)) return;
        
        this.moveHistory.push({ type: 'move', player: this.currentPlayer, from, to });
        
        this.board[to] = this.board[from];
        this.board[from] = null;
        
        const coin = document.querySelector(`.coin[data-pos="${from}"]:not(.ghost-coin)`);
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
        document.querySelectorAll('.node').forEach(node => node.classList.remove('valid-move'));
        document.querySelectorAll('.ghost-coin').forEach(ghost => ghost.remove());
        this.clearHighlightedConnections();
    }
    
    highlightConnections(position) {
        document.querySelectorAll('.connection-line').forEach(line => line.classList.add('highlight'));
    }
    
    clearHighlightedConnections() {
        document.querySelectorAll('.connection-line').forEach(line => line.classList.remove('highlight'));
    }
    
    createCoin(position, player) {
        const coin = document.createElement('div');
        coin.className = `coin player${player}`;
        coin.dataset.pos = position;
        coin.dataset.player = player;
        
        document.getElementById('board').appendChild(coin);
        requestAnimationFrame(() => this.animateCoinToPosition(coin, position));
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
        
        const coinSize = coin.offsetWidth || 55;
        const x = rect.left - boardRect.left + rect.width / 2 - coinSize / 2;
        const y = rect.top - boardRect.top + rect.height / 2 - coinSize / 2;
        
        coin.style.left = x + 'px';
        coin.style.top = y + 'px';
    }
    
    repositionAllCoins() {
        document.querySelectorAll('.coin:not(.ghost-coin)').forEach(coin => {
            const pos = parseInt(coin.dataset.pos);
            this.animateCoinToPosition(coin, pos);
        });
    }
    
    checkWin(board, player) {
        return this.winPatterns.some(pattern => pattern.every(pos => board[pos] === player));
    }
    
    endGame(winner) {
        this.gameOver = true;
        
        const winningPattern = this.winPatterns.find(pattern =>
            pattern.every(pos => this.board[pos] === winner)
        );
        
        if (winningPattern) {
            winningPattern.forEach(pos => {
                const coin = document.querySelector(`.coin[data-pos="${pos}"]:not(.ghost-coin)`);
                if (coin) coin.classList.add('winning');
            });
        }
        
        if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 200]);
        
        setTimeout(() => {
            const winnerName = winner === 1 ? 'Player 1' : 
                              (this.gameMode === 'pvc' ? 'Robot' : 'Player 2');
            document.getElementById('winMessage').textContent = `${winnerName} Wins!`;
            document.getElementById('winModal').classList.add('show');
        }, 600);
    }
    
    switchPlayer() {
        this.currentPlayer = this.currentPlayer === 1 ? 2 : 1;
        
        if (this.gameMode === 'pvc' && this.currentPlayer === 2 && !this.gameOver) {
            setTimeout(() => this.makeAIMove(), 600);
        }
    }
    
    makeAIMove() {
        if (this.phase === 'placement') {
            const move = this.getAIPlacementMove();
            if (move !== null) this.placeCoin(move);
        } else {
            const move = this.getAIMovementMove();
            if (move) this.moveCoin(move.from, move.to);
        }
    }
    
    getAIPlacementMove() {
        for (let i = 0; i < 9; i++) {
            if (this.board[i] === null) {
                const testBoard = [...this.board];
                testBoard[i] = 1;
                if (this.checkWin(testBoard, 1)) {
                    const testBoard2 = [...this.board];
                    testBoard2[i] = 2;
                    if (!this.checkWin(testBoard2, 2)) return i;
                }
            }
        }
        
        if (this.board[4] === null) {
            const testBoard = [...this.board];
            testBoard[4] = 2;
            if (!this.checkWin(testBoard, 2)) return 4;
        }
        
        const validMoves = [];
        for (let i = 0; i < 9; i++) {
            if (this.board[i] === null) {
                const testBoard = [...this.board];
                testBoard[i] = 2;
                if (!this.checkWin(testBoard, 2)) validMoves.push(i);
            }
        }
        
        return validMoves.length > 0 ? validMoves[Math.floor(Math.random() * validMoves.length)] : null;
    }
    
    getAIMovementMove() {
        const moves = this.getAllPossibleMoves(2);
        
        for (const move of moves) {
            const testBoard = [...this.board];
            testBoard[move.to] = testBoard[move.from];
            testBoard[move.from] = null;
            if (this.checkWin(testBoard, 2)) return move;
        }
        
        const opponentMoves = this.getAllPossibleMoves(1);
        for (const oppMove of opponentMoves) {
            const testBoard = [...this.board];
            testBoard[oppMove.to] = testBoard[oppMove.from];
            testBoard[oppMove.from] = null;
            if (this.checkWin(testBoard, 1)) {
                for (const move of moves) {
                    if (move.to === oppMove.to) return move;
                }
            }
        }
        
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
                    if (this.board[adj] === null) moves.push({ from: i, to: adj });
                });
            }
        }
        return moves;
    }
    
    minimax(board, depth, isMaximizing, alpha, beta) {
        if (this.checkWin(board, 2)) return 10 - depth;
        if (this.checkWin(board, 1)) return depth - 10;
        if (depth >= 4) return 0;
        
        const player = isMaximizing ? 2 : 1;
        const moves = [];
        
        for (let i = 0; i < 9; i++) {
            if (board[i] === player) {
                this.adjacency[i].forEach(adj => {
                    if (board[adj] === null) moves.push({ from: i, to: adj });
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
            const coin = document.querySelector(`.coin[data-pos="${lastMove.position}"]:not(.ghost-coin)`);
            if (coin) coin.remove();
            
            if (this.phase === 'movement') this.phase = 'placement';
        } else if (lastMove.type === 'move') {
            this.board[lastMove.from] = lastMove.player;
            this.board[lastMove.to] = null;
            const coin = document.querySelector(`.coin[data-pos="${lastMove.to}"]:not(.ghost-coin)`);
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
        this.clearSelectedCoin();
        this.updateUI();
    }
    
    updateUI() {
        document.getElementById('player1Status').classList.toggle('active', this.currentPlayer === 1);
        document.getElementById('player2Status').classList.toggle('active', this.currentPlayer === 2);
        
        document.getElementById('p1Coins').textContent = 
            this.phase === 'placement' ? `${3 - this.coinsPlaced[1]} left` : '3 coins';
        document.getElementById('p2Coins').textContent = 
            this.phase === 'placement' ? `${3 - this.coinsPlaced[2]} left` : '3 coins';
        
        document.getElementById('phaseIndicator').textContent = 
            this.phase === 'placement' ? 'Place Coins' : 'Move Coins';
        
        document.getElementById('undoBtn').disabled = this.moveHistory.length === 0 || this.gameOver;
        
        if (!this.gameOver) {
            const playerName = this.currentPlayer === 1 ? 'Player 1' : 
                              (this.gameMode === 'pvc' ? 'Robot' : 'Player 2');
            const action = this.phase === 'placement' ? 'place' : 'move';
            this.showMessage(`${playerName}'s turn to ${action}`);
        }
    }
    
    showMessage(text) {
        document.getElementById('message').textContent = text;
    }
}

document.addEventListener('DOMContentLoaded', () => new ShisimaGame());
