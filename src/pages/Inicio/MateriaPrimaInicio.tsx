import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Modal from 'react-bootstrap/Modal'
import ProgressBar from 'react-bootstrap/ProgressBar'
import { FaUsers, FaCalendarAlt, FaClock, FaSyncAlt, FaListUl, FaChevronDown, FaInfoCircle, FaSignOutAlt } from 'react-icons/fa'
import { IoInformationCircleOutline } from 'react-icons/io5'
import api, { STORAGE_USUARIO } from '../../services/api'
import type { DadosUsuarioAuth } from '../../types/auth'
import './MateriaPrimaInicio.scss'

const base = import.meta.env.BASE_URL

function isDataFimSeparacaoValida(valor: any): boolean {
  const data = parseDataHora(valor)
  if (!data) return false
  return data.getFullYear() >= 1950
}

function derivarStatusSeparacao(dataIni: any, dataFin: any): string {
  const temIni = Boolean(parseDataHora(dataIni))
  const temFim = isDataFimSeparacaoValida(dataFin)
  if (temIni && temFim) return 'FINALIZADO'
  if (temIni) return 'EM PROCESSO'
  return 'AGUARDANDO'
}

type LinhaSeparacao = {
  prioridadeLib: string
  prioridadeLibClass: string
  prioridadeLibPulseClass: string
  prioridadeLinha: string
  prioridadeLinhaClass: string
  seq: string
  linha: string
  op: string
  produto: string
  dataProgramacao: string
  horaInicioSeparacao: string
  horaFimSeparacao: string
  tempoSeparacao: string
  statusSeparacao: string
  separacaoClass: string
  statusFinal: string
  statusFinalClass: string
  horaInicioPesagem: string
  horaFimPesagem: string
  tempoPesagem: string
  statusPesagem: string
  pesagemClass: string
  horaInicioConferencia: string
  horaFimConferencia: string
  statusConferencia: string
  conferenciaClass: string
  tempoTotal: string
  nivPrioridade: number
  rowClass: string
  processoCompleto: boolean
}

function montarSqlSeparacao(dataProgramacao: string, op: string, linha: string, turno: string) {
  return `SELECT
    PL.OP,
    PL.DESCRICAO AS Produto,
    TS.DATA_INI AS DtIniSeparacao,
    TS.DATA_FIN AS DtFimSeparacao,
    P.QTDPES,
    I.DATA AS DataPesagem,
    I.PESO_CONFERIDO,
    CASE
        WHEN P.IDIPROC IS NULL THEN 'Aguardando'
        WHEN I.OP IS NULL THEN 'Aguardando'
        WHEN I.QTD_NULL > 0 THEN 'Em Processo'
        ELSE 'Finalizado'
    END AS StatusConferencia,
    NULL AS TempoConferencia,
    PL.PRIORIDADE,
    PL.EQUIP AS LINHA,
    PL.SEQ AS SEQUENCIA,
    PL.TURNO AS LINHA_PRODUCAO,
    PL.NIV_PRIORIDADE,
    PL.DATAPROGRAMACAO
FROM AD_PLANEJAMENTOPRODUCAO PL

LEFT JOIN (
  SELECT
    OP,
    MIN(DATA_INI) AS DATA_INI,
    MAX(CASE
      WHEN DATA_FIN IS NOT NULL
        AND DATA_FIN >= CAST('1950-01-01' AS DATETIME)
      THEN DATA_FIN
    END) AS DATA_FIN
  FROM AD_TEMPOSEPARA
  GROUP BY OP
) TS ON TS.OP = PL.OP

-- Agrupado para garantir apenas 1 linha por IDIPROC
LEFT JOIN (
  SELECT 
    IDIPROC, 
    SUM(QTDPES) AS QTDPES -- Ou MAX(QTDPES) dependendo da sua regra de negócio
  FROM AD_PESAGEM
  GROUP BY IDIPROC
) P ON P.IDIPROC = PL.OP

-- Agrupado para garantir apenas 1 linha por OP e otimizar o CASE STATUS
LEFT JOIN (
  SELECT 
    OP, 
    MAX(DATA) AS DATA, 
    SUM(PESO_CONFERIDO) AS PESO_CONFERIDO, -- Ou MAX(PESO_CONFERIDO)
    COUNT(CASE WHEN PESO_CONFERIDO IS NULL THEN 1 END) AS QTD_NULL
  FROM AD_INSERTBAL
  GROUP BY OP
) I ON I.OP = PL.OP

WHERE ('${op}' = '' OR PL.OP = '${op}')
    AND ('${linha}' = '' OR PL.EQUIP = '${linha}')
    AND ('${turno}' = '' OR PL.TURNO = '${turno}')
    AND CONVERT(DATE, PL.DATAPROGRAMACAO) = CONVERT(DATE, '${formatSqlDate(dataProgramacao)}')
ORDER BY PL.NIV_PRIORIDADE ASC, PL.SEQ ASC`
}

