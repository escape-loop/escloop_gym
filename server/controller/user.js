const express = require('express')
const UserModels = require('../models/usermodel.js')
const bcrypt = require('bcryptjs')
require('dotenv').config()
const jwt = require('jsonwebtoken')
const transport = require('../database/nodemailer.js')
const GymSettings = require('../models/GymSettings.js')
const License = require('../models/license.js')
const { runChurnAnalysis } = require('../services/churnService.js')
const { runExpiryReminderAutomation, runLeadFollowUpAutomation, runBirthdayReminderAutomation, runAttendanceReminderAutomation } = require('../services/automationService.js')


const register = async (req, res) => {
    const { Name, email, password, userID } = req.body
    if (!Name || !email || !password || !userID) {
        return res.json({
            success: false,
            message: "all fields to be filled"
        })
    }
    try {
        const existingUser = await UserModels.findOne({ email })
        if (existingUser) {
            return res.json({
                success: false,
                message: "email already exist"
            })
        }

        const hashedpassword = await bcrypt.hash(password, 10)
        const newuser = new UserModels({ Name, email, password: hashedpassword, userID })
        await newuser.save()
        const token = jwt.sign({ id: newuser._id }, process.env.JWT_PASS)
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.SECURE === 'production',
            sameSite: process.env.SECURE === 'production' ? 'none' : 'strict',


        })
        const html = `
        <!DOCTYPE html>
        <html>
        <head>
        <meta charset="UTF-8" />
        <title>Signed Up Successfully - JRR Automobiles</title>
        </head>
        <body style="background:#f4f8fb;padding:0;margin:0;">
        <div style="background:#fff;max-width:420px;margin:40px auto;padding:32px 24px 28px 24px;
        border-radius:13px;box-shadow:0 2px 16px rgba(43,99,241,0.08);border:1.2px solid #d3d9e5;">
            <div style="display:flex;align-items:center;gap:14px;margin-bottom:20px;">
                <img src="cid:logo@jrr" alt="JRR Automobiles" style="height:44px;width:auto;display:block;" />
                <span style="font-size:19px;font-weight:800;color:black;letter-spacing:0.6px;padding-top:20px"> Automobiles</span>
            </div>
            <h2 style="margin:14px 0 10px 0;font-size:22px;color:#0c1222;">Signed Up Successfully</h2>
            <p style="font-size:15px;color:#414a62;line-height:1.45;">Hi ${newuser.Name},</p>
            <p style="font-size:15px;color:#414a62;line-height:1.45;">
                Your account has been successfully created for the account associated ${newuser.email}.\n
                Account id : ${newuser.userID}
            </p>
            <div style="margin:28px 0 22px 0;padding:15px 0;font-size:32px;color:#2b63f1;font-weight:700;
                letter-spacing:10px;text-align:center;background:#f4f8fb;border-radius:10px;
                border:1.2px solid #d3d9e5;user-select:all;">
                ${password}
            </div>
            <ul style="color:#414a62;font-size:15px;">
                <li>If you did not Signed up, please ignore this email.</li>
                <li>Do not share your information with anyone.</li>
            </ul>
            <div style="margin-top:30px;font-size:12px;color:#888;text-align:center;">
                &copy; 2025 JRR Automobiles<br/>
                For internal use only<br/>
                This is an automated message – do not reply.
            </div>
        </div>
        </body>
        </html>
        `;

        const mail = {
            from: process.env.SENDER_EMAIL,
            to: newuser.email,
            subject: "Signed Up Successfully",
            text: `Your account has been successfully created for the account associated ${newuser.email}.\n
                Account id : ${newuser.userID}`,
            html,// <-- html template,
            attachments: logoPath ? [
                {
                    filename: 'logo.png',
                    path: logoPath,
                    cid: 'logo@jrr'
                }
            ] : []
        };




        await newuser.save();
        await transport.sendMail(mail);



        return res.json({ success: true, message: "Signed up successfully" })


    } catch (e) {
        console.error(e)
        res.json({
            success: false,
            message: "failed in registration"
        })
    }
}
const login = async (req, res) => {
    const { identifier, password } = req.body
    if (!identifier || !password) {
        return res.json({
            success: false,
            message: "all fields to be filled"
        })
    }
    try {
        let existingUser;
        if (identifier.includes('@')) {
            existingUser = await UserModels.findOne({ email: identifier })
        } else {
            existingUser = await UserModels.findOne({ userID: identifier })
        }
        if (existingUser) {
            if (await bcrypt.compare(password, existingUser.password)) {
                // Check if gym license is suspended
                const license = await License.findOne({ gymId: existingUser.gymId });
                if (license && license.status === 'suspended') {
                    return res.json({
                        success: false,
                        message: "Your subscription has been suspended please contact the admin!"
                    });
                }

                // Ensure ownedGymIds is a clean array of strings
                const ownedGymIds = existingUser.ownedGymIds ? existingUser.ownedGymIds.map(String) : [];
                const role = existingUser.role || 'owner';
                const token = jwt.sign(
                    { id: existingUser._id, gymId: String(existingUser.gymId), ownedGymIds, role },
                    process.env.JWT_PASS,
                    { expiresIn: '7d' }
                );
                res.cookie('token', token, {
                    httpOnly: true,
                    secure: process.env.SECURE === 'production',
                    sameSite: process.env.SECURE === 'production' ? 'none' : 'lax',
                    maxAge: 7 * 24 * 60 * 60 * 1000
                });

                // Pre-warm the specific database connection for this gym
                try {
                    const gymUriCache = require('../services/gymUriCache');
                    const connectionManager = require('../services/connectionManager');
                    
                    if (existingUser.gymId) {
                        const uri = await gymUriCache.getUri(String(existingUser.gymId));
                        if (uri) {
                            connectionManager.getConnection(uri); // This creates/returns the connection, warming it up
                            console.log(`[Login] Pre-warmed connection for gymId: ${existingUser.gymId}`);
                        }
                    }
                } catch (warmUpErr) {
                    console.error('[Login] Error pre-warming connection:', warmUpErr.message);
                }

                // Background jobs are now handled by the external cloud cron server
                // to prevent duplicate executions when multiple laptops are logged in.

                // Return branches info for BranchContext
                const allBranchIds = [existingUser.gymId, ...ownedGymIds].filter(Boolean);
                const branches = await Promise.all(
                    allBranchIds.map(async (gId) => {
                        const s = await GymSettings.findOne({ gymId: gId }).lean();
                        return { gymId: gId, gymName: s ? s.gymName : gId, isPrimary: gId === existingUser.gymId };
                    })
                );

                return res.json({ success: true, message: "logged in successfully", branches, primaryGymId: existingUser.gymId })
            }
            else {
                res.json({
                    success: false,
                    message: "invalid password"
                })
            }
        } else {
            return res.json({
                success: false,
                message: "invalid email or userID"
            })
        }
    }
    catch (e) {
        res.json({
            success: false,
            message: "failed to login"
        })
    }
}
const logout = async (req, res) => {
    try {
        res.clearCookie('token', {
            httpOnly: true,
            secure: process.env.SECURE === 'production',
            sameSite: process.env.SECURE === 'production' ? 'none' : 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000

        })
        res.json({ success: true, message: "your account has been logged out , login again to continue" })
    } catch (e) {
        res.json({
            success: false,
            message: "failed to logout"
        })
    }
}



