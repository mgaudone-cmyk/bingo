```javascript
/* Simple Multiplayer Bingo MVP
   Plain HTML/CSS/JS.
   Firebase Realtime Database when configured; local demo mode otherwise.
*/

const CONFIG = window.BINGO_CONFIG || { demoMode: true };
const appEl = document.getElementById('app');

const uid = getOrCreateId('bingo_uid');
const playerNameKey = 'bingo_name';

let state = {
  roomCode: null,
  room: null,
  player: null,
  error: '',
  info: ''
};

let unsubscribeRoom = null;
let db = null;

const NUMBER_POOL = Array.from({ length: 75 }, (_, i) => String(i + 1));

function getOrCreateId(key) {
  let id = localStorage.getItem(key);

  if (!id) {
    id = 'p_' + Math.random().toString(36).slice(2, 10);
    localStorage.setItem(key, id);
  }

  return id;
}

function code() {
  return Math.random()
    .toString(36)
    .replace(/[^a-z0-9]/g, '')
    .slice(2, 8)
    .toUpperCase();
}

function esc(s = '') {
  return String(s).replace(/[&<>'"]/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[c]));
}

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

function roomUrl(roomCode) {
  return `${location.origin}${location.pathname}?room=${roomCode}`;
}

function isFirebaseReady() {
  return !CONFIG.demoMode &&
    CONFIG.firebaseConfig &&
    CONFIG.firebaseConfig.apiKey;
}

function initDataLayer() {
  if (isFirebaseReady()) {
    firebase.initializeApp(CONFIG.firebaseConfig);
    db = firebase.database();
    return new FirebaseStore(db);
  }

  return new DemoStore();
}

class FirebaseStore {
  constructor(db) {
    this.db = db;
  }

  ref(path) {
    return this.db.ref(path);
  }

  async getRoom(roomCode) {
    const snap = await this.ref(`rooms/${roomCode}`).get();
    return snap.val();
  }

  listenRoom(roomCode, cb) {
    const r = this.ref(`rooms/${roomCode}`);

    r.on('value', s => {
      cb(s.val());
    });

    return () => r.off();
  }

  async setRoom(roomCode, room) {
    await this.ref(`rooms/${roomCode}`).set(room);
  }

  async updateRoom(roomCode, patch) {
    await this.ref(`rooms/${roomCode}`).update(patch);
  }

  async updatePlayer(roomCode, playerId, patch) {
    await this.ref(`rooms/${roomCode}/players/${playerId}`).update(patch);
  }
}

class DemoStore {
  constructor() {
    this.listeners = {};
  }

  key(roomCode) {
    return `demo_room_${roomCode}`;
  }

  async getRoom(roomCode) {
    return JSON.parse(localStorage.getItem(this.key(roomCode)) || 'null');
  }

  listenRoom(roomCode, cb) {
    this.listeners[roomCode] = cb;
    this.notify(roomCode);

    return () => {
      delete this.listeners[roomCode];
    };
  }

  async setRoom(roomCode, room) {
    localStorage.setItem(this.key(roomCode), JSON.stringify(room));
    this.notify(roomCode);
  }

  async updateRoom(roomCode, patch) {
    const room = await this.getRoom(roomCode);

    await this.setRoom(roomCode, {
      ...room,
      ...patch
    });
  }

  async updatePlayer(roomCode, playerId, patch) {
    const room = await this.getRoom(roomCode);

    room.players[playerId] = {
      ...(room.players[playerId] || {}),
      ...patch
    };

    await this.setRoom(roomCode, room);
  }

  async notify(roomCode) {
    if (this.listeners[roomCode]) {
      this.listeners[roomCode](await this.getRoom(roomCode));
    }
  }
}

const store = initDataLayer();

function makeCard() {
  const columns = [
    shuffle(range(1, 15)).slice(0, 5),
    shuffle(range(16, 30)).slice(0, 5),
    shuffle(range(31, 45)).slice(0, 5),
    shuffle(range(46, 60)).slice(0, 5),
    shuffle(range(61, 75)).slice(0, 5)
  ];

  const card = [];

  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      card.push(row === 2 && col === 2 ? 'FREE' : columns[col][row]);
    }
  }

  return card;
}

function range(start, end) {
  return Array.from(
    { length: end - start + 1 },
    (_, i) => String(start + i)
  );
}

function makePlayer(name) {
  return {
    id: uid,
    name,
    card: makeCard(),
    marked: { 12: true },
    joinedAt: Date.now()
  };
}

function amHost(room) {
  return room.hostId === uid;
}

async function createRoom() {
  const roomName = document.getElementById('roomName').value || 'Bingo Room';
  const playerName = document.getElementById('playerName').value || 'Host';

  localStorage.setItem(playerNameKey, playerName);

  const room = {
    code: code(),
    roomName,
    hostId: uid,
    status: 'lobby',
    called: [],
    current: '',
    players: {}
  };

  room.players[uid] = makePlayer(playerName);

  await store.setRoom(room.code, room);

  joinRoomView(room.code);
}

async function joinRoom() {
  const roomCode = document
    .getElementById('joinCode')
    .value
    .trim()
    .toUpperCase();

  const playerName =
    document.getElementById('joinName').value || 'Player';

  const room = await store.getRoom(roomCode);

  if (!room) {
    alert('Room not found');
    return;
  }

  localStorage.setItem(playerNameKey, playerName);

  if (!room.players[uid]) {
    await store.updatePlayer(
      roomCode,
      uid,
      makePlayer(playerName)
    );
  }

  joinRoomView(roomCode);
}

function joinRoomView(roomCode) {
  state.roomCode = roomCode;

  if (unsubscribeRoom) {
    unsubscribeRoom();
  }

  unsubscribeRoom = store.listenRoom(roomCode, room => {
    state.room = room;
    state.player = room.players[uid];

    renderRoom();
  });
}

async function startGame() {
  if (!amHost(state.room)) {
    alert('Only the host can start the game');
    return;
  }

  await store.updateRoom(state.roomCode, {
    status: 'playing'
  });
}

async function callNext() {
  const room = state.room;

  const remaining = NUMBER_POOL.filter(
    n => !room.called.includes(n)
  );

  if (!remaining.length) {
    return;
  }

  const next = shuffle(remaining)[0];

  await store.updateRoom(state.roomCode, {
    current: next,
    called: [...room.called, next]
  });
}

async function toggleMark(i) {
  if (i === 12) return;

  const marked = {
    ...(state.player.marked || {})
  };

  marked[i] = !marked[i];

  await store.updatePlayer(
    state.roomCode,
    uid,
    { marked }
  );
}

function renderHome() {
  appEl.innerHTML = `
    <div class="panel">
      <h1>Bingo MVP</h1>

      <h2>Create Room</h2>

      <input id="roomName" placeholder="Room Name">
      <input id="playerName" placeholder="Your Name">

      <button onclick="createRoom()">
        Create Room
      </button>

      <hr>

      <h2>Join Room</h2>

      <input id="joinName" placeholder="Your Name">
      <input id="joinCode" placeholder="Room Code">

      <button onclick="joinRoom()">
        Join Room
      </button>

      <p>
        ${
          CONFIG.demoMode
            ? 'Demo mode'
            : 'Firebase live mode'
        }
      </p>
    </div>
  `;
}

function renderRoom() {
  const room = state.room;
  const player = state.player;

  appEl.innerHTML = `
    <div class="panel">
      <h1>${esc(room.roomName)}</h1>

      <p>
        Room Code:
        <strong>${room.code}</strong>
      </p>

      <p>
        Current Call:
        <strong>${room.current || '-'}</strong>
      </p>

      ${
        amHost(room)
          ? `
            <button onclick="startGame()">
              Start Game
            </button>

            <button onclick="callNext()">
              Call Next
            </button>
          `
          : ''
      }

      <h2>Players</h2>

      <div>
        ${Object.values(room.players)
          .map(p => `
            <div>
              ${esc(p.name)}
              ${p.id === room.hostId ? '👑' : ''}
            </div>
          `)
          .join('')}
      </div>

      <h2>Your Card</h2>

      <div class="card-grid">
        ${player.card.map((x, i) => `
          <button
            class="cell ${
              player.marked?.[i] ? 'marked' : ''
            }"
            onclick="toggleMark(${i})"
          >
            ${esc(x)}
          </button>
        `).join('')}
      </div>
    </div>
  `;
}

window.addEventListener('load', () => {
  renderHome();
});

