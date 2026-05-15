export interface DadosUsuarioAuth {
  id: number
  username: string
  email: string
  grupoId: number
  status: string
  nomeCompleto: string
  token: string
  primeiroLoginAdm?: boolean
}