const isauth = async (req, res) => {
    try {
        return res.json({
            success: true
        })
    } catch (e) {
        res.json({
            success: false,
            message: e.message
        })

    }
}
const path = require('path');
const fs = require('fs');

// before sending mail
const getLogoPath = () => {
    const primary = path.resolve(__dirname, '..', '..', 'client', 'public', 'GYM.png');
    if (fs.existsSync(primary)) return primary;
    const secondary = path.resolve(__dirname, '..', '..', 'client', 'public', 'gym_logo.jpg');
    if (fs.existsSync(secondary)) return secondary;
    return null;
};
const logoPath = getLogoPath();
if (!logoPath) {
    console.warn('[Server]: Logo file not found in client/public. Email attachments will be skipped.');
}

const Resetpasswordotp = async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.json({
            success: false,
            message: "email is required"
        });
    }
    try {
        const user = await UserModels.findOne({ email });
        if (!user) {
            return res.json({
                success: false,
                message: "email is not found"
            });
        }
        const otp = Math.floor(100000 + Math.random() * 900000);
        user.ResetOTPexpireAt = Date.now() + 24 * 60 * 60 * 1000;
        user.ResetOTP = otp;

        // --- HTML Email Template ---
        const html = `
        <!DOCTYPE html>
        <html>
        <head>
        <meta charset="UTF-8" />
        <title>Reset Password OTP - JRR Automobiles</title>
        </head>
        <body style="background:#f4f8fb;padding:0;margin:0;">
        <div style="background:#fff;max-width:420px;margin:40px auto;padding:32px 24px 28px 24px;
        border-radius:13px;box-shadow:0 2px 16px rgba(43,99,241,0.08);border:1.2px solid #d3d9e5;">
            <div style="display:flex;align-items:center;gap:14px;margin-bottom:20px;">
                <img src="cid:logo@jrr" alt="JRR Automobiles" style="height:44px;width:auto;display:block;" />
                <span style="font-size:19px;font-weight:800;color:black;letter-spacing:0.6px;padding-top:20px"> Automobiles</span>
            </div>
            <h2 style="margin:14px 0 10px 0;font-size:22px;color:#0c1222;">Reset Your Password</h2>
            <p style="font-size:15px;color:#414a62;line-height:1.45;">Hi ${user.Name},</p>
            <p style="font-size:15px;color:#414a62;line-height:1.45;">
                Use the OTP below to reset your password for your JRR Automobiles account. The code is valid for the next 24 hours.
            </p>
            <div style="margin:28px 0 22px 0;padding:15px 0;font-size:32px;color:#2b63f1;font-weight:700;
                letter-spacing:10px;text-align:center;background:#f4f8fb;border-radius:10px;
                border:1.2px solid #d3d9e5;user-select:all;">
                ${otp}
            </div>
            <ul style="color:#414a62;font-size:15px;">
                <li>If you did not request a reset, please ignore this email.</li>
                <li>Do not share your OTP with anyone.</li>
            </ul>
            <div style="margin-top:30px;font-size:12px;color:#888;text-align:center;">
                &copy; 2025 JRR Automobiles<br/>
                For internal use only<br/>
                This is an automated message – do not reply.
            </div>
        </div>
        </body>
        </html>
        `;

        const mail = {
            from: process.env.SENDER_EMAIL,
            to: user.email,
            subject: "Reset password",
            text: `Your OTP for password reset is: ${otp}\n\nDo not share this code. If you didn't request this, ignore this email.`,
            html,// <-- html template,
            attachments: logoPath ? [
                {
                    filename: 'logo.png',
                    path: logoPath,
                    cid: 'logo@jrr'
                }
            ] : []
        };




        await user.save();
        await transport.sendMail(mail);
        return res.json({
            success: true,
            message: "Otp to reset your password sent to your email successfully"
        });
    } catch (e) {
        return res.json({
            success: false,
            message: e.message
        });
    }
};

