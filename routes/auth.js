import express from "express";
import fetch from "node-fetch";
import { auth, db } from "../api/firebaseadmin.js";

const router = express.Router();

const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;

if (!FIREBASE_API_KEY) {
  console.error("WARNING: FIREBASE_API_KEY is not set in environment variables");
}

router.post("/auth/signup", async (req, res) => {
  console.log("Signup request received:", { ...req.body, password: "[REDACTED]" });
  
  const { name, email, password, phone } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    const userRecord = await auth.createUser({
      email,
      password,
      displayName: name,
      phoneNumber: phone || undefined,
    });

    await db.collection("users").doc(userRecord.uid).set({
      name,
      email,
      phone: phone || null,
      createdAt: new Date().toISOString(),
    });

    const link = await auth.generateEmailVerificationLink(email);
    
    console.log("User created successfully:", userRecord.uid);
    
    res.status(201).json({
      message: "Account created successfully. Check your email for verification link.",
      uid: userRecord.uid,
      verificationLink: link
    });
  } catch (error) {
    console.error("Signup error:", error.message);
    res.status(400).json({ message: error.message });
  }
});

router.post("/auth/login", async (req, res) => {
  console.log("Login request received for:", req.body.email);
  
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  if (!FIREBASE_API_KEY) {
    return res.status(500).json({ error: "Server configuration error" });
  }

  try {
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
      }
    );
    
    const data = await response.json();

    if (data.error) {
      console.error("Firebase auth error:", data.error.message);
      throw new Error(data.error.message);
    }

    const idToken = data.idToken;
    const decodedToken = await auth.verifyIdToken(idToken);

    const expiresIn = 60 * 60 * 24 * 5 * 1000;

    try {
      const sessionCookie = await auth.createSessionCookie(idToken, { 
        expiresIn: expiresIn 
      });

      await db.collection("users").doc(decodedToken.uid).set({
        lastLogin: new Date().toISOString(),
      }, { merge: true });

      res.cookie("session", sessionCookie, { 
        httpOnly: true, 
        secure: false,
        sameSite: "lax",
        maxAge: expiresIn
      });
      
      console.log("Login successful for:", email);
      
      res.status(200).json({ 
        message: "Login successful", 
        user: {
          uid: decodedToken.uid,
          email: decodedToken.email,
          displayName: decodedToken.name
        },
        idToken,
      });
    } catch (cookieError) {
      console.error("Session cookie creation error:", cookieError.message);
      res.status(200).json({ 
        message: "Login successful (session creation failed)", 
        user: {
          uid: decodedToken.uid,
          email: decodedToken.email,
          displayName: decodedToken.name
        },
        warning: "Session cookie not created"
      });
    }
  } catch (err) {
    console.error("Login error:", err.message);
    res.status(400).json({ error: err.message });
  }
});


router.post("/auth/google-login", async (req, res) => {
  console.log("Google login request received");
  
  const { idToken } = req.body;

  if (!idToken) {
    console.error("No ID token provided");
    return res.status(400).json({ error: "ID token is required" });
  }

  try {
    console.log("Verifying ID token...");
    const decodedToken = await auth.verifyIdToken(idToken);
    
    console.log("Google token verified for:", decodedToken.email);
    
    const userDoc = await db.collection("users").doc(decodedToken.uid).get();
    
    if (!userDoc.exists) {
      await db.collection("users").doc(decodedToken.uid).set({
        name: decodedToken.name || decodedToken.email.split('@')[0],
        email: decodedToken.email,
        photoURL: decodedToken.picture || null,
        createdAt: new Date().toISOString(),
        provider: 'google'
      });
      console.log("New Google user created in Firestore:", decodedToken.uid);
    } else {
      await db.collection("users").doc(decodedToken.uid).update({
        lastLogin: new Date().toISOString(),
      });
      console.log("Existing Google user updated:", decodedToken.uid);
    }

    const expiresIn = 60 * 60 * 24 * 5 * 1000;

    try {
      console.log("Creating session cookie...");
      const sessionCookie = await auth.createSessionCookie(idToken, { 
        expiresIn: expiresIn 
      });
      
      console.log("Session cookie created successfully");
      
      res.cookie("session", sessionCookie, { 
        httpOnly: true, 
        secure: false,
        sameSite: "lax",
        maxAge: expiresIn
      });
      
      console.log("Login successful, cookie set");
      
      res.status(200).json({ 
        message: "Login successful",
        user: {
          uid: decodedToken.uid,
          email: decodedToken.email,
          displayName: decodedToken.name
        }
      });
    } catch (cookieError) {
      console.error("Session cookie creation error:", cookieError.code, cookieError.message);
      
      res.status(200).json({ 
        message: "Login successful (session creation skipped)",
        user: {
          uid: decodedToken.uid,
          email: decodedToken.email,
          displayName: decodedToken.name
        },
        warning: "Session cookie not created - authentication still valid"
      });
    }
  } catch (error) {
    console.error("Google login error:", error.code, error.message);
    
    res.status(401).json({ 
      error: error.message,
      code: error.code
    });
  }
});


router.get("/auth/profile", async (req, res) => {
  const sessionCookie = req.cookies.session || "";
  
  if (!sessionCookie) {
    return res.status(401).json({ error: "No session found" });
  }

  try {
    const decodedClaims = await auth.verifySessionCookie(sessionCookie, true);
    const userDoc = await db.collection("users").doc(decodedClaims.uid).get();
    
    res.json({ 
      user: decodedClaims, 
      profile: userDoc.exists ? userDoc.data() : null 
    });
  } catch (err) {
    console.error("Profile error:", err.message);
    res.status(401).json({ error: "Unauthorized" });
  }
});


router.post("/auth/logout", async (req, res) => {
  res.clearCookie("session");
  res.status(200).json({ message: "Logged out successfully" });
});


router.get("/auth/test", (req, res) => {
  res.json({ 
    message: "Auth routes are working",
    routes: [
      "POST /auth/signup",
      "POST /auth/login", 
      "POST /auth/google-login",
      "GET /auth/profile",
      "POST /auth/logout"
    ],
    firebaseConfigured: !!FIREBASE_API_KEY
  });
});

export default router;