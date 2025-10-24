import { db } from "../api/firebaseadmin.js";

export const createUserProfile = async (uid, data) => {
  await db.collection("users").doc(uid).set(data, { merge: true });
};

export const getUserProfile = async (uid) => {
  const doc = await db.collection("users").doc(uid).get();
  return doc.exists ? doc.data() : null;
};
