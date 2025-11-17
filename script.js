// Room management
function getRoomId() {
  const urlParams = new URLSearchParams(window.location.search);
  let roomId = urlParams.get('room');
  
  if (!roomId) {
    // Generate a new room ID
    roomId = Math.random().toString(36).substring(2, 9);
    const newUrl = new URL(window.location);
    newUrl.searchParams.set('room', roomId);
    window.history.replaceState({}, '', newUrl);
  }
  
  return roomId;
}

function getShareableLink() {
  const roomId = getRoomId();
  return window.location.origin + window.location.pathname + '?room=' + roomId;
}

// Storage keys (room-specific)
function getStorageKey(roomId, key) {
  return `secretSanta_${roomId}_${key}`;
}

const ROOM_ID = getRoomId();
const STORAGE_KEY = getStorageKey(ROOM_ID, "wishlists");
const MATCHES_KEY = getStorageKey(ROOM_ID, "matches");
const CURRENT_USER_KEY = getStorageKey(ROOM_ID, "currentUser");

// Get current user's name (from their wishlist submission)
function getCurrentUserName() {
  try {
    return localStorage.getItem(CURRENT_USER_KEY) || null;
  } catch (e) {
    return null;
  }
}

function setCurrentUserName(name) {
  try {
    localStorage.setItem(CURRENT_USER_KEY, name);
  } catch (e) {
    console.error("Could not save current user name", e);
  }
}

// Form and UI elements
const form = document.getElementById("wishlistForm");
const nameInput = document.getElementById("name");
const wishlistInput = document.getElementById("wishlist");
const listContainer = document.getElementById("wishlistList");
const countLabel = document.getElementById("countLabel");
const clearMyBtn = document.getElementById("clearMyWishlist");

const generateBtn = document.getElementById("generateMatches");
const matchesList = document.getElementById("matchesList");
const matchHint = document.getElementById("matchHint");

// Snow layer
const snowLayer = document.getElementById("snow-layer");

/* ========== Firebase/Storage helpers ========== */
let useFirebase = false;
let wishlistsListener = null;
let matchesListener = null;

// Check if Firebase is available
function checkFirebase() {
  useFirebase = window.firebaseDatabase && 
                window.firebaseRef && 
                window.firebaseSet && 
                window.firebaseOnValue;
  
  if (!useFirebase) {
    console.warn("Firebase not configured. Using localStorage fallback.");
  }
  
  return useFirebase;
}

function getRoomRef(path) {
  if (useFirebase) {
    return window.firebaseRef(window.firebaseDatabase, `rooms/${ROOM_ID}/${path}`);
  }
  return null;
}

function loadWishlists() {
  if (useFirebase) {
    // Return current state (will be updated via listener)
    return window.currentWishlists || [];
  }
  
  // Fallback to localStorage
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error("Could not read wishlists", e);
    return [];
  }
}

function saveWishlists(list) {
  if (useFirebase) {
    const wishlistsRef = getRoomRef('wishlists');
    if (wishlistsRef) {
      window.firebaseSet(wishlistsRef, list).catch(e => {
        console.error("Could not save wishlists to Firebase", e);
      });
    }
    return;
  }
  
  // Fallback to localStorage
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    console.error("Could not save wishlists", e);
  }
}

