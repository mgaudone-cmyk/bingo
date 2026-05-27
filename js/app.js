/* Clean Multiplayer Bingo MVP
   Root-level version. No nested paths. No build tools.
*/

const CONFIG = window.BINGO_CONFIG || { demoMode: true };
const appEl = document.getElementById("app");

const uid = getOrCreateId("bingo_uid");
const playerNameKey = "bingo_name";

let state = {
  roomCode: null,
  room: null,
  player: null,
  error: "",
  info: ""
};

let unsubscribeRoom = null;

const NUMBER_POOL = Array.from({ length: 75 }, (_, i) => String(i + 1));

function getOrCreateId(key) {
  let id = localStorage.getItem(key);
  if (!id) {
    id = "p_" + Math.random().toString(36).slice(2, 10);
    localStorage.setItem(key, id);
  }
  return id;
}

function now() {
  return Date.now();
}

function code() {
  return Math.random().toString(36).replace(/[^a-z0-9]/g, "").slice(2, 8).toUpperCase();
}

function esc(s = "") {
  return String(s).replace(/[&<>'"]/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  }[c]));
}

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

function range(start, end) {
  return Array.from({ length: end - start + 1 }, (_, i) => String(start + i));
}

function roomUrl(roomCode) {
  return `${location.origin}${location.pathname}?room=${roomCode}`;
}

function isFirebaseReady() {
  return Boolean(
    !CONFIG.demoMode &&
    CONFIG.firebaseConfig &&
    CONFIG.firebaseConfig.apiKey &&
    CONFIG.firebaseConfig.databaseURL &&
    !CONFIG.firebaseConfig.apiKey.includes("PASTE")
  );
}

class FirebaseStore {
  constructor() {
    if (!firebase.apps.length) {
      firebase.initializeApp(CONFIG.firebaseConfig);
    }
    this.db = firebase.database();
  }

  ref(path) {
    return this.db.ref(path);
  }

  async getRoom(roomCode) {
    const snap = await this.ref(`rooms/${roomCode}`).get();
    return snap.val();
  }

  listenRoom(roomCode, cb) {
    const ref = this.ref(`rooms/${roomCode}`);
    ref.on("value", snap => cb(snap.val()));
    return () => ref.off();
  }

  async setRoom(roomCode, room) {
    await this.ref(`rooms/${roomCode}`).set(room);
  }

  async updateRoom(roomCode, patch) {
    await this.ref(`rooms/${roomCode}`).update({ ...patch, updatedAt: now() });
  }

  async updatePlayer(roomCode, playerId, patch) {
    await this.ref(`rooms/${roomCode}/players/${playerId}`).update(patch);
  }

  async listPublicRooms() {
    const snap = await this.ref("rooms").get();
    const rooms = snap.val() || {};
    return Object.values(rooms)
      .filter(r => r.isPublic && r.status !== "finished")
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, 20);
  }
}

class DemoStore {
  constructor() {
    this.listeners = {};
    window.addEventListener("storage", e => {
      if (e.key && e.key.startsWith("demo_room_") && state.roomCode) {
        this.notify(state.roomCode);
      }
    });
  }

  key(roomCode) {
    return `demo_room_${roomCode}`;
  }

  async getRoom(roomCode) {
    return JSON.parse(localStorage.getItem(this.key(roomCode)) || "null");
  }

  listenRoom(roomCode, cb) {
    this.listeners[roomCode] = cb;
    this.notify(roomCode);
    return () => delete this.listeners[roomCode];
  }

  async setRoom(roomCode, room) {
    localStorage.setItem(this.key(roomCode), JSON.stringify(room));
    this.notify(roomCode);
  }

  async updateRoom(roomCode, patch) {
    const room = await this.getRoom(roomCode);
    await this.setRoom(roomCode, { ...room, ...patch, updatedAt: now() });
  }

  async updatePlayer(roomCode, playerId, patch) {
    const room = await this.getRoom(roomCode);
    room.players[playerId] = { ...(room.players[playerId] || {}), ...patch };
    await this.setRoom(roomCode, room);
  }

  async listPublicRooms() {
    return Object.keys(localStorage)
      .filter(k => k.startsWith("demo_room_"))
      .map(k => JSON.parse(localStorage.getItem(k)))
      .filter(r => r.isPublic && r.status !== "finished")
      .reverse();
  }

  async notify(roomCode) {
    if (this.listeners[roomCode]) {
      this.listeners[roomCode](await this.getRoom(roomCode));
    }
  }
}

const store = isFirebaseReady() ? new FirebaseStore() : new DemoStore();

function parseCustomList(text) {
  return String(text || "")
    .split(/[\n,]+/)
    .map(x => x.trim())
    .filter(Boolean)
    .slice(0, 200);
}

function makeCard(pool) {
  const isClassicNumbers = pool.length === 75 && pool.every((x, i) => String(x) === String(i + 1));

  if (isClassicNumbers) {
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
        card.push(row === 2 && col === 2 ? "FREE" : columns[col][row]);
      }
    }
    return card;
  }

  const items = shuffle(pool).slice(0, 24);
  if (items.length < 24) {
    throw new Error("You need at least 24 custom words or phrases.");
  }
  items.splice(12, 0, "FREE");
  return items;
}

