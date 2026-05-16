import React, { useState, useEffect, useContext } from 'react';
import { toast } from 'react-toastify';
import { AppContent } from '../context/context.jsx';

const GlobalAttendanceListener = () => {
    const { backendurl } = useContext(AppContent);
    const [inputBuffer, setInputBuffer] = useState('');
    const [lastTimestamp, setLastTimestamp] = useState(0);

    // Audio Feedback System
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

        const audio = new Audio(config.file);
        audio.play().catch(() => {
            if ('speechSynthesis' in window) {
                const utterance = new SpeechSynthesisUtterance(config.text);
                utterance.rate = 1.2;
                window.speechSynthesis.speak(utterance);
            }
        });
    };

    const markAttendance = async (id) => {
        try {
            const now = new Date();

            // Pad the ID to 4 digits for MEMBER search
            const paddedId = id.toString().trim().padStart(4, '0');

            const attendanceData = {
                date: now.getFullYear() + '-' + (now.getMonth() + 1).toString().padStart(2, '0') + '-' + now.getDate().toString().padStart(2, '0'),
                time: now.toTimeString().split(' ')[0],
                attendanceId: paddedId,
                type: 'member' // Force member-only attendance
            };

            const response = await fetch(`${backendurl}/check`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(attendanceData)
            });

            const result = await response.json();

            if (result.audio) {
                playFeedback(result.audio);
            }

            if (result.success || result.existing) {
                const name = result.person ? result.person.fullName || `${result.person.firstName} ${result.person.lastName}` : 'User';
                toast.success(result.message || `Attendance marked for ${name}`);
            } else {
                toast.error(result.message || 'Failed to mark attendance');
            }
        } catch (error) {
            console.error('Global Attendance Error:', error);
            toast.error('Connection error for attendance');
        }
    };

    useEffect(() => {
        const handleKeyDown = (e) => {
            // Ignore if user is typing in an input or textarea
            if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
                return;
            }

            const now = Date.now();

            // Clear buffer if there's a long gap (e.g., > 1 second)
            if (now - lastTimestamp > 1000) {
                setInputBuffer('');
            }
            setLastTimestamp(now);

            // Handle digits
            if (/^\d$/.test(e.key)) {
                setInputBuffer(prev => prev + e.key);
            }
            // Handle Enter key (NumpadEnter or generic Enter)
            else if (e.key === 'Enter') {
                // Accept 1-6 digits (changed from 3-6 to allow single digit IDs)
                if (inputBuffer.length >= 1 && inputBuffer.length <= 6) {
                    markAttendance(inputBuffer);
                }
                setInputBuffer(''); // Reset after Enter
            }
            // Clear on Escape
            else if (e.key === 'Escape') {
                setInputBuffer('');
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [inputBuffer, lastTimestamp, backendurl]);

    return null; // Invisible component
};

export default GlobalAttendanceListener;
