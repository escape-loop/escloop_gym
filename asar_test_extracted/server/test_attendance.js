const mongoose = require('mongoose');
const AttendanceModel = require('./models/attendance.js');
const MemberModel = require('./models/member.js');

mongoose.connect('mongodb://admin:YourSuperSecretPassword@localhost:27018/gym_software?authSource=admin').then(async () => {
    try {
        const gymId = "69998321026d47aed367b6be";
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

        const attendanceCounts = await AttendanceModel.aggregate([
            {
                $match: {
                    gymId: gymId,
                    type: 'member',
                    status: 'present',
                    date: { $gte: startOfMonth, $lte: endOfMonth }
                }
            },
            {
                $group: {
                    _id: '$entityId', // memberId
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } }
        ]);

        console.log("Aggregate output:", attendanceCounts);

        const uniqueScores = [...new Set(attendanceCounts.map(item => item.count))].slice(0, 3);
        const topPerformers = attendanceCounts.filter(item => uniqueScores.includes(item.count));
        const memberIds = topPerformers.map(item => item._id);

        console.log("Member IDs to lookup:", memberIds);
        const members = await MemberModel.find({ gymId, memberId: { $in: memberIds } })
            .select('memberId fullName packageName profilePhoto');

        console.log("Found members:", members);

    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
});