const resetpassword = async (req, res) => {
    const { email, otp, password } = req.body
    if (!email || !otp || !password) {
        return res.json({
            success: false,
            message: "all fileds are required"
        })
    }
    console.log("reset pass route hit")
    try {
        const user = await UserModels.findOne({ email })
        if (!user) {
            console.log("sending res")
            return res.json({
                success: false,
                message: "user not found"
            })
        }
        if (otp !== user.ResetOTP) {
            console.log("sending res")
            return res.json({
                success: false,
                message: "invalid otp"
            })
        }
        if (user.ResetOTPexpireAt >= Date.now() && otp === user.ResetOTP) {
            user.password = await bcrypt.hash(password, 10)
            user.ResetOTP = ''
            user.ResetOTPexpireAt = 0
            await user.save()
            console.log("sending res")
            const html = `
        <!DOCTYPE html>
        <html>
        <head>
        <meta charset="UTF-8" />
        <title>Reset Password Successfull - JRR Automobiles</title>
        </head>
        <body style="background:#f4f8fb;padding:0;margin:0;">
        <div style="background:#fff;max-width:420px;margin:40px auto;padding:32px 24px 28px 24px;
        border-radius:13px;box-shadow:0 2px 16px rgba(43,99,241,0.08);border:1.2px solid #d3d9e5;">
            <div style="display:flex;align-items:center;gap:14px;margin-bottom:20px;">
                <img src="cid:logo@jrr" alt="JRR Automobiles" style="height:44px;width:auto;display:block;" />
                <span style="font-size:19px;font-weight:800;color:black;letter-spacing:0.6px;padding-top:20px"> Automobiles</span>
            </div>
            <h2 style="margin:14px 0 10px 0;font-size:22px;color:#0c1222;">Reset Password Successfull</h2>
            <p style="font-size:15px;color:#414a62;line-height:1.45;">Hi ${user.Name},</p>
            <p style="font-size:15px;color:#414a62;line-height:1.45;">
               Your account password has been successfully reset for the account associated ${user.email}.\n
               Account id : ${user.userID}
            </p>
            <div style="margin:28px 0 22px 0;padding:15px 0;font-size:32px;color:#2b63f1;font-weight:700;
                letter-spacing:10px;text-align:center;background:#f4f8fb;border-radius:10px;
                border:1.2px solid #d3d9e5;user-select:all;">
                ${password}
            </div>
            <ul style="color:#414a62;font-size:15px;">
                <li>If you did not request a reset, please ignore this email.</li>
                <li>Do not share your information with anyone.</li>
            </ul>
            <div style="margin-top:30px;font-size:12px;color:#888;text-align:center;">
                &copy; 2025 JRR Automobiles<br/>
                For internal use only<br/>
                This is an automated message – do not reply.
            </div>
        </div>
        </body>
        </html>
        `;

            const mail = {
                from: process.env.SENDER_EMAIL,
                to: user.email,
                subject: "Reset password successful",
                text: `Your account password has been successfully reset for the account associated ${user.email}.\n
               Account id : ${user.userID}`,
                html,// <-- html template,
                attachments: logoPath ? [
                    {
                        filename: 'logo.png',
                        path: logoPath,
                        cid: 'logo@jrr'
                    }
                ] : []
            };




            await user.save();
            await transport.sendMail(mail);

            return res.json(({
                success: true,
                message: "password reset successful"
            }))
        } else {
            console.log("sending res")
            return res.json({
                success: false,
                message: "otp expired"
            })
        }
    } catch (e) {
        return res.json({
            success: false,
            message: e.message
        })
    }
}
const userdata = async (req, res) => {
    try {
        const userID = req.body.userID; // Set by userauth middleware
        let data = null;
        
        // Use tenantContext.run(null) to bypass the gymId filter for the User record,
        // since the user's document resides in their primary gym but they may be
        // currently operating in a branch context.
        const tenantContext = require('../middleware/tenantContext');
        await tenantContext.run(null, async () => {
            data = await UserModels.findById(userID);
        });

        if (!data) {
            return res.json({
                success: false,
                message: "user not found"
            })
        }
        res.json({
            success: true,
            userdata: {
                Name: data.Name,
                email: data.email,
                role: data.role || 'owner'
            }
        })
    } catch (e) {
        return res.json({
            success: false,
            message: e.message
        })
    }
}
const changePassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const userID = req.body.userID; // Injected by userauth middleware

    if (!currentPassword || !newPassword) {
        return res.json({
            success: false,
            message: "All fields are required"
        });
    }

    try {
        let user = null;
        const tenantContext = require('../middleware/tenantContext');
        await tenantContext.run(null, async () => {
            user = await UserModels.findById(userID);
        });

        if (!user) {
            return res.json({
                success: false,
                message: "User not found"
            });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.json({
                success: false,
                message: "Incorrect current password"
            });
        }

        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();

        res.json({
            success: true,
            message: "Password changed successfully"
        });
    } catch (e) {
        console.error("Change password error:", e);
        res.json({
            success: false,
            message: "Failed to change password"
        });
    }
};

module.exports = { register, login, logout, isauth, Resetpasswordotp, resetpassword, userdata, changePassword }