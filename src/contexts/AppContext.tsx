import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  ReactNode,
} from 'react'
import type { Aluno, Categoria, Lancamento, ConfiguracaoGlobal, TurnoAluno } from '@/types'
import {
  getConfiguracaoGlobal,
  salvarConfiguracaoGlobal as apiSalvarConfiguracaoGlobal,
} from '@/services/configuracao'
import {
  listarAlunos,
  criarAluno as apiCriarAluno,
  atualizarAluno as apiAtualizarAluno,
  excluirAluno as apiExcluirAluno,
  promoverTodosAlunos as apiPromoverTodosAlunos,
  executarViradaSemestreAssistida as apiExecutarViradaSemestreAssistida,
  ViradaSemestreParams,
  ResultadoViradaSemestre,
} from '@/services/alunos'
import {
  listarCategorias,
  criarCategoria as apiCriarCategoria,
  atualizarCategoria as apiAtualizarCategoria,
  excluirCategoria as apiExcluirCategoria,
} from '@/services/categorias'
import {
  listarTodosLancamentos,
  criarLancamento as apiCriarLancamento,
} from '@/services/lancamentos'
import {
  salvarBackupLocalNoStorage,
  carregarBackupLocalDoStorage,
  obterMetadataUltimoBackup,
} from '@/lib/localStorageBackup'

export interface AppContextType {
  // Estado principal
  config: ConfiguracaoGlobal | null
  alunos: Aluno[]
  categorias: Categoria[]
  lancamentos: Lancamento[]
  loading: boolean
  isOfflineMode: boolean
  offlineLoadedAt: string | null
  ultimoBackupSalvoEm: string | null
  erroCarregamento: string | null

  // Ações de recarga / sincronização
  recarregarDados: () => Promise<void>
  forcarBackupLocal: () => boolean

  // Mutações de Aluno (atualizam backend e backup local imediatamente)
  criarAluno: (data: Omit<Aluno, 'id' | 'created' | 'updated'>) => Promise<Aluno>
  atualizarAluno: (
    id: string,
    data: Partial<Omit<Aluno, 'id' | 'created' | 'updated'>>,
  ) => Promise<Aluno>
  excluirAluno: (id: string, autor?: { nome?: string; email?: string }) => Promise<boolean>
  promoverTodosAlunos: () => Promise<number>
  executarViradaSemestreAssistida: (
    params: ViradaSemestreParams,
  ) => Promise<ResultadoViradaSemestre>

  // Mutações de Categoria
  criarCategoria: (data: Omit<Categoria, 'id' | 'created' | 'updated'>) => Promise<Categoria>
  atualizarCategoria: (
    id: string,
    data: Partial<Omit<Categoria, 'id' | 'created' | 'updated'>>,
  ) => Promise<Categoria>
  excluirCategoria: (id: string) => Promise<boolean>

  // Mutações de Lançamento (incluindo estornos com horas negativas)
  criarLancamento: (data: {
    aluno_id: string
    categoria_id: string
    data_lancamento: string
    semestre_letivo_atividade: string
    horas_aceitas: number
    comprovante_ok: boolean
    relatorio_ok: boolean
    observacao?: string
  }) => Promise<Lancamento>

  // Mutações de Configuração
  salvarConfiguracao: (
    id: string,
    data: Partial<Omit<ConfiguracaoGlobal, 'id' | 'created' | 'updated'>>,
  ) => Promise<ConfiguracaoGlobal>
}

const AppContext = createContext<AppContextType | null>(null)

export const BACKUP_INTERVAL_MS = 30000 // 30 segundos conforme diretrizes

