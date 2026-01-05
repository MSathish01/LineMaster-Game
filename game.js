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

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth();

class LineMaster {
    constructor() {
        this.board = Array(9).fill(null);
        this.turn = 1;
        this.phase = 'place';
        this.placed = { 1: 0, 2: 0 };
        this.selected = null;
        this.mode = 'local';
        this.over = false;
        this.history = [];
        this.drag = null;
        this.names = { 1: 'Player 1', 2: 'Player 2' };
        
        this.roomId = null;
        this.playerId = null;
        this.roomRef = null;
        this.user = null;
        this.isOnlineReady = false;
        
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
            info.innerHTML = `<button class="login-btn" onclick="game.login()">🔑 Sign in with Google</button>`;
        }
    }
    
    login() {
        const provider = new firebase.auth.GoogleAuthProvider();
        auth.signInWithPopup(provider).catch(e => this.toast('Login failed'));
    }
    
    logout() { auth.signOut(); }

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
        this.placed = { 1: 0, 2: 0 };
        this.selected = null;
        this.over = false;
        this.history = [];
        document.querySelectorAll('.coin').forEach(c => c.remove());
        document.querySelectorAll('.node').forEach(n => n.classList.remove('valid'));
        document.getElementById('winModal').classList.remove('show');
    }


    // ============ ONLINE MULTIPLAYER ============
    createRoom() {
        const name = document.getElementById('onlineName').value || 'Player';
        this.roomId = this.generateCode();
        this.playerId = 1;
        this.names[1] = name;
        this.isOnlineReady = false;
        
        this.roomRef = db.ref('rooms/' + this.roomId);
        this.roomRef.set({
            p1: name,
            p2: null,
            board: '000000000',
            turn: 1,
            phase: 'place',
            c1: 0,
            c2: 0,
            status: 'waiting'
        });
        
        document.getElementById('roomCodeDisplay').textContent = this.roomId;
        this.showScreen('waitingRoom');
        
        this.roomRef.on('value', snap => {
            const d = snap.val();
            if (!d) return;
            
            if (d.p2 && !this.isOnlineReady) {
                this.names[2] = d.p2;
                this.isOnlineReady = true;
                this.roomRef.update({ status: 'playing' });
                this.startOnlineGame();
            }
            
            if (this.isOnlineReady && d.status === 'playing') {
                this.syncFromServer(d);
            }
        });
    }
    
    joinRoom() {
        const code = document.getElementById('roomCodeInput').value.toUpperCase().trim();
        if (code.length !== 6) { this.toast('Enter 6-digit code'); return; }
        
        const name = document.getElementById('onlineName').value || 'Player';
        this.roomId = code;
        this.playerId = 2;
        this.names[2] = name;
        this.isOnlineReady = false;
        
        this.roomRef = db.ref('rooms/' + this.roomId);
        this.roomRef.once('value').then(snap => {
            const d = snap.val();
            if (!d) { this.toast('Room not found'); return; }
            if (d.p2) { this.toast('Room is full'); return; }
            
            this.names[1] = d.p1;
            this.roomRef.update({ p2: name });
            
            this.roomRef.on('value', snap => {
                const data = snap.val();
                if (!data) return;
                
                if (data.status === 'playing' && !this.isOnlineReady) {
                    this.isOnlineReady = true;
                    this.startOnlineGame();
                }
                
                if (this.isOnlineReady) {
                    this.syncFromServer(data);
                }
            });
        });
    }
    
    generateCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
        return code;
    }
    
    quickJoin() {
        this.toast('Finding a game...');
        db.ref('rooms').orderByChild('status').equalTo('waiting').limitToFirst(5).once('value').then(snap => {
            const rooms = snap.val();
            if (!rooms) { this.toast('No rooms. Creating...'); this.createRoom(); return; }
            
            for (const id of Object.keys(rooms)) {
                if (!rooms[id].p2) {
                    document.getElementById('roomCodeInput').value = id;
                    this.joinRoom();
                    return;
                }
            }
            this.toast('No rooms. Creating...'); 
            this.createRoom();
        });
    }
    
    copyRoomCode() {
        navigator.clipboard.writeText(this.roomId);
        this.toast('Code copied!');
    }
    
    shareLink() {
        const url = `${location.origin}${location.pathname}?room=${this.roomId}`;
        if (navigator.share) navigator.share({ title: 'LineMaster', url });
        else { navigator.clipboard.writeText(url); this.toast('Link copied!'); }
    }
    
    cancelRoom() {
        if (this.roomRef) {
            this.roomRef.off();
            if (this.playerId === 1) this.roomRef.remove();
        }
        this.roomRef = null;
        this.showScreen('homeScreen');
    }
    
    startOnlineGame() {
        this.mode = 'online';
        this.resetGame();
        this.showScreen('gameScreen');
        document.getElementById('onlineIndicator').classList.remove('hidden');
        this.updateUI();
        
        if (this.playerId === 1) this.toast("Your turn!");
        else this.toast("Waiting for " + this.names[1]);
    }
    
    syncFromServer(d) {
        if (this.over || !d) return;
        
        // Parse board string "012001020" -> array
        const newBoard = d.board.split('').map(c => c === '0' ? null : parseInt(c));
        const newTurn = d.turn;
        
        this.board = newBoard;
        this.turn = newTurn;
        this.phase = d.phase;
        this.placed[1] = d.c1;
        this.placed[2] = d.c2;
        this.names[1] = d.p1;
        if (d.p2) this.names[2] = d.p2;
        
        this.rebuildBoard();
        this.updateUI();
        
        if (d.winner) this.win(d.winner);
    }
    
    pushToServer() {
        if (this.mode !== 'online' || !this.roomRef) return;
        
        // Convert board to string
        const boardStr = this.board.map(v => v === null ? '0' : v).join('');
        
        this.roomRef.update({
            board: boardStr,
            turn: this.turn,
            phase: this.phase,
            c1: this.placed[1],
            c2: this.placed[2],
            winner: this.over ? (this.turn === 1 ? 2 : 1) : null
        });
    }
    
    rebuildBoard() {
        document.querySelectorAll('.coin').forEach(c => c.remove());
        this.board.forEach((p, i) => {
            if (p) this.createCoin(p, i, false);
        });
    }


    // ============ BOARD EVENTS ============
    bindBoardEvents() {
        const board = document.getElementById('board');
        
        board.addEventListener('touchstart', e => this.onTouchStart(e), { passive: false });
        board.addEventListener('touchmove', e => this.onTouchMove(e), { passive: false });
        board.addEventListener('touchend', e => this.onTouchEnd(e), { passive: false });
        
        board.addEventListener('mousedown', e => this.onMouseDown(e));
        document.addEventListener('mousemove', e => this.onMouseMove(e));
        document.addEventListener('mouseup', e => this.onMouseUp(e));
        
        document.querySelectorAll('.node').forEach(node => {
            node.onclick = () => this.onNodeClick(parseInt(node.dataset.pos));
        });
    }
    
    canPlay() {
        if (this.over) return false;
        if (this.mode === 'online' && this.turn !== this.playerId) {
            return false;
        }
        return true;
    }
    
    onNodeClick(pos) {
        if (!this.canPlay()) {
            if (this.mode === 'online') this.toast("Wait for your turn!");
            return;
        }
        
        if (this.phase === 'place') {
            if (this.board[pos] === null) this.place(pos);
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
    
    onTouchStart(e) {
        if (!this.canPlay()) return;
        const touch = e.touches[0];
        const el = document.elementFromPoint(touch.clientX, touch.clientY);
        
        if (el?.classList.contains('coin') && this.phase === 'move') {
            const p = el.classList.contains('c1') ? 1 : 2;
            if (p === this.turn) {
                e.preventDefault();
                this.startDrag(el, touch.clientX, touch.clientY);
            }
        }
    }
    
    onTouchMove(e) {
        if (!this.drag) return;
        e.preventDefault();
        this.moveDrag(e.touches[0].clientX, e.touches[0].clientY);
    }
    
    onTouchEnd(e) {
        if (!this.drag) return;
        e.preventDefault();
        this.endDrag(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
    }
    
    onMouseDown(e) {
        if (!this.canPlay()) return;
        if (e.target.classList.contains('coin') && this.phase === 'move') {
            const p = e.target.classList.contains('c1') ? 1 : 2;
            if (p === this.turn) {
                e.preventDefault();
                this.startDrag(e.target, e.clientX, e.clientY);
            }
        }
    }
    
    onMouseMove(e) {
        if (this.drag) this.moveDrag(e.clientX, e.clientY);
    }
    
    onMouseUp(e) {
        if (this.drag) this.endDrag(e.clientX, e.clientY);
    }
    
    startDrag(coin, x, y) {
        const pos = parseInt(coin.dataset.pos);
        this.drag = { coin, from: pos, startX: x, startY: y, origLeft: coin.offsetLeft, origTop: coin.offsetTop };
        coin.classList.add('dragging');
        coin.style.transition = 'none';
        this.select(pos);
        this.haptic();
    }
    
    moveDrag(x, y) {
        if (!this.drag) return;
        this.drag.coin.style.left = (this.drag.origLeft + x - this.drag.startX) + 'px';
        this.drag.coin.style.top = (this.drag.origTop + y - this.drag.startY) + 'px';
    }
    
    endDrag(x, y) {
        if (!this.drag) return;
        const { coin, from } = this.drag;
        coin.classList.remove('dragging');
        coin.style.transition = '';
        
        let closest = null, minDist = 60;
        document.querySelectorAll('.node').forEach(node => {
            const pos = parseInt(node.dataset.pos);
            if (!this.adj[from].includes(pos) || this.board[pos] !== null) return;
            const r = node.getBoundingClientRect();
            const dist = Math.hypot(x - (r.left + r.width/2), y - (r.top + r.height/2));
            if (dist < minDist) { minDist = dist; closest = pos; }
        });
        
        if (closest !== null) this.move(from, closest);
        else this.reposition(coin, from);
        
        this.clearSel();
        this.drag = null;
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
                const ghost = document.createElement('div');
                ghost.className = `coin c${this.turn} ghost`;
                this.position(ghost, to);
                document.getElementById('board').appendChild(ghost);
            }
        });
    }


    // ============ GAME LOGIC ============
    place(pos) {
        if (this.board[pos] !== null || this.placed[this.turn] >= 3) return;
        
        this.board[pos] = this.turn;
        if (this.checkWin(this.turn)) {
            this.board[pos] = null;
            this.toast("Can't win during placement!");
            return;
        }
        
        this.placed[this.turn]++;
        this.createCoin(this.turn, pos, true);
        this.haptic();
        
        if (this.placed[1] === 3 && this.placed[2] === 3) this.phase = 'move';
        this.nextTurn();
    }
    
    move(from, to) {
        if (this.board[from] !== this.turn || this.board[to] !== null) return;
        if (!this.adj[from].includes(to)) return;
        
        this.board[to] = this.board[from];
        this.board[from] = null;
        
        const coin = document.querySelector(`.coin[data-pos="${from}"]`);
        if (coin) { coin.dataset.pos = to; this.reposition(coin, to); }
        this.haptic();
        
        if (this.checkWin(this.turn)) { this.win(this.turn); return; }
        this.nextTurn();
    }
    
    nextTurn() {
        this.turn = this.turn === 1 ? 2 : 1;
        this.updateUI();
        this.pushToServer();
        
        if (this.mode === 'robot' && this.turn === 2 && !this.over) {
            setTimeout(() => this.ai(), 500);
        }
    }
    
    createCoin(player, pos, animate) {
        const coin = document.createElement('div');
        coin.className = `coin c${player}`;
        if (animate) coin.classList.add('placing');
        coin.dataset.pos = pos;
        
        coin.addEventListener('touchstart', e => {
            if (!this.canPlay() || this.phase !== 'move') return;
            const p = coin.classList.contains('c1') ? 1 : 2;
            if (p !== this.turn) return;
            e.preventDefault();
            e.stopPropagation();
            this.startDrag(coin, e.touches[0].clientX, e.touches[0].clientY);
        }, { passive: false });
        
        coin.onclick = e => {
            if (!this.canPlay() || this.phase !== 'move') return;
            const p = coin.classList.contains('c1') ? 1 : 2;
            if (p === this.turn) this.select(parseInt(coin.dataset.pos));
        };
        
        this.position(coin, pos);
        document.getElementById('board').appendChild(coin);
    }
    
    position(coin, pos) {
        const board = document.getElementById('board');
        const node = document.querySelector(`.node[data-pos="${pos}"]`);
        const bRect = board.getBoundingClientRect();
        const nRect = node.getBoundingClientRect();
        coin.style.left = (nRect.left - bRect.left + nRect.width/2 - 23) + 'px';
        coin.style.top = (nRect.top - bRect.top + nRect.height/2 - 23) + 'px';
    }
    
    reposition(coin, pos) {
        coin.style.transition = 'left 0.25s ease-out, top 0.25s ease-out';
        this.position(coin, pos);
    }
    
    checkWin(p) {
        return this.wins.some(w => w.every(i => this.board[i] === p));
    }
    
    win(player) {
        this.over = true;
        this.wins.forEach(w => {
            if (w.every(i => this.board[i] === player)) {
                w.forEach(i => {
                    const c = document.querySelector(`.coin[data-pos="${i}"]`);
                    if (c) c.classList.add('win');
                });
            }
        });
        setTimeout(() => {
            document.getElementById('winText').textContent = `${this.names[player]} Wins!`;
            document.getElementById('winModal').classList.add('show');
        }, 800);
        this.pushToServer();
    }


    // ============ AI ============
    ai() {
        if (this.over) return;
        if (this.phase === 'place') this.aiPlace();
        else this.aiMove();
    }
    
    aiPlace() {
        const empty = this.board.map((v,i) => v === null ? i : -1).filter(i => i >= 0);
        
        for (const pos of empty) {
            this.board[pos] = 1;
            if (this.checkWin(1)) {
                this.board[pos] = 2;
                if (!this.checkWin(2)) { this.board[pos] = null; this.place(pos); return; }
            }
            this.board[pos] = null;
        }
        
        if (this.board[4] === null) {
            this.board[4] = 2;
            if (!this.checkWin(2)) { this.board[4] = null; this.place(4); return; }
            this.board[4] = null;
        }
        
        const valid = empty.filter(p => { this.board[p] = 2; const w = this.checkWin(2); this.board[p] = null; return !w; });
        if (valid.length) this.place(valid[Math.floor(Math.random() * valid.length)]);
    }
    
    aiMove() {
        const moves = [];
        this.board.forEach((v,i) => { if (v === 2) this.adj[i].forEach(j => { if (this.board[j] === null) moves.push([i,j]); }); });
        if (!moves.length) return;
        
        for (const [f,t] of moves) {
            this.board[t] = 2; this.board[f] = null;
            if (this.checkWin(2)) { this.board[f] = 2; this.board[t] = null; this.select(f); setTimeout(() => { this.move(f,t); this.clearSel(); }, 300); return; }
            this.board[f] = 2; this.board[t] = null;
        }
        
        const [f,t] = moves[Math.floor(Math.random() * moves.length)];
        this.select(f);
        setTimeout(() => { this.move(f,t); this.clearSel(); }, 300);
    }

    // ============ UI ============
    updateUI() {
        const p1 = document.getElementById('p1Panel');
        const p2 = document.getElementById('p2Panel');
        
        p1.classList.toggle('active', this.turn === 1);
        p2.classList.toggle('active', this.turn === 2);
        
        document.getElementById('p1Name').textContent = this.names[1];
        document.getElementById('p2Name').textContent = this.names[2];
        
        document.getElementById('p1Status').textContent = this.phase === 'place' ? `${3 - this.placed[1]} coins` : 'Move';
        document.getElementById('p2Status').textContent = this.phase === 'place' ? `${3 - this.placed[2]} coins` : 'Move';
        
        document.getElementById('phaseText').textContent = this.phase === 'place' ? 'Place your coins' : 'Move to align 3';
        document.getElementById('undoBtn').disabled = this.mode === 'online';
    }
    
    undo() {
        if (this.mode === 'online' || !this.history.length || this.over) return;
        // Simplified - not implementing full undo for now
    }
    
    playAgain() {
        document.getElementById('winModal').classList.remove('show');
        this.resetGame();
        if (this.mode === 'online' && this.roomRef) {
            this.roomRef.update({ board: '000000000', turn: 1, phase: 'place', c1: 0, c2: 0, winner: null });
        }
        this.updateUI();
    }
    
    backToMenu() {
        document.getElementById('winModal').classList.remove('show');
        if (this.roomRef) { this.roomRef.off(); this.roomRef = null; }
        window.history.replaceState({}, '', location.pathname);
        this.showScreen('homeScreen');
    }
    
    toast(msg) {
        const t = document.getElementById('toast');
        t.textContent = msg;
        t.classList.remove('hidden');
        setTimeout(() => t.classList.add('hidden'), 2500);
    }
    
    haptic() { if (navigator.vibrate) navigator.vibrate(10); }
}

const game = new LineMaster();

window.addEventListener('resize', () => {
    document.querySelectorAll('.coin:not(.ghost)').forEach(coin => {
        game.position(coin, parseInt(coin.dataset.pos));
    });
});
