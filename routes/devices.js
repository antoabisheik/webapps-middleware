// routes/devices.js
import express from "express";
import { auth, db } from "../api/firebaseadmin.js";

const router = express.Router();

const verifyAuth = async (req, res, next) => {
  try {
    const sessionCookie = req.cookies.session;
    const authHeader = req.headers.authorization;

    let decodedClaims;

    if (sessionCookie) {
      decodedClaims = await auth.verifySessionCookie(sessionCookie, true);
    } else if (authHeader && authHeader.startsWith('Bearer ')) {
      const idToken = authHeader.split('Bearer ')[1];
      decodedClaims = await auth.verifyIdToken(idToken);
    } else {
      return res.status(401).json({ error: "Unauthorized" });
    }

    req.user = decodedClaims;
    next();
  } catch (error) {
    console.error("Auth verification error:", error.message);
    res.status(401).json({ error: "Unauthorized - Invalid token" });
  }
};


router.get("/devices", verifyAuth, async (req, res) => {
  try {
    const { 
      limit = 100, 
      organizationId, 
      type, 
      status 
    } = req.query;

    let query = db.collection("devices");

    // Apply filters
    if (organizationId) {
      query = query.where("organizationId", "==", organizationId);
    }
    if (type) {
      query = query.where("type", "==", type);
    }
    if (status) {
      query = query.where("status", "==", status);
    }

    // Get devices
    const snapshot = await query
      .orderBy("createdAt", "desc")
      .limit(parseInt(limit))
      .get();

    const devices = [];
    snapshot.forEach(doc => {
      devices.push({
        id: doc.id,
        ...doc.data()
      });
    });

    console.log(`Fetched ${devices.length} devices for user ${req.user.uid}`);

    res.json({
      success: true,
      data: devices,
      count: devices.length
    });
  } catch (error) {
    console.error("Error fetching devices:", error);
    res.status(500).json({ 
      error: "Failed to fetch devices",
      message: error.message 
    });
  }
});


router.get("/devices/:id", verifyAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const doc = await db.collection("devices").doc(id).get();

    if (!doc.exists) {
      return res.status(404).json({ 
        success: false,
        error: "Device not found" 
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
    console.error("Error fetching device:", error);
    res.status(500).json({ 
      error: "Failed to fetch device",
      message: error.message 
    });
  }
});


router.post("/devices", verifyAuth, async (req, res) => {
  try {
    const { 
      deviceName, 
      type, 
      serialNumber, 
      model,
      manufacturer,
      organizationId,
      status,
      location,
      ipAddress,
      macAddress
    } = req.body;

    // Validate required fields
    if (!deviceName || !type || !serialNumber) {
      return res.status(400).json({ 
        error: "Validation failed",
        details: ["Device name, type, and serial number are required"] 
      });
    }

    // Check if device with same serial number exists
    const existingDevice = await db.collection("devices")
      .where("serialNumber", "==", serialNumber)
      .limit(1)
      .get();

    if (!existingDevice.empty) {
      return res.status(409).json({ 
        error: "Device with this serial number already exists" 
      });
    }

    // If organizationId is provided, verify it exists
    if (organizationId) {
      const orgDoc = await db.collection("organizations").doc(organizationId).get();
      if (!orgDoc.exists) {
        return res.status(404).json({ 
          error: "Organization not found" 
        });
      }
    }

    // Prepare device data
    const deviceData = {
      deviceName,
      type,
      serialNumber,
      model: model || "",
      manufacturer: manufacturer || "",
      organizationId: organizationId || null,
      organizationName: organizationId ? 
        (await db.collection("organizations").doc(organizationId).get()).data()?.name : 
        "Unassigned",
      status: status || "active",
      location: location || "",
      ipAddress: ipAddress || "",
      macAddress: macAddress || "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: req.user.uid
    };

    // Create device
    const docRef = await db.collection("devices").add(deviceData);

    // Fetch created document
    const createdDoc = await docRef.get();

    console.log(`Device created: ${docRef.id} by user ${req.user.uid}`);

    res.status(201).json({
      success: true,
      message: "Device created successfully",
      data: {
        id: docRef.id,
        ...createdDoc.data()
      }
    });
  } catch (error) {
    console.error("Error creating device:", error);
    res.status(500).json({ 
      error: "Failed to create device",
      message: error.message 
    });
  }
});


router.put("/devices/:id", verifyAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      deviceName, 
      type, 
      serialNumber,
      model,
      manufacturer,
      organizationId,
      status,
      location,
      ipAddress,
      macAddress
    } = req.body;

    // Check if device exists
    const docRef = db.collection("devices").doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ 
        success: false,
        error: "Device not found" 
      });
    }

    // If changing serial number, check it's unique
    if (serialNumber && serialNumber !== doc.data().serialNumber) {
      const existingDevice = await db.collection("devices")
        .where("serialNumber", "==", serialNumber)
        .limit(1)
        .get();

      if (!existingDevice.empty) {
        return res.status(409).json({ 
          error: "Device with this serial number already exists" 
        });
      }
    }

    // Prepare update data
    const updateData = {
      updatedAt: new Date().toISOString(),
      lastModifiedBy: req.user.uid
    };

    if (deviceName) updateData.deviceName = deviceName;
    if (type) updateData.type = type;
    if (serialNumber) updateData.serialNumber = serialNumber;
    if (model !== undefined) updateData.model = model;
    if (manufacturer !== undefined) updateData.manufacturer = manufacturer;
    if (status) updateData.status = status;
    if (location !== undefined) updateData.location = location;
    if (ipAddress !== undefined) updateData.ipAddress = ipAddress;
    if (macAddress !== undefined) updateData.macAddress = macAddress;

    // Handle organization assignment
    if (organizationId !== undefined) {
      if (organizationId) {
        const orgDoc = await db.collection("organizations").doc(organizationId).get();
        if (!orgDoc.exists) {
          return res.status(404).json({ error: "Organization not found" });
        }
        updateData.organizationId = organizationId;
        updateData.organizationName = orgDoc.data().name;
      } else {
        updateData.organizationId = null;
        updateData.organizationName = "Unassigned";
      }
    }

    // Update document
    await docRef.update(updateData);

    // Fetch updated document
    const updatedDoc = await docRef.get();

    console.log(`Device updated: ${id} by user ${req.user.uid}`);

    res.json({
      success: true,
      message: "Device updated successfully",
      data: {
        id: updatedDoc.id,
        ...updatedDoc.data()
      }
    });
  } catch (error) {
    console.error("Error updating device:", error);
    res.status(500).json({ 
      error: "Failed to update device",
      message: error.message 
    });
  }
});

