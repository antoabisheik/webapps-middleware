// backend/api/firebaseadmin.js
import admin from "firebase-admin";
import dotenv from "dotenv";

dotenv.config();

// Choose initialization method based on what's available
let serviceAccount;

// Method 1: Try environment variables first (more secure for production)
if (process.env.FIREBASE_PROJECT_ID && 
    process.env.FIREBASE_PRIVATE_KEY && 
    process.env.FIREBASE_CLIENT_EMAIL) {
  
  console.log("Using Firebase Admin credentials from environment variables");
  
  serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  };
}
// Method 2: Try service account key file (easier for development)
else {
  try {
    const { readFileSync } = await import("fs");
    const { fileURLToPath } = await import("url");
    const { dirname, join } = await import("path");

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const serviceAccountPath = join(__dirname, "serviceAccountKey.json");
    
    serviceAccount = JSON.parse(readFileSync(serviceAccountPath, "utf8"));
    console.log("Using Firebase Admin credentials from serviceAccountKey.json");
  } catch (error) {
    console.error("\n❌ ERROR: Firebase Admin SDK cannot be initialized!");
    console.error("You need to provide credentials using one of these methods:\n");
    console.error("Method 1: Service Account Key File");
    console.error("  1. Download from Firebase Console → Project Settings → Service Accounts");
    console.error("  2. Save as backend/api/serviceAccountKey.json\n");
    console.error("Method 2: Environment Variables (.env file)");
    console.error("  Add these to your .env file:");
    console.error("  FIREBASE_PROJECT_ID=your-project-id");
    console.error("  FIREBASE_PRIVATE_KEY=\"-----BEGIN PRIVATE KEY-----\\nYOUR_KEY\\n-----END PRIVATE KEY-----\\n\"");
    console.error("  FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com\n");
    process.exit(1);
  }
}

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log("✅ Firebase Admin SDK initialized successfully\n");
  } catch (error) {
    console.error("❌ ERROR: Failed to initialize Firebase Admin SDK");
    console.error("Error message:", error.message);
    console.error("\nPlease check your credentials and try again.\n");
    process.exit(1);
  }
}

export const auth = admin.auth();
export const db = admin.firestore();