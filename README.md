# My Dissertation Dashboard v2.0 Complete

A cloud-synced Dissertation in Practice dashboard using Firebase Authentication, Firestore, and GitHub Pages.

## Files
- `index.html` – app layout
- `style.css` – soft red/white design with black text
- `script.js` – app logic and Firestore sync
- `firebase-config.js` – Firebase project connection
- `firestore.rules` – recommended user-private database rules

## Update GitHub
Copy all files into your `CBW-Dip` folder, keeping your current `firebase-config.js` if it already works. Commit in GitHub Desktop with:

`Version 2.0 - Complete dissertation dashboard app`

Then push origin.

## Version 2.1 PDF and Research List Update

This update adds:

- Research Library list/table view instead of large cards
- PDF upload field on research sources
- New PDF Library section for coursework notes, readings, rubrics, syllabi, and other PDFs
- PDF links that open uploaded files in a new browser tab

### Important Firebase Storage setup

To use PDF uploads, enable Firebase Storage:

1. Firebase Console → Build → Storage
2. Click **Get started**
3. Choose the same region as your Firebase project when possible
4. After Storage is created, open the **Rules** tab
5. Paste the contents of `storage.rules`
6. Click **Publish**

Keep your existing `firebase-config.js` file. Do not replace it unless you intentionally need to reconnect Firebase.
