const express = require('express');
const router = express.Router();
const equipmentController = require('../controller/equipment');
const userAuth = require('../middleware/userauth');
const Equipment = require('../models/equipment');

// Apply authentication middleware to all routes
router.use(userAuth);

// Debug middleware to log all requests (only after auth)
router.use((req, res, next) => {
  console.log(`Equipment route hit: ${req.method} ${req.path}`);
  console.log('Headers:', req.headers);
  console.log('User from middleware:', req.user);
  next();
});

// Test route to verify equipment routes are working
router.get('/test', (req, res) => {
  res.json({ success: true, message: 'Equipment routes are working!' });
});

// Debug route to see all equipment data
router.get('/debug/all', async (req, res) => {
  try {
    const equipment = await Equipment.find().sort({ createdAt: -1 });
    console.log('Debug route - Found equipment:', equipment.length);
    if (equipment.length > 0) {
      console.log('Debug route - First equipment item:', equipment[0]);
      console.log('Debug route - Available fields:', Object.keys(equipment[0]));
    }
    res.json({
      success: true,
      message: 'Debug data',
      count: equipment.length,
      data: equipment
    });
  } catch (error) {
    console.error('Debug route error:', error);
    res.status(500).json({
      success: false,
      message: 'Error in debug route',
      error: error.message
    });
  }
});

// POST /api/equipment - Create new equipment
router.post('/', equipmentController.createEquipment);

// GET /api/equipment - Get all equipment
router.get('/', equipmentController.getAllEquipment);

// GET /api/equipment/:id - Get equipment by ID
router.get('/:id', equipmentController.getEquipmentById);

// PUT /api/equipment/:id - Update equipment
router.put('/:id', equipmentController.updateEquipment);

// DELETE /api/equipment/:id - Delete equipment
router.delete('/:id', equipmentController.deleteEquipment);

module.exports = router;