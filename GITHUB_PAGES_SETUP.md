# GitHub Pages Setup Guide

Follow these steps to host your Secret Santa app on GitHub Pages so you can share it with friends!

## Step 1: Create a GitHub Account (if you don't have one)

1. Go to https://github.com/
2. Sign up for a free account (or sign in if you already have one)

## Step 2: Create a New Repository

1. Click the "+" icon in the top right corner
2. Select "New repository"
3. Fill in the details:
   - **Repository name**: `secret-santa` (or any name you like)
   - **Description**: "Secret Santa gift matching app" (optional)
   - **Visibility**: Choose "Public" (required for free GitHub Pages)
   - **DO NOT** check "Initialize this repository with a README" (we'll upload files manually)
4. Click "Create repository"

## Step 3: Upload Your Files

You have two options:

### Option A: Using GitHub's Web Interface (Easiest)

1. On your new repository page, click "uploading an existing file"
2. Drag and drop ALL your files from the "Secret Santa" folder:
   - `index.html`
   - `script.js`
   - `style.css`
   - `fireplace.jpg` (if you have it)
   - Any other files in your folder
3. Scroll down and click "Commit changes"
4. Wait for the files to upload

### Option B: Using Git Command Line (If you have Git installed)

1. Open Terminal/Command Prompt
2. Navigate to your Secret Santa folder:
   ```bash
   cd "/Users/sylvie/Desktop/Secret Santa"
   ```
3. Initialize git (if not already done):
   ```bash
   git init
   ```
4. Add all files:
   ```bash
   git add .
   ```
5. Commit:
   ```bash
   git commit -m "Initial commit - Secret Santa app"
   ```
6. Add your GitHub repository as remote:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/secret-santa.git
   ```
   (Replace `YOUR_USERNAME` with your actual GitHub username)
7. Push to GitHub:
   ```bash
   git branch -M main
   git push -u origin main
   ```

## Step 4: Enable GitHub Pages

1. Go to your repository on GitHub
2. Click "Settings" (top menu bar)
3. Scroll down to "Pages" in the left sidebar
4. Under "Source", select:
   - **Branch**: `main` (or `master` if that's what you have)
   - **Folder**: `/ (root)`
5. Click "Save"
6. Wait a minute or two for GitHub to build your site

## Step 5: Get Your URL

1. After GitHub finishes building, you'll see a message like:
   "Your site is live at https://YOUR_USERNAME.github.io/secret-santa/"
2. Click that link to see your app!
3. **Important**: It might take a few minutes for the site to be fully available

## Step 6: Update Firebase Config (If Needed)

If your Firebase config has any localhost references, you might need to update them, but usually it works as-is since Firebase works from any URL.

## Step 7: Share with Friends!

1. Copy your GitHub Pages URL (e.g., `https://YOUR_USERNAME.github.io/secret-santa/`)
2. Share it with your friends!
3. They can open it, join a room, and everyone will see updates in real-time

## Updating Your Site

Whenever you make changes to your files:

**If using web interface:**
1. Go to your repository
2. Click on the file you want to update
3. Click the pencil icon (✏️) to edit
4. Make your changes
5. Click "Commit changes"

**If using command line:**
```bash
cd "/Users/sylvie/Desktop/Secret Santa"
git add .
git commit -m "Description of your changes"
git push
```

Changes will appear on your GitHub Pages site within a few minutes!

## Troubleshooting

- **404 Error**: Wait a few more minutes - GitHub Pages can take 5-10 minutes to build
- **Site not updating**: Clear your browser cache or wait a bit longer
- **Firebase not working**: Make sure your Firebase config is correct and your database rules are published
- **Files not showing**: Make sure you uploaded ALL files (index.html, script.js, style.css)

## Custom Domain (Optional)

If you want a custom domain like `secretsanta.com`:
1. In repository Settings > Pages
2. Enter your custom domain
3. Follow GitHub's instructions to configure DNS

But the free `github.io` URL works perfectly fine!

