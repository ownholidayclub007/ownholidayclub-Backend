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

Influencer passwords are stored as hashes for authentication and as encrypted values solely for authenticated admin display. Admins can view the masked password in the Referral Codes page or reset it to generate another unique password.
