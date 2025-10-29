// routes/gyms-routes.js
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


router.get("/organizations/:orgId/gyms", verifyAuth, async (req, res) => {
  try {
    const { orgId } = req.params;
    const { limit = 100 } = req.query;

    console.log(`Fetching gyms for organization: ${orgId}`);

    // UPDATED: Don't fail if organization doesn't exist, just return empty array
    const orgDoc = await db.collection("organizations").doc(orgId).get();
    if (!orgDoc.exists) {
      console.log(`Organization ${orgId} not found, returning empty gyms list`);
      return res.json({
        success: true,
        data: [],
        count: 0,
        message: "No gyms found (organization doesn't exist yet)"
      });
    }

    // Get gyms subcollection
    const gymsRef = db.collection("organizations").doc(orgId).collection("gyms");
    const snapshot = await gymsRef.orderBy("createdAt", "desc").limit(parseInt(limit)).get();

    if (snapshot.empty) {
      return res.json({
        success: true,
        data: [],
        count: 0,
        message: "No gyms found"
      });
    }

    const gyms = [];
    snapshot.forEach(doc => {
      gyms.push({
        id: doc.id,
        ...doc.data()
      });
    });

    console.log(`Fetched ${gyms.length} gyms for organization ${orgId}`);

    res.json({
      success: true,
      data: gyms,
      count: gyms.length
    });
  } catch (error) {
    console.error("Error fetching gyms:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch gyms",
      message: error.message
    });
  }
});


router.get("/organizations/:orgId/gyms/:gymId", verifyAuth, async (req, res) => {
  try {
    const { orgId, gymId } = req.params;

    const gymRef = db.collection("organizations").doc(orgId).collection("gyms").doc(gymId);
    const doc = await gymRef.get();

    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        error: "Gym not found"
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
    console.error("Error fetching gym:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch gym",
      message: error.message
    });
  }
});


router.post("/organizations/:orgId/gyms", verifyAuth, async (req, res) => {
  try {
    const { orgId } = req.params;
    const { name, address, phone, email, capacity, manager, status, openingTime, closingTime, amenities, latitude, longitude } = req.body;

    // Validate required fields
    const requiredFields = ['name', 'address', 'phone', 'email', 'capacity', 'manager'];
    const missingFields = requiredFields.filter(field => !req.body[field]);

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: missingFields.map(field => `${field} is required`)
      });
    }

    console.log(`Creating gym in organization: ${orgId}`);

    // Verify organization exists - don't auto-create
    const orgDoc = await db.collection("organizations").doc(orgId).get();
    if (!orgDoc.exists) {
      console.log(`Organization ${orgId} not found`);
      return res.status(404).json({
        success: false,
        error: "Organization not found. Please create the organization first."
      });
    }

    // Prepare gym data
    const gymData = {
      name,
      address,
      phone,
      email,
      capacity: parseInt(capacity) || 0,
      manager,
      status: status || "ACTIVE",
      openingTime: openingTime || "",
      closingTime: closingTime || "",
      amenities: amenities || [],
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      members: 0,
      monthlyRevenue: 0,
      organizationId: orgId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: req.user.uid
    };

    // Create gym in subcollection
    const gymsRef = db.collection("organizations").doc(orgId).collection("gyms");
    const docRef = await gymsRef.add(gymData);

    // Fetch created document
    const createdDoc = await docRef.get();

    console.log(`Gym created: ${docRef.id} in organization ${orgId} by user ${req.user.uid}`);

    res.status(201).json({
      success: true,
      message: "Gym created successfully",
      data: {
        id: docRef.id,
        ...createdDoc.data()
      }
    });
  } catch (error) {
    console.error("Error creating gym:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create gym",
      message: error.message
    });
  }
});


router.put("/organizations/:orgId/gyms/:gymId", verifyAuth, async (req, res) => {
  try {
    const { orgId, gymId } = req.params;
    const { name, address, phone, email, capacity, manager, status, openingTime, closingTime, amenities, latitude, longitude, members, monthlyRevenue } = req.body;

    // Check if gym exists
    const gymRef = db.collection("organizations").doc(orgId).collection("gyms").doc(gymId);
    const doc = await gymRef.get();

    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        error: "Gym not found"
      });
    }

    // Prepare update data
    const updateData = {
      updatedAt: new Date().toISOString(),
      lastModifiedBy: req.user.uid
    };

    if (name) updateData.name = name;
    if (address) updateData.address = address;
    if (phone) updateData.phone = phone;
    if (email) updateData.email = email;
    if (capacity !== undefined) updateData.capacity = parseInt(capacity);
    if (manager) updateData.manager = manager;
    if (status) updateData.status = status;
    if (openingTime !== undefined) updateData.openingTime = openingTime;
    if (closingTime !== undefined) updateData.closingTime = closingTime;
    if (amenities !== undefined) updateData.amenities = amenities;
    if (latitude !== undefined) updateData.latitude = latitude ? parseFloat(latitude) : null;
    if (longitude !== undefined) updateData.longitude = longitude ? parseFloat(longitude) : null;
    if (members !== undefined) updateData.members = parseInt(members);
    if (monthlyRevenue !== undefined) updateData.monthlyRevenue = parseFloat(monthlyRevenue);

    // Update document
    await gymRef.update(updateData);

    // Fetch updated document
    const updatedDoc = await gymRef.get();

    console.log(`Gym updated: ${gymId} in organization ${orgId} by user ${req.user.uid}`);

    res.json({
      success: true,
      message: "Gym updated successfully",
      data: {
        id: updatedDoc.id,
        ...updatedDoc.data()
      }
    });
  } catch (error) {
    console.error("Error updating gym:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update gym",
      message: error.message
    });
  }
});


router.delete("/organizations/:orgId/gyms/:gymId", verifyAuth, async (req, res) => {
  try {
    const { orgId, gymId } = req.params;

    // Check if gym exists
    const gymRef = db.collection("organizations").doc(orgId).collection("gyms").doc(gymId);
    const doc = await gymRef.get();

    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        error: "Gym not found"
      });
    }

    // Delete gym
    await gymRef.delete();

    // Optional: Create audit log
    await db.collection("audit_logs").add({
      action: "delete_gym",
      gymId: gymId,
      organizationId: orgId,
      performedBy: req.user.uid,
      timestamp: new Date().toISOString(),
      details: doc.data()
    });

    console.log(`Gym deleted: ${gymId} from organization ${orgId} by user ${req.user.uid}`);

    res.json({
      success: true,
      message: "Gym deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting gym:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete gym",
      message: error.message
    });
  }
});

export default router;