function makePlayer(name, pool) {
  return {
    id: uid,
    name: name || "Player",
    card: makeCard(pool),
    marked: { 12: true },
    joinedAt: now(),
    onlineAt: now()
  };
}

function players(room) {
  return Object.values(room?.players || {}).sort((a, b) => a.joinedAt - b.joinedAt);
}

function amHost(room) {
  const ps = players(room);
  return room?.hostId === uid || ps[0]?.id === uid;
}

function labelMode(mode) {
  return {
    one: "One line",
    two: "Two lines",
    full: "Full card"
  }[mode] || mode;
}

function header(title = "Bingo") {
  return `
    <div class="header">
      <div>
        <div class="brand">${title}</div>
        <div class="muted">${isFirebaseReady() ? "Firebase live mode" : "Demo mode"}</div>
      </div>
      <button class="secondary" onclick="goHome()">Home</button>
    </div>
  `;
}

function flash() {
  return `
    ${state.error ? `<div class="notice error">${esc(state.error)}</div>` : ""}
    ${state.info ? `<div class="notice success">${esc(state.info)}</div>` : ""}
  `;
}

function setError(msg) {
  state.error = msg;
  state.info = "";
  render();
}

function setInfo(msg) {
  state.info = msg;
  state.error = "";
  render();
}

function goHome() {
  if (unsubscribeRoom) unsubscribeRoom();
  state = { roomCode: null, room: null, player: null, error: "", info: "" };
  history.replaceState({}, "", location.pathname);
  renderHome();
}

function baseRoom(form) {
  const pool = form.cardType === "numbers" ? NUMBER_POOL : parseCustomList(form.customList);

  return {
    code: code(),
    roomName: form.roomName || "Bingo Room",
    isPublic: form.isPublic,
    mode: form.mode,
    cardType: form.cardType,
    pool,
    called: [],
    current: "",
    status: "lobby",
    hostId: uid,
    createdAt: now(),
    updatedAt: now(),
    winner: null,
    players: {}
  };
}

async function createRoom(form) {
  try {
    const room = baseRoom(form);
    const name = localStorage.getItem(playerNameKey) || "Host";
    room.players[uid] = makePlayer(name, room.pool);
    await store.setRoom(room.code, room);
    joinRoomView(room.code, true);
  } catch (e) {
    setError(e.message);
  }
}

