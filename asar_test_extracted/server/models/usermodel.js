const mongoose = require('mongoose')
require('express')
const tenantPlugin = require('../plugins/tenantPlugin');


const UserModels = mongoose.Schema({
    Name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true,
    },
    userID: {
        type: String,
        required: true,
        unique: true
    },
    ResetOTP: {
        type: String,
        default: ''
    },
    ResetOTPexpireAt: {
        type: Number,
        default: 0
    },
    gymId: {
        type: String,
        default: null  // null until linked to a gym during registration/setup
    },
    ownedGymIds: {
        type: [String],
        default: []    // Array of all branch gymIds this owner manages
    },
    role: {
        type: String,
        enum: ['owner', 'branch_manager'],
        default: 'owner'
    }
})

UserModels.plugin(tenantPlugin);

module.exports = mongoose.model('UserSchema', UserModels)