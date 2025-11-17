# Firebase Setup Instructions

To enable real-time sharing across multiple devices, you need to set up Firebase Realtime Database.

**You do NOT need Firebase Hosting** - you can host your files anywhere (GitHub Pages, Netlify, or even just open the HTML file locally). You only need the Realtime Database.

## Step 1: Create a Firebase Project

1. Go to https://console.firebase.google.com/
2. Click "Add project" or select an existing project
3. Follow the setup wizard:
   - Enter a project name (e.g., "Secret Santa")
   - You can disable Google Analytics if you want (it's optional)
   - Click "Create project"
   - Wait for it to finish, then click "Continue"

## Step 2: Enable Realtime Database

1. In your Firebase project dashboard, look for "Realtime Database" in the left sidebar
2. Click "Realtime Database"
3. Click "Create Database"
4. Choose a location (pick the closest to you - e.g., `us-central1`)
5. **Important**: Start in "Test mode" (this allows read/write for now)
6. Click "Enable"

## Step 3: Get Your Firebase Config

1. In Firebase Console, click the gear icon ⚙️ next to "Project Overview" (top left)
2. Select "Project settings"
3. Scroll down to the "Your apps" section
4. If you don't see any apps, click the `</>` (web) icon to add a web app
5. Register your app:
   - Give it a nickname like "Secret Santa" (this is just for your reference)
   - You don't need to check "Also set up Firebase Hosting" - skip that
   - Click "Register app"
6. You'll see a `firebaseConfig` object - copy all of it

## Step 4: Add Config to index.html

1. Open `index.html` in your code editor
2. Find the `firebaseConfig` object (around lines 14-25)
3. You'll see placeholder values like `"YOUR_API_KEY"`, `"YOUR_PROJECT_ID"`, etc.
4. Replace ALL the placeholder values with your actual Firebase config values

For example, if your Firebase config looks like this:
```javascript
const firebaseConfig = {
  apiKey: "AIzaSyC1234567890abcdefghijklmnopqrstuv",
  authDomain: "my-secret-santa.firebaseapp.com",
  databaseURL: "https://my-secret-santa-default-rtdb.firebaseio.com",
  projectId: "my-secret-santa",
  storageBucket: "my-secret-santa.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef1234567890"
};
```

Then replace the entire `firebaseConfig` object in `index.html` with your actual values.

## Step 5: Secure Your Database (Important!)

1. In Firebase Console, go back to "Realtime Database" in the left sidebar
2. Click on the "Rules" tab (next to "Data")
3. You'll see some default rules - replace them with this:

```json
{
  "rules": {
    "rooms": {
      "$roomId": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```

4. Click "Publish" button
5. This allows anyone with a room link to read/write to that room (perfect for Secret Santa!)

## Step 6: Test It!

1. Open your `index.html` file in a browser (just double-click it, or use a local server)
2. Open the same file in a different browser window/tab
3. Copy the room link from one window and paste it in the other (or just make sure both have the same `?room=XXXXX` in the URL)
4. Add a wishlist in one window
5. **It should appear in the other window automatically!** 🎉

If you see "🟢 real-time sync" in the room section, Firebase is working!

## Troubleshooting

- **"Firebase not configured" or "⚪ local only"**: 
  - Make sure you replaced ALL the placeholder values in index.html
  - Check browser console (F12) for errors
  - Make sure you saved the file after editing

- **Permission denied**: 
  - Go back to Firebase Console > Realtime Database > Rules
  - Make sure you published the rules from Step 5

- **Not syncing**: 
  - Check browser console (F12) for error messages
  - Make sure both windows have the same room code in the URL
  - Try refreshing both windows

- **Still using localStorage**: 
  - Firebase might not have loaded - check the console
  - Make sure your config values are correct (no quotes around the actual values, but keep quotes around the keys)

## How to Share with Friends

You have a few options:

**Option 1: GitHub Pages (Recommended)**
1. Push your code to a GitHub repository
2. Go to repository Settings > Pages
3. Enable GitHub Pages (select main branch)
4. Share the GitHub Pages URL with friends!

**Option 2: Netlify Drop**
1. Go to https://app.netlify.com/drop
2. Drag and drop your entire folder
3. Share the URL they give you!

**Option 3: Any Web Hosting**
- Upload your files to any web hosting service
- Share the URL

**Important**: The app works with Firebase from any URL - you don't need Firebase Hosting!

