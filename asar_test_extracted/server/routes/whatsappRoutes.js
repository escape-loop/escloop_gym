const express = require('express');
const router = express.Router();
const userauth = require('../middleware/userauth');
const whatsappController = require('../controller/whatsappController');

// All routes are protected by userauth which sets req.user.gymId
router.use(userauth);

router.get('/instance', whatsappController.getInstance);
router.get('/connectionState', whatsappController.getConnectionState);
router.get('/connect', whatsappController.connect);
router.post('/sendText', whatsappController.sendText);
router.post('/restart', whatsappController.restart);
router.delete('/logout', whatsappController.logout);

router.post('/send-notification-reminder', whatsappController.sendNotificationReminder);
router.post('/send-custom-text', whatsappController.sendCustomText);
router.post('/send-personalized-plan', whatsappController.sendPersonalizedPlan);
router.post('/send-report', whatsappController.sendReport);

module.exports = router;
