const Equipment = require('../models/equipment');

// Test if model is loaded correctly
console.log('Equipment model loaded:', !!Equipment);
console.log('Equipment model methods:', Object.keys(Equipment));

// Create new equipment
const createEquipment = async (req, res) => {
  try {
    console.log('Received equipment creation request:', req.body);
    console.log('Request headers:', req.headers);
    console.log('User ID from middleware:', req.user?.id);
    console.log('Request body keys:', Object.keys(req.body));

    const {
      name,
      category,
      brand,
      model,
      serialNumbers,
      statuses,
      purchaseDate,
      unitPrice,
      quantity,
      maintenanceSchedule,
      lastServiced,
      maintenanceDays,
      warrantyExpiry,
      serviceContactNumber,
      notes
    } = req.body;

    console.log('Extracted fields:', {
      name, category, brand, model, serialNumbers, statuses,
      purchaseDate, unitPrice, quantity, maintenanceSchedule,
      lastServiced, maintenanceDays, warrantyExpiry, serviceContactNumber, notes
    });

    // Validate required fields (only name, maintenanceSchedule, and maintenanceDays)
    if (!name || !maintenanceSchedule || !maintenanceDays) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
        required: ['name', 'maintenanceSchedule', 'maintenanceDays'],
        received: Object.keys(req.body)
      });
    }

    // Calculate total price
    const totalPrice = unitPrice * quantity;

    const equipment = new Equipment({
      gymId: req.user.gymId,
      name,
      category,
      brand,
      model,
      serialNumbers,
      statuses,
      purchaseDate,
      unitPrice,
      quantity,
      totalPrice,
      maintenanceSchedule,
      lastServiced,
      maintenanceDays,
      warrantyExpiry,
      serviceContactNumber,
      notes
    });

    console.log('Creating equipment with data:', equipment);
    await equipment.save();
    console.log('Equipment saved successfully:', equipment._id);

    res.status(201).json({
      success: true,
      message: 'Equipment added successfully',
      data: equipment
    });
  } catch (error) {
    console.error('Error creating equipment:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating equipment',
      error: error.message,
      details: error
    });
  }
};

// Get all equipment
const getAllEquipment = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, category, status } = req.query;

    const query = { gymId: req.user.gymId };
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { brand: { $regex: search, $options: 'i' } },
        { model: { $regex: search, $options: 'i' } }
      ];
    }

    if (category && category !== 'all') {
      query.category = category;
    }

    if (status && status !== 'all') {
      if (status === 'available') {
        // 'available' includes items explicitly marked 'available' OR items with no status (default)
        query.$or = [
          { statuses: status },
          { statuses: { $size: 0 } },
          { statuses: { $exists: false } }
        ];
      } else {
        // For other statuses, strict match
        query.statuses = status;
      }
    }

    // Default sorting by purchaseDate or createdAt
    const equipment = await Equipment.find(query)
      .sort({ purchaseDate: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Equipment.countDocuments(query);

    res.status(200).json({
      success: true,
      data: equipment,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching equipment:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching equipment',
      error: error.message
    });
  }
};

// Get equipment by ID
const getEquipmentById = async (req, res) => {
  try {
    const { id } = req.params;
    const equipment = await Equipment.findOne({ _id: id, gymId: req.user.gymId });

    if (!equipment) {
      return res.status(404).json({
        success: false,
        message: 'Equipment not found'
      });
    }

    res.status(200).json({
      success: true,
      data: equipment
    });
  } catch (error) {
    console.error('Error fetching equipment:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching equipment',
      error: error.message
    });
  }
};

// Update equipment
const updateEquipment = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };
    
    // Prevent tenant hijacking
    delete updates.gymId;

    // Calculate total price if unitPrice or quantity is updated
    if (updates.unitPrice || updates.quantity) {
      const currentEquipment = await Equipment.findOne({ _id: id, gymId: req.user.gymId });
      const unitPrice = updates.unitPrice !== undefined ? updates.unitPrice : currentEquipment.unitPrice;
      const quantity = updates.quantity !== undefined ? updates.quantity : currentEquipment.quantity;
      updates.totalPrice = unitPrice * quantity;
    }

    const equipment = await Equipment.findOneAndUpdate(
      { _id: id, gymId: req.user.gymId },
      updates,
      { new: true, runValidators: true }
    );

    if (!equipment) {
      return res.status(404).json({
        success: false,
        message: 'Equipment not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Equipment updated successfully',
      data: equipment
    });
  } catch (error) {
    console.error('Error updating equipment:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating equipment',
      error: error.message
    });
  }
};

// Delete equipment
const deleteEquipment = async (req, res) => {
  try {
    const { id } = req.params;
    const equipment = await Equipment.findOneAndDelete({ _id: id, gymId: req.user.gymId });

    if (!equipment) {
      return res.status(404).json({
        success: false,
        message: 'Equipment not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Equipment deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting equipment:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting equipment',
      error: error.message
    });
  }
};

module.exports = {
  createEquipment,
  getAllEquipment,
  getEquipmentById,
  updateEquipment,
  deleteEquipment
};