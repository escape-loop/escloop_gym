import { useState } from "react";
import { createContext } from "react";
import { toast } from "react-toastify";
import axios from "axios";
import { useEffect } from "react";

export const AppContent = createContext()

export const AppContextProvider = (props) => {

    axios.defaults.withCredentials = true;
    const backendurl = import.meta.env.VITE_BACKEND_URL
    const [isloggedin, setisloggedin] = useState(false)
    const [authLoading, setAuthLoading] = useState(true)
    const [userdata, setuserdata] = useState(false)
    const [State, setState] = useState(backendurl)
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [gymSettings, setGymSettings] = useState(null)

    const fetchGymSettings = async () => {
        try {
            const currentActive = localStorage.getItem('activeGymId');
            const headers = currentActive ? { 'x-gym-id': currentActive } : {};
            const response = await axios.get(`${backendurl}/settings`, { headers, withCredentials: true })
            if (response.data.success) {
                setGymSettings(response.data.settings)
            }
        } catch (e) {
            console.log("Error fetching gym settings:", e.message)
        }
    }

    const getuserdata = async () => {
        try {
            const response = await axios.get(backendurl + '/data')
            const user = response.data
            user.success ? setuserdata(user.userdata) : console.log(user.message)

        } catch (e) {
            console.log(e.message)
        }
    }
    const checkIsAuthenticated = async () => {
        axios.defaults.withCredentials = true
        try {
            const currentActive = localStorage.getItem('activeGymId');
            const headers = currentActive ? { 'x-gym-id': currentActive } : {};
            const response = await axios.get(backendurl + "/isauth", { headers })
            if (response.data.success) {
                setisloggedin(true)
                getuserdata()
                fetchGymSettings()
            }
        } catch (e) {
            console.log(e.message)
        } finally {
            setAuthLoading(false)
        }
    }
    useEffect(() => {
        // --- Global Axios Interceptor ---
        const requestInterceptor = axios.interceptors.request.use(function (config) {
            const currentActive = localStorage.getItem('activeGymId');
            // Only attach for internal backend requests
            if (currentActive && config.url && (config.url.includes(backendurl) || config.url.startsWith('/'))) {
                config.headers['x-gym-id'] = currentActive;
            }
            return config;
        }, function (error) {
            return Promise.reject(error);
        });

        // --- Global Fetch Interceptor ---
        const originalFetch = window.fetch;
        window.fetch = async (...args) => {
            let [resource, config] = args;
            const currentActive = localStorage.getItem('activeGymId');
            
            const url = typeof resource === 'string' ? resource : (resource && resource.url ? resource.url : '');
            
            // Only attach for internal backend requests
            if (currentActive && (url.includes(backendurl) || url.startsWith('/'))) {
                config = config || {};
                if (config.headers instanceof Headers) {
                    config.headers.append('x-gym-id', currentActive);
                } else if (Array.isArray(config.headers)) {
                    config.headers.push(['x-gym-id', currentActive]);
                } else {
                    config.headers = {
                        ...config.headers,
                        'x-gym-id': currentActive
                    };
                }
            }
            return originalFetch(resource, config);
        };

        // --- Run Auth Check ---
        checkIsAuthenticated();

        return () => {
            axios.interceptors.request.eject(requestInterceptor);
            window.fetch = originalFetch;
        };
    }, [])
    const value = {
        backendurl,
        State,
        // expose boolean auth state as `isauthenticated` for consumers
        isauthenticated: isloggedin,
        // true while the initial cookie-check is in-flight (prevents premature redirect on refresh)
        authLoading,
        // keep raw flag and setter available
        isloggedin,
        setisloggedin,
        userdata,
        setuserdata,
        sidebarOpen,
        setSidebarOpen,
        getuserdata,
        gymSettings,
        fetchGymSettings,
        // expose the auth-check function under a different name
        isauthenticatedCheck: checkIsAuthenticated
    }
    return (
        <AppContent.Provider value={value}>
            {props.children}
        </AppContent.Provider>
    )
}