async function joinRoom(roomCode, nickname) {
  try {
    roomCode = String(roomCode || "").trim().toUpperCase();

    if (!roomCode) {
      return setError("Enter a room code.");
    }

    const room = await store.getRoom(roomCode);

    if (!room) {
      return setError("Room not found. Check the code.");
    }

    if (players(room).length >= 10 && !room.players[uid]) {
      return setError("This room already has 10 players.");
    }

    localStorage.setItem(playerNameKey, nickname || "Player");

    if (!room.players[uid]) {
      await store.updatePlayer(roomCode, uid, makePlayer(nickname || "Player", room.pool));
    } else {
      await store.updatePlayer(roomCode, uid, { name: nickname || "Player", onlineAt: now() });
    }

    joinRoomView(roomCode, true);
  } catch (e) {
    setError(e.message);
  }
}

function joinRoomView(roomCode, replace = false) {
  state.roomCode = roomCode;

  if (unsubscribeRoom) unsubscribeRoom();

  unsubscribeRoom = store.listenRoom(roomCode, room => {
    if (!room) {
      state.error = "Room no longer exists.";
      renderHome();
      return;
    }

    if (!room.players?.[room.hostId]) {
      const firstPlayer = players(room)[0];
      if (firstPlayer) {
        store.updateRoom(roomCode, { hostId: firstPlayer.id });
      }
    }

    state.room = room;
    state.player = room.players?.[uid] || null;
    state.error = "";
    render();
  });

  const url = new URL(location.href);
  url.searchParams.set("room", roomCode);
  if (replace) history.replaceState({}, "", url);
}

async function startGame() {
  if (!state.room || !state.player) {
    return setError("Player not connected to room.");
  }

  if (!amHost(state.room)) {
    return setError("Only the host can start the game.");
  }

  await store.updateRoom(state.roomCode, {
    status: "playing",
    winner: null,
    hostId: uid
  });
}

async function callNext() {
  const room = state.room;
  const remaining = room.pool.filter(x => !room.called.includes(x));

  if (!remaining.length) {
    return setError("No more items to call.");
  }

  const next = shuffle(remaining)[0];

  await store.updateRoom(state.roomCode, {
    current: next,
    called: [...room.called, next],
    status: "playing"
  });
}

async function toggleMark(i) {
  if (i === 12 || !state.player) return;

  const marked = { ...(state.player.marked || {}) };
  marked[i] = !marked[i];

  await store.updatePlayer(state.roomCode, uid, { marked });
}

async function claimBingo() {
  const result = validateCard(state.player.card, state.player.marked || {}, state.room.called, state.room.mode);

  if (!result.valid) {
    return setError(result.message);
  }

  await store.updateRoom(state.roomCode, {
    status: "finished",
    winner: {
      playerId: uid,
      name: state.player.name,
      pattern: result.pattern,
      at: now()
    }
  });
}

async function resetRound() {
  const room = state.room;
  const nextPlayers = {};

  players(room).forEach(p => {
    nextPlayers[p.id] = makePlayer(p.name, room.pool);
  });

  await store.updateRoom(state.roomCode, {
    players: nextPlayers,
    called: [],
    current: "",
    status: "lobby",
    winner: null
  });
}

function allLines() {
  const lines = [];

  for (let r = 0; r < 5; r++) {
    lines.push([0, 1, 2, 3, 4].map(c => r * 5 + c));
  }

  for (let c = 0; c < 5; c++) {
    lines.push([0, 1, 2, 3, 4].map(r => r * 5 + c));
  }

  lines.push([0, 6, 12, 18, 24], [4, 8, 12, 16, 20]);

  return lines;
}

function validateCard(card, marked, called, mode) {
  const calledSet = new Set(called.concat("FREE"));

  if (mode === "full") {
    const ok = card.every((x, i) => x === "FREE" || (marked[i] && calledSet.has(x)));
    return ok
      ? { valid: true, pattern: "Full card" }
      : { valid: false, message: "Not a full-card Bingo yet. Only called items count." };
  }

  const count = allLines().filter(line => line.every(i => marked[i] && calledSet.has(card[i]))).length;

  if (mode === "one" && count >= 1) return { valid: true, pattern: "One line" };
  if (mode === "two" && count >= 2) return { valid: true, pattern: "Two lines" };

  return { valid: false, message: `Not valid yet. You have ${count} completed line(s).` };
}

