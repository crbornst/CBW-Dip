# My DiP v1.0

A soft red/white Dissertation in Practice dashboard with black text, Firebase login, and Firestore cloud saving.

## Files
- `index.html` — main app page
- `style.css` — design
- `script.js` — app logic and Firestore syncing
- `firebase-config.js` — your Firebase project connection
- `firestore.rules` — recommended security rules

## How to use locally
Open `index.html` in Edge. Because Firebase modules load from the web, you need internet access.

## GitHub Pages setup
1. Create a new GitHub repository, for example `my-dip`.
2. Upload all files from this folder into the repository.
3. Go to repository **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select branch `main` and folder `/root`.
6. Save.
7. Open the GitHub Pages URL.

## Firebase Auth domain note
After GitHub Pages gives you a URL, go to Firebase Console:
Authentication → Settings → Authorized domains.
Add your GitHub Pages domain, usually:
`yourusername.github.io`

## Firestore rules
In Firebase Console, go to Firestore Database → Rules and paste the contents of `firestore.rules`.
Publish the rules.
