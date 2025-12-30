# 🎮 LineMaster Game

A modern, strategic board game inspired by Shisima and Achi, featuring stunning visuals, smooth animations, and an intelligent AI opponent.

![Game Preview](https://img.shields.io/badge/Status-Live-success)
![License](https://img.shields.io/badge/License-MIT-blue)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black)

## ✨ Features

### 🎯 Gameplay
- **Two-Phase Strategy**: Placement phase followed by movement phase
- **Smart Rules**: Prevents winning during placement for balanced gameplay
- **Win Detection**: 8 possible winning patterns (rows, columns, diagonals)
- **Undo System**: Take back moves to refine your strategy

### 🤖 AI Opponent
- **Minimax Algorithm**: Strategic AI with alpha-beta pruning
- **Intelligent Decisions**: Prioritizes winning moves and blocks opponent threats
- **Adjustable Difficulty**: Depth-limited search for optimal performance

### 🎨 Visual Design
- **Futuristic Aesthetic**: Neon glowing effects and premium glass materials
- **Smooth Animations**: Cubic-bezier easing for fluid coin movements
- **Dynamic Feedback**: Glowing lines, pulsing nodes, and ghost previews
- **Responsive Layout**: Works perfectly on desktop and mobile devices

### 🎮 Controls
- **Drag & Drop**: Intuitive coin movement with smooth tracking
- **Click to Select**: Alternative control method for precision
- **Touch Support**: Full mobile compatibility
- **Visual Guides**: Ghost coins show valid moves

## 🚀 Quick Start

### Play Online
Simply open `index.html` in any modern web browser. No installation required!

### Local Setup
```bash
# Clone the repository
git clone https://github.com/MSathish01/LineMaster-Game.git

# Navigate to directory
cd LineMaster-Game

# Open in browser
start index.html  # Windows
open index.html   # macOS
xdg-open index.html  # Linux
```

## 📖 How to Play

### Game Objective
Align your 3 coins in a straight line (horizontal, vertical, or diagonal) before your opponent does.

### Phase 1: Placement
1. Players alternate placing coins on empty nodes
2. Each player places 3 coins total
3. **Important**: You cannot form a winning line during this phase

### Phase 2: Movement
1. Once all 6 coins are placed, the movement phase begins
2. Players take turns moving one coin to an adjacent empty node
3. Coins can only move along connecting lines
4. First player to align 3 coins wins!

### Game Modes
- **Player vs Player**: Challenge a friend locally
- **Player vs Robot**: Test your skills against the AI

## 🎯 Strategy Tips

1. **Control the Center**: The center node connects to all 8 positions
2. **Create Threats**: Set up multiple winning possibilities
3. **Block Wisely**: Watch for opponent's potential winning moves
4. **Think Ahead**: Plan 2-3 moves in advance
5. **Corner Strategy**: Corners limit opponent's movement options

## 🛠️ Technical Details

### Technologies
- Pure HTML5, CSS3, and Vanilla JavaScript
- No external dependencies or frameworks
- Fully client-side - works offline

### Key Components
- **Game Logic**: Complete rule validation and state management
- **AI Engine**: Minimax algorithm with optimized search
- **Animation System**: Smooth lerp-style transitions
- **Event Handling**: Mouse, touch, and keyboard support

### Browser Compatibility
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

## 📁 Project Structure

```
LineMaster-Game/
├── index.html      # Game structure and layout
├── style.css       # Visual styling and animations
├── game.js         # Game logic and AI implementation
└── README.md       # Documentation
```

## 🎨 Customization

### Change Colors
Edit the CSS gradient values in `style.css`:
```css
/* Player 1 color (default: teal) */
.coin.player1 {
    background: radial-gradient(circle at 30% 30%, #00f0ff, #00d4ff, #0099cc);
}

/* Player 2 color (default: purple) */
.coin.player2 {
    background: radial-gradient(circle at 30% 30%, #9d4edd, #7b2cbf, #5a1e8f);
}
```

### Adjust AI Difficulty
Modify the depth limit in `game.js`:
```javascript
// Line ~450 in minimax function
if (depth >= 4) return 0; // Increase for harder AI (e.g., 6)
```

## 🤝 Contributing

Contributions are welcome! Feel free to:
- Report bugs
- Suggest new features
- Submit pull requests
- Improve documentation

## 📝 License

This project is open source and available under the [MIT License](LICENSE).

## 🙏 Acknowledgments

- Inspired by traditional African board games Shisima and Achi
- Design influenced by modern UI/UX principles
- Built with passion for strategic gaming

## 📧 Contact

Created by [@MSathish01](https://github.com/MSathish01)

---

⭐ Star this repository if you enjoyed the game!