export function AppProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<ConfiguracaoGlobal | null>(null)
  const [alunos, setAlunos] = useState<Aluno[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [isOfflineMode, setIsOfflineMode] = useState<boolean>(false)
  const [offlineLoadedAt, setOfflineLoadedAt] = useState<string | null>(null)
  const [ultimoBackupSalvoEm, setUltimoBackupSalvoEm] = useState<string | null>(() => {
    return typeof window !== 'undefined' ? obterMetadataUltimoBackup().salvoEm : null
  })
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null)

  // Refs para capturar sempre o estado mais atual nos callbacks e no intervalo
  const stateRef = useRef({ config, alunos, categorias, lancamentos })
  useEffect(() => {
    stateRef.current = { config, alunos, categorias, lancamentos }
  }, [config, alunos, categorias, lancamentos])

  /**
   * Persiste o estado atual no localStorage e atualiza o timestamp de feedback.
   */
  const persistirNoLocalStorage = useCallback(
    (dadosSobrescritos?: {
      config?: ConfiguracaoGlobal | null
      alunos?: Aluno[]
      categorias?: Categoria[]
      lancamentos?: Lancamento[]
    }): boolean => {
      if (typeof window === 'undefined') return false

      const dadosParaSalvar = {
        configuracao:
          dadosSobrescritos?.config !== undefined
            ? dadosSobrescritos.config
            : stateRef.current.config,
        categorias:
          dadosSobrescritos?.categorias !== undefined
            ? dadosSobrescritos.categorias
            : stateRef.current.categorias,
        alunos:
          dadosSobrescritos?.alunos !== undefined
            ? dadosSobrescritos.alunos
            : stateRef.current.alunos,
        lancamentos:
          dadosSobrescritos?.lancamentos !== undefined
            ? dadosSobrescritos.lancamentos
            : stateRef.current.lancamentos,
      }

      // Evita gravar se ainda estiver completamente vazio (não carregado)
      if (
        !dadosParaSalvar.configuracao &&
        dadosParaSalvar.alunos.length === 0 &&
        dadosParaSalvar.categorias.length === 0
      ) {
        return false
      }

      const res = salvarBackupLocalNoStorage(dadosParaSalvar)
      if (res.sucesso && res.salvoEm) {
        setUltimoBackupSalvoEm(res.salvoEm)
        return true
      }
      return false
    },
    [],
  )

  /**
   * Carrega os dados do backend PocketBase (fonte de verdade).
   * Se falhar (offline / erro de rede), hidrata a partir do backup do localStorage.
   */
  const carregarDados = useCallback(async () => {
    try {
      setLoading(true)
      setErroCarregamento(null)

      const [cfg, als, cats, lcs] = await Promise.all([
        getConfiguracaoGlobal(),
        listarAlunos(),
        listarCategorias(false), // carrega todas para manter histórico completo
        listarTodosLancamentos(),
      ])

      // Sucesso no servidor PocketBase: servidor prevalece
      setConfig(cfg)
      setAlunos(als)
      setCategorias(cats)
      setLancamentos(lcs)
      setIsOfflineMode(false)
      setOfflineLoadedAt(null)

      // Atualiza o backup local imediatamente com o snapshot mais recente do servidor
      persistirNoLocalStorage({
        config: cfg,
        alunos: als,
        categorias: cats,
        lancamentos: lcs,
      })
    } catch (err: unknown) {
      console.warn(
        '[AppContext] Falha ao carregar dados do PocketBase. Tentando restaurar do localStorage...',
        err,
      )
      const msgErro = err instanceof Error ? err.message : 'Falha na conexão com o servidor'
      setErroCarregamento(msgErro)

      // Tenta hidratar a partir do cache do localStorage
      const backupRecuperado = carregarBackupLocalDoStorage()
      if (backupRecuperado.sucesso && backupRecuperado.payload) {
        const payload = backupRecuperado.payload
        setConfig(payload.configuracao)
        setAlunos(payload.alunos)
        setCategorias(payload.categorias)
        setLancamentos(payload.lancamentos)
        setIsOfflineMode(true)
        setOfflineLoadedAt(payload.savedAt)
        setUltimoBackupSalvoEm(payload.savedAt)
      } else {
        // Se não houver nem servidor nem backup válido
        setIsOfflineMode(true)
        setOfflineLoadedAt(null)
      }
    } finally {
      setLoading(false)
    }
  }, [persistirNoLocalStorage])

  // Carga inicial ao montar
  useEffect(() => {
    carregarDados()
  }, [carregarDados])

  // Rotina de Backup Periódico no localStorage (a cada 30 segundos)
  useEffect(() => {
    const timer = setInterval(() => {
      // Se tiver dados carregados, salva periodicamente
      if (
        stateRef.current.alunos.length > 0 ||
        stateRef.current.categorias.length > 0 ||
        stateRef.current.config
      ) {
        persistirNoLocalStorage()
      }
    }, BACKUP_INTERVAL_MS)

    return () => clearInterval(timer)
  }, [persistirNoLocalStorage])

  // Mutações com persistência imediata:
  const criarAluno = useCallback(
    async (data: Omit<Aluno, 'id' | 'created' | 'updated'>): Promise<Aluno> => {
      const novo = await apiCriarAluno(data)
      setAlunos((prev) => {
        const atualizados = [...prev, novo].sort((a, b) => a.nome.localeCompare(b.nome))
        persistirNoLocalStorage({ alunos: atualizados })
        return atualizados
      })
      return novo
    },
    [persistirNoLocalStorage],
  )

  const atualizarAluno = useCallback(
    async (
      id: string,
      data: Partial<Omit<Aluno, 'id' | 'created' | 'updated'>>,
    ): Promise<Aluno> => {
      const atualizado = await apiAtualizarAluno(id, data)
      setAlunos((prev) => {
        const listaAtualizada = prev.map((a) => (a.id === id ? atualizado : a))
        persistirNoLocalStorage({ alunos: listaAtualizada })
        return listaAtualizada
      })
      return atualizado
    },
    [persistirNoLocalStorage],
  )

  const excluirAluno = useCallback(
    async (id: string, autor?: { nome?: string; email?: string }): Promise<boolean> => {
      // 1. Coleta dados para auditoria antes da exclusão
      const alunoAlvo = stateRef.current.alunos.find((a) => a.id === id)
      const lancsAlvo = stateRef.current.lancamentos.filter((l) => l.aluno_id === id)
      const horasTotais = lancsAlvo.reduce((sum, l) => sum + (Number(l.horas_aceitas) || 0), 0)
      const totalLancamentos = lancsAlvo.length

      // 2. Chama a API de exclusão (que cascateia os lançamentos)
      const ok = await apiExcluirAluno(id)
      if (ok) {
        // Atualiza estado de alunos
        const novosAlunos = stateRef.current.alunos.filter((a) => a.id !== id)
        // Atualiza estado de lançamentos removendo os do aluno excluído
        const novosLancamentos = stateRef.current.lancamentos.filter((l) => l.aluno_id !== id)

        setAlunos(novosAlunos)
        setLancamentos(novosLancamentos)

        // Salva backup local imediatamente sem o aluno e sem os lançamentos órfãos
        persistirNoLocalStorage({
          alunos: novosAlunos,
          lancamentos: novosLancamentos,
        })

        // Registra log na trilha de auditoria
        try {
          const { registrarLogAuditoria } = await import('@/services/auditoria')
          const nomeAtor = autor?.nome || 'Coordenação de Psicologia'
          const emailAtor = autor?.email || ''
          const nomeAluno = alunoAlvo?.nome || 'Estudante'
          const matAluno = alunoAlvo?.matricula || '—'

          registrarLogAuditoria({
            tipo_evento: 'ALUNO_EXCLUIDO',
            ator_nome: nomeAtor,
            ator_email: emailAtor,
            aluno_nome: nomeAluno,
            aluno_matricula: matAluno,
            semestre_letivo: stateRef.current.config?.semestre_letivo_atual || '',
            descricao: `Exclusão do estudante ${nomeAluno} (${matAluno}). Total de ${horasTotais}h acumuladas e ${totalLancamentos} lançamento(s) vinculados removidos em cascata.`,
            detalhes: {
              aluno_id: id,
              nome: nomeAluno,
              matricula: matAluno,
              turno: alunoAlvo?.turno,
              semestre_atual: alunoAlvo?.semestre_atual,
              horas_acumuladas: horasTotais,
              lancamentos_removidos: totalLancamentos,
            },
          })
        } catch (e) {
          console.warn('Erro ao registrar log de exclusão de aluno na auditoria:', e)
        }
      }
      return ok
    },
    [persistirNoLocalStorage],
  )

  const promoverTodosAlunos = useCallback(async (): Promise<number> => {
    const count = await apiPromoverTodosAlunos()
    // Recarrega alunos para garantir sincronia completa
    const alsAtualizados = await listarAlunos()
    setAlunos(alsAtualizados)
    persistirNoLocalStorage({ alunos: alsAtualizados })
    return count
  }, [persistirNoLocalStorage])

  const executarViradaSemestreAssistida = useCallback(
    async (params: ViradaSemestreParams): Promise<ResultadoViradaSemestre> => {
      const res = await apiExecutarViradaSemestreAssistida(params)
      // Atualiza alunos e configuração após a virada
      const [als, cfg] = await Promise.all([listarAlunos(), getConfiguracaoGlobal()])
      setAlunos(als)
      setConfig(cfg)
      persistirNoLocalStorage({ alunos: als, config: cfg })

      // Registra evento na trilha de auditoria
      try {
        const { registrarLogAuditoria } = await import('@/services/auditoria')
        const semestreAnterior = cfg?.semestre_letivo_atual || 'anterior'
        registrarLogAuditoria({
          tipo_evento: 'VIRADA_SEMESTRE',
          ator_nome: 'Roberta Andrea de Oliveira (Coordenação)',
          semestre_letivo: params.novoSemestreLetivo,
          descricao: `Virada de Semestre Assistida executada: transição de ${semestreAnterior} para ${params.novoSemestreLetivo} (${res.alunosPromovidos} alunos promovidos).`,
        })
      } catch (e) {
        console.warn('Erro ao registrar log de virada na auditoria:', e)
      }

      return res
    },
    [persistirNoLocalStorage],
  )

  const criarCategoria = useCallback(
    async (data: Omit<Categoria, 'id' | 'created' | 'updated'>): Promise<Categoria> => {
      const nova = await apiCriarCategoria(data)
      setCategorias((prev) => {
        const atualizadas = [...prev, nova].sort((a, b) => a.nome.localeCompare(b.nome))
        persistirNoLocalStorage({ categorias: atualizadas })
        return atualizadas
      })
      return nova
    },
    [persistirNoLocalStorage],
  )

  const atualizarCategoria = useCallback(
    async (
      id: string,
      data: Partial<Omit<Categoria, 'id' | 'created' | 'updated'>>,
    ): Promise<Categoria> => {
      const atualizada = await apiAtualizarCategoria(id, data)
      setCategorias((prev) => {
        const atualizadas = prev.map((c) => (c.id === id ? atualizada : c))
        persistirNoLocalStorage({ categorias: atualizadas })
        return atualizadas
      })
      return atualizada
    },
    [persistirNoLocalStorage],
  )

  const excluirCategoria = useCallback(
    async (id: string): Promise<boolean> => {
      const ok = await apiExcluirCategoria(id)
      if (ok) {
        setCategorias((prev) => {
          const filtradas = prev.filter((c) => c.id !== id)
          persistirNoLocalStorage({ categorias: filtradas })
          return filtradas
        })
      }
      return ok
    },
    [persistirNoLocalStorage],
  )

  const criarLancamento = useCallback(
    async (data: {
      aluno_id: string
      categoria_id: string
      data_lancamento: string
      semestre_letivo_atividade: string
      horas_aceitas: number
      comprovante_ok: boolean
      relatorio_ok: boolean
      observacao?: string
    }): Promise<Lancamento> => {
      const novo = await apiCriarLancamento(data)
      setLancamentos((prev) => {
        const atualizados = [novo, ...prev]
        persistirNoLocalStorage({ lancamentos: atualizados })
        return atualizados
      })

      // Registra evento estrutural na trilha de auditoria
      try {
        const { registrarLogAuditoria } = await import('@/services/auditoria')
        const alunoAlvo = alunos.find((a) => a.id === data.aluno_id)
        const catAlvo = categorias.find((c) => c.id === data.categoria_id)
        const isEstorno = Number(data.horas_aceitas) < 0
        const horasFormatadas = isEstorno
          ? `Estorno de ${Math.abs(Number(data.horas_aceitas))}h`
          : `Deferimento de ${data.horas_aceitas}h`

        registrarLogAuditoria({
          tipo_evento: isEstorno ? 'ESTORNO_REGISTRADO' : 'LANCAMENTO_CRIADO',
          ator_nome: 'Roberta Andrea de Oliveira (Coordenação)',
          aluno_nome: alunoAlvo?.nome,
          aluno_matricula: alunoAlvo?.matricula,
          semestre_letivo: data.semestre_letivo_atividade,
          descricao: `${horasFormatadas} em "${catAlvo?.nome || 'Atividade Complementar'}" (${data.semestre_letivo_atividade}) — ${data.observacao || 'Checklist OK'}`,
        })
      } catch (e) {
        console.warn('Erro ao registrar log de lançamento na auditoria:', e)
      }

      return novo
    },
    [persistirNoLocalStorage, alunos, categorias],
  )

  const salvarConfiguracao = useCallback(
    async (
      id: string,
      data: Partial<Omit<ConfiguracaoGlobal, 'id' | 'created' | 'updated'>>,
    ): Promise<ConfiguracaoGlobal> => {
      const salva = await apiSalvarConfiguracaoGlobal(id, data)
      setConfig(salva)
      persistirNoLocalStorage({ config: salva })
      return salva
    },
    [persistirNoLocalStorage],
  )

  const forcarBackupLocal = useCallback((): boolean => {
    return persistirNoLocalStorage()
  }, [persistirNoLocalStorage])

  return (
    <AppContext.Provider
      value={{
        config,
        alunos,
        categorias,
        lancamentos,
        loading,
        isOfflineMode,
        offlineLoadedAt,
        ultimoBackupSalvoEm,
        erroCarregamento,
        recarregarDados: carregarDados,
        forcarBackupLocal,
        criarAluno,
        atualizarAluno,
        excluirAluno,
        promoverTodosAlunos,
        executarViradaSemestreAssistida,
        criarCategoria,
        atualizarCategoria,
        excluirCategoria,
        criarLancamento,
        salvarConfiguracao,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useApp deve ser utilizado dentro de um AppProvider')
  }
  return context
}

export { AppContext }
