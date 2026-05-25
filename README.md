# Simple Multiplayer Bingo MVP

A beginner-friendly, GitHub-ready multiplayer Bingo web app.

## What this MVP does

- Web app only: HTML, CSS, JavaScript.
- Up to 10 players per room.
- Public or private rooms.
- Host creates a room and shares a room code, link, or QR code.
- Players join with nickname only.
- No login required.
- Host can choose one line, two lines, or full card.
- Supports classic number Bingo and custom word/phrase Bingo.
- Each player receives a unique randomized card.
- Host calls the next item.
- Players mark their own card.
- Player clicks Bingo and the app validates the claim.
- Host can reset/start a new round.
- Demo mode works without Firebase.

## Free hosting choice

This project is designed for **GitHub Pages** because it is free and works well for static files like `index.html`, CSS, and JavaScript.

For real-time multiplayer, GitHub Pages alone is not enough because it cannot store and sync live room data across different phones/computers. For live sync, this app uses **Firebase Realtime Database free tier**. Firebase is used only as a simple shared live database. No authentication, no server code, and no paid API are required for this MVP.

## Folder structure

```text
bingo-mvp/
  index.html
  README.md
  firebase-rules-testing.json
  css/
    styles.css
  js/
    app.js
    config.js
    config.example.js
```

## How to test immediately without Firebase

1. Open `index.html` in your browser.
2. The app starts in **demo mode** because `js/config.js` has `demoMode: true`.
3. Create a room.
4. Copy the room link.
5. Open the link in another tab on the same browser.
6. Join with a different nickname.

### Demo mode limitation

Demo mode uses your browser's local storage. It is only for testing. It does **not** sync across different devices.

## Firebase setup for beginners

Firebase gives the app a shared live database so players on different devices can see the same room.

### Firebase products to enable

Enable only this product:

- **Realtime Database**

Do not enable these for the MVP:

- Authentication
- Firestore
- Storage
- Hosting
- Cloud Functions

### Step-by-step Firebase setup

1. Go to the Firebase Console.
2. Click **Add project**.
3. Enter a project name, for example `bingo-mvp`.
4. Google Analytics can be turned off for this MVP.
5. Click **Create project**.
6. On the project overview screen, click the **Web app icon**. It looks like `</>`.
7. Enter an app nickname, for example `bingo-web`.
8. Do **not** check Firebase Hosting.
9. Click **Register app**.
10. Firebase will show a block of code containing `firebaseConfig`.
11. Copy only the config object values.
12. Open this file in your project: `js/config.js`.
13. Replace the placeholder values inside `firebaseConfig`.
14. Change `demoMode: true` to `demoMode: false`.

Your `js/config.js` should look similar to this:

```js
window.BINGO_CONFIG = {
  demoMode: false,
  firebaseConfig: {
    apiKey: "your-api-key",
    authDomain: "your-project.firebaseapp.com",
    databaseURL: "https://your-project-default-rtdb.firebaseio.com",
    projectId: "your-project",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abc123"
  }
};
```

### Create the Realtime Database

1. In Firebase Console, open **Build**.
2. Click **Realtime Database**.
3. Click **Create database**.
4. Choose a location close to you or your users.
5. Choose **Start in test mode**.
6. Click **Enable**.

### Exact testing rules

For beginner testing, paste these rules in Realtime Database > Rules:

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

The same rules are included in `firebase-rules-testing.json`.

### Important warning

These rules are **unsafe for production**. They allow anyone who knows your database URL to read and write data. Use them only while testing with friends or yourself.

Before real public use, add stronger rules, room cleanup, rate limits, and probably anonymous authentication.

## Firebase working checklist

Use this checklist after you paste the Firebase config:

- [ ] `js/config.js` has `demoMode: false`.
- [ ] `firebaseConfig` values are no longer placeholders.
- [ ] Realtime Database is created.
- [ ] Testing rules are pasted and published.
- [ ] You open the app in Chrome or Safari.
- [ ] You create a room.
- [ ] You open the room link on another device.
- [ ] The second device can join with a nickname.
- [ ] The player list updates on both devices.
- [ ] Host clicks **Call Next** and both devices see the same called item.

## Deploy to GitHub Pages

### Option A: Upload through GitHub website

1. Go to GitHub.
2. Click **New repository**.
3. Name it something like `bingo-mvp`.
4. Choose **Public**.
5. Click **Create repository**.
6. Click **uploading an existing file**.
7. Upload all files and folders from this project.
8. Click **Commit changes**.
9. Go to **Settings**.
10. Go to **Pages**.
11. Under **Build and deployment**, choose:
    - Source: **Deploy from a branch**
    - Branch: **main**
    - Folder: **/root**
12. Click **Save**.
13. Wait 1–3 minutes.
14. GitHub will show your live app URL.

### Option B: Push with Git

```bash
git init
git add .
git commit -m "Initial Bingo MVP"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/bingo-mvp.git
git push -u origin main
```

Then enable GitHub Pages from repository Settings > Pages.

## Data model

Firebase stores rooms like this:

```text
rooms/
  ROOMCODE/
    code
    roomName
    isPublic
    mode
    cardType
    pool
    called
    current
    status
    hostId
    winner
    players/
      PLAYERID/
        id
        name
        card
        marked
        joinedAt
```

## MVP limitations

- No accounts or authentication.
- Testing rules are not production-safe.
- No automatic old-room cleanup.
- Host transfer is basic: if the host player record disappears, the first remaining player becomes host.
- Demo mode only works across tabs on the same browser/device.
- QR generation uses a public CDN library.
- Firebase SDK is loaded from Google's CDN.

## Future upgrades

- Safer Firebase rules.
- Anonymous login.
- Room passwords.
- Ads on public room screen.
- Premium rooms with more players.
- Custom themes.
- Saved player profiles.
- Larger rooms.
- Better host transfer with heartbeat/offline detection.
- Automatic cleanup of old rooms.
- Better public-room search and filters.
