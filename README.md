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
