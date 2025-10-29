// routes/organizations.js
import express from "express";
import { auth, db } from "../api/firebaseadmin.js";

const router = express.Router();


const verifyAuth = async (req, res, next) => {
  try {
    const sessionCookie = req.cookies.session;
    const authHeader = req.headers.authorization;

    let decodedClaims;

    // Try session cookie first
    if (sessionCookie) {
      decodedClaims = await auth.verifySessionCookie(sessionCookie, true);
    } 
    // Try Authorization header with Bearer token
    else if (authHeader && authHeader.startsWith('Bearer ')) {
      const idToken = authHeader.split('Bearer ')[1];
      decodedClaims = await auth.verifyIdToken(idToken);
    } 
    else {
      return res.status(401).json({ error: "Unauthorized - No valid authentication found" });
    }

    // Attach user to request
    req.user = decodedClaims;
    next();
  } catch (error) {
    console.error("Auth verification error:", error.message);
    res.status(401).json({ error: "Unauthorized - Invalid token" });
  }
};


router.get("/organizations", verifyAuth, async (req, res) => {
  try {
    const { limit = 100, organizationId } = req.query;

    let query = db.collection("organizations");

    // If specific organization requested
    if (organizationId) {
      const doc = await db.collection("organizations").doc(organizationId).get();
      if (!doc.exists) {
        return res.status(404).json({ error: "Organization not found" });
      }
      return res.json({
        success: true,
        data: { id: doc.id, ...doc.data() }
      });
    }

    // Get all organizations
    const snapshot = await query.orderBy("createdAt", "desc").limit(parseInt(limit)).get();

    const organizations = [];
    snapshot.forEach(doc => {
      organizations.push({
        id: doc.id,
        ...doc.data()
      });
    });

    console.log(`Fetched ${organizations.length} organizations for user ${req.user.uid}`);

    res.json({
      success: true,
      data: organizations,
      count: organizations.length
    });
  } catch (error) {
    console.error("Error fetching organizations:", error);
    res.status(500).json({ 
      error: "Failed to fetch organizations",
      message: error.message 
    });
  }
});


router.get("/organizations/:id", verifyAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const doc = await db.collection("organizations").doc(id).get();

    if (!doc.exists) {
      return res.status(404).json({ 
        success: false,
        error: "Organization not found" 
      });
    }

    res.json({
      success: true,
      data: {
        id: doc.id,
        ...doc.data()
      }
    });
  } catch (error) {
    console.error("Error fetching organization:", error);
    res.status(500).json({ 
      error: "Failed to fetch organization",
      message: error.message 
    });
  }
});


router.post("/organizations", verifyAuth, async (req, res) => {
  try {
    const { name, email, phone, address, status } = req.body;

    // Validate required fields
    if (!name || !email) {
      return res.status(400).json({ 
        error: "Validation failed",
        details: ["Name and email are required"] 
      });
    }

    // Check if organization with same email exists
    const existingOrg = await db.collection("organizations")
      .where("email", "==", email)
      .limit(1)
      .get();

    if (!existingOrg.empty) {
      return res.status(409).json({ 
        error: "Organization with this email already exists" 
      });
    }

    // Prepare organization data
    const organizationData = {
      name,
      email,
      phone: phone || "",
      address: address || "",
      status: status || "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: req.user.uid
    };

    // Create organization
    const docRef = await db.collection("organizations").add(organizationData);

    // Fetch created document
    const createdDoc = await docRef.get();

    console.log(`Organization created: ${docRef.id} by user ${req.user.uid}`);

    res.status(201).json({
      success: true,
      message: "Organization created successfully",
      data: {
        id: docRef.id,
        ...createdDoc.data()
      }
    });
  } catch (error) {
    console.error("Error creating organization:", error);
    res.status(500).json({ 
      error: "Failed to create organization",
      message: error.message 
    });
  }
});


router.put("/organizations/:id", verifyAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, address, status } = req.body;

    // Check if organization exists
    const docRef = db.collection("organizations").doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ 
        success: false,
        error: "Organization not found" 
      });
    }

    // Prepare update data
    const updateData = {
      updatedAt: new Date().toISOString(),
      lastModifiedBy: req.user.uid
    };

    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;
    if (address !== undefined) updateData.address = address;
    if (status) updateData.status = status;

    // Update document
    await docRef.update(updateData);

    // Fetch updated document
    const updatedDoc = await docRef.get();

    console.log(`Organization updated: ${id} by user ${req.user.uid}`);

    res.json({
      success: true,
      message: "Organization updated successfully",
      data: {
        id: updatedDoc.id,
        ...updatedDoc.data()
      }
    });
  } catch (error) {
    console.error("Error updating organization:", error);
    res.status(500).json({ 
      error: "Failed to update organization",
      message: error.message 
    });
  }
});


router.delete("/organizations/:id", verifyAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if organization exists
    const docRef = db.collection("organizations").doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ 
        success: false,
        error: "Organization not found" 
      });
    }

    // Check if organization has associated devices
    const devicesSnapshot = await db.collection("devices")
      .where("organizationId", "==", id)
      .limit(1)
      .get();

    if (!devicesSnapshot.empty) {
      return res.status(409).json({ 
        error: "Cannot delete organization with associated devices",
        message: "Please reassign or delete all devices first"
      });
    }

    // Delete organization
    await docRef.delete();

    // Optional: Create audit log
    await db.collection("audit_logs").add({
      action: "delete_organization",
      organizationId: id,
      performedBy: req.user.uid,
      timestamp: new Date().toISOString(),
      details: doc.data()
    });

    console.log(`Organization deleted: ${id} by user ${req.user.uid}`);

    res.json({
      success: true,
      message: "Organization deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting organization:", error);
    res.status(500).json({ 
      error: "Failed to delete organization",
      message: error.message 
    });
  }
});

export default router;