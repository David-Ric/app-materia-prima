import axios from 'axios'
import type { DadosUsuarioAuth } from '../types/auth'

/** Mesma chave do `pga-front` (`resolveBaseURL` em `services/api.ts`) — override manual compartilhado no mesmo domínio. */
export const STORAGE_API_BASE_URL = '@Portal/apiBaseURL'

const STORAGE_USUARIO = '@MateriaPrima/usuario'

// Defina manualmente a URL base comentando a que não quer usar
const BASE_URL = 'https://pga.cigel.com.br:8095/' // Produção
// const BASE_URL = 'https://localhost:8095/' // Desenvolvimento local
// const BASE_URL = 'http://10.0.0.158:8091/' // Outro ambiente

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-type': 'application/json',
  },
})

function getToken(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_USUARIO)
    if (!raw) return null
    const usuario: DadosUsuarioAuth = JSON.parse(raw)
    return usuario.token || null
  } catch {
    return null
  }
}

api.interceptors.request.use((config) => {
  const token = getToken()
  config.headers = config.headers || {}
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export { STORAGE_USUARIO }
export default api
