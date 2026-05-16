// AddStaff.jsx
import React, { useState, useContext, useEffect, useRef } from "react";
import imageCompression from 'browser-image-compression';
import { useNavigate, useLocation } from "react-router-dom";
import { AppContent } from "../context/context.jsx";
import "../styles/dashboard.css";
import ToggleButton from "../components/ToggleButton.jsx";
import Sidebar from "../components/Sidebar.jsx";
import "../styles/sidebar.css";
import "../styles/toggle-button.css";
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';

export default function AddStaff() {
  const { backendurl } = useContext(AppContent);
  const navigate = useNavigate();
  const location = useLocation();
  const [isEditing, setIsEditing] = useState(false);
  const [staffId, setStaffId] = useState('');

  // Helper to generate 3-digit numeric ID
  const generateAttendanceId = () => {
    const randomNum = Math.floor(Math.random() * 900) + 100; // Generates 100-999
    return randomNum.toString();
  };

  // Get staff data from location state if editing (support both keys)
  const staffData = location.state?.staffMember ?? location.state?.staff;
  const editing = location.state?.isEditing ?? Boolean(location.state?.staffMember ?? location.state?.staff);

  const [form, setForm] = useState({
    // Personal Details
    firstName: "",
    lastName: "",
    staffId: "",
    gender: "",
    dob: "",
    phone: "",
    email: "",
    emergencyContact: "",
    emergencyPhone: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    profilePhoto: null,

    // Employment Details
    role: "",
    department: "",
    joinDate: "",
    salary: "",
    employmentType: "Full-time", // Full-time/Part-time/Contract
    salaryPaymentMode: "Bank", // Bank/Cash
    bankAccount: "",
    ifsc: "",
    panNumber: "",
    aadhaarNumber: "",

    // Work Schedule
    shiftType: "",
    workDays: [],
    workHoursStart: "",
    workHoursEnd: "",
    breakDuration: "",

    // Certifications & Skills
    certifications: "",
    specializations: "",
    qualifications: "",
    certificates: null,

    // Gym Assignment
    assignedBranch: "",
    assignedBatches: [],
    assignedMembers: [],

    // Status
    status: "Active",
    probationPeriod: false,
    probationEndDate: "",

    // Attendance and Access
    entryAllowed: "Yes",
  });

  // Helper to deeply parse and normalize workDays from backend
  const parseWorkDaysValue = (wd) => {
    console.log('parseWorkDaysValue called with:', wd, typeof wd);

    const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    const normalize = (s) => {
      if (!s) return null;
      const str = String(s).trim();
      const found = DAYS.find((d) => d.toLowerCase() === str.toLowerCase());
      if (found) return found;
      return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    };

    // Handle null/undefined
    if (wd == null) {
      console.log('parseWorkDaysValue: wd is null, returning empty array');
      return [];
    }

    // Handle already parsed arrays
    if (Array.isArray(wd)) {
      console.log('parseWorkDaysValue: wd is array:', wd);

      // Special case: if array has only one element and it's a JSON string
      if (wd.length === 1 && typeof wd[0] === 'string') {
        const firstElement = wd[0].trim();
        console.log('parseWorkDaysValue: single element array with string:', firstElement);

        // Check if it's a JSON array string
        if (firstElement.startsWith('[') && firstElement.endsWith(']')) {
          try {
            const parsed = JSON.parse(firstElement);
            console.log('parseWorkDaysValue: parsed single element JSON:', parsed);

            if (Array.isArray(parsed)) {
              const result = parsed
                .map(item => {
                  if (typeof item === 'string') {
                    return normalize(item);
                  }
                  return normalize(String(item));
                })
                .filter(Boolean)
                .filter(day => DAYS.includes(day));

              console.log('parseWorkDaysValue: single element array result:', result);
              return result;
            }
          } catch (e) {
            console.log('parseWorkDaysValue: failed to parse single element JSON:', e.message);
          }
        }
      }

      // Regular array processing
      const result = wd
        .map(item => {
          // If it's a string, normalize it
          if (typeof item === 'string') {
            return normalize(item);
          }
          // If it's something else, convert to string and normalize
          return normalize(String(item));
        })
        .filter(Boolean)
        .filter(day => DAYS.includes(day)); // Only include valid day names

      console.log('parseWorkDaysValue: array result:', result);
      return result;
    }

    // Handle string inputs - this is where the double-encoded JSON issue occurs
    if (typeof wd === 'string') {
      console.log('parseWorkDaysValue: wd is string:', wd);

      // Try to parse as JSON multiple times to handle double/triple encoding
      let parsed = wd;
      let attempts = 0;
      const maxAttempts = 5;

      while (attempts < maxAttempts) {
        try {
          // Check if it looks like JSON
          const trimmed = parsed.trim();
          if ((trimmed.startsWith('[') && trimmed.endsWith(']')) ||
            (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
            const result = JSON.parse(parsed);
            console.log(`parseWorkDaysValue: JSON parse attempt ${attempts + 1} successful:`, result);
            parsed = result;
            attempts++;
          } else {
            break; // Not JSON-like, stop parsing
          }
        } catch (e) {
          console.log(`parseWorkDaysValue: JSON parse attempt ${attempts + 1} failed:`, e.message);
          break;
        }
      }

      // Now handle the parsed result
      if (Array.isArray(parsed)) {
        const result = parsed
          .map(item => {
            if (typeof item === 'string') {
              return normalize(item);
            }
            return normalize(String(item));
          })
          .filter(Boolean)
          .filter(day => DAYS.includes(day));

        console.log('parseWorkDaysValue: string->array result:', result);
        return result;
      }

      // If it's still a string after parsing attempts
      if (typeof parsed === 'string') {
        // Split by comma and normalize
        const result = parsed
          .split(',')
          .map(s => normalize(s.trim()))
          .filter(Boolean)
          .filter(day => DAYS.includes(day));

        console.log('parseWorkDaysValue: string result:', result);
        return result;
      }
    }

    // Fallback: convert to string and try to extract day names
    const str = String(wd);
    const result = [];

    // Look for day names in the string
    DAYS.forEach(day => {
      if (str.toLowerCase().includes(day.toLowerCase())) {
        result.push(day);
      }
    });

    console.log('parseWorkDaysValue: fallback result:', result);
    return result;
  };
  // Helper to deeply parse and normalize assignedBatches from backend
  const parseAssignedBatchesValue = (ab) => {
    // Helper to recursively parse and flatten
    const flattenAndParse = (input) => {
      if (input === null || input === undefined) return [];

      if (Array.isArray(input)) {
        return input.flatMap(item => flattenAndParse(item));
      }

      if (typeof input === 'string') {
        let trimmed = input.trim();
        // Remove surrounding quotes if present (double encoded strings)
        if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
          try {
            const unquoted = JSON.parse(trimmed);
            if (unquoted !== trimmed) return flattenAndParse(unquoted);
          } catch (e) {
            // ignore
          }
        }

        // Check if string is a JSON array
        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
          try {
            const parsed = JSON.parse(trimmed);
            // If parsed is different from input, recurse
            if (parsed !== input) {
              return flattenAndParse(parsed);
            }
          } catch (e) {
            // Not valid JSON, treat as regular string
          }
        }

        // Handle comma-separated strings inside the structure
        if (trimmed.includes(',') && !trimmed.startsWith('[')) {
          return trimmed.split(',').map(s => s.trim()).filter(Boolean);
        }

        return [trimmed];
      }

      return [String(input)];
    };

    const result = flattenAndParse(ab);
    return [...new Set(result)].filter(Boolean);
  };
  // Helper to deeply parse and normalize assignedMembers from backend
  const parseAssignedMembersValue = (am) => {
    const deepParse = (val) => {
      let cur = val;
      let prev = null;
      for (let i = 0; i < 10; i++) {
        if (cur === prev) break;
        prev = cur;
        if (typeof cur === 'string') {
          const t = cur.trim();
          if (t.startsWith('[') || t.startsWith('"') || t.startsWith('\"') || t.includes('\\"')) {
            try {
              cur = JSON.parse(cur);
              continue;
            } catch (e) {
              // not parseable further
            }
          }
        }
        break;
      }
      return cur;
    };

    if (am == null) return [];

    // If value is an array, try to flatten deeply-parsed elements
    if (Array.isArray(am)) {
      const out = [];
      am.forEach((el) => {
        const p = deepParse(el);
        if (Array.isArray(p)) {
          p.forEach((x) => {
            if (typeof x === 'object' && x !== null) out.push(x);
            else if (typeof x === 'string') {
              try {
                const obj = JSON.parse(x);
                if (typeof obj === 'object' && obj !== null) out.push(obj);
              } catch (e) {
                // ignore
              }
            }
          });
        } else if (typeof p === 'object' && p !== null) {
          out.push(p);
        } else if (typeof p === 'string') {
          try {
            const obj = JSON.parse(p);
            if (typeof obj === 'object' && obj !== null) out.push(obj);
          } catch (e) {
            // ignore
          }
        }
      });
      return out.filter(Boolean);
    }

    // For string inputs, deep parse then handle
    if (typeof am === 'string') {
      const parsed = deepParse(am);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
      if (typeof parsed === 'object' && parsed !== null) return [parsed];
    }

    return [];
  };

  const [assignedMembersList, setAssignedMembersList] = useState([]);
  const [members, setMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [certificatePreview, setCertificatePreview] = useState(null);
  const photoInputRef = useRef(null);


  // Fetch members from database
  const fetchMembers = async () => {
    setLoadingMembers(true);
    try {
      console.log('Fetching members from:', `${backendurl}/members`);
      const response = await fetch(`${backendurl}/members`, {
        method: 'GET',
        credentials: 'include',
      });
      console.log('Response status:', response.status);
      const result = await response.json();
      console.log('Fetch members result:', result);

      if (result.success) {
        console.log('Members data received:', result.members);
        console.log('Members data type:', typeof result.members);
        console.log('Members data length:', result.members ? result.members.length : 'undefined');

        // The correct structure should be result.members
        let membersData = [];
        if (result.members && Array.isArray(result.members)) {
          membersData = result.members;
        } else if (result.data && Array.isArray(result.data)) {
          membersData = result.data;
        } else if (result && Array.isArray(result)) {
          membersData = result;
        } else {
          console.warn('Unexpected members data structure:', result);
          membersData = [];
        }

        // Debug: Log the first member's data structure
        if (membersData.length > 0) {
          console.log('First member data structure:', {
            firstName: membersData[0].firstName,
            lastName: membersData[0].lastName,
            memberId: membersData[0].memberId,
            packageName: membersData[0].packageName,
            ptSessions: membersData[0].ptSessions,
            trainer: membersData[0].trainer,
            trainerAssigned: membersData[0].trainerAssigned,
            availableFields: Object.keys(membersData[0])
          });
        }

        console.log('Final members data:', membersData);
        setMembers(membersData);
      } else {
        console.error('Failed to fetch members:', result.message);
      }
    } catch (error) {
      console.error('Error fetching members:', error);
    } finally {
      setLoadingMembers(false);
    }
  };

  // Filter members to show only those assigned to the current trainer
  const getAssignedMembersForTrainer = () => {
    if (!isEditing || !staffData || staffData.role !== 'Trainer') {
      return [];
    }

    console.log('getAssignedMembersForTrainer called with:', {
      staffData: staffData,
      assignedMembers: staffData.assignedMembers,
      members: members
    });

    // Get the assigned member IDs from the current trainer
    const assignedMemberIds = Array.isArray(staffData.assignedMembers)
      ? staffData.assignedMembers.map(member => {
        // Handle different data formats for assignedMembers
        if (typeof member === 'string') {
          return member;
        } else if (member && member.memberId) {
          return member.memberId;
        } else if (member && member._id) {
          return member._id;
        }
        return null;
      }).filter(Boolean)
      : [];

    console.log('Assigned member IDs from trainer data:', assignedMemberIds);

    // If no assigned member IDs found, try to find members assigned to this trainer
    if (assignedMemberIds.length === 0) {
      console.log('No assigned member IDs found in trainer data, searching members for trainer assignment');

      // Search through all members to find those assigned to this trainer
      const membersAssignedToTrainer = members.filter(member => {
        console.log('Checking member for trainer assignment:', {
          memberId: member._id,
          trainer: member.trainer,
          trainerAssigned: member.trainerAssigned,
          staffDataId: staffData._id,
          staffDataName: `${staffData.firstName} ${staffData.lastName}`
        });

        // Check if member has trainerAssigned field matching current trainer's name
        if (member.trainerAssigned && member.trainerAssigned === `${staffData.firstName} ${staffData.lastName}`) {
          console.log('Found member with trainerAssigned name match');
          return true;
        }

        // Check if member has trainer field matching current trainer's name
        if (member.trainer && member.trainer === `${staffData.firstName} ${staffData.lastName}`) {
          console.log('Found member with trainer name match');
          return true;
        }

        // Check if member has trainerAssigned field matching current trainer's ID
        if (member.trainerAssigned && member.trainerAssigned === staffData._id) {
          console.log('Found member with trainerAssigned ID match');
          return true;
        }

        // Check if member has trainer field matching current trainer's ID
        if (member.trainer && member.trainer === staffData._id) {
          console.log('Found member with trainer ID match');
          return true;
        }

        // Check if member has trainer object with _id matching current trainer
        if (member.trainer && member.trainer._id && member.trainer._id === staffData._id) {
          console.log('Found member with trainer object match');
          return true;
        }

        // Check if member has trainerAssigned object with _id matching current trainer
        if (member.trainerAssigned && member.trainerAssigned._id && member.trainerAssigned._id === staffData._id) {
          console.log('Found member with trainerAssigned object match');
          return true;
        }

        return false;
      });

      console.log('Members assigned to trainer found:', membersAssignedToTrainer);
      return membersAssignedToTrainer;
    }

    // Filter the members list to show only assigned members
    const assignedMembers = members.filter(member => {
      const memberId = member._id || member.memberId;
      return assignedMemberIds.includes(memberId);
    });

    console.log('Filtered assigned members from trainer data:', assignedMembers);
    return assignedMembers;
  };

  // Filter members to show only active members assigned to the current trainer
  const getActiveAssignedMembersForTrainer = () => {
    const assignedMembers = getAssignedMembersForTrainer();
    console.log('All assigned members status values:', assignedMembers.map(m => ({ id: m.memberId, status: m.status })));
    return assignedMembers.filter(member => {
      const status = member.status ? member.status.toLowerCase() : '';
      const isActive = status === 'active' || status === 'approved' || status === 'running' || status === 'valid' || status === 'pending';
      console.log(`Member ${member.memberId} status: "${member.status}" -> "${status}" -> active: ${isActive}`);
      return isActive;
    });
  };

  // Fetch assigned members data for the current trainer
  const fetchAssignedMembersData = async () => {
    if (!isEditing || !staffData || staffData.role !== 'Trainer') {
      return [];
    }

    try {
      console.log('Fetching assigned members for trainer:', staffData._id, 'Name:', `${staffData.firstName} ${staffData.lastName}`);
      const response = await fetch(`${backendurl}/staff/${staffData._id}/assigned-members`, {
        method: 'GET',
        credentials: 'include',
      });

      const result = await response.json();
      console.log('Assigned members response:', result);

      if (result.success && result.members) {
        console.log('Assigned members data:', result.members);
        return result.members;
      } else {
        console.error('Failed to fetch assigned members:', result.message);
        return [];
      }
    } catch (error) {
      console.error('Error fetching assigned members:', error);
      return [];
    }
  };

  // Alternative method to fetch members assigned to trainer by searching all members
  const fetchMembersAssignedToTrainer = async () => {
    if (!isEditing || !staffData || staffData.role !== 'Trainer') {
      return [];
    }

    try {
      console.log('Searching all members for trainer assignment:', staffData._id);

      // Fetch all members and filter on client side
      const response = await fetch(`${backendurl}/members`, {
        method: 'GET',
        credentials: 'include',
      });

      const result = await response.json();
      console.log('All members response:', result);

      if (result.success && result.members) {
        // Filter members assigned to this trainer
        const membersAssignedToTrainer = result.members.filter(member => {
          console.log('Checking member for trainer assignment:', {
            memberId: member._id,
            trainer: member.trainer,
            trainerAssigned: member.trainerAssigned,
            staffDataId: staffData._id,
            staffDataName: `${staffData.firstName} ${staffData.lastName}`
          });

          // Check various possible trainer assignment fields
          const trainerFields = [
            member.trainerAssigned,
            member.trainer,
            member.trainerAssigned?._id,
            member.trainer?._id
          ];

          return trainerFields.some(trainer => {
            if (!trainer) return false;

            console.log('Checking trainer field:', trainer, 'against staffData._id:', staffData._id, 'and name:', `${staffData.firstName} ${staffData.lastName}`);

            // Handle string comparisons - check both ID and name
            if (typeof trainer === 'string') {
              const idMatch = trainer === staffData._id;
              const nameMatch = trainer === `${staffData.firstName} ${staffData.lastName}`;
              const match = idMatch || nameMatch;
              console.log('String comparison result (ID:', idMatch, ', Name:', nameMatch, ')');
              return match;
            }

            // Handle object IDs
            if (typeof trainer === 'object' && trainer !== null) {
              const match = trainer._id === staffData._id;
              console.log('Object comparison result:', match);
              return match;
            }

            return false;
          });
        });

        console.log('Members assigned to trainer found:', membersAssignedToTrainer);
        return membersAssignedToTrainer;
      } else {
        console.error('Failed to fetch all members:', result.message);
        return [];
      }
    } catch (error) {
      console.error('Error fetching members assigned to trainer:', error);
      return [];
    }
  };



  // Update assigned members when component loads or trainer changes
  useEffect(() => {
    // Helper to generate preview object for certificates
    const generatePreview = (item) => {
      if (item instanceof File) {
        return { url: URL.createObjectURL(item), type: 'file', isImage: isImageFile(item.name) };
      } else if (typeof item === 'string') {
        const baseUrl = backendurl.replace(/\/gym$/, '');
        let path = item;
        if (!path.startsWith('/') && !path.startsWith('http')) path = '/' + path;
        const fullUrl = (path.startsWith('http') || path.startsWith('blob:')) ? path : `${baseUrl}${path}`;
        return { url: fullUrl, type: 'url', isImage: isImageFile(path), originalPath: item };
      }
      return null;
    };

    let certs = form.certificates;
    if (!certs) {
      setCertificatePreview([]);
      // return; // Continue to loadAssignedMembers
    } else {
      // Normalize to array
      if (!Array.isArray(certs)) certs = [certs];
      const previews = certs.map(generatePreview).filter(Boolean);
      setCertificatePreview(previews);
    }
  }, [form.certificates, backendurl]);

  const isImageFile = (urlOrFile) => {
    if (!urlOrFile) return false;
    const name = (urlOrFile instanceof File) ? urlOrFile.name : urlOrFile;
    if (typeof name !== 'string') return true; // Fallback
    const lower = name.toLowerCase();
    // Common image extensions
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
    return imageExtensions.some(ext => lower.endsWith(ext)) || lower.startsWith('data:image') || lower.startsWith('blob:');
  };

  const handleRemoveCertificate = (index) => {
    setForm(prev => {
      let current = prev.certificates;
      if (!current) return prev;
      if (!Array.isArray(current)) current = [current];

      const updated = [...current];
      updated.splice(index, 1);
      return { ...prev, certificates: updated.length > 0 ? updated : null };
    });
  };

  // Update assigned members when component loads or trainer changes
  useEffect(() => {
    const loadAssignedMembers = async () => {
      if (isEditing && staffData && staffData.role === 'Trainer') {
        console.log('Loading assigned members for trainer:', staffData._id, 'Name:', `${staffData.firstName} ${staffData.lastName}`);

        // Try multiple methods to get assigned members
        let assignedMembersData = [];

        // Method 1: Try direct API call
        assignedMembersData = await fetchAssignedMembersData();
        console.log('Method 1 (direct API) result:', assignedMembersData.length);

        if (assignedMembersData.length === 0) {
          // Method 2: Search all members for trainer assignment (by name and ID)
          assignedMembersData = await fetchMembersAssignedToTrainer();
          console.log('Method 2 (search all members by name/ID) result:', assignedMembersData.length);
        }

        if (assignedMembersData.length === 0) {
          // Method 3: Use fallback method from trainer's assignedMembers field
          const assignedMemberIds = Array.isArray(staffData.assignedMembers)
            ? staffData.assignedMembers.map(member => {
              if (typeof member === 'string') return member;
              if (member && member.memberId) return member.memberId;
              if (member && member._id) return member._id;
              return null;
            }).filter(Boolean)
            : [];

          console.log('Method 3 (trainer assignedMembers field) - assignedMemberIds:', assignedMemberIds);

          const filteredMembers = members.filter(member => {
            const memberId = member._id || member.memberId;
            return assignedMemberIds.includes(memberId);
          });

          console.log('Method 3 result:', filteredMembers.length);
          assignedMembersData = filteredMembers;
        }

        if (assignedMembersData.length > 0) {
          // Update the dedicated assigned members state
          setAssignedMembersList(assignedMembersData);
          // Also set members for backward compatibility/debugging if needed, but primary display uses assignedMembersList
          setMembers(assignedMembersData);
          console.log('Successfully loaded', assignedMembersData.length, 'assigned members');
        } else {
          console.log('No assigned members found using any method');
        }
      }
    };

    loadAssignedMembers();
  }, [isEditing, staffData, backendurl, members]);

  // Handle member assignment (for future use if checkboxes are re-added)
  const isMemberAssigned = (member) => {
    if (!Array.isArray(form.assignedMembers)) return false;
    return form.assignedMembers.some((am) => {
      if (!am) return false;
      if (typeof am === 'string') return am === member._id || am === member.memberId;
      return (am.memberId && (am.memberId === member._id || am.memberId === member.memberId)) || (am._id && am._id === member._id);
    });
  };

  const handleMemberAssignment = (member) => {
    // This function is kept for future use if checkboxes are re-added
    // Currently not used since checkboxes are removed
    console.log('Member assignment function called (not used currently):', member);
  };

  // Add state for photo compression loading
  const [compressingPhoto, setCompressingPhoto] = useState(false);

  const handleChange = async (e) => {
    const { name, value, type, checked } = e.target;
    if (type === "checkbox") {
      if (name === "workDays") {
        setForm((prev) => {
          console.log('Checkbox change:', { name, value, checked, currentWorkDays: prev.workDays });

          // Clean the current workDays array to remove any malformed entries
          const cleanWorkDays = prev.workDays.filter(day =>
            typeof day === 'string' && day.length > 0
          );

          let newWorkDays;
          let statusChanged = false;
          let newStatus = prev.status;

          if (checked) {
            // Add day if not already present
            if (!cleanWorkDays.includes(value)) {
              newWorkDays = [...cleanWorkDays, value];
              // If status was On Leave and we're adding work days, change to Active
              if (prev.status === "On Leave") {
                newStatus = "Active";
                statusChanged = true;
              }
            } else {
              newWorkDays = cleanWorkDays; // Day already exists
            }
          } else {
            // Remove day
            newWorkDays = cleanWorkDays.filter((day) => day !== value);
            // Always set status to On Leave when removing work days
            newStatus = "On Leave";
            statusChanged = true;
          }

          console.log('New work days:', newWorkDays);
          console.log('Status changed:', statusChanged, 'from', prev.status, 'to', newStatus);

          return {
            ...prev,
            workDays: newWorkDays,
            status: newStatus,
          };
        });
      } else {
        setForm((prev) => ({ ...prev, [name]: checked }));
      }
    } else if (type === "file") {
      const files = e.target.files;
      if (name === 'certificates') {
        if (files && files.length > 0) {
          const newFiles = Array.from(files);
          setForm(prev => {
            let current = prev.certificates || [];
            if (!Array.isArray(current)) current = [current];
            return { ...prev, certificates: [...current, ...newFiles] };
          });
        }
        // Clear input value to allow re-selecting same file
        e.target.value = '';
        return;
      }

      let file = files[0];

      if (file && file.type.startsWith('image/')) {
        setCompressingPhoto(true);
        try {
          const options = {
            maxSizeMB: 1,
            maxWidthOrHeight: 1920,
            useWebWorker: true
          };
          const compressedFile = await imageCompression(file, options);
          // Ensure it's a File object with original name
          if (compressedFile instanceof Blob && !(compressedFile instanceof File)) {
            file = new File([compressedFile], file.name, { type: file.type });
          } else {
            file = compressedFile;
          }
        } catch (err) {
          console.error("Compression error:", err);
        } finally {
          setCompressingPhoto(false);
        }
      }

      if (name === 'profilePhoto') {
        if (previewUrl && previewUrl.startsWith('blob:')) {
          try { URL.revokeObjectURL(previewUrl); } catch (e) { /* ignore */ }
        }
        if (file) {
          const blobUrl = URL.createObjectURL(file);
          setPreviewUrl(blobUrl);
          setForm((prev) => ({ ...prev, profilePhoto: file }));
        } else {
          setPreviewUrl("");
          setForm((prev) => ({ ...prev, profilePhoto: null }));
        }
      } else {
        setForm((prev) => ({ ...prev, [name]: file }));
      }
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleRemovePhoto = () => {
    // Revoke blob URL if needed
    if (previewUrl && previewUrl.startsWith('blob:')) {
      try { URL.revokeObjectURL(previewUrl); } catch (e) { /* ignore */ }
    }
    setPreviewUrl("");
    setForm((prev) => ({ ...prev, profilePhoto: null }));
    if (photoInputRef.current) photoInputRef.current.value = null;
  };

  // Helper to build uploads URL for existing images
  const getUploadUrl = (filename) => {
    if (!filename) return "";
    try {
      const base = backendurl && backendurl.includes('/gym') ? backendurl.replace('/gym', '') : backendurl;
      return `${base}/uploads/${filename}`;
    } catch (e) {
      return `${backendurl}/uploads/${filename}`;
    }
  };

  // Function to check if today's day is in workDays and update status accordingly
  const updateStatusForToday = (workDaysArray) => {
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    console.log('Today is:', today);
    console.log('Work days array:', workDaysArray);

    const isTodayWorkDay = workDaysArray.includes(today);
    console.log('Is today a work day?', isTodayWorkDay);

    const newStatus = isTodayWorkDay ? "Active" : "On Leave";
    console.log('Setting status to:', newStatus);

    setForm((prev) => ({
      ...prev,
      status: newStatus,
    }));
  };



  // Recursive search for a key matching predicate and return its value
  const deepFindValue = (obj, predicate, seen = new Set()) => {
    if (!obj || typeof obj !== 'object') return undefined;
    if (seen.has(obj)) return undefined;
    seen.add(obj);
    for (const key of Object.keys(obj)) {
      try {
        if (predicate(key, obj[key])) return obj[key];
      } catch (e) { }
      const val = obj[key];
      if (val && typeof val === 'object') {
        const found = deepFindValue(val, predicate, seen);
        if (found !== undefined) return found;
      }
    }
    return undefined;
  };

  // Update status when workDays change
  useEffect(() => {
    if (form.workDays && Array.isArray(form.workDays)) {
      updateStatusForToday(form.workDays);
    }
  }, [form.workDays]);

  // Fetch members when component loads
  React.useEffect(() => {
    fetchMembers();
  }, []);

  // Set editing state when component mounts
  useEffect(() => {
    if (editing) {
      setIsEditing(true);
    }
  }, [editing]);

  // Generate unique numeric ID only when adding a new staff (not when editing)
  useEffect(() => {
    if (!editing) {
      setForm((prev) => ({ ...prev, staffId: generateAttendanceId() }));
    }
  }, [editing]);

  // Populate form with staff data when editing
  React.useEffect(() => {
    console.log('Staff data received:', staffData);
    console.log('Editing mode:', editing);
    if (editing && staffData) {
      setStaffId(staffData._id);

      // Debug the data structure
      console.log('Complete staff data:', staffData);
      console.log('Work days from backend:', staffData.workDays);
      console.log('Assigned batches from backend:', staffData.assignedBatches);
      console.log('Assigned members from backend:', staffData.assignedMembers);
      console.log('Bank account:', staffData.bankAccount);
      console.log('PAN number:', staffData.panNumber);
      console.log('Aadhaar number:', staffData.aadhaarNumber);
      console.log('Work days type:', typeof staffData.workDays, Array.isArray(staffData.workDays));
      console.log('Assigned batches type:', typeof staffData.assignedBatches, Array.isArray(staffData.assignedBatches));
      console.log('Assigned members type:', typeof staffData.assignedMembers, Array.isArray(staffData.assignedMembers));

      // Parse work days from multiple possible backend keys and fall back to deep search
      let rawWorkDays = staffData.workDays ?? staffData.workdays ?? staffData.work_days ?? staffData.days;
      if ((rawWorkDays === undefined || rawWorkDays === null) && typeof staffData === 'object') {
        rawWorkDays = deepFindValue(staffData, (k) => k.toLowerCase().includes('work') && k.toLowerCase().includes('day'));
      }
      const parsedWorkDays = parseWorkDaysValue(rawWorkDays);
      console.log('Parsed work days:', parsedWorkDays);
      console.log('Parsed work days type:', typeof parsedWorkDays, Array.isArray(parsedWorkDays));

      // Check if parsedWorkDays is empty when it shouldn't be
      if (Array.isArray(parsedWorkDays) && parsedWorkDays.length === 0 && staffData.workDays) {
        console.warn('Parsed work days is empty but backend data exists:', staffData.workDays);
      }

      // Populate form with existing staff data
      setForm({
        // Personal Details
        firstName: staffData.firstName || "",
        lastName: staffData.lastName || "",
        staffId: staffData.staffId ?? staffData.staffID ?? staffData.staff_code ?? "",
        gender: staffData.gender || "",
        dob: staffData.dob ? (() => { const d = new Date(staffData.dob); return d.getFullYear() + '-' + (d.getMonth() + 1).toString().padStart(2, '0') + '-' + d.getDate().toString().padStart(2, '0'); })() : "",
        phone: staffData.phone || "",
        email: staffData.email || "",
        emergencyContact: staffData.emergencyContact || "",
        emergencyPhone: staffData.emergencyPhone || "",
        address: staffData.address || "",
        city: staffData.city || "",
        state: staffData.state || "",
        pincode: staffData.pincode || "",
        profilePhoto: null, // Profile photo can't be pre-filled for security reasons

        // Employment Details
        role: staffData.role || "",
        department: staffData.department || "",
        joinDate: staffData.joinDate ? (() => { const d = new Date(staffData.joinDate); return d.getFullYear() + '-' + (d.getMonth() + 1).toString().padStart(2, '0') + '-' + d.getDate().toString().padStart(2, '0'); })() : "",
        salary: staffData.salary || "",
        employmentType: staffData.employmentType || "Full-time",
        salaryPaymentMode: staffData.salaryPaymentMode || "Bank",
        bankAccount: staffData.bankAccount || "",
        ifsc: staffData.ifsc || "",
        panNumber: staffData.panNumber || "",
        aadhaarNumber: staffData.aadhaarNumber || "",

        // Work Schedule
        shiftType: staffData.shiftType || "",
        workDays: parsedWorkDays,
        workHoursStart: staffData.workHoursStart || "",
        workHoursEnd: staffData.workHoursEnd || "",
        breakDuration: staffData.breakDuration || "",

        // Certifications & Skills
        certifications: staffData.certifications || "",
        specializations: staffData.specializations || "",
        qualifications: staffData.qualifications || "",
        certificates: staffData.certificates || null, // Initialize with existing certificates

        // Gym Assignment
        assignedBranch: staffData.assignedBranch || "",
        assignedBatches: parseAssignedBatchesValue(staffData.assignedBatches),
        assignedMembers: parseAssignedMembersValue(staffData.assignedMembers),

        // Status
        status: staffData.status || "Active",
        probationPeriod: staffData.probationPeriod || false,
        probationEndDate: staffData.probationEndDate ? (() => { const d = new Date(staffData.probationEndDate); return d.getFullYear() + '-' + (d.getMonth() + 1).toString().padStart(2, '0') + '-' + d.getDate().toString().padStart(2, '0'); })() : "",

        // Attendance and Access
        entryAllowed: staffData.entryAllowed || "Yes",
      });
      // Show saved profile photo in preview when editing
      if (staffData.profilePhoto) {
        // Robust URL construction for profile photo
        const baseUrl = backendurl.replace('/gym', '').replace(/\/+$/, '');
        const photoPath = staffData.profilePhoto.startsWith('/') ? staffData.profilePhoto : `/${staffData.profilePhoto}`;
        const fullPhotoUrl = staffData.profilePhoto.startsWith('http') ? staffData.profilePhoto : `${baseUrl}${photoPath}`;
        setPreviewUrl(fullPhotoUrl);
      }

      // Log the final form state
      console.log('Form populated with workDays:', parsedWorkDays);

      // Update status based on today's day after form is populated
      if (parsedWorkDays && Array.isArray(parsedWorkDays)) {
        updateStatusForToday(parsedWorkDays);
      }

      // Load assigned members data for trainers - this is now handled by the separate useEffect
      if (staffData.role === 'Trainer') {
        console.log('Trainer detected, assigned members will be loaded by the dedicated useEffect');
      }
    }
  }, [editing, staffData]);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        try { URL.revokeObjectURL(previewUrl); } catch (e) { /* ignore */ }
      }
    };
  }, [previewUrl]);

  const validateForm = () => {
    // 1. Check required text fields
    if (!form.firstName?.trim()) {
      toast.error("First Name is required");
      return false;
    }

    if (!form.phone?.trim()) {
      toast.error("Phone number is required");
      return false;
    }
    if (!form.gender) {
      toast.error("Gender is required");
      return false;
    }
    if (!form.role) {
      toast.error("Role is required");
      return false;
    }

    if (!form.salary) {
      toast.error("Salary is required");
      return false;
    }

    // 2. Validate salary is a number
    if (isNaN(form.salary) || Number(form.salary) < 0) {
      toast.error("Please enter a valid salary amount");
      return false;
    }

    // Additional required fields for work schedule
    if (!form.shiftType) {
      toast.error("Shift Type is required");
      return false;
    }

    if (!form.workHoursStart) {
      toast.error("Work Hours Start is required");
      return false;
    }

    if (!form.workHoursEnd) {
      toast.error("Work Hours End is required");
      return false;
    }

    if (!form.workDays || form.workDays.length === 0) {
      toast.error("At least one Work Day must be selected");
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (compressingPhoto) {
      toast.warning("Please wait for image compression to complete.");
      return;
    }

    if (!validateForm()) return;
    try {
      // Normalize workDays and build FormData to handle file uploads
      const normalizedWorkDays = parseWorkDaysValue(form.workDays);
      const tempForm = { ...form, workDays: normalizedWorkDays };

      const formData = new FormData();
      for (const key of Object.keys(tempForm)) {
        const value = tempForm[key];
        if (value === null || value === undefined) continue;

        // Only include assigned batches/members when role is Trainer
        if ((key === 'assignedBatches' || key === 'assignedMembers') && form.role !== 'Trainer') {
          continue;
        }

        if (key === 'workDays' || key === 'assignedBatches' || key === 'assignedMembers') {
          formData.append(key, JSON.stringify(value));
          console.log(`Adding ${key}:`, JSON.stringify(value));
        } else if (key === 'profilePhoto' && (value instanceof File || value instanceof Blob)) {
          formData.append(key, value, value.name);
          console.log(`Adding ${key}:`, value);
        } else if (key === 'certificates') {
          // Skip direct appending, handle below
        } else if (key !== 'staffId') {
          formData.append(key, value);
          console.log(`Adding ${key}:`, value);
        }
      }

      // Handle Certificates
      if (form.certificates) {
        const certs = Array.isArray(form.certificates) ? form.certificates : [form.certificates];
        const newFiles = [];
        const existingPaths = [];

        certs.forEach(item => {
          if (item instanceof File) {
            newFiles.push(item);
          } else if (typeof item === 'string') {
            existingPaths.push(item);
          }
        });

        // Append new files
        newFiles.forEach(file => {
          formData.append('certificates', file);
        });

        // Send existing paths for retention (if backend supports keeping them via a separate field or parsed from the same)
        // Since backend implementation isn't fully visible, we'll try to send existing ones in a separate field 
        // OR as JSON string if your backend expects that. 
        // Following AddMember pattern:
        if (existingPaths.length > 0) {
          formData.append('existingCertificates', JSON.stringify(existingPaths));
        } else if (isEditing) {
          formData.append('existingCertificates', JSON.stringify([]));
        }
      } else if (isEditing) {
        formData.append('existingCertificates', JSON.stringify([]));
      }

      const sId = tempForm.staffId || "";
      if (sId) {
        formData.set('staffId', sId);
      }

      console.log('Submitting staff data:', Object.fromEntries(formData.entries()));
      console.log('Is editing:', isEditing);
      console.log('Staff ID:', staffId);
      console.log('Backend URL:', `${backendurl}/staff${isEditing ? `/${staffId}` : '/add'}`);

      const response = await fetch(`${backendurl}/staff${isEditing ? `/${staffId}` : '/add'}`, {
        method: isEditing ? 'PUT' : 'POST',
        credentials: 'include',
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        toast.success(`Staff member ${isEditing ? 'updated' : 'added'} successfully!`);
        setTimeout(() => navigate('/stafflisting'), 1500);
      } else {
        toast.error(result.message || `Failed to ${isEditing ? 'update' : 'add'} staff member`);
      }
    } catch (error) {
      console.error(`Error ${isEditing ? 'updating' : 'adding'} staff:`, error);
      toast.error(`Error ${isEditing ? 'updating' : 'adding'} staff member. Please try again.`);
    }
  };

  const handleDelete = async () => {
    if (!isEditing || !staffId) return;
    const result = await Swal.fire({
      title: 'Delete this staff member?',
      text: 'This action cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, delete'
    });
    if (!result.isConfirmed) return;
    try {
      const response = await fetch(`${backendurl}/staff/${staffId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const result = await response.json();
      if (result.success) {
        toast.success('Staff deleted successfully');
        setTimeout(() => navigate('/stafflisting'), 1500);
      } else {
        toast.error(result.message || 'Failed to delete staff');
      }
    } catch (error) {
      console.error('Error deleting staff:', error);
      toast.error('Error deleting staff. Check console for details.');
    }
  };

  return (
    <div className="dash-main">
      <header className="dash-header">
        <div className="dash-header-left">
          <ToggleButton isOpen={false} onClick={() => { }} />
          <div className="dash-breadcrumb">Dashboard / Staff / Add New</div>
        </div>
        <div className="dash-header-right">
          {isEditing && (
            <button type="button" className="btn-danger" onClick={handleDelete} style={{ marginRight: '8px' }}>
              Delete Staff
            </button>
          )}
        </div>
      </header>

      <div className="dash-content new-member-page" style={{ paddingLeft: "30px", marginRight: "0px" }}>
        <h1 className="dash-page-title">{isEditing ? 'Edit Staff Member' : 'Add New Staff Member'}</h1>
        <form className="nm-form" onSubmit={handleSubmit}>

          {/* Section 1: Personal Details */}
          <section className="nm-card">
            <div className="nm-card-header" style={{ marginBottom: "30px" }}>
              <h2 style={{ padding: "10px" }}> Personal Details</h2>
            </div>
            <div className="nm-grid">
              {/* Row 1: Basic Info */}
              <div className="nm-field">
                <label>Staff ID</label>
                <input
                  type="text"
                  name="staffId"
                  value={form.staffId || ""}
                  readOnly
                  placeholder="Auto-generated"
                />
              </div>
              <div className="nm-field">
                <label>First Name *</label>
                <input
                  type="text"
                  name="firstName"
                  value={form.firstName}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="nm-field">
                <label>Last Name</label>
                <input
                  type="text"
                  name="lastName"
                  value={form.lastName}
                  onChange={handleChange}
                />
              </div>

              {/* Row 2: Contact Info */}
              <div className="nm-field">
                <label>Phone *</label>
                <input
                  type="tel"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="nm-field">
                <label>Email</label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                />
              </div>
              <div className="nm-field">
                <label>Gender *</label>
                <select name="gender" value={form.gender} onChange={handleChange} required>
                  <option value="">Select</option>
                  <option>Male</option>
                  <option>Female</option>
                  <option>Other</option>
                </select>
              </div>

              {/* Row 3: Location Info */}
              <div className="nm-field">
                <label>City</label>
                <input
                  type="text"
                  name="city"
                  value={form.city}
                  onChange={handleChange}
                />
              </div>
              <div className="nm-field">
                <label>State</label>
                <input
                  type="text"
                  name="state"
                  value={form.state}
                  onChange={handleChange}
                />
              </div>
              <div className="nm-field">
                <label>Pincode</label>
                <input
                  type="text"
                  name="pincode"
                  value={form.pincode}
                  onChange={handleChange}
                />
              </div>

              {/* Row 4: Date of Birth */}
              <div className="nm-field">
                <label>Date of Birth</label>
                <input
                  type="date"
                  name="dob"
                  value={form.dob}
                  onChange={handleChange}
                />
              </div>

              {/* Row 5: Address (Full Width) */}
              <div className="nm-field full">
                <label>Address</label>
                <textarea
                  name="address"
                  value={form.address}
                  onChange={handleChange}
                  rows="2"
                />
              </div>

              {/* Row 6: Profile Photo */}
              <div className="nm-field photo-upload">
                <div className="photo-upload-container">
                  <div className="photo-input-wrapper">
                    <label className="photo-upload-label">Profile Photo</label>
                    <input
                      type="file"
                      name="profilePhoto"
                      accept="image/*"
                      onChange={handleChange}
                      ref={photoInputRef}
                      className="photo-upload-input"
                    />
                    <div className="photo-actions">
                      <button type="button" onClick={handleRemovePhoto} className="btn-secondary">
                        Remove Photo
                      </button>
                      <button type="button" onClick={() => photoInputRef.current?.click()} className="btn-primary">
                        Upload New
                      </button>
                    </div>
                  </div>

                  <div className={`photo-preview-wrapper ${previewUrl ? 'has-photo' : ''}`}>
                    {compressingPhoto ? (
                      <div className="spinner-overlay">
                        <div className="spinner"></div>
                        <div className="spinner-text">Compressing...</div>
                      </div>
                    ) : previewUrl ? (
                      <img src={previewUrl} alt="Profile Preview" className="photo-preview" />
                    ) : (
                      <div className="photo-placeholder">
                        <div style={{ fontWeight: '600', marginBottom: '4px' }}>Upload Staff Photo</div>
                        <div style={{ fontSize: '11px', color: '#9ca3af' }}>Click above to upload or drag & drop</div>
                        <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '4px' }}>PNG, JPG up to 5MB</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Row 7: Emergency Contact (2 columns) */}
              <div className="nm-field">
                <label>Emergency Contact</label>
                <input
                  type="text"
                  name="emergencyContact"
                  value={form.emergencyContact}
                  onChange={handleChange}
                />
              </div>
              <div className="nm-field">
                <label>Emergency Phone</label>
                <input
                  type="tel"
                  name="emergencyPhone"
                  value={form.emergencyPhone}
                  onChange={handleChange}
                />
              </div>
            </div>
          </section>

          {/* Section 2: Employment Details */}
          <section className="nm-card">
            <div className="nm-card-header" style={{ marginBottom: "30px" }}>
              <h2 style={{ padding: "10px" }}> Employment Details</h2>
            </div>
            <div className="nm-grid">
              {/* Row 1: Basic Employment Info */}
              <div className="nm-field">
                <label>Role *</label>
                <select name="role" value={form.role} onChange={handleChange} required>
                  <option value="">Select Role</option>
                  <option>Receptionist</option>
                  <option>Trainer</option>
                  <option>Manager</option>
                  <option>Cleaner</option>
                  <option>Admin</option>
                  <option>Security</option>
                </select>
              </div>
              <div className="nm-field">
                <label>Department</label>
                <select name="department" value={form.department} onChange={handleChange}>
                  <option value="">Select</option>
                  <option>Front Desk</option>
                  <option>Training</option>
                  <option>Management</option>
                  <option>Maintenance</option>
                  <option>Security</option>
                </select>
              </div>
              <div className="nm-field">
                <label>Join Date</label>
                <input
                  type="date"
                  name="joinDate"
                  value={form.joinDate}
                  onChange={handleChange}
                />
              </div>

              {/* Row 2: Employment Terms */}
              <div className="nm-field">
                <label>Employment Type</label>
                <select name="employmentType" value={form.employmentType} onChange={handleChange}>
                  <option>Full-time</option>
                  <option>Part-time</option>
                  <option>Contract</option>
                </select>
              </div>
              <div className="nm-field">
                <label>Monthly Salary (₹) *</label>
                <input
                  type="number"
                  name="salary"
                  value={form.salary}
                  onChange={handleChange}
                  required
                  placeholder="e.g. 25000"
                />
              </div>

              {/* Row 3: Financial Details */}
              <div className="nm-field">
                <label>Bank Account Number</label>
                <input
                  type="text"
                  name="bankAccount"
                  value={form.bankAccount}
                  onChange={handleChange}
                  placeholder="e.g. 1234567890"
                />
              </div>
              <div className="nm-field">
                <label>IFSC Code</label>
                <input
                  type="text"
                  name="ifsc"
                  value={form.ifsc}
                  onChange={handleChange}
                  placeholder="e.g. SBIN0001234"
                />
              </div>


              {/* Row 4: Identification Numbers */}
              <div className="nm-field">
                <label>PAN Number</label>
                <input
                  type="text"
                  name="panNumber"
                  value={form.panNumber}
                  onChange={handleChange}
                  placeholder="e.g. ABCDE1234F"
                />
              </div>
              <div className="nm-field">
                <label>Aadhaar Number</label>
                <input
                  type="text"
                  name="aadhaarNumber"
                  value={form.aadhaarNumber}
                  onChange={handleChange}
                  placeholder="e.g. 123456789012"
                />
              </div>
            </div>
          </section>

          {/* Section 3: Work Schedule */}
          <section className="nm-card">
            <div className="nm-card-header" style={{ marginBottom: "30px" }}>
              <h2 style={{ padding: "10px" }}> Work Schedule</h2>
            </div>
            <div className="nm-grid">
              {/* Row 1: Basic Schedule Info */}
              <div className="nm-field">
                <label>Shift Type *</label>
                <select
                  name="shiftType"
                  value={form.shiftType}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select</option>
                  <option>Morning</option>
                  <option>Afternoon</option>
                  <option>Night</option>
                  <option>Flexible</option>
                </select>
              </div>
              <div className="nm-field">
                <label>Work Hours Start *</label>
                <input
                  type="time"
                  name="workHoursStart"
                  value={form.workHoursStart}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="nm-field">
                <label>Work Hours End *</label>
                <input
                  type="time"
                  name="workHoursEnd"
                  value={form.workHoursEnd}
                  onChange={handleChange}
                  required
                />
              </div>

              {/* Row 2: Break and Work Days */}

              <div className="nm-field">
                <label>Work Days *</label>
                <div className="work-days-grid">
                  {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day) => {
                    const isChecked = form.workDays.includes(day);
                    console.log(`Day ${day}: checked=${isChecked}, form.workDays=${JSON.stringify(form.workDays)}`);
                    return (
                      <label key={day} className={`checkbox-label ${isChecked ? 'checked' : 'unchecked'}`}>
                        <input
                          type="checkbox"
                          name="workDays"
                          value={day}
                          checked={isChecked}
                          onChange={handleChange}
                        />
                        <span className="day-name">{day.slice(0, 3)}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="nm-field">
                <label>Current Status</label>
                <div className="work-days-status">
                  <span className={`status-indicator ${form.status.toLowerCase().replace(' ', '-')}`}>
                    {form.status}
                  </span>
                  <span className="status-hint">
                    {form.workDays.length === 0
                      ? "No work days selected"
                      : `${form.workDays.length} work day(s) selected`}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Section 4: Certifications & Skills */}
          <section className="nm-card">
            <div className="nm-card-header" style={{ marginBottom: "30px" }}>
              <h2 style={{ padding: "10px" }}> Certifications & Skills</h2>
            </div>
            <div className="nm-grid">
              <div className="nm-field full">
                <label>Certifications</label>
                <textarea
                  name="certifications"
                  value={form.certifications}
                  onChange={handleChange}
                  placeholder="e.g. ACE Certified Trainer, CPR Certified"
                  rows="3"
                />
              </div>
              <div className="nm-field full">
                <label>Specializations/Experience</label>
                <textarea
                  name="specializations"
                  value={form.specializations}
                  onChange={handleChange}
                  placeholder="e.g. Weight Training, Yoga, Cardio"
                  rows="2"
                />
              </div>
              <div className="nm-field full">
                <label>Qualifications/Education</label>
                <textarea
                  name="qualifications"
                  value={form.qualifications}
                  onChange={handleChange}
                  placeholder="e.g. B.Sc Sports Science, Diploma in Fitness"
                  rows="2"
                />
              </div>
              <div className="nm-field full">
                <label>Certificates & ID Proofs</label>
                <div className="file-upload-wrapper" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%' }}>
                    <input
                      type="file"
                      name="certificates"
                      accept="image/*,.pdf,.doc,.docx"
                      multiple
                      onChange={handleChange}
                      ref={(input) => {
                        // No strict reset needed here as we clear value in handleChange
                      }}
                    />
                    <span className="file-upload-hint">Upload certificates (PDF, Images)</span>
                  </div>

                  {/* Render list of previews */}
                  {certificatePreview && certificatePreview.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '15px' }}>
                      {certificatePreview.map((preview, index) => (
                        <div key={index} className="certificate-preview" style={{ position: 'relative', display: 'inline-block', border: '1px solid #e5e7eb', padding: '10px', borderRadius: '8px', background: '#f9fafb' }}>
                          <button
                            type="button"
                            onClick={() => handleRemoveCertificate(index)}
                            style={{
                              position: 'absolute',
                              top: '-10px',
                              right: '-10px',
                              background: '#ef4444',
                              color: 'white',
                              border: 'none',
                              borderRadius: '50%',
                              width: '24px',
                              height: '24px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '14px',
                              fontWeight: 'bold',
                              zIndex: 10
                            }}
                            title="Remove file"
                          >
                            ✕
                          </button>

                          {/* Check if preview is an image or document */}
                          {preview.isImage ? (
                            <div onClick={() => window.open(preview.url, '_blank')} style={{ cursor: 'pointer' }}>
                              <img
                                src={preview.url}
                                alt={`Certificate ${index + 1}`}
                                style={{ maxWidth: '100px', maxHeight: '100px', objectFit: 'cover', borderRadius: '4px' }}
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                  e.currentTarget.innerHTML = '<span style="font-size: 30px">📄</span><div style="font-size: 10px; margin-top: 5px; color: #0369a1; text-align: center;">View Document</div>';
                                }}
                              />
                              {!preview.url.includes('blob:') && <div style={{ fontSize: '10px', marginTop: '5px', color: '#0369a1', textAlign: 'center' }}>Click</div>}
                            </div>
                          ) : (
                            <div onClick={() => window.open(preview.url, '_blank')} style={{
                              cursor: 'pointer',
                              width: '100px',
                              height: '100px',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#4b5563'
                            }}>
                              <span style={{ fontSize: '30px' }}>📄</span>
                              <div style={{ fontSize: '10px', marginTop: '5px', color: '#0369a1', textAlign: 'center', wordBreak: 'break-all', maxWidth: '100%' }}>
                                {preview.originalPath ? preview.originalPath.split('/').pop() : 'Document'}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Section 5: Gym Assignment */}
          <section className="nm-card">
            <div className="nm-card-header" style={{ marginBottom: "30px" }}>
              <h2 style={{ padding: "10px" }}> Gym Assignment</h2>
            </div>
            <div className="nm-grid">
              {form.role === 'Trainer' && (
                <div className="nm-field full">
                  <label>Assigned Batches</label>
                  <input
                    type="text"
                    name="assignedBatches"
                    value={Array.isArray(form.assignedBatches) ? form.assignedBatches.join(", ") : ""}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        assignedBatches: e.target.value.split(",").map((b) => b.trim()).filter(b => b.length > 0),
                      }))
                    }
                    placeholder="e.g. 6-7AM, 7-8AM"
                  />
                </div>
              )}
            </div>
          </section>

          {/* Section 6: Assigned Members */}
          {form.role === 'Trainer' && (
            <section className="nm-card">
              <div className="nm-card-header" style={{ marginBottom: "30px" }}>
                <h2 style={{ padding: "10px" }}> Assigned Members</h2>
              </div>
              <div className="nm-grid">
                <div className="nm-field full">
                  <label>{isEditing ? 'Members Assigned to This Trainer' : 'Available Members for Assignment'}</label>
                  <div className="member-assignment-container">
                    {loadingMembers ? (
                      <div className="loading-members">Loading assigned members...</div>
                    ) : isEditing && staffData && staffData.role === 'Trainer' ? (
                      (() => {
                        // Filter active members from the dedicated list
                        const activeAssignedMembers = assignedMembersList.filter(member => {
                          const status = member.status ? member.status.toLowerCase() : '';
                          return ['active', 'approved', 'running', 'valid', 'pending'].includes(status);
                        });

                        if (activeAssignedMembers.length === 0) {
                          return <div className="no-members">No active members assigned to this trainer. Members with inactive status are not displayed.</div>;
                        }
                        return (
                          <div className="members-table-container">
                            <table className="members-table">
                              <thead>
                                <tr>
                                  <th>Name</th>
                                  <th>ID</th>
                                  <th>Phone</th>
                                  <th>Package</th>
                                  <th>Fitness Goal</th>
                                  <th>Membership Type</th>
                                </tr>
                              </thead>
                              <tbody>
                                {activeAssignedMembers.map((member) => {
                                  // Calculate PT sessions remaining from ptSessionsUsed array
                                  const totalSessions = Array.isArray(member.ptSessionsUsed) ? member.ptSessionsUsed.length : 0;
                                  const usedSessions = Array.isArray(member.ptSessionsUsed) ? member.ptSessionsUsed.filter(Boolean).length : 0;
                                  const remainingSessions = totalSessions - usedSessions;

                                  return (
                                    <tr key={member._id} className="member-row">
                                      <td>
                                        <div className="member-name">{member.firstName} {member.lastName}</div>
                                      </td>
                                      <td>
                                        <span className="member-id">#{member.memberId}</span>
                                      </td>
                                      <td>
                                        <span className="member-phone">{member.phone}</span>
                                      </td>
                                      <td>
                                        <span className="member-package">{member.packageName}</span>
                                      </td>
                                      <td>
                                        <span className="member-fitness-goal">{member.fitnessGoal || 'Not specified'}</span>
                                      </td>
                                      <td>
                                        <span className="member-membership-type">{member.membershipType || 'Not specified'}</span>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        );
                      })()
                    ) : (
                      <div className="no-members">Member assignment is managed through the member's profile. This section shows assigned members when editing an existing trainer.</div>
                    )}
                  </div>
                </div>
              </div>
            </section>
          )}





          <div className="nm-actions">
            <button type="button" className="btn-secondary" onClick={() => navigate('/stafflisting')}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={compressingPhoto}>
              {isEditing ? 'Update Staff' : 'Save Staff'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