router.delete("/devices/:id", verifyAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if device exists
    const docRef = db.collection("devices").doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ 
        success: false,
        error: "Device not found" 
      });
    }

    // Delete device
    await docRef.delete();

    await db.collection("audit_logs").add({
      action: "delete_device",
      deviceId: id,
      performedBy: req.user.uid,
      timestamp: new Date().toISOString(),
      details: doc.data()
    });

    console.log(`Device deleted: ${id} by user ${req.user.uid}`);

    res.json({
      success: true,
      message: "Device deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting device:", error);
    res.status(500).json({ 
      error: "Failed to delete device",
      message: error.message 
    });
  }
});

router.post("/devices/bulk-assign", verifyAuth, async (req, res) => {
  try {
    const { deviceIds, organizationId } = req.body;

    if (!deviceIds || !Array.isArray(deviceIds) || deviceIds.length === 0) {
      return res.status(400).json({ 
        error: "Device IDs array is required" 
      });
    }

    // Verify organization exists
    let organizationName = "Unassigned";
    if (organizationId) {
      const orgDoc = await db.collection("organizations").doc(organizationId).get();
      if (!orgDoc.exists) {
        return res.status(404).json({ error: "Organization not found" });
      }
      organizationName = orgDoc.data().name;
    }

    // Update all devices
    const batch = db.batch();
    const updatedDevices = [];

    for (const deviceId of deviceIds) {
      const deviceRef = db.collection("devices").doc(deviceId);
      const deviceDoc = await deviceRef.get();
      
      if (deviceDoc.exists) {
        batch.update(deviceRef, {
          organizationId: organizationId || null,
          organizationName,
          updatedAt: new Date().toISOString(),
          lastModifiedBy: req.user.uid
        });
        updatedDevices.push(deviceId);
      }
    }

    await batch.commit();

    console.log(`Bulk assigned ${updatedDevices.length} devices by user ${req.user.uid}`);

    res.json({
      success: true,
      message: `Successfully assigned ${updatedDevices.length} devices`,
      updatedCount: updatedDevices.length
    });
  } catch (error) {
    console.error("Error bulk assigning devices:", error);
    res.status(500).json({ 
      error: "Failed to assign devices",
      message: error.message 
    });
  }
});

export default router;