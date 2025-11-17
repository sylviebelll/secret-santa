// Room management
function getRoomId() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('room') || null;
}

function createNewRoom() {
  const newRoomId = Math.random().toString(36).substring(2, 9);
  window.location.href = `app.html?room=${newRoomId}`;
}

function joinRoom(roomCode) {
  const roomId = roomCode.trim().toLowerCase();
  if (!roomId || roomId.length < 3) {
    alert("please enter a valid room code (at least 3 characters)");
    return;
  }
  
  window.location.href = `app.html?room=${roomId}`;
}

function getShareableLink() {
  const roomId = getRoomId();
  // Use app.html for shareable links
  const baseUrl = window.location.origin + window.location.pathname.replace(/[^/]*$/, '');
  return baseUrl + 'app.html?room=' + roomId;
}

// Storage keys (room-specific)
function getStorageKey(roomId, key) {
  return `secretSanta_${roomId}_${key}`;
}

// Get room ID - if null, show landing page
const ROOM_ID = getRoomId();
let STORAGE_KEY, MATCHES_KEY, CURRENT_USER_KEY, DEVICE_ID_KEY, HOST_KEY;

// Only set storage keys if we have a room
if (ROOM_ID) {
  STORAGE_KEY = getStorageKey(ROOM_ID, "wishlists");
  MATCHES_KEY = getStorageKey(ROOM_ID, "matches");
  CURRENT_USER_KEY = getStorageKey(ROOM_ID, "currentUser");
  DEVICE_ID_KEY = getStorageKey(ROOM_ID, "deviceId");
  HOST_KEY = getStorageKey(ROOM_ID, "host");
}

// Generate or retrieve a unique device ID for this browser/device
// Uses a global device ID (not room-specific) so device tracking works across rooms
function getDeviceId() {
  try {
    const GLOBAL_DEVICE_KEY = 'secretSanta_global_deviceId';
    let deviceId = localStorage.getItem(GLOBAL_DEVICE_KEY);
    if (!deviceId) {
      // Generate a unique ID based on browser fingerprint + timestamp
      deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
      localStorage.setItem(GLOBAL_DEVICE_KEY, deviceId);
    }
    return deviceId;
  } catch (e) {
    console.error("Could not get device ID", e);
    return null;
  }
}

// Check if this device has already submitted a wishlist
function hasDeviceSubmitted() {
  try {
    const deviceId = getDeviceId();
    if (!deviceId) return false;
    
    const wishlists = loadWishlists();
    // Check if any wishlist has this device ID stored
    return wishlists.some(w => w.deviceId === deviceId);
  } catch (e) {
    return false;
  }
}

// Get the name associated with this device
function getDeviceSubmissionName() {
  try {
    const deviceId = getDeviceId();
    if (!deviceId) return null;
    
    const wishlists = loadWishlists();
    const submission = wishlists.find(w => w.deviceId === deviceId);
    return submission ? submission.name : null;
  } catch (e) {
    return null;
  }
}

// Host management (synced via Firebase)
let currentHostId = null;
let hostListener = null;

function getHostDeviceId() {
  // Return current synced host ID (from Firebase or localStorage)
  if (useFirebase && currentHostId !== null) {
    return currentHostId;
  }
  
  // Fallback to localStorage
  try {
    return localStorage.getItem(HOST_KEY) || null;
  } catch (e) {
    return null;
  }
}

function setHostDeviceId(deviceId) {
  if (useFirebase) {
    const hostRef = getRoomRef('host');
    if (hostRef) {
      window.firebaseSet(hostRef, deviceId).catch(e => {
        console.error("Could not save host to Firebase", e);
      });
    }
  }
  
  // Also save to localStorage as fallback
  try {
    localStorage.setItem(HOST_KEY, deviceId);
  } catch (e) {
    console.error("Could not save host device ID", e);
  }
  
  currentHostId = deviceId;
}

