import React, { useState, useEffect, useContext, useCallback } from 'react';
import { AppContent } from '../context/context.jsx';
import '../styles/qr-attendance.css';

export default function QrAttendance() {
    const { backendurl } = useContext(AppContent);

    // State management
    const [memberId, setMemberId] = useState('');
    const [inputType, setInputType] = useState('memberId'); // 'memberId' or 'phone'
    const [message, setMessage] = useState('');
    const [messageType, setMessageType] = useState(''); // 'success', 'error', 'info'
    const [loading, setLoading] = useState(false);
    const [autoSubmitted, setAutoSubmitted] = useState(false);
    const [gymId, setGymId] = useState(null);

    // Get gymId from URL on mount
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const id = urlParams.get('gymId');
        if (id) {
            setGymId(id);
        } else {
            console.warn("[QrAttendance] No gymId found in URL. Attendance marking may fail.");
        }
    }, []);

    // Location logic removed


    // Audio feedback system
    const playFeedback = (audioLabel) => {
        if (!audioLabel) return;

        const audioMap = {
            successful: { file: '/audio/successful.mp3', text: 'Successful' },
            expired: { file: '/audio/expired.mp3', text: 'Expired' },
            onleave: { file: '/audio/onleave.mp3', text: 'On Leave' },
            invalid: { file: '/audio/invalid.mp3', text: 'Invalid' }
        };

        const config = audioMap[audioLabel];
        if (!config) return;

        // Try playing audio file
        const audio = new Audio(config.file);
        audio.play().catch(() => {
            // Fallback to TTS if file fails
            console.log(`Audio file missing for ${audioLabel}, falling back to TTS`);
            if ('speechSynthesis' in window) {
                const utterance = new SpeechSynthesisUtterance(config.text);
                utterance.rate = 1;
                utterance.pitch = 1;
                window.speechSynthesis.speak(utterance);
            }
        });

        // Vibration feedback for mobile
        if ('vibrate' in navigator) {
            if (audioLabel === 'successful') {
                navigator.vibrate([100]); // Single short vibration
            } else {
                navigator.vibrate([100, 50, 100]); // Error pattern
            }
        }
    };

    // Handle automatic attendance submission on page load
    const handleAutoSubmit = useCallback(async (savedId) => {
        if (!savedId || !savedId.trim()) return;

        setLoading(true);
        setMessage('🔄 Auto-marking attendance...');
        setMessageType('info');

        try {
            // Step 1: Skip location check


            // Step 2: Call public attendance API with location
            const response = await fetch(`${backendurl}/public-check`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    attendanceId: savedId.trim(),
                    gymId: gymId, // Send gymId from state
                    // Location removed

                })
            });

            const result = await response.json();

            if (response.ok && result.success) {
                // Success case
                const displayName = result.person?.fullName ||
                    `${result.person?.firstName || ''} ${result.person?.lastName || ''}`.trim() ||
                    'Member';

                setMessage(`✅ Auto-marked! Welcome back, ${displayName}`);
                setMessageType('success');
                playFeedback(result.audio || 'successful');
            } else if (result.existing) {
                // Already marked today
                const displayName = result.person?.fullName ||
                    `${result.person?.firstName || ''} ${result.person?.lastName || ''}`.trim() ||
                    'Member';

                setMessage(`ℹ️ Attendance already marked for ${displayName} today!`);
                setMessageType('info');
                playFeedback('invalid');
            } else {
                // Error case (expired, on leave, out of range, etc.)
                setMessage(result.message || '❌ Failed to mark attendance. Please try again.');
                setMessageType('error');
                playFeedback(result.audio || 'invalid');
            }
        } catch (error) {
            console.error('Error auto-marking attendance:', error);
            setMessage('❌ Auto-mark failed. You can mark manually below.');
            setMessageType('error');
            playFeedback('invalid');
        } finally {
            setLoading(false);
        }
    }, [backendurl, gymId]); // Only re-create if backendurl or gymId changes

    // Load saved identifier from localStorage and auto-mark attendance on mount
    useEffect(() => {
        const savedId = localStorage.getItem('qr_member_id');
        const savedType = localStorage.getItem('qr_input_type');

        if (savedId) {
            setMemberId(savedId);
            if (savedType) {
                setInputType(savedType);
            }
            // Auto-mark attendance if we have a saved ID and haven't auto-submitted yet
            setAutoSubmitted(true);
            // Trigger auto-submission after a short delay to ensure all useEffects are complete
            setTimeout(() => {
                handleAutoSubmit(savedId);
            }, 500);
        }
    }, [handleAutoSubmit]); // Empty dependency array - only run once on mount

    // Fetch gym settings for branding
    useEffect(() => {
        const fetchGymSettings = async () => {
            if (!gymId) {
                console.warn("Cannot fetch gym settings: gymId is null.");
                return;
            }
            try {
                const response = await fetch(`${backendurl}/settings/${gymId}`, {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' },
                });
                const data = await response.json();
                if (data.success && data.settings) {
                    setGymName(data.settings.gymName || 'Gym');
                }
            } catch (error) {
                console.error('Failed to fetch gym settings:', error);
            }
        };
        fetchGymSettings();
    }, [backendurl, gymId]);

    // Auto-clear message after 5 seconds
    useEffect(() => {
        if (message) {
            const timer = setTimeout(() => {
                setMessage('');
                setMessageType('');
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [message]);

    // Handle manual attendance submission
    const handleSubmit = async (e) => {
        if (e) e.preventDefault();

        setLoading(true);
        setMessage('');
        setMessageType('');

        // Validate input
        if (!memberId || !memberId.trim()) {
            setMessage(inputType === 'phone' ? 'Please enter your Phone Number' : 'Please enter your Member ID');
            setMessageType('error');
            playFeedback('invalid');
            setLoading(false);
            return;
        }

        if (!gymId) {
            setMessage('❌ Gym ID not found. Cannot mark attendance.');
            setMessageType('error');
            playFeedback('invalid');
            setLoading(false);
            return;
        }

        try {
            // Step 1: Skip location check


            // Step 2: Save identifier and type to localStorage for next time
            localStorage.setItem('qr_member_id', memberId.trim());
            localStorage.setItem('qr_input_type', inputType);

            // Step 3: Call public attendance API with location
            const response = await fetch(`${backendurl}/public-check`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    attendanceId: memberId.trim(),
                    gymId: gymId, // Send gymId from state
                    // Location removed

                })
            });

            const result = await response.json();

            if (response.ok && result.success) {
                // Success case
                const displayName = result.person?.fullName ||
                    `${result.person?.firstName || ''} ${result.person?.lastName || ''}`.trim() ||
                    'Member';

                setMessage(`✅ Attendance marked successfully! Welcome, ${displayName}`);
                setMessageType('success');
                playFeedback(result.audio || 'successful');

                // Clear input after 3 seconds
                setTimeout(() => {
                    setMemberId('');
                }, 3000);
            } else if (result.existing) {
                // Already marked today
                const displayName = result.person?.fullName ||
                    `${result.person?.firstName || ''} ${result.person?.lastName || ''}`.trim() ||
                    'Member';

                setMessage(`ℹ️ Attendance already marked for ${displayName} today!`);
                setMessageType('info');
                playFeedback('invalid');
            } else {
                // Error case (expired, on leave, out of range, etc.)
                setMessage(result.message || '❌ Failed to mark attendance. Please contact reception.');
                setMessageType('error');
                playFeedback(result.audio || 'invalid');
            }
        } catch (error) {
            console.error('Error marking attendance:', error);
            setMessage('❌ Network error. Please try again or contact reception.');
            setMessageType('error');
            playFeedback('invalid');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="qr-attendance-container">
            <div className="qr-attendance-card">
                {/* Gym Branding */}
                <div className="qr-header">
                    <h1 className="gym-name">{gymName}</h1>
                    <p className="qr-subtitle">Self Check-in</p>
                </div>

                {/* Status Message */}
                {message && (
                    <div className={`qr-message qr-message-${messageType}`}>
                        {message}
                    </div>
                )}

                {/* Attendance Form */}
                <form onSubmit={handleSubmit} className="qr-form">
                    {/* Input Type Toggle */}
                    <div className="qr-toggle-container">
                        <button
                            type="button"
                            className={`qr-toggle-btn ${inputType === 'memberId' ? 'active' : ''}`}
                            onClick={() => {
                                setInputType('memberId');
                                setMemberId('');
                            }}
                            disabled={loading}
                        >
                            Member ID
                        </button>
                        <button
                            type="button"
                            className={`qr-toggle-btn ${inputType === 'phone' ? 'active' : ''}`}
                            onClick={() => {
                                setInputType('phone');
                                setMemberId('');
                            }}
                            disabled={loading}
                        >
                            Phone Number
                        </button>
                    </div>

                    <div className="qr-form-group">
                        <label htmlFor="memberId" className="qr-label">
                            {inputType === 'phone' ? 'Enter Your Phone Number' : 'Enter Your Member ID'}
                        </label>
                        <input
                            id="memberId"
                            type={inputType === 'phone' ? 'tel' : 'text'}
                            value={memberId}
                            onChange={(e) => setMemberId(e.target.value)}
                            placeholder={inputType === 'phone' ? 'e.g., +91 9876543210' : 'e.g., 1000'}
                            className="qr-input"
                            autoFocus
                            disabled={loading}
                        />
                    </div>

                    <button
                        type="submit"
                        className="qr-submit-btn"
                        disabled={loading || !memberId.trim()}
                    >
                        {loading ? (
                            <>
                                <span className="spinner"></span>
                                Processing...
                            </>
                        ) : (
                            '✓ Mark Attendance'
                        )}
                    </button>
                </form>

                {/* Help Text */}
                <div className="qr-help">
                    <p>Don't know your Member ID or Phone Number?</p>
                    <p>Please contact the reception desk.</p>
                </div>
            </div>
        </div>
    );
}
