import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import './styles/toast-fixes.css'
import App from './App.jsx'
import { BrowserRouter } from 'react-router-dom'
import { AppContextProvider } from './context/context.jsx'
import { PlanProvider } from './context/PlanContext.jsx'
import { BranchProvider } from './context/BranchContext.jsx'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <AppContextProvider>
      <PlanProvider>
        <BranchProvider>
          <App />
        </BranchProvider>
      </PlanProvider>
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss={false}
        draggable={false}
        pauseOnHover={false}
        theme="light"
        limit={3}
      />
    </AppContextProvider>
  </BrowserRouter>,
)