function render() {
  if (!state.room) return renderHome();
  if (state.room.status === "lobby") return renderLobby();
  if (state.room.status === "finished") return renderWinner();
  return renderGame();
}

async function renderHome() {
  const publicRooms = await store.listPublicRooms();

  appEl.innerHTML = `
    ${header("Bingo MVP")}
    ${flash()}

    <div class="panel grid two">
      <div>
        <h2>Create a room</h2>
        <p class="muted">Host a private or public room for up to 10 players.</p>
        <button onclick="renderCreate()">Create room</button>
      </div>

      <div>
        <h2>Join a room</h2>
        <label>Nickname</label>
        <input id="joinName" value="${esc(localStorage.getItem(playerNameKey) || "")}" placeholder="Your nickname">

        <label>Room code</label>
        <input id="joinCode" placeholder="ABC123">

        <button onclick="joinRoom(document.getElementById('joinCode').value, document.getElementById('joinName').value || 'Player')">
          Join room
        </button>
      </div>
    </div>

    <div class="panel">
      <h2>Public rooms</h2>
      <div class="rooms-list">
        ${
          publicRooms.length
            ? publicRooms.map(r => `
                <button class="secondary" onclick="quickJoin('${r.code}')">
                  ${esc(r.roomName)} <span class="code">${r.code}</span>
                </button>
              `).join("")
            : '<span class="muted">No public rooms yet.</span>'
        }
      </div>
    </div>
  `;
}

function quickJoin(roomCode) {
  const name = localStorage.getItem(playerNameKey) || prompt("Nickname?") || "Player";
  joinRoom(roomCode, name);
}

function renderCreate() {
  appEl.innerHTML = `
    ${header("Create Room")}
    ${flash()}

    <div class="panel">
      <label>Room name</label>
      <input id="roomName" value="Friday Bingo">

      <label>Your nickname</label>
      <input id="hostName" value="${esc(localStorage.getItem(playerNameKey) || "Host")}">

      <label>Room visibility</label>
      <select id="isPublic">
        <option value="false">Private room</option>
        <option value="true">Public room</option>
      </select>

      <label>Win condition</label>
      <select id="mode">
        <option value="one">One line</option>
        <option value="two">Two lines</option>
        <option value="full">Full card</option>
      </select>

      <label>Card type</label>
      <select id="cardType" onchange="document.getElementById('customBox').style.display=this.value==='words'?'block':'none'">
        <option value="numbers">Classic number Bingo 1-75</option>
        <option value="words">Custom word or phrase Bingo</option>
      </select>

      <div id="customBox" style="display:none">
        <label>Custom words or phrases, one per line or comma-separated. Minimum 24.</label>
        <textarea id="customList" placeholder="coffee&#10;pizza&#10;movie night&#10;... minimum 24 items"></textarea>
      </div>

      <div class="footer-actions row">
        <button onclick="submitCreate()">Create room</button>
        <button class="secondary" onclick="renderHome()">Cancel</button>
      </div>
    </div>
  `;
}

function submitCreate() {
  const hostName = document.getElementById("hostName").value || "Host";
  localStorage.setItem(playerNameKey, hostName);

  createRoom({
    roomName: document.getElementById("roomName").value || "Bingo Room",
    isPublic: document.getElementById("isPublic").value === "true",
    mode: document.getElementById("mode").value,
    cardType: document.getElementById("cardType").value,
    customList: document.getElementById("customList").value
  });
}

