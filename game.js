class Game {
    constructor() {
        this.board = Array(9).fill(null);
        this.turn = 1;
        this.phase = 'place';
        this.placed = [0, 0, 0];
        this.selected = null;
        this.mode = 'pvp';
        this.over = false;
        this.history = [];
        this.drag = null;
        this.names = ['', 'Player 1', 'Player 2'];
        
        this.adj = {
            0:[1,3,4], 1:[0,2,4], 2:[1,4,5],
            3:[0,4,6], 4:[0,1,2,3,5,6,7,8], 5:[2,4,8],
            6:[3,4,7], 7:[4,6,8], 8:[4,5,7]
        };
        this.wins = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
        
        this.init();
    }
    
    init() {
        // Mode buttons
        document.getElementById('pvpBtn').onclick = () => this.setMode('pvp');
        document.getElementById('pvcBtn').onclick = () => this.setMode('pvc');
        document.getElementById('startBtn').onclick = () => this.start();
        document.getElementById('undoBtn').onclick = () => this.undo();
        document.getElementById('menuBtn').onclick = () => this.menu();
        document.getElementById('againBtn').onclick = () => this.restart();
        document.getElementById('newBtn').onclick = () => this.menu();
        
        // Node taps - immediate response
        document.querySelectorAll('.node').forEach((n, i) => {
            const tap = e => { 
                e.preventDefault(); 
                e.stopPropagation();
                this.tapNode(i); 
            };
            n.addEventListener('touchstart', tap, {passive: false});
            n.addEventListener('click', tap);
        });
        
        // Drag events with passive: false for immediate response
        const board = document.getElementById('board');
        
        // Prevent default touch behavior on board
        board.addEventListener('touchstart', e => this.touchStart(e), {passive: false});
        board.addEventListener('touchmove', e => this.touchMove(e), {passive: false});
        board.addEventListener('touchend', e => this.touchEnd(e), {passive: false});
        board.addEventListener('touchcancel', e => this.touchEnd(e), {passive: false});
        
        // Mouse events
        board.addEventListener('mousedown', e => this.mouseDown(e));
        document.addEventListener('mousemove', e => this.mouseMove(e));
        document.addEventListener('mouseup', e => this.mouseUp(e));
        
        // Prevent context menu on long press
        board.addEventListener('contextmenu', e => e.preventDefault());
        
        window.onresize = () => this.reposition();
    }
    
    setMode(m) {
        this.mode = m;
        document.getElementById('pvpBtn').classList.toggle('active', m === 'pvp');
        document.getElementById('pvcBtn').classList.toggle('active', m === 'pvc');
        const f = document.getElementById('p2Field');
        const inp = document.getElementById('p2NameInput');
        if (m === 'pvc') {
            f.style.opacity = '0.5';
            inp.value = 'Robot 🤖';
            inp.disabled = true;
        } else {
            f.style.opacity = '1';
            inp.value = 'Player 2';
            inp.disabled = false;
        }
    }

    start() {
        this.names[1] = document.getElementById('p1NameInput').value.trim() || 'Player 1';
        this.names[2] = document.getElementById('p2NameInput').value.trim() || 'Player 2';
        document.getElementById('p1Name').textContent = this.names[1];
        document.getElementById('p2Name').textContent = this.names[2];
        document.getElementById('setupScreen').classList.add('hidden');
        document.getElementById('gameScreen').classList.remove('hidden');
        this.restart();
    }
    
    menu() {
        document.getElementById('gameScreen').classList.add('hidden');
        document.getElementById('setupScreen').classList.remove('hidden');
        document.getElementById('winModal').classList.remove('show');
    }
    
    restart() {
        this.board = Array(9).fill(null);
        this.turn = 1;
        this.phase = 'place';
        this.placed = [0, 0, 0];
        this.selected = null;
        this.over = false;
        this.history = [];
        document.querySelectorAll('.coin').forEach(c => c.remove());
        document.getElementById('winModal').classList.remove('show');
        this.clearSel();
        this.updateUI();
    }
    
    // Touch handlers - optimized for mobile
    touchStart(e) {
        if (this.phase !== 'move' || this.over) return;
        
        const t = e.touches[0];
        const coin = this.findCoin(t.clientX, t.clientY);
        if (!coin || +coin.dataset.p !== this.turn) return;
        
        // Prevent ALL default behavior
        e.preventDefault();
        e.stopPropagation();
        
        this.startDrag(coin, t.clientX, t.clientY);
    }
    
    touchMove(e) {
        if (!this.drag) return;
        
        // Must prevent default to stop scrolling
        e.preventDefault();
        e.stopPropagation();
        
        const t = e.touches[0];
        this.moveDrag(t.clientX, t.clientY);
    }
    
    touchEnd(e) {
        if (!this.drag) return;
        
        e.preventDefault();
        e.stopPropagation();
        
        const t = e.changedTouches[0];
        this.endDrag(t.clientX, t.clientY);
    }
    
    mouseDown(e) {
        if (this.phase !== 'move' || this.over) return;
        const coin = e.target.closest('.coin:not(.ghost)');
        if (!coin || +coin.dataset.p !== this.turn) return;
        this.startDrag(coin, e.clientX, e.clientY);
    }
    
    mouseMove(e) {
        if (this.drag) this.moveDrag(e.clientX, e.clientY);
    }
    
    mouseUp(e) {
        if (this.drag) this.endDrag(e.clientX, e.clientY);
    }
    
    startDrag(coin, x, y) {
        // Cache board rect for precision coordinate mapping
        this.boardRect = document.getElementById('board').getBoundingClientRect();
        
        this.drag = {
            coin, 
            pos: +coin.dataset.pos, 
            startX: x, 
            startY: y, 
            moved: false
        };
        
        // Disable transitions for lag-free dragging
        coin.style.transition = 'none';
        coin.classList.add('dragging');
        
        this.select(this.drag.pos);
        
        // Haptic feedback
        if (navigator.vibrate) navigator.vibrate(10);
    }
    
    moveDrag(x, y) {
        const d = this.drag;
        
        // Check if actually moved (threshold 5px)
        if (!d.moved) {
            const dx = Math.abs(x - d.startX);
            const dy = Math.abs(y - d.startY);
            if (dx > 5 || dy > 5) {
                d.moved = true;
            }
        }
        
        if (d.moved) {
            // Precision coordinate mapping using cached boardRect
            const coinSize = d.coin.offsetWidth;
            const newX = x - this.boardRect.left - (coinSize / 2);
            const newY = y - this.boardRect.top - (coinSize / 2);
            
            // Direct style manipulation for 60fps performance
            d.coin.style.left = newX + 'px';
            d.coin.style.top = newY + 'px';
        }
    }
    
    endDrag(x, y) {
        const d = this.drag;
        
        // Remove dragging state
        d.coin.classList.remove('dragging');
        
        // Restore smooth transition for snap animation
        d.coin.style.transition = 'left 0.2s ease-out, top 0.2s ease-out, transform 0.15s ease-out';
        
        if (d.moved) {
            // 60px snap threshold
            const target = this.findNode(x, y, 60);
            
            if (target !== null && this.canMove(d.pos, target)) {
                this.move(d.pos, target);
                if (navigator.vibrate) navigator.vibrate(15);
            } else {
                // Snap back to original position
                this.position(d.coin, d.pos);
            }
            this.clearSel();
        } else {
            // Was a tap, not drag - keep selected
            this.position(d.coin, d.pos);
            d.coin.classList.add('selected');
        }
        
        this.drag = null;
        this.boardRect = null;
    }
    
    findCoin(x, y) {
        for (const el of document.elementsFromPoint(x, y)) {
            if (el.classList.contains('coin') && !el.classList.contains('ghost')) return el;
        }
        return null;
    }
    
    findNode(x, y, threshold = 60) {
        let best = null;
        let minDist = threshold;
        
        document.querySelectorAll('.node').forEach((n, i) => {
            const r = n.getBoundingClientRect();
            const centerX = r.left + r.width / 2;
            const centerY = r.top + r.height / 2;
            
            // Euclidean distance
            const dist = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
            
            if (dist < minDist) {
                minDist = dist;
                best = i;
            }
        });
        
        return best;
    }

    tapNode(pos) {
        if (this.over || this.drag) return;
        if (this.phase === 'place') {
            this.place(pos);
        } else {
            if (this.selected !== null) {
                if (this.canMove(this.selected, pos)) {
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
        const coin = document.querySelector(`.coin[data-pos="${pos}"]:not(.ghost)`);
        if (coin) coin.classList.add('selected');
        this.showMoves(pos);
    }
    
    clearSel() {
        this.selected = null;
        document.querySelectorAll('.coin.selected').forEach(c => c.classList.remove('selected'));
        document.querySelectorAll('.node.valid').forEach(n => n.classList.remove('valid'));
        document.querySelectorAll('.coin.ghost').forEach(g => g.remove());
    }
    
    showMoves(pos) {
        this.adj[pos].forEach(p => {
            if (this.board[p] === null) {
                document.querySelector(`.node[data-pos="${p}"]`).classList.add('valid');
                const g = document.createElement('div');
                g.className = `coin c${this.turn} ghost`;
                document.getElementById('board').appendChild(g);
                this.position(g, p);
            }
        });
    }
    
    place(pos) {
        if (this.board[pos] !== null) return;
        const test = [...this.board];
        test[pos] = this.turn;
        if (this.checkWin(test, this.turn)) return;
        
        this.board[pos] = this.turn;
        this.placed[this.turn]++;
        this.history.push({t:'p', p:this.turn, pos});
        this.createCoin(pos, this.turn);
        
        if (this.placed[1] === 3 && this.placed[2] === 3) this.phase = 'move';
        this.next();
    }
    
    move(from, to) {
        if (!this.canMove(from, to)) return;
        this.history.push({t:'m', p:this.turn, from, to});
        this.board[to] = this.board[from];
        this.board[from] = null;
        
        const coin = document.querySelector(`.coin[data-pos="${from}"]:not(.ghost)`);
        if (coin) {
            coin.dataset.pos = to;
            this.position(coin, to);
        }
        
        if (this.checkWin(this.board, this.turn)) {
            this.win(this.turn);
            return;
        }
        this.next();
    }
    
    canMove(from, to) {
        return this.board[to] === null && this.adj[from].includes(to);
    }
    
    createCoin(pos, p) {
        const c = document.createElement('div');
        c.className = `coin c${p}`;
        c.dataset.pos = pos;
        c.dataset.p = p;
        document.getElementById('board').appendChild(c);
        requestAnimationFrame(() => this.position(c, pos));
    }
    
    position(coin, pos) {
        const node = document.querySelector(`.node[data-pos="${pos}"]`);
        if (!node) return;
        
        // Use getBoundingClientRect for precision
        const nodeRect = node.getBoundingClientRect();
        const boardRect = document.getElementById('board').getBoundingClientRect();
        const coinSize = coin.offsetWidth || 44;
        
        // Calculate center position
        const x = nodeRect.left - boardRect.left + (nodeRect.width / 2) - (coinSize / 2);
        const y = nodeRect.top - boardRect.top + (nodeRect.height / 2) - (coinSize / 2);
        
        coin.style.left = x + 'px';
        coin.style.top = y + 'px';
    }
    
    reposition() {
        document.querySelectorAll('.coin:not(.ghost)').forEach(c => this.position(c, +c.dataset.pos));
    }
    
    checkWin(b, p) {
        return this.wins.some(w => w.every(i => b[i] === p));
    }
    
    win(p) {
        this.over = true;
        const w = this.wins.find(w => w.every(i => this.board[i] === p));
        if (w) w.forEach(i => {
            const c = document.querySelector(`.coin[data-pos="${i}"]:not(.ghost)`);
            if (c) c.classList.add('win');
        });
        setTimeout(() => {
            document.getElementById('winText').textContent = this.names[p] + ' Wins!';
            document.getElementById('winModal').classList.add('show');
        }, 500);
    }
    
    next() {
        this.turn = this.turn === 1 ? 2 : 1;
        this.updateUI();
        if (this.mode === 'pvc' && this.turn === 2 && !this.over) {
            setTimeout(() => this.ai(), 500);
        }
    }

    ai() {
        if (this.phase === 'place') {
            const pos = this.aiPlace();
            if (pos !== null) this.place(pos);
        } else {
            const m = this.aiMove();
            if (m) this.move(m.from, m.to);
        }
    }
    
    aiPlace() {
        for (let i = 0; i < 9; i++) {
            if (this.board[i] === null) {
                const t = [...this.board]; t[i] = 1;
                if (this.checkWin(t, 1)) {
                    const t2 = [...this.board]; t2[i] = 2;
                    if (!this.checkWin(t2, 2)) return i;
                }
            }
        }
        if (this.board[4] === null) {
            const t = [...this.board]; t[4] = 2;
            if (!this.checkWin(t, 2)) return 4;
        }
        const v = [];
        for (let i = 0; i < 9; i++) {
            if (this.board[i] === null) {
                const t = [...this.board]; t[i] = 2;
                if (!this.checkWin(t, 2)) v.push(i);
            }
        }
        return v.length ? v[Math.random() * v.length | 0] : null;
    }
    
    aiMove() {
        const moves = this.getMoves(2);
        for (const m of moves) {
            const t = [...this.board]; t[m.to] = t[m.from]; t[m.from] = null;
            if (this.checkWin(t, 2)) return m;
        }
        for (const om of this.getMoves(1)) {
            const t = [...this.board]; t[om.to] = t[om.from]; t[om.from] = null;
            if (this.checkWin(t, 1)) {
                for (const m of moves) if (m.to === om.to) return m;
            }
        }
        return moves[Math.random() * moves.length | 0];
    }
    
    getMoves(p) {
        const m = [];
        for (let i = 0; i < 9; i++) {
            if (this.board[i] === p) {
                for (const a of this.adj[i]) if (this.board[a] === null) m.push({from:i, to:a});
            }
        }
        return m;
    }
    
    undo() {
        if (!this.history.length || this.over) return;
        const h = this.history.pop();
        if (h.t === 'p') {
            this.board[h.pos] = null;
            this.placed[h.p]--;
            const c = document.querySelector(`.coin[data-pos="${h.pos}"]:not(.ghost)`);
            if (c) c.remove();
            if (this.phase === 'move') this.phase = 'place';
        } else {
            this.board[h.from] = h.p;
            this.board[h.to] = null;
            const c = document.querySelector(`.coin[data-pos="${h.to}"]:not(.ghost)`);
            if (c) { c.dataset.pos = h.from; this.position(c, h.from); }
        }
        this.turn = h.p;
        this.clearSel();
        this.updateUI();
    }
    
    updateUI() {
        document.getElementById('p1Panel').classList.toggle('active', this.turn === 1);
        document.getElementById('p2Panel').classList.toggle('active', this.turn === 2);
        document.getElementById('p1Status').textContent = this.phase === 'place' ? (3 - this.placed[1]) + ' coins' : 'Ready';
        document.getElementById('p2Status').textContent = this.phase === 'place' ? (3 - this.placed[2]) + ' coins' : 'Ready';
        document.getElementById('phaseText').textContent = this.phase === 'place' ? 'Tap to place coin' : 'Tap coin → Tap destination';
        document.getElementById('undoBtn').disabled = !this.history.length || this.over;
    }
}

document.addEventListener('DOMContentLoaded', () => new Game());
