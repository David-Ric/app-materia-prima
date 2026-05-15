import type { ReactElement } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import LoginPage from './pages/Login/LoginPage'
import MateriaPrimaInicio from './pages/Inicio/MateriaPrimaInicio'
import { STORAGE_USUARIO } from './services/api'

function estaAutenticado(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_USUARIO)
    if (!raw) return false
    const u = JSON.parse(raw) as { token?: string }
    return Boolean(u?.token)
  } catch {
    return false
  }
}

function RequireAuth({ children }: { children: ReactElement }) {
  if (!estaAutenticado()) {
    return <Navigate to="/" replace />
  }
  return children
}

export default function App() {
  return (
    <BrowserRouter basename="/materia-prima">
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route
          path="/separacao"
          element={
            <RequireAuth>
              <MateriaPrimaInicio />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
