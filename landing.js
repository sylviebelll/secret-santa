// Landing page script - handles room joining and creation

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

// Initialize landing page
function initLandingPage() {
  const landingPage = document.getElementById("landing-page");
  const joinRoomForm = document.getElementById("joinRoomForm");
  const createRoomBtn = document.getElementById("createRoomBtn");
  const roomCodeInput = document.getElementById("roomCodeInput");
  
  // If there's a room code in URL, redirect to app
  const roomId = getRoomId();
  if (roomId) {
    window.location.href = `app.html?room=${roomId}`;
    return;
  }
  
  // Landing page is visible by default in CSS, no need to show it
  
  // Join room form
  if (joinRoomForm) {
    joinRoomForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const roomCode = roomCodeInput?.value.trim();
      if (roomCode) {
        joinRoom(roomCode);
      }
    });
  }
  
  // Create room button
  if (createRoomBtn) {
    createRoomBtn.addEventListener("click", () => {
      createNewRoom();
    });
  }
  
  // Focus on input
  if (roomCodeInput) {
    roomCodeInput.focus();
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLandingPage);
} else {
  initLandingPage();
}