function formatDateInput(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getDataAnterior(dataAtual: string): string {
  const [y, m, d] = dataAtual.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() - 1)
  return formatDateInput(date)
}

function formatarDataProgramacaoExibicao(dataProgramacao: string): string {
  if (!dataProgramacao) return ''
  const str = String(dataProgramacao).trim()

  const iso = str.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`

  const br = str.match(/(\d{2})\/(\d{2})\/(\d{4})/)
  if (br) return `${br[1]}/${br[2]}/${br[3]}`

  const digits = str.replace(/\D/g, '')
  if (digits.length >= 8) {
    const oito = digits.slice(0, 8)
    const ano = Number(oito.slice(0, 4))
    if (ano >= 1900 && ano <= 2100) {
      return `${oito.slice(6, 8)}/${oito.slice(4, 6)}/${oito.slice(0, 4)}`
    }
    return `${oito.slice(0, 2)}/${oito.slice(2, 4)}/${oito.slice(4, 8)}`
  }

  return str.split(' ')[0]
}

function isStatusFinalizado(status: string): boolean {
  return texto(status, '').toUpperCase().includes('FINAL')
}

function formatSqlDate(date: string) {
  const [year, month, day] = date.split('-')
  return `${day}/${month}/${year}`
}

function formatarDataHoraExibicao(valor: any): string {
  if (!valor) return '--:--'
  const data = parseDataHora(valor)
  if (!data) return '--:--'
  return data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function normalizarOpKey(op: any): string {
  return String(op ?? '').trim()
}

function valor(row: any, nomes: string[], index: number) {
  if (Array.isArray(row)) return row[index] ?? ''
  for (const nome of nomes) {
    if (row?.[nome] !== undefined && row?.[nome] !== null) return row[nome]
  }
  return ''
}

function texto(valorCampo: any, fallback = '--') {
  if (valorCampo === undefined || valorCampo === null || valorCampo === '') return fallback
  return String(valorCampo)
}

function badgePrioridade(valorCampo: any) {
  const v = texto(valorCampo, 'NORMAL').toUpperCase()
  if (v.includes('CR')) return 'badge-critica'
  if (v.includes('ALT')) return 'badge-alta'
  if (v.includes('M')) return 'badge-media'
  if (v.includes('OK')) return 'badge-ok'
  return 'badge-normal'
}

function badgeStatus(valorCampo: any) {
  const v = texto(valorCampo, 'AGUARDANDO').toUpperCase()
  if (v.includes('FINAL')) return 'badge-finalizado'
  if (v.includes('PROCESS') || v.includes('ANDAMENTO')) return 'badge-processo'
  return 'badge-aguardando'
}

function badgePrioridadeLinha(valorCampo: any) {
  const v = texto(valorCampo, 'N').toUpperCase()
  if (!v || v === 'NORMAL' || v === '' || v === 'N') return 'badge-cinza'
  if (v.includes('2')) return 'badge-2t'
  return 'badge-1t'
}

function formatarPrioridadeLinha(valorCampo: any) {
  const v = texto(valorCampo, 'N').toUpperCase()
  if (!v || v === 'NORMAL' || v === '' || v === 'N') return 'N'
  return v
}

function getRowClassByNivPrioridade(nivPrioridade: any, processoCompleto: boolean = false): string {
  if (processoCompleto) {
    return 'mp-row-completed'
  }
  const niv = Number(nivPrioridade) || 5
  switch (niv) {
    case 1:
      return 'mp-row-priority-1'
    case 2:
      return 'mp-row-priority-2'
    case 3:
      return 'mp-row-priority-3'
    case 4:
      return 'mp-row-priority-4'
    case 5:
    default:
      return 'mp-row-priority-5'
  }
}

function parseDataHora(valor: any): Date | null {
  if (!valor) return null
  if (valor instanceof Date) return valor

  const str = String(valor).trim()

  const br = str.match(/^(\d{2})\/(\d{2})\/(\d{4})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/)
  if (br) {
    const data = new Date(
      Number(br[3]),
      Number(br[2]) - 1,
      Number(br[1]),
      Number(br[4]),
      Number(br[5]),
      Number(br[6] || 0)
    )
    if (!isNaN(data.getTime())) return data
  }

  const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/)
  if (iso) {
    const data = new Date(
      Number(iso[1]),
      Number(iso[2]) - 1,
      Number(iso[3]),
      Number(iso[4]),
      Number(iso[5]),
      Number(iso[6] || 0)
    )
    if (!isNaN(data.getTime())) return data
  }

  if (/^\d{8}\s\d{2}:\d{2}:\d{2}$/.test(str)) {
    const dia = Number(str.substring(0, 2))
    const mes = Number(str.substring(2, 4)) - 1
    const ano = Number(str.substring(4, 8))
    const hora = Number(str.substring(9, 11))
    const minuto = Number(str.substring(12, 14))
    const segundo = Number(str.substring(15, 17))
    const data = new Date(ano, mes, dia, hora, minuto, segundo)
    if (!isNaN(data.getTime())) return data
  }

  const data = new Date(valor)
  if (!isNaN(data.getTime())) return data
  return null
}

function segundosParaHms(totalSegundos: number): string {
  const h = Math.floor(totalSegundos / 3600)
  const m = Math.floor((totalSegundos % 3600) / 60)
  const s = totalSegundos % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function calcularDiferencaTempo(inicio: any, fim: any): string {
  if (!inicio || !fim) return '00:00:00'

  try {
    const dataInicio = parseDataHora(inicio)
    const dataFim = parseDataHora(fim)
    if (!dataInicio || !dataFim) return '00:00:00'

    const totalSegundos = Math.max(
      0,
      Math.floor(Math.abs(dataFim.getTime() - dataInicio.getTime()) / 1000)
    )
    return segundosParaHms(totalSegundos)
  } catch {
    return '00:00:00'
  }
}

function somarTempos(...tempos: string[]): string {
  let totalSegundos = 0
  for (const tempo of tempos) {
    if (tempo !== '--' && tempo !== '--:--' && tempo !== '00:00:00') {
      const [horas, minutos, segundos] = tempo.split(':').map(Number)
      if (!isNaN(horas) && !isNaN(minutos)) {
        totalSegundos += horas * 3600 + minutos * 60 + (segundos || 0)
      }
    }
  }
  if (totalSegundos === 0) return '00:00:00'
  const h = Math.floor(totalSegundos / 3600)
  const m = Math.floor((totalSegundos % 3600) / 60)
  const s = totalSegundos % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function mapLinhaSeparacao(row: any, index: number): LinhaSeparacao {
  const prioridadeLib = texto(valor(row, ['PRIORIDADE'], 9), 'NORMAL')
  const prioridadeLinha = texto(valor(row, ['LINHA_PRODUCAO'], 12), 'N')
  const statusPesagem = texto(valor(row, ['QTDPES'], 4), '') ? 'FINALIZADO' : 'AGUARDANDO'
  const statusConferencia = texto(valor(row, ['STATUSCONFERENCIA', 'StatusConferencia'], 7), 'AGUARDANDO')
  const nivPrioridade = Number(valor(row, ['NIV_PRIORIDADE'], 13)) || 5
  const op = normalizarOpKey(valor(row, ['OP'], 0))

  const rawInicioSeparacao = valor(row, ['DTINISEPARACAO', 'DtIniSeparacao'], 2)
  const rawFimSeparacao = valor(row, ['DTFIMSEPARACAO', 'DtFimSeparacao'], 3)
  const rawInicioPesagem = valor(row, ['DATAPESAGEM', 'DataPesagem'], 5)
  const rawFimPesagem = valor(row, ['DATAPESAGEM', 'DataPesagem'], 5)
  const rawInicioConferencia = valor(row, ['DATAPESAGEM', 'DataPesagem'], 5)
  const rawFimConferencia = texto(valor(row, ['PESO_CONFERIDO'], 6), '') ? valor(row, ['DATAPESAGEM', 'DataPesagem'], 5) : null

  const statusSeparacao = derivarStatusSeparacao(rawInicioSeparacao, rawFimSeparacao)
  const horaInicioSeparacao = formatarDataHoraExibicao(rawInicioSeparacao)
  const horaFimSeparacao = formatarDataHoraExibicao(rawFimSeparacao)
  const horaInicioPesagem = formatarDataHoraExibicao(rawInicioPesagem)
  const horaFimPesagem = formatarDataHoraExibicao(rawFimPesagem)
  const horaInicioConferencia = formatarDataHoraExibicao(rawInicioConferencia)
  const horaFimConferencia = rawFimConferencia ? formatarDataHoraExibicao(rawFimConferencia) : '--:--'

  const tempoSeparacao = calcularDiferencaTempo(rawInicioSeparacao, rawFimSeparacao)
  const tempoPesagem = calcularDiferencaTempo(rawInicioPesagem, rawFimPesagem)
  const tempoConferencia = calcularDiferencaTempo(rawInicioConferencia, rawFimConferencia)
  const tempoTotal = somarTempos(tempoSeparacao, tempoPesagem, tempoConferencia)

  const processoCompleto =
    isStatusFinalizado(statusSeparacao) &&
    isStatusFinalizado(statusPesagem) &&
    isStatusFinalizado(statusConferencia)

  const statusFinal = processoCompleto ? 'OK' : statusSeparacao
  const statusFinalClass = processoCompleto ? 'badge-ok' : badgeStatus(statusSeparacao)

  const prioridadeLibPulseClass = (!processoCompleto && nivPrioridade === 1) ? 'mp-priority-pulse' : ''

  return {
    prioridadeLib,
    prioridadeLibClass: badgePrioridade(prioridadeLib),
    prioridadeLibPulseClass,
    prioridadeLinha: formatarPrioridadeLinha(prioridadeLinha),
    prioridadeLinhaClass: badgePrioridadeLinha(prioridadeLinha),
    seq: String(index + 1),
    linha: texto(valor(row, ['LINHA'], 10)),
    op,
    produto: texto(valor(row, ['PRODUTO', 'Produto'], 1)),
    dataProgramacao: texto(valor(row, ['DATAPROGRAMACAO'], 14)),
    horaInicioSeparacao,
    horaFimSeparacao,
    tempoSeparacao,
    statusSeparacao,
    separacaoClass: badgeStatus(statusSeparacao),
    statusFinal,
    statusFinalClass,
    horaInicioPesagem,
    horaFimPesagem,
    tempoPesagem,
    statusPesagem,
    pesagemClass: badgeStatus(statusPesagem),
    horaInicioConferencia,
    horaFimConferencia,
    statusConferencia,
    conferenciaClass: badgeStatus(statusConferencia),
    tempoTotal,
    nivPrioridade,
    rowClass: getRowClassByNivPrioridade(nivPrioridade, processoCompleto),
    processoCompleto,
  }
}

export default function MateriaPrimaInicio() {
  const navigate = useNavigate()
  const [agora, setAgora] = useState(() => new Date())
  const [usuario, setUsuario] = useState<DadosUsuarioAuth | null>(null)
  
  const getDataProgramacaoPadrao = () => {
    const agora = new Date()
    if (agora.getHours() < 7) {
      const d = new Date()
      d.setDate(d.getDate() - 1)
      return formatDateInput(d)
    }
    return formatDateInput(agora)
  }
  
  const [dataProgramacao, setDataProgramacao] = useState(getDataProgramacaoPadrao)
  const [opSelecionada, setOpSelecionada] = useState('')
  const [linhaSelecionada, setLinhaSelecionada] = useState('')
  const [turnoSelecionado, setTurnoSelecionado] = useState('')
  const [linhas, setLinhas] = useState<LinhaSeparacao[]>([])
  const [linhasDiaAnterior, setLinhasDiaAnterior] = useState<LinhaSeparacao[]>([])
  const [carregandoInicial, setCarregandoInicial] = useState(true)
  const [filtrosAbertos, setFiltrosAbertos] = useState(false)
  const [legendaMobileAberta, setLegendaMobileAberta] = useState(false)
  const [linhaSelecionadaModal, setLinhaSelecionadaModal] = useState<LinhaSeparacao | null>(null)
  const [modalAberto, setModalAberto] = useState(false)
  const [tempoRestante, setTempoRestante] = useState(30)

  const linhasProducaoMock = [
    'ENV 01',
    'ENV 02',
    'ENV 03',
    'ENV 05',
    'ENV 06',
    'ENV 12',
    'ENV 13',
    'ENV 14',
    'ENV 15',
    'ENV 16',
    'ENV 17',
    'ENV 18',
    'ENV 19',
    'ENV 20',
  ]

  function abrirModal(linha: LinhaSeparacao) {
    setLinhaSelecionadaModal(linha)
    setModalAberto(true)
  }

  function fecharModal() {
    setLinhaSelecionadaModal(null)
    setModalAberto(false)
  }

  function handleLogout() {
    localStorage.removeItem(STORAGE_USUARIO)
    navigate('/', { replace: true })
  }

  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_USUARIO)
      if (!raw) {
        navigate('/', { replace: true })
        return
      }
      setUsuario(JSON.parse(raw) as DadosUsuarioAuth)
    } catch {
      navigate('/', { replace: true })
    }
  }, [navigate])

  const carregarSeparacao = useCallback(async () => {
    try {
      const dataAnterior = getDataAnterior(dataProgramacao)
      const sql = montarSqlSeparacao(dataProgramacao, opSelecionada, linhaSelecionada, turnoSelecionado)
      const sqlAnterior = montarSqlSeparacao(dataAnterior, opSelecionada, linhaSelecionada, turnoSelecionado)

      const [response, responseAnterior] = await Promise.all([
        api.post(`/api/Sankhya/DadosDashSankhya?sql=${encodeURIComponent(sql)}`),
        api.post(`/api/Sankhya/DadosDashSankhya?sql=${encodeURIComponent(sqlAnterior)}`),
      ])

      const data = response?.data?.responseBody?.rows || []
      const dataAnteriorRows = responseAnterior?.data?.responseBody?.rows || []

      setLinhas(data.map((row: any, index: number) => mapLinhaSeparacao(row, index)))
      const itensNaoFinalizados = dataAnteriorRows
        .map((row: any, index: number) => mapLinhaSeparacao(row, index))
        .filter((item: LinhaSeparacao) => !item.processoCompleto)
      setLinhasDiaAnterior(itensNaoFinalizados)
    } catch {
      // Não limpa os dados em caso de erro para evitar piscar
    } finally {
      setCarregandoInicial(false)
    }
  }, [dataProgramacao, opSelecionada, linhaSelecionada, turnoSelecionado])
  function atualizar() {
    window.location.reload()
  }

  useEffect(() => {
    const interval = setInterval(() => {
      setTempoRestante((prev) => {
        if (prev <= 1) {
          carregarSeparacao()
          return 30
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [carregarSeparacao])

  useEffect(() => {
    if (usuario) carregarSeparacao()
  }, [usuario, carregarSeparacao])

  const ops = useMemo(
    () => Array.from(new Set(linhas.map((linha) => linha.op).filter(Boolean))),
    [linhas]
  )

  const dataProgramacaoExibicao = useMemo(
    () => formatarDataProgramacaoExibicao(linhas[0]?.dataProgramacao || dataProgramacao),
    [linhas, dataProgramacao]
  )

  const dataAnteriorExibicao = useMemo(
    () => formatarDataProgramacaoExibicao(linhasDiaAnterior[0]?.dataProgramacao || getDataAnterior(dataProgramacao)),
    [linhasDiaAnterior, dataProgramacao]
  )

  const temPendenciasDiaAnterior = linhasDiaAnterior.length > 0

  function renderSeparadorProgramacao(dataExibicao: string) {
    return (
      <tr className="mp-separator-row">
        <td colSpan={18} className="mp-separator-cell">
          <div className="mp-separator-content">
            <div className="mp-separator-line" />
            <span className="mp-separator-text">Programação {dataExibicao}</span>
            <div className="mp-separator-line" />
          </div>
        </td>
      </tr>
    )
  }

  function renderLinhaGrid(r: LinhaSeparacao, keyPrefix: string, anterior = false) {
    return (
      <tr
        key={`${keyPrefix}-${r.op}`}
        className={`${r.rowClass}${anterior ? ' mp-row-anterior' : ''}`}
        onClick={() => abrirModal(r)}
        style={{ cursor: 'pointer' }}
      >
        <td>
          <span className={`badge-pill badge-liberacao ${r.prioridadeLibClass} ${r.prioridadeLibPulseClass}`}>{r.prioridadeLib}</span>
        </td>
        <td>
          <span className={`badge-pill ${r.prioridadeLinhaClass}`}>{r.prioridadeLinha}</span>
        </td>
        <td>{r.seq}</td>
        <td>{r.linha}</td>
        <td className="op-cell">{r.op}</td>
        <td className="produto-cell">{r.produto}</td>
        <td>{r.horaInicioSeparacao}</td>
        <td>{r.horaFimSeparacao}</td>
        <td>{r.tempoSeparacao}</td>
        <td>
          <span className={`badge-pill ${r.statusFinalClass}`}>{r.statusFinal}</span>
        </td>
        <td>{r.horaInicioPesagem}</td>
        <td>{r.horaFimPesagem}</td>
        <td>{r.tempoPesagem}</td>
        <td>
          <span className={`badge-pill ${r.pesagemClass}`}>{r.statusPesagem}</span>
        </td>
        <td>{r.horaInicioConferencia}</td>
        <td>{r.horaFimConferencia}</td>
        <td>
          <span className={`badge-pill ${r.conferenciaClass}`}>{r.statusConferencia}</span>
        </td>
        <td>
          <span>{r.tempoTotal}</span>
        </td>
      </tr>
    )
  }

  const dataStr = useMemo(
    () =>
      agora.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }),
    [agora]
  )
  const horaStr = useMemo(
    () =>
      agora.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    [agora]
  )

  
  if (!usuario) return null

  return (
    <div className="mp-app">
      <header className="mp-header">
        <div className="mp-header-left">
          <img src={`${base}logo-light.png`} alt="Grupo Alyne" />
          <div className="mp-header-title">1. MATÉRIA PRIMA — SEPARAÇÃO</div>
        </div>
        <div className="mp-header-meta">
          <div className="mp-header-meta-item mp-header-refresh">
            <FaSyncAlt className="icon-inline" aria-hidden />
            <span>Atualiza em {tempoRestante}s</span>
          </div>
          <div className="mp-header-meta-item">
            <FaCalendarAlt className="icon-inline" aria-hidden />
            <span>{dataStr}</span>
          </div>
          <div className="mp-header-meta-item">
            <FaClock className="icon-inline" aria-hidden />
            <span>{horaStr}</span>
          </div>
          <div className="mp-header-actions">
            <button type="button" className="btn-icon" title="Atualizar" onClick={atualizar}>
              <FaSyncAlt />
            </button>
            <button type="button" className="btn-icon" title="Sair" onClick={handleLogout}>
              <FaSignOutAlt />
            </button>
          </div>
        </div>
      </header>

      <main className="mp-main">
        <div className="mp-card">
          <div className="mp-card-toolbar">
            <button
              type="button"
              className="mp-filter-toggle"
              title={filtrosAbertos ? 'Ocultar filtros' : 'Exibir filtros'}
              onClick={() => setFiltrosAbertos((prev) => !prev)}
            >
              {filtrosAbertos ? <FaChevronDown /> : <FaListUl />}
            </button>
            {filtrosAbertos && (
            <div className="mp-toolbar-filters">
              <label>
                Linha de Produção
                <select value={linhaSelecionada} onChange={(e) => setLinhaSelecionada(e.target.value)}>
                  <option value="">TODAS AS LINHAS</option>
                  {linhasProducaoMock.map((linha) => (
                    <option key={linha} value={linha}>{linha}</option>
                  ))}
                </select>
              </label>
              <label>
                OP
                <input
                  type="text"
                  list="ops-list"
                  value={opSelecionada}
                  onChange={(e) => setOpSelecionada(e.target.value)}
                  placeholder="Digite ou selecione a OP..."
                />
                <datalist id="ops-list">
                  <option value="">Todas</option>
                  {ops.map((op) => (
                    <option key={op} value={op}>{op}</option>
                  ))}
                </datalist>
              </label>
              <label>
                Turno
                <select value={turnoSelecionado} onChange={(e) => setTurnoSelecionado(e.target.value)}>
                  <option value="">TODOS OS TURNOS</option>
                  <option value="1T">1T</option>
                  <option value="2T">2T</option>
                </select>
              </label>
              <label className="mp-date-range">
                Data Programação
                <input type="date" value={dataProgramacao} onChange={(e) => setDataProgramacao(e.target.value)} />
              </label>
            </div>
            )}
          </div>

          <div className="mp-section-title">
            <div className="mp-section-title-main">
              <FaUsers aria-hidden />
              <span>FILA DE LIBERAÇÃO + URGÊNCIA (MATÉRIA PRIMA)</span>
            </div>
            <span className="mp-programacao-text-header">
              Programação {dataProgramacaoExibicao}
              {temPendenciasDiaAnterior ? ` · pendências de ${dataAnteriorExibicao} no topo` : ''}
              {' '}- Válida de 07h às 07h do dia seguinte
            </span>
          </div>

          <div className="mp-table-wrap">
            <table className="mp-table">
              <thead>
                <tr>
                      <th>PRIORIDADE DE<br />LIBERAÇÃO</th>
                  <th>TURNO</th>
                  <th>SEQ</th>
                  <th>LINHA</th>
                  <th>OP</th>
                  <th>PRODUTO</th>
                  <th>INI.<br />SEPARAÇÃO</th>
                  <th>FIM<br />SEPARAÇÃO</th>
                  <th>TEMPO<br />SEPARAÇÃO</th>
                  <th>STATUS<br />SEPARAÇÃO</th>
                  <th>INI.<br />PESAGEM</th>
                  <th>FIM<br />PESAGEM</th>
                  <th>TEMPO<br />PESAGEM</th>
                  <th>STATUS<br />PESAGEM</th>
                  <th>INI.<br />CONF.</th>
                  <th>FIM<br />CONF.</th>
                  <th>STATUS<br />CONFERÊNCIA</th>
                  <th>TEMPO TOTAL<br />(SEP + PES + CONF)</th>
                </tr>
              </thead>
              <tbody>
                {linhasDiaAnterior.length === 0 && linhas.length === 0 && (
                  <tr>
                    <td colSpan={18} className="mp-empty-cell">Nenhum registro encontrado.</td>
                  </tr>
                )}
                {temPendenciasDiaAnterior && (
                  <>
                    {renderSeparadorProgramacao(dataAnteriorExibicao)}
                    {linhasDiaAnterior.map((r) => renderLinhaGrid(r, 'anterior', true))}
                  </>
                )}
                {linhas.length > 0 && temPendenciasDiaAnterior && renderSeparadorProgramacao(dataProgramacaoExibicao)}
                {linhas.map((r) => renderLinhaGrid(r, 'atual'))}
              </tbody>
            </table>
          </div>

          <div className={`mp-legend ${legendaMobileAberta ? 'is-mobile-open' : ''}`}>
            <button
              type="button"
              className="legend-mobile-toggle legend-mobile-open"
              title="Abrir legendas"
              onClick={() => setLegendaMobileAberta(true)}
            >
              <FaInfoCircle />
            </button>
            <button
              type="button"
              className="legend-mobile-toggle legend-mobile-close"
              title="Fechar legendas"
              onClick={() => setLegendaMobileAberta(false)}
            >
              <FaChevronDown />
            </button>
            <div className="legend-group">
              <strong>Legenda - Prioridade de Liberação</strong>
              <div className="legend-values">
                <span className="legend-badge badge-critica">CRÍTICA</span>
                <span className="legend-badge badge-alta">ALTA</span>
                <span className="legend-badge badge-media">MÉDIA</span>
                <span className="legend-badge badge-normal">NORMAL</span>
                <span className="legend-badge badge-ok">OK</span>
              </div>
            </div>
            <div className="legend-group">
              <strong>Legenda - Turno</strong>
              <div className="legend-values">
                <span className="legend-badge badge-1t">1T</span>
                <span>Primeiro Turno</span>
                <span className="legend-badge badge-2t">2T</span>
                <span>Segundo Turno</span>
              </div>
            </div>
            <div className="legend-group">
              <strong>Legenda - Status Separação</strong>
              <div className="legend-values">
                <span className="legend-circle legend-finalizado"></span>
                <span>FINALIZADO</span>
                <span className="legend-circle legend-processo"></span>
                <span>EM PROCESSO</span>
                <span className="legend-circle legend-aguardando"></span>
                <span>AGUARDANDO</span>
              </div>
            </div>
            <div className="legend-group">
              <strong>Legenda - Status Pesagem</strong>
              <div className="legend-values">
                <span className="legend-circle legend-finalizado"></span>
                <span>FINALIZADO</span>
                <span className="legend-circle legend-processo"></span>
                <span>EM PROCESSO</span>
                <span className="legend-circle legend-aguardando"></span>
                <span>AGUARDANDO</span>
              </div>
            </div>
            <div className="legend-group">
              <strong>Legenda - Status Conferência</strong>
              <div className="legend-values">
                <span className="legend-circle legend-finalizado"></span>
                <span>FINALIZADO</span>
                <span className="legend-circle legend-processo"></span>
                <span>EM PROCESSO</span>
                <span className="legend-circle legend-aguardando"></span>
                <span>AGUARDANDO</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="mp-footer">
        <div className="mp-footer-info">
          <IoInformationCircleOutline className="info-icon" />
          <span>A separação deve ser concluída e pesada antes do início da produção.</span>
        </div>
        <div className="mp-footer-update">
          <span>Dados atualizados em: {dataStr} {horaStr}</span>
        </div>
      </footer>

      <Modal className="modalLoading" show={carregandoInicial} backdrop="static">
        <Modal.Body>
          <div className="loadingModal">
            <img id="logoSankhya" src={`${base}logo-dark.png`} alt="" />
            <h4 className="loadingTitle">Carregando dados...</h4>
            <div className="loadingSubtitle">Aguarde enquanto os dados são carregados.</div>
            <ProgressBar className="progress" animated now={100} />
          </div>
        </Modal.Body>
      </Modal>

      {modalAberto && linhaSelecionadaModal && (
        <div className="modal-overlay" onClick={fecharModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Detalhes da OP</h3>
              <button type="button" className="modal-close" onClick={fecharModal}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="modal-detail-grid">
                <div className="modal-detail-item">
                  <span className="modal-detail-label">OP:</span>
                  <span className="modal-detail-value op-destaque">{linhaSelecionadaModal.op}</span>
                </div>
                <div className="modal-detail-item">
                  <span className="modal-detail-label">Linha:</span>
                  <span className="modal-detail-value">{linhaSelecionadaModal.linha}</span>
                </div>
                <div className="modal-detail-item">
                  <span className="modal-detail-label">Sequência:</span>
                  <span className="modal-detail-value">{linhaSelecionadaModal.seq}</span>
                </div>
                <div className="modal-detail-item">
                  <span className="modal-detail-label">Prioridade Liberação:</span>
                  <span className={`badge-pill ${linhaSelecionadaModal.prioridadeLibClass}`}>
                    {linhaSelecionadaModal.prioridadeLib}
                  </span>
                </div>
                <div className="modal-detail-item">
                  <span className="modal-detail-label">Turno:</span>
                  <span className={`badge-pill ${linhaSelecionadaModal.prioridadeLinhaClass}`}>
                    {linhaSelecionadaModal.prioridadeLinha}
                  </span>
                </div>
              </div>
              <div className="modal-section">
                <h4>Separação</h4>
                <div className="modal-detail-grid">
                  <div className="modal-detail-item">
                    <span className="modal-detail-label">Início:</span>
                    <span className="modal-detail-value">{linhaSelecionadaModal.horaInicioSeparacao}</span>
                  </div>
                  <div className="modal-detail-item">
                    <span className="modal-detail-label">Fim:</span>
                    <span className="modal-detail-value">{linhaSelecionadaModal.horaFimSeparacao}</span>
                  </div>
                  <div className="modal-detail-item">
                    <span className="modal-detail-label">Tempo:</span>
                    <span className="modal-detail-value">{linhaSelecionadaModal.tempoSeparacao}</span>
                  </div>
                  <div className="modal-detail-item">
                    <span className="modal-detail-label">Status:</span>
                    <span className={`badge-pill ${linhaSelecionadaModal.separacaoClass}`}>
                      {linhaSelecionadaModal.statusSeparacao}
                    </span>
                  </div>
                </div>
              </div>
              <div className="modal-section">
                <h4>Pesagem</h4>
                <div className="modal-detail-grid">
                  <div className="modal-detail-item">
                    <span className="modal-detail-label">Início:</span>
                    <span className="modal-detail-value">{linhaSelecionadaModal.horaInicioPesagem}</span>
                  </div>
                  <div className="modal-detail-item">
                    <span className="modal-detail-label">Fim:</span>
                    <span className="modal-detail-value">{linhaSelecionadaModal.horaFimPesagem}</span>
                  </div>
                  <div className="modal-detail-item">
                    <span className="modal-detail-label">Tempo:</span>
                    <span className="modal-detail-value">{linhaSelecionadaModal.tempoPesagem}</span>
                  </div>
                  <div className="modal-detail-item">
                    <span className="modal-detail-label">Status:</span>
                    <span className={`badge-pill ${linhaSelecionadaModal.pesagemClass}`}>
                      {linhaSelecionadaModal.statusPesagem}
                    </span>
                  </div>
                </div>
              </div>
              <div className="modal-section">
                <h4>Conferência</h4>
                <div className="modal-detail-grid">
                  <div className="modal-detail-item">
                    <span className="modal-detail-label">Início:</span>
                    <span className="modal-detail-value">{linhaSelecionadaModal.horaInicioConferencia}</span>
                  </div>
                  <div className="modal-detail-item">
                    <span className="modal-detail-label">Fim:</span>
                    <span className="modal-detail-value">{linhaSelecionadaModal.horaFimConferencia}</span>
                  </div>
                  <div className="modal-detail-item">
                    <span className="modal-detail-label">Status:</span>
                    <span className={`badge-pill ${linhaSelecionadaModal.conferenciaClass}`}>
                      {linhaSelecionadaModal.statusConferencia}
                    </span>
                  </div>
                </div>
              </div>
              <div className="modal-section">
                <h4>Tempo Total</h4>
                <div className="modal-detail-item">
                  <span className="modal-detail-value">{linhaSelecionadaModal.tempoTotal}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
