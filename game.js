// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyDYtOcGPllr_3-9ZmVpkx-vVs2iIBZkA2I",
    authDomain: "linemaster-game.firebaseapp.com",
    databaseURL: "https://linemaster-game-default-rtdb.firebaseio.com",
    projectId: "linemaster-game",
    storageBucket: "linemaster-game.firebasestorage.app",
    messagingSenderId: "782658360944",
    appId: "1:782658360944:web:a1e8240dc058e0f6c306b5"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth();

class LineMaster {
    constructor() {
        this.board = Array(9).fill(null);
        this.turn = 1;
        this.phase = 'place';
        this.placed = [0, 0, 0];
        this.selected = null;
        this.mode = 'local';
        this.over = false;
        this.history = [];
        this.drag = null;
        this.names = ['', 'Player 1', 'Player 2'];
        
        // Online state
        this.roomId = null;
        this.playerId = null;
        this.roomRef = null;
        this.user = null;
        
        this.adj = {
            0:[1,3,4], 1:[0,2,4], 2:[1,4,5],
            3:[0,4,6], 4:[0,1,2,3,5,6,7,8], 5:[2,4,8],
            6:[3,4,7], 7:[4,6,8], 8:[4,5,7]
        };
        this.wins = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
        
        this.init();
    }
    
    init() {
        const params = new URLSearchParams(window.location.search);
        const roomCode = params.get('room');
        if (roomCode) {
            this.showScreen('onlineSetup');
            document.getElementById('roomCodeInput').value = roomCode;
        }
        
        auth.onAuthStateChanged(user => {
            this.user = user;
            this.updateUserUI();
        });
        
        this.bindEvents();
    }
    
    bindEvents() {
        document.getElementById('loginBtn').onclick = () => this.login();
        document.getElementById('localBtn').onclick = () => this.showScreen('localSetup');
        document.getElementById('onlineBtn').onclick = () => this.showScreen('onlineSetup');
        document.getElementById('robotBtn').onclick = () => this.startRobot();
        
        document.getElementById('localBack').onclick = () => this.showScreen('homeScreen');
        document.getElementById('startLocal').onclick = () => this.startLocal();
        
        document.getElementById('onlineBack').onclick = () => this.showScreen('homeScreen');
        document.getElementById('createRoom').onclick = () => this.createRoom();
        document.getElementById('joinRoom').onclick = () => this.joinRoom();
        document.getElementById('quickJoin').onclick = () => this.quickJoin();
        
        document.getElementById('copyCode').onclick = () => this.copyRoomCode();
        document.getElementById('shareLink').onclick = () => this.shareLink();
        document.getElementById('cancelWait').onclick = () => this.cancelRoom();
        
        document.getElementById('undoBtn').onclick = () => this.undo();
        document.getElementById('menuBtn').onclick = () => this.backToMenu();
        document.getElementById('againBtn').onclick = () => this.playAgain();
        document.getElementById('newBtn').onclick = () => this.backToMenu();
        
        this.bindBoardEvents();
    }
    
    showScreen(id) {
        document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
        document.getElementById(id).classList.remove('hidden');
    }
    
    updateUserUI() {
        const info = document.getElementById('userInfo');
        if (this.user) {
            info.innerHTML = `
                <div class="user-logged">
                    <img class="user-avatar" src="${this.user.photoURL || ''}" alt="">
                    <span class="user-name">${this.user.displayName || 'Player'}</span>
                    <button class="logout-btn" onclick="game.logout()">Logout</button>
                </div>`;
            document.getElementById('onlineName').value = this.user.displayName || 'Player';
        } else {
            info.innerHTML = `<button class="login-btn" id="loginBtn" onclick="game.login()">🔑 Sign in with Google</button>`;
        }
    }
    
    login() {
        const provider = new firebase.auth.GoogleAuthProvider();
        auth.signInWithPopup(provider).catch(e => {
            this.toast('Login failed');
            console.error(e);
        });
    }
    
