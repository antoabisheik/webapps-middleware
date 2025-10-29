// backend/routes/auth.js
import express from "express";
import { auth, db } from "../api/firebaseadmin.js";

const router = express.Router();


router.post("/auth/signup", async (req, res) => {
  const { name, email, password, phone } = req.body;

  if (!email || !password || !name)
    return res.status(400).json({ message: "Missing required fields" });

  try {
    // create user in Firebase Auth
    const userRecord = await auth.createUser({
      email,
      password,
      displayName: name,
      phoneNumber: phone || undefined,
    });

    //Optionally store profile in Firestore
    await db.collection("users").doc(userRecord.uid).set({
      name,
      email,
      phone,
      createdAt: new Date().toISOString(),
    });

    //Send email verification link (optional)
    const link = await auth.generateEmailVerificationLink(email);

    res
      .status(201)
      .json({
        message:
          "Account created successfully. Check your email for verification link.",
        uid: userRecord.uid,
      });
  } catch (error) {
    console.error("Signup error:", error.message);
    res.status(400).json({ message: error.message });
  }
});

export default router;
