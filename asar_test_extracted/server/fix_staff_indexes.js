const mongoose = require('mongoose');
const StaffModel = require('./models/staff.js');

async function fixStaffIndexes() {
  try {
    // Connect to database
    await mongoose.connect('mongodb://localhost:27017/gym_software');
    console.log('Connected to database');

    // Drop existing unique indexes
    try {
      await StaffModel.collection.dropIndex('panNumber_1');
      console.log('Dropped panNumber index');
    } catch (err) {
      console.log('panNumber index not found or already dropped');
    }

    try {
      await StaffModel.collection.dropIndex('aadhaarNumber_1');
      console.log('Dropped aadhaarNumber index');
    } catch (err) {
      console.log('aadhaarNumber index not found or already dropped');
    }

    try {
      await StaffModel.collection.dropIndex('bankAccount_1');
      console.log('Dropped bankAccount index');
    } catch (err) {
      console.log('bankAccount index not found or already dropped');
    }

    // Create new sparse unique indexes
    await StaffModel.collection.createIndex({ panNumber: 1 }, { unique: true, sparse: true });
    console.log('Created sparse panNumber index');

    await StaffModel.collection.createIndex({ aadhaarNumber: 1 }, { unique: true, sparse: true });
    console.log('Created sparse aadhaarNumber index');

    await StaffModel.collection.createIndex({ bankAccount: 1 }, { unique: true, sparse: true });
    console.log('Created sparse bankAccount index');

    console.log('All indexes updated successfully!');
    mongoose.disconnect();

  } catch (error) {
    console.error('Error fixing indexes:', error);
    mongoose.disconnect();
  }
}

fixStaffIndexes();