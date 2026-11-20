# OHC Backend Server

The core API engine for **Own Holiday Club**, built with Node.js and MongoDB.

## 🚀 Key Modules
*   **Auth**: Secure JWT authentication and role-based access.
*   **Activity Logger**: Standardized utility for tracking system-wide administrative actions.
*   **CMS Core**: API endpoints for managing hero slides, blogs, destinations, and SEO.
*   **Cloudinary Integration**: Handling image transformations and storage.

## 🛠 Tech Stack
*   **Node.js & Express**
*   **Mongoose (MongoDB)**
*   **Cloudinary SDK**
*   **JSON Web Tokens (JWT)**

## ⚙️ Development
1. `npm install`
2. Set up `.env` (Database URI, Cloudinary keys, JWT secret).
3. `npm run dev` to start the server.

## Manual Membership Documents
The admin manual-membership flow optionally accepts a profile image, one ID proof, one address proof, and a spouse ID when applicable. Files are encrypted in MongoDB using AES-256-GCM and can be retrieved only by authenticated CMS admins; they are not uploaded to Cloudinary or attached to customer emails. Each file is limited to 1.5 MB. Existing private member documents remain encrypted and use the same key.

Configure `MEMBER_DOCUMENTS_ENCRYPTION_KEY` in the backend environment before accepting uploads or retrieving private documents. It must be a stable, secret 32-byte key encoded as 64 hexadecimal characters. Generate one with:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Keep the key in the deployment secret manager, back it up securely, and never commit or rotate it without re-encrypting existing documents; losing it makes stored documents unrecoverable. Manual entry does not verify identity or contact ownership: staff are responsible for confirming the supplied information before recording payment.

## Influencer referral accounts
Influencers sign in to the existing admin-panel login page using a separate username and password. Their dashboard returns only their linked referral codes and membership counts; it does not expose customer information. Admins can create, edit, disable, reset passwords, link existing codes, and delete influencer logins from **Influencer Accounts** in the panel. Deleting a login unlinks its codes but preserves each referral code and its membership count.

Set a stable, secret `INFLUENCER_TOKEN_SECRET` in the backend environment for deployed environments. The server falls back to `CMS_TOKEN_SECRET` when it is not set; configure a separate secret before deployment.

Influencer passwords are generated automatically from the referral code, with a short random suffix. Authentication uses a password hash; an AES-256-GCM encrypted copy lets authenticated CMS admins view it in the Referral Codes page. Configure a stable, secret `INFLUENCER_CREDENTIALS_ENCRYPTION_KEY` before creating or resetting influencer passwords:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Keep the key in the deployment secret manager, back it up securely, and use the same key across backend restarts. Losing it makes the admin-visible encrypted passwords unrecoverable; never commit or rotate it without re-encrypting existing credentials.

### Create an influencer from Postman
First obtain an admin token:

```http
POST {{baseUrl}}/api/cms/auth/login
Content-Type: application/json

{"username":"<admin-username>","password":"<admin-password>"}
```

Use the returned token as `Authorization: Bearer <admin-token>` on admin-only requests. To link already-existing referral codes, find their MongoDB `_id` values with `GET {{baseUrl}}/api/referral-codes?page=1&limit=50`, then call:

```http
POST {{baseUrl}}/api/influencers/accounts
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "name": "Influencer Name",
  "referralCodeIds": ["<existing-referral-code-id>"]
}
```

Each influencer is linked to exactly one referral code, and that referral code is automatically used as the login username. A unique password is generated automatically and can be viewed by an authenticated admin in the Referral Codes page. Existing code values and membership counts are retained. For a new referral code instead, omit `referralCodeIds` and provide `"code": "DS17"`; do not send both.

### Influencer API
- `POST /api/influencers/auth/login` — public login; body includes `username` and `password`.
- `GET /api/influencers/dashboard` — influencer token; returns only that account's codes and counts.
- `GET /api/influencers/accounts` and `GET /api/influencers/unassigned-codes` — admin token.
- `POST /api/influencers/accounts`, `PUT /api/influencers/accounts/:id`, `PATCH /api/influencers/accounts/:id/password`, and `DELETE /api/influencers/accounts/:id` — admin token. An influencer login is linked to exactly one referral code, and its username is derived from that code.
- `PUT /api/referral-codes/:id` — admin token; updates a referral code, its VP name, and optionally active status. If linked, the influencer account name and username are synchronized.

Influencer passwords are stored as hashes for authentication and as encrypted values for admin display and Google Sheets sync. Admins can view the masked password in the Referral Codes page or reset it to generate another unique password.

## Pending applications Google Sheets sync
The admin panel syncs both pending applications and referral codes to separate tabs in the same Google Sheet, either from each page's **Sync Google Sheet** button or automatically every 15 minutes. The `Pending Applications` tab contains application ID, name, email, mobile, plan, payment status, and saved date; passwords and uploaded documents are excluded. The `Referral Codes` tab contains the referral code, VP name, linked influencer password, membership count, status, and creation date. The password cell is blank when no recoverable password is available.

1. Create a Google Sheet and open **Extensions → Apps Script**.
2. Copy `scripts/pending-applications-google-sheet.gs` into the Apps Script editor and save it.
3. In Apps Script **Project Settings → Script properties**, add:
   - `SPREADSHEET_ID`: the value between `/d/` and `/edit` in the spreadsheet URL.
   - `SHEET_NAME`: `Pending Applications` (or the tab name you prefer).
   - `SYNC_SECRET`: a randomly generated secret with at least 32 characters.
4. Deploy the Apps Script as a **Web app**, executing as yourself. Allow the web app to receive requests from the backend, then copy its deployed URL ending in `/exec`.
5. Add these values to the backend deployment's secret/environment settings and restart the backend:
   - `PENDING_APPS_SHEET_WEBHOOK_URL`: the deployed Apps Script `/exec` URL.
   - `PENDING_APPS_SHEET_SYNC_SECRET`: the same secret used in the Apps Script properties.
6. Open **Pending Applications** or **Referral Codes** in the admin panel and choose **Sync Google Sheet** to verify the connection. The integration only allows writes to those two tabs.

Keep the sync secret private and never commit it. The Apps Script deployment URL is not sufficient by itself to update the sheet; requests must also contain the matching secret. The sheet contains readable influencer passwords and applicant contact details, so restrict access to staff authorized to see both. Google Sheets version history may retain old passwords after a sync or password reset. The backend needs the same `INFLUENCER_CREDENTIALS_ENCRYPTION_KEY` used to encrypt the passwords; a decryption error fails the referral sync rather than replacing the sheet.