function renderLobby() {
  const r = state.room;
  const url = roomUrl(r.code);

  appEl.innerHTML = `
    ${header("Lobby")}
    ${flash()}

    <div class="panel">
      <div class="row space">
        <h2>${esc(r.roomName)}</h2>
        <span class="code">${r.code}</span>
      </div>

      <p class="muted">
        Share this link:
        <input readonly value="${url}" onclick="this.select()">
      </p>

      <div class="qr-wrap">
        <canvas id="qr"></canvas>
      </div>

      <p>
        <b>Mode:</b> ${labelMode(r.mode)}
        · <b>Type:</b> ${r.cardType === "numbers" ? "Numbers" : "Words"}
        · <b>Visibility:</b> ${r.isPublic ? "Public" : "Private"}
      </p>

      <h3>Players (${players(r).length}/10)</h3>

      <div class="players">
        ${players(r).map(p => `
          <span class="pill ${p.id === r.hostId ? "host" : ""}">
            ${esc(p.name)}${p.id === r.hostId ? " 👑" : ""}
          </span>
        `).join("")}
      </div>

      <div class="footer-actions row">
        ${
          amHost(r)
            ? '<button onclick="startGame()">Start game</button>'
            : '<span class="muted">Waiting for host to start.</span>'
        }
        <button class="secondary" onclick="copyLink()">Copy link</button>
      </div>
    </div>
  `;

  const qr = document.getElementById("qr");
  if (window.QRCode && qr) {
    QRCode.toCanvas(qr, url, { width: 150 });
  }
}

function renderGame() {
  const r = state.room;
  const p = state.player;

  if (!p) {
    return setError("Player not connected to room.");
  }

  appEl.innerHTML = `
    ${header("Game")}
    ${flash()}

    <div class="panel">
      <div class="row space">
        <span class="code">${r.code}</span>
        <span class="pill">${labelMode(r.mode)}</span>
      </div>

      <p class="muted">Current call</p>
      <div class="current-call">${esc(r.current || "Ready")}</div>

      <div class="row footer-actions">
        ${amHost(r) ? '<button onclick="callNext()">Call Next</button>' : ""}
        <button class="good" onclick="claimBingo()">Bingo!</button>
        ${amHost(r) ? '<button class="secondary" onclick="resetRound()">Reset round</button>' : ""}
      </div>
    </div>

    <div class="panel">
      <h2>Your card</h2>

      <div class="bingo-headers">
        <span>B</span><span>I</span><span>N</span><span>G</span><span>O</span>
      </div>

      <div class="card-grid">
        ${p.card.map((x, i) => `
          <button
            class="cell ${p.marked?.[i] ? "marked" : ""} ${i === 12 ? "free" : ""}"
            onclick="toggleMark(${i})"
          >
            ${esc(x)}
          </button>
        `).join("")}
      </div>
    </div>

    <div class="panel">
      <h3>Call history</h3>
      <div class="history">
        ${
          r.called.length
            ? r.called.slice().reverse().map(x => `<span class="pill">${esc(x)}</span>`).join("")
            : '<span class="muted">No calls yet.</span>'
        }
      </div>

      <h3>Players</h3>
      <div class="players">
        ${players(r).map(pl => `
          <span class="pill ${pl.id === r.hostId ? "host" : ""}">
            ${esc(pl.name)}${pl.id === r.hostId ? " 👑" : ""}
          </span>
        `).join("")}
      </div>
    </div>
  `;
}

function renderWinner() {
  const r = state.room;

  appEl.innerHTML = `
    ${header("Winner")}
    ${flash()}

    <div class="panel">
      <h1>🎉 ${esc(r.winner?.name || "Winner")} wins!</h1>
      <p class="pill">${esc(r.winner?.pattern || "")}</p>
      <p class="muted">Room ${r.code}</p>

      <div class="row">
        ${
          amHost(r)
            ? '<button onclick="resetRound()">New round</button>'
            : '<span class="muted">Waiting for host to start a new round.</span>'
        }
        <button class="secondary" onclick="renderGame()">View board</button>
      </div>
    </div>
  `;
}

function copyLink() {
  navigator.clipboard?.writeText(roomUrl(state.room.code));
  setInfo("Link copied.");
}

window.addEventListener("load", () => {
  const urlRoom = new URL(location.href).searchParams.get("room");

  if (urlRoom) {
    const nickname = localStorage.getItem(playerNameKey) || prompt("Enter your nickname to join") || "Player";
    joinRoom(urlRoom, nickname);
  } else {
    renderHome();
  }
});
