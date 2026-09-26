import type { Aluno, Categoria, Lancamento, ConfiguracaoGlobal } from '@/types'

export const LOCAL_STORAGE_BACKUP_KEY = 'fausp_horas_app_backup_v1'
export const BACKUP_CURRENT_SCHEMA_VERSION = 1

export interface LocalStorageBackupPayload {
  app: string
  version: number
  savedAt: string // ISO date string
  configuracao: ConfiguracaoGlobal | null
  categorias: Categoria[]
  alunos: Aluno[]
  lancamentos: Lancamento[]
}

export interface ResultadoValidacaoLocalBackup {
  valido: boolean
  erro?: string
  dados?: LocalStorageBackupPayload
}

/**
 * Sanitiza e serializa os dados essenciais para o backup local.
 * Evita inflar o localStorage com campos desnecessários ou circulares.
 */
export function criarPayloadBackupLocal(dados: {
  configuracao: ConfiguracaoGlobal | null
  categorias: Categoria[]
  alunos: Aluno[]
  lancamentos: Lancamento[]
}): LocalStorageBackupPayload {
  return {
    app: 'Controle de Horas Complementares — Psicologia FAUSP',
    version: BACKUP_CURRENT_SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    configuracao: dados.configuracao ? { ...dados.configuracao } : null,
    categorias: Array.isArray(dados.categorias)
      ? dados.categorias.map((c) => ({
          id: c.id,
          nome: c.nome,
          regra_horas_unitaria: c.regra_horas_unitaria,
          teto_maximo_curso: Number(c.teto_maximo_curso) || 0,
          ativo: c.ativo !== false,
          created: c.created,
          updated: c.updated,
        }))
      : [],
    alunos: Array.isArray(dados.alunos)
      ? dados.alunos.map((a) => ({
          id: a.id,
          matricula: a.matricula,
          nome: a.nome,
          turno: a.turno,
          semestre_atual: Number(a.semestre_atual) || 1,
          periodo_entrada: a.periodo_entrada,
          email: a.email,
          created: a.created,
          updated: a.updated,
        }))
      : [],
    lancamentos: Array.isArray(dados.lancamentos)
      ? dados.lancamentos.map((l) => ({
          id: l.id,
          aluno_id: l.aluno_id,
          categoria_id: l.categoria_id,
          data_lancamento: l.data_lancamento,
          semestre_letivo_atividade: l.semestre_letivo_atividade,
          horas_aceitas: Number(l.horas_aceitas) || 0,
          comprovante_ok: l.comprovante_ok,
          relatorio_ok: l.relatorio_ok,
          observacao: l.observacao || '',
          created: l.created,
          updated: l.updated,
        }))
      : [],
  }
}

/**
 * Valida se um objeto des-serializado do localStorage possui a estrutura de backup esperada.
 */
export function validarBackupLocal(dados: unknown): ResultadoValidacaoLocalBackup {
  if (!dados || typeof dados !== 'object') {
    return { valido: false, erro: 'Payload não é um objeto válido.' }
  }

  const obj = dados as Partial<LocalStorageBackupPayload>

  if (typeof obj.version !== 'number' || obj.version < 1) {
    return { valido: false, erro: 'Versão de esquema do backup inválida ou ausente.' }
  }

  if (!obj.savedAt || typeof obj.savedAt !== 'string') {
    return { valido: false, erro: 'Data de salvamento (savedAt) inválida ou ausente.' }
  }

  // Verifica timestamp parseável
  const timestamp = Date.parse(obj.savedAt)
  if (isNaN(timestamp)) {
    return { valido: false, erro: 'Formato de data (savedAt) inválido.' }
  }

  if (!Array.isArray(obj.categorias)) {
    return { valido: false, erro: 'Seção de categorias deve ser um array.' }
  }

  if (!Array.isArray(obj.alunos)) {
    return { valido: false, erro: 'Seção de alunos deve ser um array.' }
  }

  if (!Array.isArray(obj.lancamentos)) {
    return { valido: false, erro: 'Seção de lançamentos deve ser um array.' }
  }

  return {
    valido: true,
    dados: obj as LocalStorageBackupPayload,
  }
}

/**
 * Salva os dados no localStorage de forma silenciosa e resiliente.
 * Trata estouro de cota e erros de serialização sem travar a UI.
 */
export function salvarBackupLocalNoStorage(
  dados: {
    configuracao: ConfiguracaoGlobal | null
    categorias: Categoria[]
    alunos: Aluno[]
    lancamentos: Lancamento[]
  },
  storage: Storage = window.localStorage,
): { sucesso: boolean; salvoEm?: string; erro?: string } {
  try {
    const payload = criarPayloadBackupLocal(dados)
    const json = JSON.stringify(payload)
    storage.setItem(LOCAL_STORAGE_BACKUP_KEY, json)
    return { sucesso: true, salvoEm: payload.savedAt }
  } catch (err: unknown) {
    // Tratar QuotaExceededError ou restrições de navegação privada
    const msg = err instanceof Error ? err.message : 'Erro desconhecido ao gravar no localStorage'
    console.warn('[LocalStorageBackup] Não foi possível salvar backup local:', msg)
    return { sucesso: false, erro: msg }
  }
}

/**
 * Carrega e valida o backup do localStorage.
 * Em caso de JSON corrompido, descarta a chave corrompida silenciosamente.
 */
export function carregarBackupLocalDoStorage(storage: Storage = window.localStorage): {
  sucesso: boolean
  payload?: LocalStorageBackupPayload
  erro?: string
} {
  try {
    const raw = storage.getItem(LOCAL_STORAGE_BACKUP_KEY)
    if (!raw) {
      return { sucesso: false, erro: 'Nenhum backup local encontrado.' }
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      // JSON corrompido: descarta para evitar loop de falhas
      console.warn(
        '[LocalStorageBackup] JSON corrompido detectado no localStorage. Limpando chave...',
      )
      try {
        storage.removeItem(LOCAL_STORAGE_BACKUP_KEY)
      } catch {
        // ignore
      }
      return { sucesso: false, erro: 'JSON local corrompido e descartado.' }
    }

    const validacao = validarBackupLocal(parsed)
    if (!validacao.valido || !validacao.dados) {
      console.warn('[LocalStorageBackup] Estrutura do backup local incompatível:', validacao.erro)
      return { sucesso: false, erro: validacao.erro }
    }

    return { sucesso: true, payload: validacao.dados }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro ao acessar localStorage'
    return { sucesso: false, erro: msg }
  }
}

/**
 * Obtém apenas os metadados (savedAt) do último backup sem carregar todo o payload se não necessário.
 */
export function obterMetadataUltimoBackup(storage: Storage = window.localStorage): {
  salvoEm: string | null
} {
  try {
    const raw = storage.getItem(LOCAL_STORAGE_BACKUP_KEY)
    if (!raw) return { salvoEm: null }
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed.savedAt === 'string') {
      return { salvoEm: parsed.savedAt }
    }
    return { salvoEm: null }
  } catch {
    return { salvoEm: null }
  }
}
