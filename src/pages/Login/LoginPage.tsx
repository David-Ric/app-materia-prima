import { useCallback, useState } from 'react'
import type { FormEvent, KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import Modal from 'react-bootstrap/Modal'
import ProgressBar from 'react-bootstrap/ProgressBar'
import { Si1Password } from 'react-icons/si'
import api, { STORAGE_USUARIO } from '../../services/api'
import type { DadosUsuarioAuth } from '../../types/auth'
import { grupoPodeAcessarMateriaPrima } from '../../config/access'
import Alert from '../../components/Alert'
import './Login.scss'

const VERSAO = '0.0.1'

const base = import.meta.env.BASE_URL

export default function LoginPage() {
  const navigate = useNavigate()
  const [user, setUser] = useState('')
  const [senha, setSenha] = useState('')
  const [loading, setLoading] = useState(false)
  const [alertErro, setAlertErro] = useState(false)
  const [msgErro, setMsgErro] = useState('')
  const [showloading, setShowloading] = useState(false)
  const [showloadingOff, setShowloadingOff] = useState(false)
  const [sucess, setSucess] = useState(0)
  const [capsLockAtivo, setCapsLockAtivo] = useState(false)

  const handleCloseloading = useCallback(() => setShowloading(false), [])
  const handleCloseloadingOff = useCallback(() => setShowloadingOff(false), [])

  const LimparErro = () => setAlertErro(false)

  const AtualizaCapsLock = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    try {
      setCapsLockAtivo(Boolean(e.getModifierState('CapsLock')))
    } catch {
      setCapsLockAtivo(false)
    }
  }

  const aguardar = (ms: number) => new Promise((r) => setTimeout(r, ms))

  const animarProgressoEntrada = async () => {
    setSucess(20)
    await aguardar(280)
    setSucess(35)
    await aguardar(280)
    setSucess(55)
    await aguardar(280)
    setSucess(75)
    await aguardar(280)
    setSucess(92)
    await aguardar(280)
    setSucess(100)
    await aguardar(250)
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    localStorage.removeItem(STORAGE_USUARIO)
    setLoading(true)
    setAlertErro(false)

    if (user.trim() === '') {
      setLoading(false)
      document.getElementById('user')?.focus()
      setAlertErro(true)
      setMsgErro('Usuario não informado.')
      return
    }
    if (senha.trim() === '') {
      setLoading(false)
      document.getElementById('senha')?.focus()
      setAlertErro(true)
      setMsgErro('Senha não informada.')
      return
    }

    try {
      const { data } = await api.post<DadosUsuarioAuth>('/api/Auth/login', {
        username: user,
        password: senha,
      })

      if (data.status !== '1') {
        setUser('')
        setSenha('')
        document.getElementById('user')?.focus()
        setAlertErro(true)
        setMsgErro('Usúario inativado, entre em contato com o suporte.')
        setLoading(false)
        return
      }

      if (!grupoPodeAcessarMateriaPrima(data.grupoId)) {
        setUser('')
        setSenha('')
        document.getElementById('user')?.focus()
        setAlertErro(true)
        setMsgErro(
          'Acesso ao módulo Matéria Prima não liberado para o grupo do seu usuário. Utilize os grupos 1, 4, 6 ou 8.'
        )
        setLoading(false)
        return
      }

      localStorage.setItem(STORAGE_USUARIO, JSON.stringify(data))
      setShowloading(true)
      setSucess(20)
      await animarProgressoEntrada()
      setShowloading(false)
      setLoading(false)
      navigate('/separacao', { replace: true })
    } catch (error: unknown) {
      setLoading(false)
      const err = error as { response?: { status?: number; data?: unknown } }
      if (err.response) {
        setAlertErro(true)
        setUser('')
        setSenha('')
        document.getElementById('user')?.focus()
        const body = err.response.data
        const msg =
          typeof body === 'string'
            ? body
            : `Erro ${err.response.status ?? ''}: ${JSON.stringify(body)}`
        setMsgErro(msg)
        return
      }

      const isMobile = typeof window !== 'undefined' && window.innerWidth <= 1280
      if (isMobile) {
        setSucess(20)
        setShowloadingOff(true)
        setAlertErro(false)
        setTimeout(() => {
          setSucess(100)
          setShowloadingOff(false)
          setAlertErro(true)
          setMsgErro('Sem conexão com o servidor. Verifique a rede e tente novamente.')
        }, 2500)
        return
      }

      setAlertErro(true)
      setMsgErro('Não foi possível conectar ao servidor.')
    }
  }

  const recuperarHref =
    typeof window !== 'undefined'
      ? `${window.location.origin}/pga/recuperar-senha`
      : '/pga/recuperar-senha'

  return (
    <div className="content-home">
      <form className="content" onSubmit={onSubmit}>
        <div className="content-banner">
          <img
            className="content-banner-img"
            src={`${base}grupo-alyne2.jpg`}
            alt=""
            loading="eager"
            decoding="async"
            fetchPriority="high"
          />
        </div>
        <div className="bloco-login">
          <img id="imgLoginDesk" src={`${base}logo-dark.png`} alt="" width={140} style={{ marginBottom: 10 }} />
          <img id="imgLoginMob" src={`${base}logo-light.png`} alt="" width={250} style={{ marginBottom: 20 }} />
          <div className="bloco-title">
            <span id="logoIdHome" style={{ fontSize: 20, fontWeight: 'bold' }}>
              LOGIN
            </span>
          </div>
          {alertErro && (
            <div className="mt-3 mb-0">
              <Alert msg={msgErro} setAlertErro={setAlertErro} />
            </div>
          )}
          <div style={{ marginBottom: 20 }} className="bloco-input">
            <p className="labelform userHome">Usuario</p>
            <input
              className="form-coontrol inputlogin2"
              id="user"
              type="text"
              name="user"
              autoComplete="username"
              value={user}
              onKeyDown={LimparErro}
              onChange={(e) => setUser(e.target.value.toLowerCase())}
            />
          </div>
          <div className="bloco-input">
            <p className="labelform userHome">Senha</p>
            <input
              className="form-coontrol inputlogin2"
              id="senha"
              type="password"
              name="password"
              autoComplete="current-password"
              value={senha}
              onKeyDown={(e) => {
                LimparErro()
                AtualizaCapsLock(e)
              }}
              onKeyUp={AtualizaCapsLock}
              onBlur={() => setCapsLockAtivo(false)}
              onChange={(e) => setSenha(e.target.value)}
            />
            {capsLockAtivo && (
              <p style={{ color: 'red', fontSize: 12, marginTop: 6, marginBottom: 0 }}>
                Caps Lock está ativado
              </p>
            )}
          </div>
          <button type="submit" id="btn-login" className="btn btn-entrar" disabled={loading}>
            {loading ? 'Carregando ' : 'Entrar '}
            {loading && <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />}
          </button>
          <p className="text-center register-link">
            <a href={recuperarHref}>
              Esqueci minha senha <Si1Password />{' '}
            </a>
          </p>

          <div
            style={{
              marginTop: 10,
              color: typeof window !== 'undefined' && window.innerWidth <= 1280 ? '#f0f3fb' : '#121213',
            }}
            className="versao"
          >
            Versão: {VERSAO}
          </div>
        </div>
      </form>

      <Modal className="modalLoading" show={showloading} onHide={handleCloseloading} backdrop="static">
        <Modal.Body>
          <div className="loadingModal">
            <img id="logoSankhya" src={`${base}logo-dark.png`} alt="" />
            <h4 className="loadingTitle">Efetuando login...</h4>
            <div className="loadingSubtitle">Aguarde enquanto sua sessão é iniciada.</div>
            <ProgressBar className="progress" animated now={sucess} />
          </div>
        </Modal.Body>
      </Modal>

      <Modal className="modalLoading" show={showloadingOff} onHide={handleCloseloadingOff} backdrop="static">
        <Modal.Body>
          <div className="loadingModal">
            <img id="logoSankhya" src={`${base}logo-dark.png`} alt="" />
            <h4 className="loadingTitle loadingTitleOffline">Efetuando login offline...</h4>
            <div className="loadingSubtitle">Aguarde enquanto sua sessão offline é preparada.</div>
            <ProgressBar className="progress" animated now={sucess} />
          </div>
        </Modal.Body>
      </Modal>
    </div>
  )
}
