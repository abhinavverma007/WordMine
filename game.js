const GRID_SIZE = 20;
const MAX_MOVES = 6;

let movesLeft;
let collectedLetters;
let gameOver;

let WORDS = [];
let SECRET_WORD = "";
let tiles = [];

const retryBtn = document.getElementById("retryBtn");

// -------------------- WORD LOADER --------------------
async function loadWords() {
  const res = await fetch("/words.txt");
  const text = await res.text();

  return text
    .split("\n")
    .map((w) => w.trim().toUpperCase())
    .filter((w) => w.length === 4);
}

// -------------------- UTILS --------------------
function hashString(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) + hash + str.charCodeAt(i);
  }
  return Math.abs(hash);
}

function pickWord(seed) {
  const hash = hashString(seed);
  return WORDS[hash % WORDS.length];
}

function seededRandom(seed) {
  let x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function randomFillerLetter(excludeSet) {
  let letter;
  do {
    letter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
  } while (excludeSet.has(letter));
  return letter;
}

function randomLetter() {
  return String.fromCharCode(65 + Math.floor(Math.random() * 26));
}

function shuffleWithSeed(arr, seed) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// -------------------- INIT GAME --------------------
async function initGame() {
  document.getElementById("message").textContent = "";

  retryBtn.style.display = "none";

  // reset state
  movesLeft = MAX_MOVES;
  collectedLetters = Array(4).fill(null);
  gameOver = false;

  // load words
  if (WORDS.length === 0) {
    WORDS = await loadWords();
  }

  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Kolkata",
  });

  SECRET_WORD = pickRandomWord();

  generateGrid(today);
  renderGrid();
}

function pickRandomWord() {
  const index = Math.floor(Math.random() * WORDS.length);
  return WORDS[index];
}

// -------------------- GRID SETUP --------------------
function generateGrid(today) {
  const excludeLetters = new Set(SECRET_WORD.split(""));

  tiles = Array.from({ length: GRID_SIZE }, (_, i) => ({
    index: i,
    letter: randomFillerLetter(excludeLetters),
    type: "SAFE",
    revealed: false,
  }));

  // place word letters
  shuffleWithSeed(tiles, today.length);
  for (let i = 0; i < 4; i++) {
    tiles[i].letter = SECRET_WORD[i];
    tiles[i].isWord = true;
  }

  // mines + hints
  tiles.slice(4, 8).forEach((t) => (t.type = "MINE"));

  shuffleWithSeed(tiles, today.charCodeAt(0));

  // 5️⃣ CALCULATE ALL POSSIBLE HINTS
  const hintCandidates = [];

  tiles.forEach((tile) => {
    if (tile.type !== "SAFE") return;

    const neighbours = getNeighbours(tile.index);

    const hasWordNeighbour = neighbours.some((i) => tiles[i].isWord === true);

    if (hasWordNeighbour) {
      hintCandidates.push(tile);
    }
  });
  hintCandidates.filter(h => !h.isWord).slice(0, 4).forEach((t) => {
    t.type = "HINT";
  });

}

function getNeighbours(index) {
  const neighbours = [];
  const row = Math.floor(index / 5);
  const col = index % 5;

  if (row > 0) neighbours.push(index - 5);
  if (row < 3) neighbours.push(index + 5);
  if (col > 0) neighbours.push(index - 1);
  if (col < 4) neighbours.push(index + 1);

  return neighbours;
}

// -------------------- RENDER --------------------
function renderGrid() {
  const gridEl = document.getElementById("grid");
  const movesEl = document.getElementById("moves");

  gridEl.innerHTML = "";
  movesEl.textContent = `Moves: ${movesLeft}`;

  tiles.forEach((tile) => {
    const div = document.createElement("div");
    div.className = "tile";
    div.onclick = () => revealTile(tile, div);
    gridEl.appendChild(div);
    tile.el = div;
  });

  updateSlots();
}

// -------------------- GAME LOGIC --------------------
function revealTile(tile, el) {
  if (tile.revealed || gameOver) return;

  tile.revealed = true;

  const msgEl = document.getElementById("message");
  msgEl.textContent = "";

  // 💣 Mine
  if (tile.type === "MINE") {
    movesLeft--;
    el.classList.add("mine");
    el.textContent = "💣";
    document.getElementById("moves").textContent = `Moves: ${movesLeft}`;
    revealAllTiles();
    endGame(false);
    return;
  }

  // 🟨 Hint
  if (tile.type === "HINT") {
    movesLeft--;
    el.classList.add("hint");
    el.textContent = tile.letter;
    msgEl.textContent = "⚠️ One letter of the word is nearby";
    document.getElementById("moves").textContent = `Moves: ${movesLeft}`;
    return;
  }

  // 🟩 Safe
  el.classList.add("safe");
  el.textContent = tile.letter;

  const letter = tile.letter;

  if (SECRET_WORD.includes(letter)) {
    for (let i = 0; i < 4; i++) {
      if (SECRET_WORD[i] === letter && collectedLetters[i] === null) {
        collectedLetters[i] = letter;
        break;
      }
    }
      el.classList.add("correct"); // 👈 brown background

    updateSlots();
    checkWin();
  } else {
    el.classList.add("wrong"); // 👈 cross overlay
    msgEl.textContent = "❌ Letter is not in word";
    movesLeft--;
  }
  document.getElementById("moves").textContent = `Moves: ${movesLeft}`;
  if (movesLeft === 0) {
    endGame(false);
  }
}

function updateSlots() {
  document.querySelectorAll(".slot").forEach((s, i) => {
    s.textContent = collectedLetters[i] || "_";
  });
}

function checkWin() {
  if (collectedLetters.every((l) => l !== null)) {
    revealAllTiles();
    endGame(true);
  }
}

function endGame(win) {
  gameOver = true;
  document.getElementById("message").textContent = win
    ? "🎉 You Win!"
    : `💥 Game Over — Word was ${SECRET_WORD}`;

  revealAllTiles();
  retryBtn.textContent = win ? "Play Again" : "Try Again";

  retryBtn.style.display = "inline-block";
}

function revealAllTiles() {
  tiles.forEach((tile) => {
    if (tile.revealed) return;

    tile.revealed = true;

    const el = tile.el;

    if (tile.type === "MINE") {
      el.classList.add("mine");
      el.textContent = "💣";
    } else if (tile.type === "HINT") {
      el.classList.add("hint");
      el.textContent = tile.letter;
    } else {
      el.classList.add("safe");
      el.textContent = tile.letter;
    }
  });
}

// attach handler ONCE
retryBtn.onclick = () => {
  retryBtn.style.display = "none";
  initGame();
};

const howBtn = document.getElementById("howToPlayBtn");
const modal = document.getElementById("howModal");
const closeBtn = document.getElementById("closeModalBtn");

howBtn.onclick = () => {
  modal.classList.remove("hidden");
};

closeBtn.onclick = () => {
  modal.classList.add("hidden");
};

// close on backdrop click
modal.querySelector(".modal-backdrop").onclick = () => {
  modal.classList.add("hidden");
};


// -------------------- START --------------------
initGame();