function isHost() {
  const deviceId = getDeviceId();
  const hostId = getHostDeviceId();
  
  if (!deviceId) return false;
  
  // If no host is set and we're using Firebase, try to claim host
  if (!hostId && deviceId) {
    if (useFirebase) {
      // Try to set host in Firebase (only if it doesn't exist)
      const hostRef = getRoomRef('host');
      if (hostRef) {
        // Use a transaction-like approach: check if host exists, if not, set it
        window.firebaseOnValue(hostRef, (snapshot) => {
          const existingHost = snapshot.val();
          if (!existingHost) {
            setHostDeviceId(deviceId);
          }
        }, { onlyOnce: true });
      }
    } else {
      // localStorage fallback: first person becomes host
      setHostDeviceId(deviceId);
      return true;
    }
  }
  
  return deviceId === hostId;
}

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

// Form and UI elements - wait for DOM to be ready
let form, nameInput, wishlistInput, listContainer, countLabel, clearMyBtn;
let generateBtn, matchesList, matchHint, hostIndicator;

function initElements() {
  form = document.getElementById("wishlistForm");
  nameInput = document.getElementById("name");
  wishlistInput = document.getElementById("wishlist");
  listContainer = document.getElementById("wishlistList");
  countLabel = document.getElementById("countLabel");
  clearMyBtn = document.getElementById("clearMyWishlist");
  generateBtn = document.getElementById("generateMatches");
  matchesList = document.getElementById("matchesList");
  matchHint = document.getElementById("matchHint");
  hostIndicator = document.getElementById("hostIndicator");
  
  if (!generateBtn) {
    console.error("Generate matches button not found!");
  }
}

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
    // Initialize if not set yet
    if (window.currentWishlists === undefined) {
      window.currentWishlists = [];
    }
    return window.currentWishlists;
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
    // Initialize if not set yet
    if (window.currentMatches === undefined) {
      window.currentMatches = [];
    }
    return window.currentMatches;
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

// Remove undefined values from data (Firebase doesn't allow undefined)
function cleanDataForFirebase(data) {
  if (Array.isArray(data)) {
    return data.map(item => cleanDataForFirebase(item));
  } else if (data && typeof data === 'object') {
    const cleaned = {};
    for (const key in data) {
      if (data[key] !== undefined) {
        cleaned[key] = cleanDataForFirebase(data[key]);
      }
    }
    return cleaned;
  }
  return data;
}