    logout() {
        auth.signOut();
    }

    
    // Game Start Methods
    startLocal() {
        this.mode = 'local';
        this.names[1] = document.getElementById('p1Input').value || 'Player 1';
        this.names[2] = document.getElementById('p2Input').value || 'Player 2';
        this.resetGame();
        this.showScreen('gameScreen');
        document.getElementById('onlineIndicator').classList.add('hidden');
        this.updateUI();
    }
    
    startRobot() {
        this.mode = 'robot';
        this.names[1] = 'You';
        this.names[2] = 'Robot 🤖';
        this.resetGame();
        this.showScreen('gameScreen');
        document.getElementById('onlineIndicator').classList.add('hidden');
        this.updateUI();
    }
    
    resetGame() {
        this.board = Array(9).fill(null);
        this.turn = 1;
        this.phase = 'place';
        this.placed = [0, 0, 0];
        this.selected = null;
        this.over = false;
        this.history = [];
        document.querySelectorAll('.coin').forEach(c => c.remove());
        document.querySelectorAll('.node').forEach(n => n.classList.remove('valid'));
        document.getElementById('winModal').classList.remove('show');
    }
    
    // Online Room Methods
    createRoom() {
        const name = document.getElementById('onlineName').value || 'Player';
        this.roomId = this.generateCode();
        this.playerId = 1;
        this.names[1] = name;
        
        this.roomRef = db.ref('rooms/' + this.roomId);
        this.roomRef.set({
            host: name,
            hostId: this.user?.uid || 'guest_' + Date.now(),
            guest: null,
            board: [null,null,null,null,null,null,null,null,null],
            turn: 1,
            phase: 'place',
            placed1: 0,
            placed2: 0,
            status: 'waiting',
            created: Date.now()
        });
        
        document.getElementById('roomCodeDisplay').textContent = this.roomId;
        this.showScreen('waitingRoom');
        
        this.roomRef.on('value', snap => {
            const data = snap.val();
            if (!data) return;
            
            if (data.guest && data.status === 'waiting') {
                this.roomRef.update({ status: 'playing' });
                this.names[2] = data.guest;
                this.startOnlineGame();
            }
            
            if (data.status === 'playing') {
                this.syncGame(data);
            }
        });
    }
    
    joinRoom() {
        const code = document.getElementById('roomCodeInput').value.toUpperCase().trim();
        if (code.length !== 6) {
            this.toast('Enter 6-digit code');
            return;
        }
        
        const name = document.getElementById('onlineName').value || 'Player';
        this.roomId = code;
        this.playerId = 2;
        this.names[2] = name;
        
        this.roomRef = db.ref('rooms/' + this.roomId);
        this.roomRef.once('value').then(snap => {
            const data = snap.val();
            if (!data) {
                this.toast('Room not found');
                return;
            }
            if (data.guest) {
                this.toast('Room is full');
                return;
            }
            
            this.names[1] = data.host;
            this.roomRef.update({
                guest: name,
                guestId: this.user?.uid || 'guest_' + Date.now()
            });
            
            this.roomRef.on('value', snap => {
                const d = snap.val();
                if (d && d.status === 'playing') {
                    this.syncGame(d);
                }
            });
            
            this.startOnlineGame();
        });
    }
    
    generateCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
        return code;
    }
    
    quickJoin() {
        const name = document.getElementById('onlineName').value || 'Player';
        this.toast('Finding a game...');
        
        db.ref('rooms').orderByChild('status').equalTo('waiting').limitToFirst(10).once('value').then(snap => {
            const rooms = snap.val();
            if (!rooms) {
                this.toast('No rooms available. Creating one...');
                this.createRoom();
                return;
            }
            
            // Find first available room
            const roomIds = Object.keys(rooms);
            const now = Date.now();
            
            for (const roomId of roomIds) {
                const room = rooms[roomId];
                // Skip rooms older than 5 minutes
                if (now - room.created > 300000) continue;
                if (!room.guest) {
                    // Join this room
                    document.getElementById('roomCodeInput').value = roomId;
                    this.joinRoom();
                    return;
                }
            }
            
            // No available rooms, create one
            this.toast('No rooms available. Creating one...');
            this.createRoom();
        }).catch(err => {
            console.error(err);
            this.toast('Error finding rooms. Creating one...');
            this.createRoom();
        });
    }
    
    copyRoomCode() {
        navigator.clipboard.writeText(this.roomId);
        this.toast('Code copied!');
    }
    
    shareLink() {
        const url = `${window.location.origin}${window.location.pathname}?room=${this.roomId}`;
        if (navigator.share) {
            navigator.share({ title: 'LineMaster Game', text: 'Join my game!', url });
        } else {
            navigator.clipboard.writeText(url);
            this.toast('Link copied!');
        }
    }
    
    cancelRoom() {
        if (this.roomRef) {
            this.roomRef.off();
            if (this.playerId === 1) this.roomRef.remove();
        }
        this.roomRef = null;
        this.roomId = null;
        this.showScreen('homeScreen');
    }
    
    startOnlineGame() {
        this.mode = 'online';
        this.board = Array(9).fill(null);
        this.turn = 1;
        this.phase = 'place';
        this.placed = [0, 0, 0];
        this.selected = null;
        this.over = false;
        this.history = [];
        document.querySelectorAll('.coin').forEach(c => c.remove());
        document.querySelectorAll('.node').forEach(n => n.classList.remove('valid'));
        document.getElementById('winModal').classList.remove('show');
        
        this.showScreen('gameScreen');
        document.getElementById('onlineIndicator').classList.remove('hidden');
        this.updateUI();
        
        // Show whose turn it is
        if (this.playerId === 1) {
            this.toast("Your turn! Place a coin.");
        } else {
            this.toast("Waiting for opponent...");
        }
    }
    
    syncGame(data) {
        if (this.over) return;
        if (!data) return;
        
        // Update names
        if (data.host) this.names[1] = data.host;
        if (data.guest) this.names[2] = data.guest;
        
        // Get server state
        const serverBoard = data.board || [null,null,null,null,null,null,null,null,null];
        const serverTurn = data.turn || 1;
        const serverPhase = data.phase || 'place';
        const serverPlaced1 = data.placed1 || 0;
        const serverPlaced2 = data.placed2 || 0;
        
        // Check if server state is different
        const boardChanged = JSON.stringify(this.board) !== JSON.stringify(serverBoard);
        const turnChanged = this.turn !== serverTurn;
        
        if (boardChanged || turnChanged) {
            this.board = serverBoard;
            this.turn = serverTurn;
            this.phase = serverPhase;
            this.placed[1] = serverPlaced1;
            this.placed[2] = serverPlaced2;
            
            this.rebuildBoard();
            this.updateUI();
            
            // Notify player
            if (this.turn === this.playerId) {
                this.toast("Your turn!");
            }
        }
        
        if (data.winner && !this.over) {
            this.win(data.winner);
        }
    }
    
    rebuildBoard() {
        document.querySelectorAll('.coin').forEach(c => c.remove());
        this.board.forEach((p, i) => {
            if (p) this.createCoin(p, i, false);
        });
    }
    
    pushOnline() {
        if (this.mode !== 'online' || !this.roomRef) return;
        this.roomRef.update({
            board: this.board,
            turn: this.turn,
            phase: this.phase,
            placed1: this.placed[1],
            placed2: this.placed[2],
            winner: this.over ? (this.turn === 1 ? 2 : 1) : null
        });
    }

    
    // Board Events - Touch & Mouse
    bindBoardEvents() {
        const board = document.getElementById('board');
        
        // Touch events with passive: false
        board.addEventListener('touchstart', e => this.touchStart(e), { passive: false });
        board.addEventListener('touchmove', e => this.touchMove(e), { passive: false });
        board.addEventListener('touchend', e => this.touchEnd(e), { passive: false });
        
        // Mouse events
        board.addEventListener('mousedown', e => this.mouseDown(e));
        document.addEventListener('mousemove', e => this.mouseMove(e));
        document.addEventListener('mouseup', e => this.mouseUp(e));
        
        // Node clicks
        document.querySelectorAll('.node').forEach(node => {
            node.addEventListener('click', e => this.tapNode(parseInt(node.dataset.pos)));
        });
    }
    
    touchStart(e) {
        if (this.over) return;
        if (this.mode === 'online' && this.turn !== this.playerId) return;
        
        const touch = e.touches[0];
        const el = document.elementFromPoint(touch.clientX, touch.clientY);
        
        if (el && el.classList.contains('coin')) {
            const player = el.classList.contains('c1') ? 1 : 2;
            if (player === this.turn && this.phase === 'move') {
                e.preventDefault();
                this.startDrag(el, touch.clientX, touch.clientY);
            }
        }
    }
    
    touchMove(e) {
        if (!this.drag) return;
        e.preventDefault();
        const touch = e.touches[0];
        this.moveDrag(touch.clientX, touch.clientY);
    }
    
    touchEnd(e) {
        if (!this.drag) return;
        e.preventDefault();
        const touch = e.changedTouches[0];
        this.endDrag(touch.clientX, touch.clientY);
    }
    
    mouseDown(e) {
        if (this.over) return;
        if (this.mode === 'online' && this.turn !== this.playerId) return;
        
        const el = e.target;
        if (el.classList.contains('coin')) {
            const player = el.classList.contains('c1') ? 1 : 2;
            if (player === this.turn && this.phase === 'move') {
                e.preventDefault();
                this.startDrag(el, e.clientX, e.clientY);
            }
        }
    }
    
    mouseMove(e) {
        if (!this.drag) return;
        this.moveDrag(e.clientX, e.clientY);
    }
    
    mouseUp(e) {
        if (!this.drag) return;
        this.endDrag(e.clientX, e.clientY);
    }
    
    startDrag(coin, x, y) {
        const pos = parseInt(coin.dataset.pos);
        if (this.board[pos] !== this.turn) return;
        
        this.drag = {
            coin,
            from: pos,
            startX: x,
            startY: y,
            origLeft: coin.offsetLeft,
            origTop: coin.offsetTop
        };
        
        coin.classList.add('dragging');
        coin.style.transition = 'none';
        this.select(pos);
        this.haptic();
    }
    
    moveDrag(x, y) {
        if (!this.drag) return;
        
        const dx = x - this.drag.startX;
        const dy = y - this.drag.startY;
        
        this.drag.coin.style.left = (this.drag.origLeft + dx) + 'px';
        this.drag.coin.style.top = (this.drag.origTop + dy) + 'px';
    }
    
    endDrag(x, y) {
        if (!this.drag) return;
        
        const coin = this.drag.coin;
        const from = this.drag.from;
        
        coin.classList.remove('dragging');
        coin.style.transition = '';
        
        // Find closest valid node
        const board = document.getElementById('board');
        const rect = board.getBoundingClientRect();
        const nodes = document.querySelectorAll('.node');
        
        let closest = null;
        let minDist = 60; // Snap threshold
        
        nodes.forEach(node => {
            const pos = parseInt(node.dataset.pos);
            if (!this.adj[from].includes(pos) || this.board[pos] !== null) return;
            
            const nRect = node.getBoundingClientRect();
            const nx = nRect.left + nRect.width / 2;
            const ny = nRect.top + nRect.height / 2;
            const dist = Math.hypot(x - nx, y - ny);
            
            if (dist < minDist) {
                minDist = dist;
                closest = pos;
            }
        });
        
        if (closest !== null) {
            this.move(from, closest);
        } else {
            this.reposition(coin, from);
        }
        
        this.clearSel();
        this.drag = null;
    }
    
    tapNode(pos) {
        if (this.over) return;
        
        // Online mode: only allow moves on your turn
        if (this.mode === 'online') {
            if (this.turn !== this.playerId) {
                this.toast("Wait for your turn!");
                return;
            }
        }
        
        if (this.phase === 'place') {
            if (this.board[pos] === null) {
                this.place(pos);
            }
        } else {
            if (this.selected !== null) {
                if (this.adj[this.selected].includes(pos) && this.board[pos] === null) {
                    this.move(this.selected, pos);
                    this.clearSel();
                } else if (this.board[pos] === this.turn) {
                    this.select(pos);
                } else {
                    this.clearSel();
                }
            } else if (this.board[pos] === this.turn) {
                this.select(pos);
            }
        }
    }
    
    select(pos) {
        this.clearSel();
        this.selected = pos;
        
        const coin = document.querySelector(`.coin[data-pos="${pos}"]`);
        if (coin) coin.classList.add('selected');
        
        this.showMoves(pos);
        this.haptic();
    }
    
    clearSel() {
        this.selected = null;
        document.querySelectorAll('.coin').forEach(c => c.classList.remove('selected'));
        document.querySelectorAll('.node').forEach(n => n.classList.remove('valid'));
        document.querySelectorAll('.coin.ghost').forEach(g => g.remove());
    }
    
    showMoves(pos) {
        this.adj[pos].forEach(to => {
            if (this.board[to] === null) {
                document.querySelector(`.node[data-pos="${to}"]`).classList.add('valid');
                
                // Ghost coin
                const ghost = document.createElement('div');
                ghost.className = `coin c${this.turn} ghost`;
                this.position(ghost, to);
                document.getElementById('board').appendChild(ghost);
            }
        });
    }

    
    // Game Logic
    place(pos) {
        if (this.board[pos] !== null) return;
        if (this.placed[this.turn] >= 3) return;
        
        // Check if placing would create a win (not allowed in placement phase)
        this.board[pos] = this.turn;
        if (this.checkWin(this.turn)) {
            this.board[pos] = null;
            this.toast("Can't win during placement!");
            return;
        }
        
        this.history.push({ type: 'place', pos, turn: this.turn });
        this.placed[this.turn]++;
        
        this.createCoin(this.turn, pos, true);
        this.haptic();
        
        // Check if placement phase is over
        if (this.placed[1] === 3 && this.placed[2] === 3) {
            this.phase = 'move';
        }
        
        this.next();
    }
    
    move(from, to) {
        if (this.board[from] !== this.turn) return;
        if (this.board[to] !== null) return;
        if (!this.adj[from].includes(to)) return;
        
        this.history.push({ type: 'move', from, to, turn: this.turn });
        
        this.board[to] = this.board[from];
        this.board[from] = null;
        
        const coin = document.querySelector(`.coin[data-pos="${from}"]`);
        if (coin) {
            coin.dataset.pos = to;
            this.reposition(coin, to);
        }
        
        this.haptic();
        
        if (this.checkWin(this.turn)) {
            this.win(this.turn);
            return;
        }
        
        this.next();
    }
    
    createCoin(player, pos, animate) {
        const coin = document.createElement('div');
        coin.className = `coin c${player}`;
        if (animate) coin.classList.add('placing');
        coin.dataset.pos = pos;
        
        // Touch events on coin
        coin.addEventListener('touchstart', e => {
            if (this.over) return;
            if (this.mode === 'online' && this.turn !== this.playerId) return;
            if (this.phase !== 'move') return;
            
            const p = coin.classList.contains('c1') ? 1 : 2;
            if (p !== this.turn) return;
            
            e.preventDefault();
            e.stopPropagation();
            const touch = e.touches[0];
            this.startDrag(coin, touch.clientX, touch.clientY);
        }, { passive: false });
        
        coin.addEventListener('click', e => {
            if (this.over) return;
            if (this.mode === 'online' && this.turn !== this.playerId) return;
            if (this.phase !== 'move') return;
            
            const p = coin.classList.contains('c1') ? 1 : 2;
            if (p === this.turn) {
                this.select(parseInt(coin.dataset.pos));
            }
        });
        
        this.position(coin, pos);
        document.getElementById('board').appendChild(coin);
    }
    
    position(coin, pos) {
        const board = document.getElementById('board');
        const node = document.querySelector(`.node[data-pos="${pos}"]`);
        
        const bRect = board.getBoundingClientRect();
        const nRect = node.getBoundingClientRect();
        
        const coinSize = coin.classList.contains('ghost') ? 46 : 46;
        const left = nRect.left - bRect.left + nRect.width / 2 - coinSize / 2;
        const top = nRect.top - bRect.top + nRect.height / 2 - coinSize / 2;
        
        coin.style.left = left + 'px';
        coin.style.top = top + 'px';
    }
    
    reposition(coin, pos) {
        coin.style.transition = 'left 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), top 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)';
        this.position(coin, pos);
    }
    
    checkWin(player) {
        return this.wins.some(w => w.every(i => this.board[i] === player));
    }
    
    win(player) {
        this.over = true;
        
        // Highlight winning coins
        this.wins.forEach(w => {
            if (w.every(i => this.board[i] === player)) {
                w.forEach(i => {
                    const coin = document.querySelector(`.coin[data-pos="${i}"]`);
                    if (coin) coin.classList.add('win');
                });
            }
        });
        
        setTimeout(() => {
            document.getElementById('winText').textContent = `${this.names[player]} Wins!`;
            document.getElementById('winModal').classList.add('show');
        }, 800);
        
        this.pushOnline();
    }
    
    next() {
        this.turn = this.turn === 1 ? 2 : 1;
        this.updateUI();
        this.pushOnline();
        
        // Robot move
        if (this.mode === 'robot' && this.turn === 2 && !this.over) {
            setTimeout(() => this.ai(), 500);
        }
    }
    
    // AI Logic
    ai() {
        if (this.over) return;
        
        if (this.phase === 'place') {
            this.aiPlace();
        } else {
            this.aiMove();
        }
    }
    
    aiPlace() {
        const empty = this.board.map((v, i) => v === null ? i : -1).filter(i => i >= 0);
        
        // Try to block player win
        for (const pos of empty) {
            this.board[pos] = 1;
            if (this.checkWin(1)) {
                this.board[pos] = null;
                // Try to place here if it doesn't win for us
                this.board[pos] = 2;
                if (!this.checkWin(2)) {
                    this.board[pos] = null;
                    this.place(pos);
                    return;
                }
                this.board[pos] = null;
            }
            this.board[pos] = null;
        }
        
        // Prefer center
        if (this.board[4] === null) {
            this.board[4] = 2;
            if (!this.checkWin(2)) {
                this.board[4] = null;
                this.place(4);
                return;
            }
            this.board[4] = null;
        }
        
        // Random valid spot
        const valid = empty.filter(pos => {
            this.board[pos] = 2;
            const wins = this.checkWin(2);
            this.board[pos] = null;
            return !wins;
        });
        
        if (valid.length > 0) {
            this.place(valid[Math.floor(Math.random() * valid.length)]);
        }
    }
    
    aiMove() {
        const moves = this.getMoves(2);
        if (moves.length === 0) return;
        
        // Check for winning move
        for (const [from, to] of moves) {
            this.board[to] = 2;
            this.board[from] = null;
            if (this.checkWin(2)) {
                this.board[from] = 2;
                this.board[to] = null;
                this.select(from);
                setTimeout(() => {
                    this.move(from, to);
                    this.clearSel();
                }, 300);
                return;
            }
            this.board[from] = 2;
            this.board[to] = null;
        }
        
        // Block player winning move
        const playerMoves = this.getMoves(1);
        for (const [pf, pt] of playerMoves) {
            this.board[pt] = 1;
            this.board[pf] = null;
            if (this.checkWin(1)) {
                this.board[pf] = 1;
                this.board[pt] = null;
                
                // Find a move that blocks
                for (const [from, to] of moves) {
                    if (to === pt) {
                        this.select(from);
                        setTimeout(() => {
                            this.move(from, to);
                            this.clearSel();
                        }, 300);
                        return;
                    }
                }
            }
            this.board[pf] = 1;
            this.board[pt] = null;
        }
        
        // Random move
        const [from, to] = moves[Math.floor(Math.random() * moves.length)];
        this.select(from);
        setTimeout(() => {
            this.move(from, to);
            this.clearSel();
        }, 300);
    }
    
    getMoves(player) {
        const moves = [];
        this.board.forEach((v, i) => {
            if (v === player) {
                this.adj[i].forEach(j => {
                    if (this.board[j] === null) moves.push([i, j]);
                });
            }
        });
        return moves;
    }

    
    // UI & Utility
    updateUI() {
        const p1 = document.getElementById('p1Panel');
        const p2 = document.getElementById('p2Panel');
        
        p1.classList.toggle('active', this.turn === 1);
        p2.classList.toggle('active', this.turn === 2);
        
        document.getElementById('p1Name').textContent = this.names[1];
        document.getElementById('p2Name').textContent = this.names[2];
        
        const p1Left = 3 - this.placed[1];
        const p2Left = 3 - this.placed[2];
        
        document.getElementById('p1Status').textContent = 
            this.phase === 'place' ? `${p1Left} coin${p1Left !== 1 ? 's' : ''} left` : 'Move phase';
        document.getElementById('p2Status').textContent = 
            this.phase === 'place' ? `${p2Left} coin${p2Left !== 1 ? 's' : ''} left` : 'Move phase';
        
        document.getElementById('phaseText').textContent = 
            this.phase === 'place' ? 'Place your coins' : 'Move to align 3';
        
        document.getElementById('undoBtn').disabled = 
            this.history.length === 0 || this.mode === 'online';
    }
    
    undo() {
        if (this.history.length === 0) return;
        if (this.mode === 'online') return;
        if (this.over) return;
        
        const last = this.history.pop();
        
        if (last.type === 'place') {
            this.board[last.pos] = null;
            this.placed[last.turn]--;
            const coin = document.querySelector(`.coin[data-pos="${last.pos}"]`);
            if (coin) coin.remove();
            if (this.phase === 'move') this.phase = 'place';
        } else {
            this.board[last.from] = last.turn;
            this.board[last.to] = null;
            const coin = document.querySelector(`.coin[data-pos="${last.to}"]`);
            if (coin) {
                coin.dataset.pos = last.from;
                this.reposition(coin, last.from);
            }
        }
        
        this.turn = last.turn;
        this.updateUI();
    }
    
    playAgain() {
        document.getElementById('winModal').classList.remove('show');
        this.resetGame();
        
        if (this.mode === 'online' && this.roomRef) {
            this.roomRef.update({
                board: [null,null,null,null,null,null,null,null,null],
                turn: 1,
                phase: 'place',
                placed1: 0,
                placed2: 0,
                winner: null
            });
        }
        
        this.updateUI();
    }
    
    backToMenu() {
        document.getElementById('winModal').classList.remove('show');
        
        if (this.roomRef) {
            this.roomRef.off();
            this.roomRef = null;
        }
        this.roomId = null;
        
        // Clear URL params
        window.history.replaceState({}, '', window.location.pathname);
        
        this.showScreen('homeScreen');
    }
    
    toast(msg) {
        const t = document.getElementById('toast');
        t.textContent = msg;
        t.classList.remove('hidden');
        setTimeout(() => t.classList.add('hidden'), 2500);
    }
    
    haptic() {
        if (navigator.vibrate) navigator.vibrate(10);
    }
}

// Initialize game
const game = new LineMaster();

// Handle window resize
window.addEventListener('resize', () => {
    document.querySelectorAll('.coin:not(.ghost)').forEach(coin => {
        const pos = parseInt(coin.dataset.pos);
        game.position(coin, pos);
    });
});