function loadMatches() {
  if (useFirebase) {
    return window.currentMatches || [];
  }
  
  // Fallback to localStorage
  try {
    const raw = localStorage.getItem(MATCHES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error("Could not read matches", e);
    return [];
  }
}

function saveMatches(matches) {
  if (useFirebase) {
    const matchesRef = getRoomRef('matches');
    if (matchesRef) {
      window.firebaseSet(matchesRef, matches).catch(e => {
        console.error("Could not save matches to Firebase", e);
      });
    }
    return;
  }
  
  // Fallback to localStorage
  try {
    localStorage.setItem(MATCHES_KEY, JSON.stringify(matches));
  } catch (e) {
    console.error("Could not save matches", e);
  }
}

function setupFirebaseListeners() {
  if (!useFirebase) {
    updateSyncStatus("offline", "local only");
    return;
  }
  
  updateSyncStatus("online", "real-time sync");
  
  // Listen to wishlists changes
  const wishlistsRef = getRoomRef('wishlists');
  if (wishlistsRef) {
    wishlistsListener = window.firebaseOnValue(wishlistsRef, (snapshot) => {
      const data = snapshot.val();
      window.currentWishlists = Array.isArray(data) ? data : [];
      renderWishlists();
    });
  }
  
  // Listen to matches changes
  const matchesRef = getRoomRef('matches');
  if (matchesRef) {
    matchesListener = window.firebaseOnValue(matchesRef, (snapshot) => {
      const data = snapshot.val();
      window.currentMatches = Array.isArray(data) ? data : [];
      renderMatches();
    });
  }
}

function updateSyncStatus(status, text) {
  const statusEl = document.getElementById("syncStatus");
  if (statusEl) {
    if (status === "online") {
      statusEl.textContent = "🟢 " + text;
      statusEl.style.color = "#4a7c59";
    } else {
      statusEl.textContent = "⚪ " + text;
      statusEl.style.color = "#7a5b65";
    }
  }
}

/* ========== render wishlists ========== */
function renderWishlists() {
  const wishlists = loadWishlists();
  listContainer.innerHTML = "";

  if (wishlists.length === 0) {
    const p = document.createElement("p");
    p.className = "wishlist-empty";
    p.textContent =
      "no wishlists yet. once someone adds one, it will appear here.";
    listContainer.appendChild(p);
  } else {
    wishlists.forEach((entry) => {
      const card = document.createElement("article");
      card.className = "wishlist-card";

      const header = document.createElement("div");
      header.className = "wishlist-name";
      header.innerHTML = `
        <span>${entry.name}</span>
        <span>${entry.items.length} item${
          entry.items.length === 1 ? "" : "s"
        }</span>
      `;

      const list = document.createElement("ul");
      list.className = "wishlist-items";
      entry.items.forEach((item) => {
        const li = document.createElement("li");
        li.textContent = item;
        list.appendChild(li);
      });

      card.appendChild(header);
      card.appendChild(list);
      listContainer.appendChild(card);
    });
  }

  countLabel.textContent =
    wishlists.length === 1 ? "1 person" : `${wishlists.length} people`;
}

/* ========== derangement (matching) ========== */
function generateDerangement(entries) {
  const n = entries.length;
  const base = entries.slice();

  let attempts = 0;
  while (attempts < 1000) {
    const shuffled = entries.slice();
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    let valid = true;
    for (let i = 0; i < n; i++) {
      if (
        shuffled[i].name.trim().toLowerCase() ===
        base[i].name.trim().toLowerCase()
      ) {
        valid = false;
        break;
      }
    }

    if (valid) {
      return base.map((giver, i) => ({
        giver: giver.name,
        receiver: shuffled[i].name,
      }));
    }

    attempts += 1;
  }
  return null;
}

function renderMatches() {
  const matches = loadMatches();
  const wishlists = loadWishlists();
  const currentUser = getCurrentUserName();
  matchesList.innerHTML = "";

  if (matches.length === 0) {
    const p = document.createElement("p");
    p.className = "matches-empty";
    p.textContent =
      'no matches yet. click "generate matches" when you are ready.';
    matchesList.appendChild(p);
    matchHint.textContent =
      "generate matches when everyone has entered their wishlist.";
    return;
  }

  // Filter to only show the current user's match
  const userMatch = currentUser 
    ? matches.find(m => m.giver.trim().toLowerCase() === currentUser.trim().toLowerCase())
    : null;

  if (!currentUser) {
    const p = document.createElement("p");
    p.className = "matches-empty";
    p.textContent = "add your wishlist first to see your match.";
    matchesList.appendChild(p);
    matchHint.textContent = "generate matches when everyone has entered their wishlist.";
    return;
  }

  if (!userMatch) {
    const p = document.createElement("p");
    p.className = "matches-empty";
    p.textContent = `no match found for "${currentUser}". make sure you've added your wishlist and matches have been generated.`;
    matchesList.appendChild(p);
    matchHint.textContent = "your match will appear here once generated.";
    return;
  }

  matchHint.textContent = "click below to reveal your secret santa match!";

  // Only render the current user's match
  const pair = userMatch;
  const card = document.createElement("article");
  card.className = "match-card";

  const header = document.createElement("div");
  header.className = "match-header";

  const giverLabel = document.createElement("div");
  giverLabel.className = "match-giver";
  giverLabel.textContent = "your match";

  const revealBtn = document.createElement("button");
  revealBtn.type = "button";
  revealBtn.className = "btn-primary btn-small";
  revealBtn.textContent = "reveal match";

  header.appendChild(giverLabel);
  header.appendChild(revealBtn);

  const details = document.createElement("div");
  details.className = "match-details hidden";

  const receiverWishlist = wishlists.find(
    (w) =>
      w.name.trim().toLowerCase() ===
      pair.receiver.trim().toLowerCase()
  );

  const title = document.createElement("h3");
  title.textContent = `you are shopping for: ${pair.receiver}`;
  details.appendChild(title);

  if (receiverWishlist && receiverWishlist.items.length > 0) {
    const hint = document.createElement("p");
    hint.style.marginBottom = "0.2rem";
    hint.textContent = "their wishlist:";
    details.appendChild(hint);

    const list = document.createElement("ul");
    receiverWishlist.items.forEach((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      list.appendChild(li);
    });
    details.appendChild(list);
  } else {
    const noList = document.createElement("p");
    noList.textContent = "they did not add any items.";
    details.appendChild(noList);
  }

  revealBtn.addEventListener("click", () => {
    details.classList.toggle("hidden");
    revealBtn.textContent = details.classList.contains("hidden")
      ? "reveal match"
      : "hide match";
  });

  card.appendChild(header);
  card.appendChild(details);
  matchesList.appendChild(card);
}

/* ========== form events ========== */
form.addEventListener("submit", (event) => {
  event.preventDefault();

  const name = nameInput.value.trim();
  const rawWishlist = wishlistInput.value
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (!name || rawWishlist.length === 0) {
    alert("please enter your name and at least one wishlist item.");
    return;
  }

  const wishlists = loadWishlists();
  const existingIndex = wishlists.findIndex(
    (entry) => entry.name.trim().toLowerCase() === name.toLowerCase()
  );

  const newEntry = { name, items: rawWishlist };

  if (existingIndex !== -1) {
    wishlists[existingIndex] = newEntry;
  } else {
    wishlists.push(newEntry);
  }

  // Store the current user's name so they can see their own match
  setCurrentUserName(name);

  saveWishlists(wishlists);
  renderWishlists();

  // any change to wishlists invalidates previous matches
  saveMatches([]);
  renderMatches();

  wishlistInput.value = "";
  wishlistInput.focus();
});

clearMyBtn.addEventListener("click", () => {
  nameInput.value = "";
  wishlistInput.value = "";
  nameInput.focus();
});

generateBtn.addEventListener("click", () => {
  const wishlists = loadWishlists();

  if (wishlists.length < 2) {
    alert("you need at least 2 people to generate secret santa matches.");
    return;
  }

  const matches = generateDerangement(wishlists);
  if (!matches) {
    alert("could not generate matches. try again.");
    return;
  }

  saveMatches(matches);
  renderMatches();
});

/* ========== falling snow ========== */
const snowflakeChars = ['❄', '❅', '❆', '✱', '✲', '✳'];

function createSnowflake() {
  if (!snowLayer) return;

  const flake = document.createElement("div");
  const useChar = Math.random() < 0.75; // 75% chance of using character
  const flakeType = useChar ? 'snowflake-char' : 'snowflake-shape';
  flake.className = `snowflake ${flakeType}`;

  const startX = Math.random() * window.innerWidth;
  const size = 8 + Math.random() * 12; // larger range: 8-20px
  const xOffset = (Math.random() - 0.5) * 120; // more drift
  const duration = 10 + Math.random() * 12; // slower: 10-22s
  const rotationSpeed = (Math.random() - 0.5) * 360; // random rotation direction and speed

  flake.style.left = `${startX}px`;
  flake.style.setProperty("--size", `${size}px`);
  flake.style.setProperty("--x-offset", `${xOffset}px`);
  flake.style.setProperty("--duration", `${duration}s`);
  flake.style.setProperty("--rotation", `${rotationSpeed}deg`);

  if (useChar) {
    flake.textContent = snowflakeChars[Math.floor(Math.random() * snowflakeChars.length)];
  }

  snowLayer.appendChild(flake);

  flake.addEventListener("animationend", () => {
    flake.remove();
  });
}

// spawn snowflakes more frequently
setInterval(createSnowflake, 100);

/* ========== cursor pixel dust trail ========== */
let lastTrailTime = 0;
const trailDelay = 20; // milliseconds

window.addEventListener("pointermove", (event) => {
  const now = performance.now();
  if (now - lastTrailTime < trailDelay) return;
  lastTrailTime = now;

  const pixel = document.createElement("div");
  pixel.className = "cursor-pixel";
  pixel.style.left = `${event.clientX}px`;
  pixel.style.top = `${event.clientY}px`;

  document.body.appendChild(pixel);

  pixel.addEventListener("animationend", () => {
    pixel.remove();
  });
});

/* ========== startup boot animation ========== */
function typeText(element, text, speed = 30, callback) {
  let index = 0;
  element.textContent = "";
  element.classList.add("visible", "typing");

  function typeChar() {
    if (index < text.length) {
      element.textContent += text[index];
      index += 1;
      setTimeout(typeChar, speed);
    } else {
      element.classList.remove("typing");
      if (callback) callback();
    }
  }

  typeChar();
}

function typeTextWithHTML(element, fullText, speed = 30, callback) {
  let index = 0;
  element.innerHTML = "";
  element.classList.add("visible", "typing");

  // Find where the HTML element should be inserted
  const commandText = "santa.exe";
  const commandIndex = fullText.indexOf(commandText);
  
  function typeChar() {
    if (index < fullText.length) {
      // Rebuild the content each time
      const beforeCommand = fullText.substring(0, Math.min(index, commandIndex));
      const afterCommandStart = commandIndex + commandText.length;
      
      element.innerHTML = "";
      
      if (index <= commandIndex) {
        // Before or at command start
        element.appendChild(document.createTextNode(fullText.substring(0, index)));
      } else if (index < afterCommandStart) {
        // During command - show command with styling
        element.appendChild(document.createTextNode(beforeCommand));
        const span = document.createElement("span");
        span.className = "boot-command";
        const typedCommand = fullText.substring(commandIndex, index);
        span.textContent = typedCommand;
        element.appendChild(span);
      } else {
        // After command
        element.appendChild(document.createTextNode(beforeCommand));
        const span = document.createElement("span");
        span.className = "boot-command";
        span.textContent = commandText;
        element.appendChild(span);
        element.appendChild(document.createTextNode(fullText.substring(afterCommandStart, index)));
      }
      
      index += 1;
      setTimeout(typeChar, speed);
    } else {
      element.classList.remove("typing");
      if (callback) callback();
    }
  }

  typeChar();
}

function runBootSequence() {
  const bootScreen = document.getElementById("boot-screen");
  if (!bootScreen) {
    // If for some reason there is no boot screen, just ensure desktop is visible
    document.body.classList.remove("booting");
    return;
  }

  const lines = bootScreen.querySelectorAll(".boot-line");
  const progressFill = document.getElementById("boot-progress-fill");
  const progressText = document.getElementById("boot-progress-text");
  const totalLines = lines.length;
  let currentLine = 0;

  function updateProgress() {
    const percent = Math.round((currentLine / totalLines) * 100);
    progressFill.style.width = `${percent}%`;
    progressText.textContent = `${percent}%`;
  }

  function showNextLine() {
    if (currentLine < lines.length) {
      const line = lines[currentLine];
      const textData = line.getAttribute("data-text");
      const hasHTML = line.getAttribute("data-html") === "true";

      if (hasHTML && textData) {
        // Special handling for the last line with HTML
        const fullText = textData + "santa.exe to begin.";
        typeTextWithHTML(line, fullText, 25, () => {
          currentLine += 1;
          updateProgress();
          setTimeout(showNextLine, 300);
        });
      } else if (textData) {
        // Regular text typing
        typeText(line, textData, 25, () => {
          currentLine += 1;
          updateProgress();
          setTimeout(showNextLine, 300);
        });
      } else {
        // Fallback for lines without data-text
        line.classList.add("visible");
        currentLine += 1;
        updateProgress();
        setTimeout(showNextLine, 300);
      }
    } else {
      // After last line, ensure progress is at 100% then hide boot screen
      updateProgress();
      setTimeout(() => {
        bootScreen.classList.add("boot-screen--hide");
        document.body.classList.remove("booting");
      }, 800);
    }
  }

  // Initialize progress bar
  updateProgress();

  // Small delay before the first line appears to feel more natural
  setTimeout(showNextLine, 400);
}

/* ========== decorative terminal auto-complete animation ========== */
function animateDecorativeTerminal(terminalCommand, fullCommand, speed = 60) {
  let index = 0;
  let isTyping = true;
  
  function typeChar() {
    if (isTyping && index < fullCommand.length) {
      terminalCommand.textContent = fullCommand.substring(0, index + 1);
      index += 1;
      setTimeout(typeChar, speed);
    } else if (isTyping) {
      // Finished typing, wait then start deleting
      isTyping = false;
      setTimeout(() => {
        deleteChar();
      }, 2000);
    }
  }
  
  function deleteChar() {
    if (!isTyping && index > 0) {
      terminalCommand.textContent = fullCommand.substring(0, index - 1);
      index -= 1;
      setTimeout(deleteChar, speed / 2); // Delete faster than typing
    } else if (!isTyping && index === 0) {
      // Finished deleting, wait then restart
      setTimeout(() => {
        isTyping = true;
        typeChar();
      }, 1500);
    }
  }
  
  // Start typing after a random delay
  const startDelay = Math.random() * 2000;
  setTimeout(typeChar, startDelay);
}

function initDecorativeTerminals() {
  console.log("🔍 Initializing decorative terminals...");
  const decorativeWindows = document.querySelectorAll(".window-decorative");
  console.log(`Found ${decorativeWindows.length} decorative windows`);
  
  decorativeWindows.forEach((window, index) => {
    const rect = window.getBoundingClientRect();
    console.log(`Window ${index + 1}:`, {
      visible: window.offsetParent !== null,
      display: window.style.display || getComputedStyle(window).display,
      opacity: getComputedStyle(window).opacity,
      zIndex: getComputedStyle(window).zIndex,
      position: getComputedStyle(window).position,
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height
    });
  });
  
  const terminals = document.querySelectorAll(".terminal-command");
  console.log(`Found ${terminals.length} terminal command elements`);
  
  terminals.forEach((terminal, index) => {
    const fullCommand = terminal.getAttribute("data-command");
    console.log(`Terminal ${index + 1}:`, {
      command: fullCommand,
      parent: terminal.parentElement?.className,
      visible: terminal.offsetParent !== null
    });
    if (fullCommand) {
      animateDecorativeTerminal(terminal, fullCommand);
    }
  });
}

// Run boot sequence and initialize decorative terminals after page fully loads
window.addEventListener("load", () => {
  runBootSequence();
  // Wait for boot sequence to finish before starting terminal animations
  setTimeout(initDecorativeTerminals, 5000);
});

/* ========== room sharing ========== */
function initRoomSharing() {
  const roomCodeEl = document.getElementById("roomCode");
  const copyLinkBtn = document.getElementById("copyLinkBtn");
  const newRoomBtn = document.getElementById("newRoomBtn");
  
  if (roomCodeEl) {
    roomCodeEl.textContent = ROOM_ID.toUpperCase();
  }
  
  if (copyLinkBtn) {
    copyLinkBtn.addEventListener("click", async () => {
      const link = getShareableLink();
      try {
        await navigator.clipboard.writeText(link);
        copyLinkBtn.textContent = "copied!";
        copyLinkBtn.style.background = "#c6e3c3";
        setTimeout(() => {
          copyLinkBtn.textContent = "copy share link";
          copyLinkBtn.style.background = "";
        }, 2000);
      } catch (e) {
        // Fallback for older browsers
        const textarea = document.createElement("textarea");
        textarea.value = link;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        copyLinkBtn.textContent = "copied!";
        setTimeout(() => {
          copyLinkBtn.textContent = "copy share link";
        }, 2000);
      }
    });
  }
  
  if (newRoomBtn) {
    newRoomBtn.addEventListener("click", () => {
      if (confirm("Create a new room? This will clear all wishlists and matches in the current room.")) {
        // Generate new room ID
        const newRoomId = Math.random().toString(36).substring(2, 9);
        const newUrl = new URL(window.location);
        newUrl.searchParams.set('room', newRoomId);
        window.location.href = newUrl.toString();
      }
    });
  }
}

/* ========== initial render ========== */
// Wait for Firebase to load, then initialize
function initializeApp() {
  // Check Firebase after a short delay to allow it to load
  setTimeout(() => {
    checkFirebase();
    if (useFirebase) {
      setupFirebaseListeners();
      console.log("✅ Firebase connected - real-time sync enabled");
    } else {
      console.log("ℹ️ Using localStorage (Firebase not configured)");
    }
  }, 500);
  
  initRoomSharing();
  renderWishlists();
  renderMatches();
}

initializeApp();
