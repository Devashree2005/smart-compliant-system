# Smart Campus Complaints

The app serves its page and API from a small Node.js server. Complaint documents are stored in MongoDB in the `complaints` collection.

## Run locally

1. Install Node.js 18 or newer.
2. In this folder, run `npm install`.
3. Copy `.env.example` to `.env` and set `MONGODB_URI` to your MongoDB connection string, `MONGODB_DB` to a database name, and `ADMIN_KEY` to a long private key. For MongoDB Atlas, allow the machine's IP in the Atlas Network Access settings and create a database user with access to this database.
4. Run `npm start` and open `http://localhost:3000`.
5. Select **Admin Dashboard** and enter the `ADMIN_KEY` to view and update all complaints.

Keep `.env` private and never put the MongoDB URI or admin key in `index.html`. Student IDs are generated in the browser and stored in local storage so the same browser can track its submissions. This lightweight identity is suitable for local demos; a deployed campus system should use real student sign-in before exposing complaint data.