function saveMatches(matches) {
  if (useFirebase) {
    const matchesRef = getRoomRef('matches');
    if (matchesRef) {
      // Remove undefined values before saving to Firebase
      const cleanedMatches = cleanDataForFirebase(matches);
      window.firebaseSet(matchesRef, cleanedMatches).catch(e => {
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
      window.currentWishlists = Array.isArray(data) ? data : (data ? [data] : []);
      if (!window.currentWishlists) window.currentWishlists = [];
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
  
  // Listen to host changes
  const hostRef = getRoomRef('host');
  if (hostRef) {
    let hostCheckDone = false;
    hostListener = window.firebaseOnValue(hostRef, (snapshot) => {
      const hostId = snapshot.val();
      currentHostId = hostId || null;
      
      // Update localStorage as backup
      if (hostId) {
        try {
          localStorage.setItem(HOST_KEY, hostId);
        } catch (e) {
          console.error("Could not save host to localStorage", e);
        }
      }
      
      // On first load, if no host exists, try to claim it
      if (!hostCheckDone && !hostId) {
        hostCheckDone = true;
        const deviceId = getDeviceId();
        if (deviceId) {
          console.log("No host found, claiming host status...");
          setHostDeviceId(deviceId);
          return; // Will update again when setHostDeviceId triggers listener
        }
      }
      hostCheckDone = true;
      
      // Update UI to reflect host status
      if (typeof updateHostUI === 'function') {
        updateHostUI();
      } else {
        // Fallback: update UI directly
        const deviceId = getDeviceId();
        const isHostNow = deviceId === hostId;
        if (generateBtn) {
          generateBtn.style.display = isHostNow ? "block" : "none";
        }
        if (hostIndicator) {
          hostIndicator.style.display = isHostNow ? "block" : "none";
        }
      }
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
    const hostMode = isHost();
    
    wishlists.forEach((entry, index) => {
      const card = document.createElement("article");
      card.className = "wishlist-card";

      const header = document.createElement("div");
      header.className = "wishlist-name";
      header.style.display = "flex";
      header.style.justifyContent = "space-between";
      header.style.alignItems = "center";
      
      const nameInfo = document.createElement("div");
      nameInfo.style.display = "flex";
      nameInfo.style.gap = "0.5rem";
      nameInfo.style.alignItems = "center";
      nameInfo.innerHTML = `
        <span>${entry.name}</span>
        <span>${entry.items.length} item${
          entry.items.length === 1 ? "" : "s"
        }</span>
      `;
      header.appendChild(nameInfo);
      
      // Add delete button for host
      if (hostMode) {
        const deleteBtn = document.createElement("button");
        deleteBtn.className = "btn-delete";
        deleteBtn.textContent = "×";
        deleteBtn.title = "delete this wishlist";
        deleteBtn.style.cssText = "background: #e8a8a2; color: white; border: none; border-radius: 4px; width: 24px; height: 24px; cursor: pointer; font-size: 18px; line-height: 1; padding: 0; display: flex; align-items: center; justify-content: center;";
        deleteBtn.addEventListener("click", () => {
          if (confirm(`delete "${entry.name}"'s wishlist?`)) {
            const updatedWishlists = wishlists.filter((_, i) => i !== index);
            saveWishlists(updatedWishlists);
            saveMatches([]); // Clear matches when wishlist is deleted
            renderWishlists();
            renderMatches();
          }
        });
        header.appendChild(deleteBtn);
      }

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
      return base.map((giver, i) => {
        const match = {
          giver: giver.name,
          receiver: shuffled[i].name,
        };
        // Only include deviceId if it exists (for backwards compatibility)
        if (giver.deviceId) {
          match.giverDeviceId = giver.deviceId;
        }
        if (shuffled[i].deviceId) {
          match.receiverDeviceId = shuffled[i].deviceId;
        }
        return match;
      });
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
  // Match by deviceId first (more reliable), fallback to name for backwards compatibility
  const deviceId = getDeviceId();
  const userMatch = deviceId && matches.some(m => m.giverDeviceId === deviceId)
    ? matches.find(m => m.giverDeviceId === deviceId)
    : currentUser 
      ? matches.find(m => {
          const giverName = m.giver.trim().toLowerCase();
          const userName = currentUser.trim().toLowerCase();
          const match = giverName === userName;
          if (!match) {
            console.log(`Name mismatch: "${giverName}" !== "${userName}"`);
          }
          return match;
        })
      : null;
  
  console.log("Current user:", currentUser, "User match:", userMatch, "All matches:", matches);
  console.log("Available giver names:", matches.map(m => m.giver));

  if (!currentUser) {
    const container = document.createElement("div");
    container.style.padding = "0.5rem";
    
    const p = document.createElement("p");
    p.className = "matches-empty";
    p.textContent = "enter your name to see your match:";
    p.style.marginBottom = "0.5rem";
    container.appendChild(p);
    
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.placeholder = "your name";
    nameInput.style.width = "100%";
    nameInput.style.padding = "0.4rem";
    nameInput.style.marginBottom = "0.4rem";
    nameInput.style.borderRadius = "6px";
    nameInput.style.border = "1px solid #cbaebe";
    
    const viewBtn = document.createElement("button");
    viewBtn.className = "btn-primary";
    viewBtn.textContent = "view my match";
    viewBtn.style.width = "100%";
    
    viewBtn.addEventListener("click", () => {
      const name = nameInput.value.trim();
      if (name) {
        setCurrentUserName(name);
        renderMatches(); // Re-render to show the match
      } else {
        alert("please enter your name");
      }
    });
    
    nameInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        viewBtn.click();
      }
    });
    
    container.appendChild(nameInput);
    container.appendChild(viewBtn);
    matchesList.appendChild(container);
    matchHint.textContent = "enter your name above to see your secret santa match.";
    return;
  }

  if (!userMatch) {
    const container = document.createElement("div");
    container.style.padding = "0.5rem";
    
    const p = document.createElement("p");
    p.className = "matches-empty";
    p.textContent = `no match found for "${currentUser}".`;
    p.style.marginBottom = "0.5rem";
    container.appendChild(p);
    
    const p2 = document.createElement("p");
    p2.style.fontSize = "0.75rem";
    p2.style.color = "#7a5b65";
    p2.textContent = "Available names in matches: " + matches.map(m => m.giver).join(", ");
    p2.style.marginBottom = "0.3rem";
    container.appendChild(p2);
    
    const p3 = document.createElement("p");
    p3.style.fontSize = "0.75rem";
    p3.style.color = "#7a5b65";
    p3.textContent = "Enter your name exactly as it appears above (case doesn't matter):";
    p3.style.marginBottom = "0.5rem";
    container.appendChild(p3);
    
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.placeholder = "your name";
    nameInput.value = currentUser;
    nameInput.style.width = "100%";
    nameInput.style.padding = "0.4rem";
    nameInput.style.marginBottom = "0.4rem";
    nameInput.style.borderRadius = "6px";
    nameInput.style.border = "1px solid #cbaebe";
    
    const viewBtn = document.createElement("button");
    viewBtn.className = "btn-primary";
    viewBtn.textContent = "try again";
    viewBtn.style.width = "100%";
    
    viewBtn.addEventListener("click", () => {
      const name = nameInput.value.trim();
      if (name) {
        setCurrentUserName(name);
        renderMatches(); // Re-render to show the match
      }
    });
    
    nameInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        viewBtn.click();
      }
    });
    
    container.appendChild(nameInput);
    container.appendChild(viewBtn);
    matchesList.appendChild(container);
    matchHint.textContent = "your match will appear here once found.";
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

  // Find receiver by deviceId if available, otherwise by name
  const receiverWishlist = pair.receiverDeviceId
    ? wishlists.find(w => w.deviceId === pair.receiverDeviceId)
    : wishlists.find(
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
function setupEventListeners() {
  if (!form || !generateBtn) {
    console.error("Form elements not found, retrying...");
    setTimeout(setupEventListeners, 100);
    return;
  }
  
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
  const nameLower = name.trim().toLowerCase();
  const deviceId = getDeviceId();
  
  // PRIMARY CHECK: Has this device already submitted? (prevents refresh bypass)
  if (hasDeviceSubmitted()) {
    const existingName = getDeviceSubmissionName();
    if (existingName && existingName.toLowerCase() === nameLower) {
      // Same device, same name - allow updating
      const existingIndex = wishlists.findIndex(
        (entry) => entry.deviceId === deviceId && entry.name.trim().toLowerCase() === nameLower
      );
      
      if (existingIndex !== -1) {
        wishlists[existingIndex] = { name, items: rawWishlist, deviceId };
        saveWishlists(wishlists);
        renderWishlists();
        saveMatches([]);
        renderMatches();
        
        wishlistInput.value = "";
        wishlistInput.focus();
        
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = "wishlist updated!";
        submitBtn.style.background = "#c6e3c3";
        setTimeout(() => {
          submitBtn.textContent = originalText;
          submitBtn.style.background = "";
        }, 1500);
        return;
      }
    } else {
      // Same device, different name - BLOCK (one submission per device)
      alert(`this device has already submitted a wishlist${existingName ? ` as "${existingName}"` : ''}. each person can only submit once.`);
      if (existingName) {
        nameInput.value = existingName;
      }
      return;
    }
  }
  
  // Note: We allow duplicate names (multiple people can have the same name)
  // The device ID ensures each device can only submit once

  // New submission - add it with device ID
  const newEntry = { name, items: rawWishlist, deviceId };
  wishlists.push(newEntry);

  // Store the current user's name so they can see their own match
  setCurrentUserName(name);

  saveWishlists(wishlists);
  renderWishlists();

  // any change to wishlists invalidates previous matches
  saveMatches([]);
  renderMatches();

  wishlistInput.value = "";
  nameInput.value = ""; // Clear name input after first submission
  wishlistInput.focus();
  
  // Show success message
  const submitBtn = form.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;
  submitBtn.textContent = "wishlist saved!";
  submitBtn.style.background = "#c6e3c3";
  setTimeout(() => {
    submitBtn.textContent = originalText;
    submitBtn.style.background = "";
  }, 1500);
  });

  if (clearMyBtn) {
    clearMyBtn.addEventListener("click", () => {
      const currentUser = getCurrentUserName();
      // Only allow clearing if they haven't submitted yet, or show a warning
      if (currentUser) {
        const confirmClear = confirm("you have already submitted a wishlist. clearing will not remove your submission, but you can update it by submitting again.");
        if (!confirmClear) {
          return;
        }
      }
      nameInput.value = "";
      wishlistInput.value = "";
      nameInput.focus();
    });
  }
  
  // Disable name input if user has already submitted
  function updateFormState() {
    if (hasDeviceSubmitted()) {
      const existingName = getDeviceSubmissionName();
      if (existingName) {
        nameInput.value = existingName;
        nameInput.disabled = true;
        nameInput.style.opacity = "0.6";
        nameInput.style.cursor = "not-allowed";
        nameInput.title = "you have already submitted a wishlist";
        // Also set current user name for match viewing
        setCurrentUserName(existingName);
      }
    }
  }
  
  // Check form state on load
  updateFormState();
  
  // Show/hide generate button based on host status
  function updateHostUI() {
    const hostMode = isHost();
    if (generateBtn) {
      if (hostMode) {
        generateBtn.style.display = "block";
      } else {
        generateBtn.style.display = "none";
        if (matchHint) {
          matchHint.textContent = "only the host can generate matches. wait for the host to generate them.";
        }
      }
    }
    
    // Show host indicator
    if (hostIndicator) {
      if (hostMode) {
        hostIndicator.style.display = "block";
      } else {
        hostIndicator.style.display = "none";
      }
    }
  }
  
  updateHostUI();

  if (generateBtn) {
    generateBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Only host can generate matches
      if (!isHost()) {
        alert("only the host can generate matches.");
        return;
      }
      
      const wishlists = loadWishlists();
      const existingMatches = loadMatches();
      
      console.log("Generating matches for wishlists:", wishlists);

      if (!wishlists || wishlists.length < 2) {
        alert("you need at least 2 people to generate secret santa matches.");
        return;
      }

      // Check if matches already exist
      if (existingMatches && existingMatches.length > 0) {
        // Count unique givers in existing matches
        const existingGiverCount = new Set(existingMatches.map(m => m.giver.toLowerCase().trim())).size;
        const currentWishlistCount = wishlists.length;
        
        console.log("Existing matches found:", existingGiverCount, "givers,", currentWishlistCount, "wishlists");
        
        // Only allow regeneration if more people have been added
        if (currentWishlistCount <= existingGiverCount) {
          alert(`matches have already been generated for ${existingGiverCount} people. add more people to regenerate matches.`);
          return;
        }
        
        // Warn before regenerating
        const confirmRegenerate = confirm(
          `${currentWishlistCount - existingGiverCount} new person(s) added. regenerate matches? (this will create new assignments for everyone)`
        );
        if (!confirmRegenerate) {
          return;
        }
      }

      const matches = generateDerangement(wishlists);
      if (!matches) {
        alert("could not generate matches. try again.");
        return;
      }

      console.log("Generated matches:", matches);
      saveMatches(matches);
      renderMatches();
      
      // Show success message
      const originalText = generateBtn.textContent;
      generateBtn.textContent = "matches generated!";
      generateBtn.style.background = "#c6e3c3";
      setTimeout(() => {
        generateBtn.textContent = originalText;
        generateBtn.style.background = "";
      }, 2000);
    });
    console.log("✅ Generate matches button listener attached");
  } else {
    console.error("❌ Generate matches button not found!");
  }
}

/* ========== falling snow ========== */
const snowflakeChars = ['❄', '❅', '❆', '✱', '✲', '✳'];
let activeSnowflakes = 0;

// Detect iOS for performance optimizations
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
const MAX_SNOWFLAKES = isIOS ? 30 : 100; // Limit on iOS, more on desktop

function createSnowflake() {
  if (!snowLayer) return;
  
  // Disable snow completely on iOS
  if (isIOS) return;
  
  // Limit snowflakes on screen for better performance (especially on iOS)
  if (activeSnowflakes >= MAX_SNOWFLAKES) return;

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
  activeSnowflakes++;

  flake.addEventListener("animationend", () => {
    flake.remove();
    activeSnowflakes--;
  });
}

// Spawn rate: slower on iOS for performance, faster on desktop for full effect
const snowflakeInterval = isIOS ? 300 : 100; // iOS: 300ms, Desktop: 100ms (original)

// spawn snowflakes (disabled on iOS)
if (!isIOS) {
  setInterval(createSnowflake, snowflakeInterval);
}

/* ========== cursor pixel dust trail ========== */
let lastTrailTime = 0;
const trailDelay = isIOS ? 50 : 20; // Slower on iOS for better performance
let activePixels = 0;
const MAX_PIXELS = isIOS ? 10 : 50; // Limit on iOS, more on desktop

window.addEventListener("pointermove", (event) => {
  // Disable cursor trail on touch devices (iOS) for better performance
  if (isIOS && event.pointerType === 'touch') return;
  
  const now = performance.now();
  if (now - lastTrailTime < trailDelay) return;
  if (activePixels >= MAX_PIXELS) return;
  
  lastTrailTime = now;

  const pixel = document.createElement("div");
  pixel.className = "cursor-pixel";
  pixel.style.left = `${event.clientX}px`;
  pixel.style.top = `${event.clientY}px`;

  document.body.appendChild(pixel);
  activePixels++;

  pixel.addEventListener("animationend", () => {
    pixel.remove();
    activePixels--;
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
        createNewRoom();
      }
    });
  }
}

// Landing page logic is now in landing.js
// This function is kept for backwards compatibility but shouldn't be called from app.html
function initLandingPage() {
  // If we're on app.html and no room is provided, redirect to landing page
  const currentRoomId = getRoomId();
  if (!currentRoomId) {
    window.location.href = 'index.html';
    return true;
  }
  return false;
}

/* ========== initial render ========== */
// Wait for Firebase to load, then initialize
function initializeApp() {
  // Re-check room ID from URL (in case it changed)
  const currentRoomId = getRoomId();
  
  // Re-initialize storage keys now that we have a room
  if (currentRoomId) {
    STORAGE_KEY = getStorageKey(currentRoomId, "wishlists");
    MATCHES_KEY = getStorageKey(currentRoomId, "matches");
    CURRENT_USER_KEY = getStorageKey(currentRoomId, "currentUser");
    DEVICE_ID_KEY = getStorageKey(currentRoomId, "deviceId");
    HOST_KEY = getStorageKey(currentRoomId, "host");
  }
  
  // Check Firebase - wait for module to load
  function tryInitFirebase(attempts = 0) {
    if (window.firebaseReady || window.firebaseDatabase) {
      checkFirebase();
      if (useFirebase) {
        setupFirebaseListeners();
        console.log("✅ Firebase connected - real-time sync enabled");
        
        // Host claiming is now handled in the host listener
      } else {
        console.log("ℹ️ Using localStorage (Firebase not configured)");
        // Fallback: set host in localStorage if not set
        const deviceId = getDeviceId();
        const hostId = getHostDeviceId();
        if (!hostId && deviceId) {
          setHostDeviceId(deviceId);
        }
      }
    } else if (attempts < 10) {
      // Try again after a short delay (up to 10 times = 2 seconds)
      setTimeout(() => tryInitFirebase(attempts + 1), 200);
      return;
    } else {
      // Give up after 2 seconds
      checkFirebase();
      console.log("ℹ️ Using localStorage (Firebase not configured or failed to load)");
    }
  }
  
  tryInitFirebase();
  
  // Initialize DOM elements
  initElements();
  
  // Setup event listeners
  setupEventListeners();
  
  initRoomSharing();
  renderWishlists();
  renderMatches();
}

// Check if we have a room - if not, redirect to landing page
const currentRoomId = getRoomId();
if (!currentRoomId) {
  window.location.href = 'index.html';
} else {
  // Wait for DOM to be ready, then initialize app
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
  } else {
    initializeApp();
  }
}
