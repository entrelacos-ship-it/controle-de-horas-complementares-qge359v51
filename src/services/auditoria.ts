import type { AtaNDE, AuditoriaLog, TipoEventoAuditoria } from '@/types/auditoria'
import type { Aluno, Lancamento, ConfiguracaoGlobal, Categoria } from '@/types'
import { calcularProgressoAluno } from '@/lib/calculoHoras'
import pb from '@/lib/pocketbase/client'

const ATAS_STORAGE_KEY = 'fausp_atas_nde_v1'
const LOGS_STORAGE_KEY = 'fausp_auditoria_logs_v1'

// Ata seed inicial de referência (conforme tela de homologação anterior 2026.1)
export const ATA_INICIAL_SEED: AtaNDE = {
  id: 'ata-01-2026-seed',
  numero_ata: '01/2026',
  semestre_letivo: '2026.1',
  data_homologacao: '2026-07-08T10:00:00.000Z',
  status: 'HOMOLOGADA',
  total_alunos_avaliados: 6,
  total_concluintes_aptos: 0,
  total_cumpriram_meta: 5,
  total_alerta_pedagogico: 1,
  total_horas_deferidas: 175,
  presidente_coordenadora: 'Roberta Andrea de Oliveira',
  crp_coordenadora: '06/77114',
  resumo_deliberacao:
    'Ata ordinária de fechamento do semestre letivo 2026.1. Homologadas 175 horas complementares deferidas pelo NDE com certificação oficial para a Secretaria Acadêmica Geral.',
  created: '2026-07-08T10:00:00.000Z',
  updated: '2026-07-08T10:00:00.000Z',
}

/**
 * Carrega a lista de atas NDE homologadas
 */
export function listarAtasNDE(): AtaNDE[] {
  if (typeof window === 'undefined') return [ATA_INICIAL_SEED]
  try {
    const raw = localStorage.getItem(ATAS_STORAGE_KEY)
    if (!raw) {
      localStorage.setItem(ATAS_STORAGE_KEY, JSON.stringify([ATA_INICIAL_SEED]))
      return [ATA_INICIAL_SEED]
    }
    const parsed = JSON.parse(raw) as AtaNDE[]
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [ATA_INICIAL_SEED]
  } catch {
    return [ATA_INICIAL_SEED]
  }
}

/**
 * Carrega atas do PocketBase com fallback síncrono para o storage local
 */
export async function listarAtasNDEPocketBase(): Promise<AtaNDE[]> {
  try {
    const records = await pb.collection('atas_nde').getFullList({
      sort: '-created',
    })
    if (records && records.length > 0) {
      const mapeadas: AtaNDE[] = records.map((r) => ({
        id: r.id,
        numero_ata: r.numero_ata,
        semestre_letivo: r.semestre_letivo,
        data_homologacao: r.data_homologacao,
        status: (r.status as AtaNDE['status']) || 'HOMOLOGADA',
        total_alunos_avaliados: Number(r.total_alunos_avaliados) || 0,
        total_concluintes_aptos: Number(r.total_concluintes_aptos) || 0,
        total_cumpriram_meta: Number(r.total_cumpriram_meta) || 0,
        total_alerta_pedagogico: Number(r.total_alerta_pedagogico) || 0,
        total_horas_deferidas: Number(r.total_horas_deferidas) || 0,
        presidente_coordenadora: r.presidente_coordenadora,
        crp_coordenadora: r.crp_coordenadora,
        resumo_deliberacao: r.resumo_deliberacao,
        dados_balanco: r.dados_balanco_json,
        created: r.created,
        updated: r.updated,
      }))
      // Sincroniza cache local
      if (typeof window !== 'undefined') {
        localStorage.setItem(ATAS_STORAGE_KEY, JSON.stringify(mapeadas))
      }
      return mapeadas
    }
  } catch (e) {
    console.warn('Fallback para cache local de atas NDE:', e)
  }
  return listarAtasNDE()
}

/**
 * Salva uma nova ata NDE homologada (persiste no PocketBase e espelha localmente)
 */
export async function salvarAtaNDEAsync(
  novaAta: Omit<AtaNDE, 'id' | 'created' | 'updated'>,
): Promise<AtaNDE> {
  const agoraIso = new Date().toISOString()
  let ataSalva: AtaNDE = {
    ...novaAta,
    id: `ata-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    created: agoraIso,
    updated: agoraIso,
  }

  try {
    const record = await pb.collection('atas_nde').create({
      numero_ata: novaAta.numero_ata,
      semestre_letivo: novaAta.semestre_letivo,
      data_homologacao: novaAta.data_homologacao,
      status: novaAta.status,
      total_alunos_avaliados: novaAta.total_alunos_avaliados,
      total_concluintes_aptos: novaAta.total_concluintes_aptos,
      total_cumpriram_meta: novaAta.total_cumpriram_meta,
      total_alerta_pedagogico: novaAta.total_alerta_pedagogico,
      total_horas_deferidas: novaAta.total_horas_deferidas,
      presidente_coordenadora: novaAta.presidente_coordenadora,
      crp_coordenadora: novaAta.crp_coordenadora || '',
      resumo_deliberacao: novaAta.resumo_deliberacao || '',
      dados_balanco_json: novaAta.dados_balanco || [],
    })

    ataSalva = {
      ...novaAta,
      id: record.id,
      created: record.created,
      updated: record.updated,
    }
  } catch (err) {
    console.warn('Ata salva em contingência local:', err)
  }

  // Atualiza cache local
  const atasLocais = listarAtasNDE().filter((a) => a.id !== ataSalva.id)
  const atualizadas = [ataSalva, ...atasLocais]
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(ATAS_STORAGE_KEY, JSON.stringify(atualizadas))
    } catch (e) {
      console.warn('Erro ao salvar ata no storage:', e)
    }
  }

  // Registrar na trilha de auditoria
  await registrarLogAuditoriaAsync({
    tipo_evento: 'HOMOLOGACAO_SEMESTRE',
    ator_nome: novaAta.presidente_coordenadora || 'Coordenação NDE',
    semestre_letivo: novaAta.semestre_letivo,
    descricao: `Homologação oficial do semestre letivo ${novaAta.semestre_letivo} — Emissão da Ata NDE N° ${novaAta.numero_ata} com ${novaAta.total_horas_deferidas}h deferidas e ${novaAta.total_alunos_avaliados} alunos avaliados.`,
  })

  return ataSalva
}

export function salvarAtaNDE(novaAta: Omit<AtaNDE, 'id' | 'created' | 'updated'>): AtaNDE {
  // Chamada síncrona mantida para compatibilidade, dispara async em background
  const id = `ata-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
  const agoraIso = new Date().toISOString()
  const ataCompleta: AtaNDE = {
    ...novaAta,
    id,
    created: agoraIso,
    updated: agoraIso,
  }

  const atas = listarAtasNDE()
  const atualizadas = [ataCompleta, ...atas]
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(ATAS_STORAGE_KEY, JSON.stringify(atualizadas))
    } catch (e) {
      console.warn('Erro ao salvar ata no storage:', e)
    }
  }

  // Persiste de forma não-bloqueante no PocketBase
  salvarAtaNDEAsync(novaAta).catch((e) => console.warn('Erro ao persistir ata no PB:', e))

  return ataCompleta
}

/**
 * Carrega logs manuais registrados
 */
export function listarLogsAuditoriaRegistrados(): AuditoriaLog[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(LOGS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as AuditoriaLog[]
    if (!Array.isArray(parsed)) return []
    const filtrados = parsed.filter(
      (l) => !l.aluno_matricula?.startsWith('PSI') && l.id !== 'ma75w7vfy7ko557',
    )
    return filtrados
  } catch {
    return []
  }
}

/**
 * Carrega logs do PocketBase com fallback
 */
export async function listarLogsAuditoriaPocketBase(): Promise<AuditoriaLog[]> {
  try {
    const records = await pb.collection('auditoria_logs').getFullList({
      sort: '-created',
    })
    if (records && records.length > 0) {
      const mapeados: AuditoriaLog[] = records.map((r) => ({
        id: r.id,
        tipo_evento: (r.tipo_evento as TipoEventoAuditoria) || 'LANCAMENTO_CRIADO',
        ator_nome: r.ator_nome,
        ator_email: r.ator_email,
        aluno_nome: r.aluno_nome,
        aluno_matricula: r.aluno_matricula,
        semestre_letivo: r.semestre_letivo,
        descricao: r.descricao,
        detalhes: r.detalhes_json,
        created: r.created,
      }))
      if (typeof window !== 'undefined') {
        localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(mapeados.slice(0, 500)))
      }
      return mapeados
    }
  } catch (e) {
    console.warn('Fallback para cache local de auditoria_logs:', e)
  }
  return listarLogsAuditoriaRegistrados()
}

/**
 * Registra um novo evento estrutural na trilha de auditoria
 */
export async function registrarLogAuditoriaAsync(
  evento: Omit<AuditoriaLog, 'id' | 'created'> & { created?: string },
): Promise<AuditoriaLog> {
  const agoraIso = evento.created || new Date().toISOString()
  let logCompleto: AuditoriaLog = {
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    created: agoraIso,
    tipo_evento: evento.tipo_evento,
    ator_nome: evento.ator_nome,
    ator_email: evento.ator_email,
    aluno_nome: evento.aluno_nome,
    aluno_matricula: evento.aluno_matricula,
    semestre_letivo: evento.semestre_letivo,
    descricao: evento.descricao,
    detalhes: evento.detalhes,
  }

  try {
    const rec = await pb.collection('auditoria_logs').create({
      tipo_evento: evento.tipo_evento,
      ator_nome: evento.ator_nome,
      ator_email: evento.ator_email || '',
      aluno_nome: evento.aluno_nome || '',
      aluno_matricula: evento.aluno_matricula || '',
      semestre_letivo: evento.semestre_letivo || '',
      descricao: evento.descricao,
      detalhes_json: evento.detalhes || null,
    })
    logCompleto = {
      ...logCompleto,
      id: rec.id,
      created: rec.created,
    }
  } catch (err) {
    console.warn('Log gravado em contingência local:', err)
  }

  // Atualiza cache local
  const logs = listarLogsAuditoriaRegistrados().filter((l) => l.id !== logCompleto.id)
  const atualizados = [logCompleto, ...logs]
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(atualizados.slice(0, 500)))
    } catch (e) {
      console.warn('Erro ao salvar log no storage:', e)
    }
  }

  return logCompleto
}

export function registrarLogAuditoria(
  evento: Omit<AuditoriaLog, 'id' | 'created'> & { created?: string },
): AuditoriaLog {
  const logs = listarLogsAuditoriaRegistrados()
  const id = `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
  const logCompleto: AuditoriaLog = {
    id,
    created: evento.created || new Date().toISOString(),
    tipo_evento: evento.tipo_evento,
    ator_nome: evento.ator_nome,
    ator_email: evento.ator_email,
    aluno_nome: evento.aluno_nome,
    aluno_matricula: evento.aluno_matricula,
    semestre_letivo: evento.semestre_letivo,
    descricao: evento.descricao,
    detalhes: evento.detalhes,
  }

  const atualizados = [logCompleto, ...logs]
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(atualizados.slice(0, 500)))
    } catch (e) {
      console.warn('Erro ao salvar log no storage:', e)
    }
  }

  // Dispara envio ao PocketBase de fundo
  registrarLogAuditoriaAsync(evento).catch((e) =>
    console.warn('Erro ao sincronizar log com backend:', e),
  )

  return logCompleto
}

/**
 * Constrói a trilha global completa de auditoria cronológica (mais recente primeiro)
 * combinando:
 * (a) Lançamentos e estornos existentes
 * (b) Atas homologadas
 * (c) Logs estruturais registrados (virada de semestre, importações, etc.)
 */
export function consolidarTrilhaAuditoriaGlobal(params: {
  lancamentos: Lancamento[]
  alunos: Aluno[]
  categorias: Categoria[]
  atas: AtaNDE[]
  logsRegistrados: AuditoriaLog[]
}): AuditoriaLog[] {
  const { lancamentos, alunos, categorias, atas, logsRegistrados } = params

  const mapaAlunos = new Map<string, Aluno>()
  alunos.forEach((a) => mapaAlunos.set(a.id, a))

  const mapaCategorias = new Map<string, Categoria>()
  categorias.forEach((c) => mapaCategorias.set(c.id, c))

  const listaConsolidada: AuditoriaLog[] = []

  // 1. Logs registrados estruturais
  listaConsolidada.push(...logsRegistrados)

  // 2. Derivar eventos das atas homologadas (evitando duplicar se já foi salva em logs)
  atas.forEach((ata) => {
    const jaExiste = logsRegistrados.some(
      (l) => l.tipo_evento === 'HOMOLOGACAO_SEMESTRE' && l.descricao.includes(ata.numero_ata),
    )
    if (!jaExiste) {
      listaConsolidada.push({
        id: `log-ata-${ata.id}`,
        tipo_evento: 'HOMOLOGACAO_SEMESTRE',
        ator_nome: ata.presidente_coordenadora,
        semestre_letivo: ata.semestre_letivo,
        created: ata.data_homologacao || ata.created || new Date().toISOString(),
        descricao: `Homologação oficial do semestre letivo ${ata.semestre_letivo} — Emissão da Ata NDE N° ${ata.numero_ata} (${ata.total_alunos_avaliados} alunos avaliados, ${ata.total_horas_deferidas}h deferidas).`,
      })
    }
  })

  // 3. Derivar de todos os lançamentos e estornos
  lancamentos.forEach((l) => {
    const aluno = mapaAlunos.get(l.aluno_id) || l.expand?.aluno_id
    const categoria = mapaCategorias.get(l.categoria_id) || l.expand?.categoria_id
    const catNome = categoria?.nome || 'Atividade Complementar'

    const isEstorno = Number(l.horas_aceitas) < 0
    const isImportacao = l.observacao?.includes('[Importação legada]')

    let tipo: TipoEventoAuditoria = isEstorno ? 'ESTORNO_REGISTRADO' : 'LANCAMENTO_CRIADO'
    if (isImportacao) {
      tipo = 'IMPORTACAO_LEGADA'
    }

    let descricao = ''
    if (isEstorno) {
      const horasPositivas = Math.abs(Number(l.horas_aceitas))
      const justif = l.observacao || 'Estorno administrativo de horas aceitas'
      descricao = `Estorno de ${horasPositivas}h em "${catNome}" — justificativa: ${justif}`
    } else if (isImportacao) {
      descricao = `[Importação legada] Deferimento de ${l.horas_aceitas}h em "${catNome}" (${l.semestre_letivo_atividade || 'semestre anterior'}) — ${l.observacao || 'Checklist homologado'}`
    } else {
      descricao = `Deferimento de ${l.horas_aceitas}h em "${catNome}" (${l.semestre_letivo_atividade || 'semestre ativo'}) — Checklist OK`
      if (l.observacao) {
        descricao += ` — ${l.observacao}`
      }
    }

    listaConsolidada.push({
      id: `log-lanc-${l.id}`,
      tipo_evento: tipo,
      ator_nome: 'Roberta Andrea de Oliveira (Coordenação)',
      ator_email: 'roberta.oliveira@fausp.br',
      aluno_nome: aluno?.nome,
      aluno_matricula: aluno?.matricula,
      semestre_letivo: l.semestre_letivo_atividade,
      descricao,
      created: l.created || l.data_lancamento,
    })
  })

  // Ordenação estrita: mais recente primeiro
  listaConsolidada.sort((a, b) => {
    const tA = new Date(a.created).getTime() || 0
    const tB = new Date(b.created).getTime() || 0
    return tB - tA
  })

  return listaConsolidada
}

/**
 * Calcula o balanço ao vivo do semestre ativo para o painel de governança NDE
 */
export function calcularBalancoAoVivoSemestre(params: {
  semestreAtivo: string
  alunos: Aluno[]
  lancamentos: Lancamento[]
  categorias: Categoria[]
  config: ConfiguracaoGlobal | null
}) {
  const { semestreAtivo, alunos, lancamentos, categorias, config } = params
  const minimoSemestral = Number(config?.minimo_exigido_semestre) || 20
  const metaCurso = Number(config?.meta_curso) || 200

  // Todos os alunos matriculados no curso são avaliados no semestre
  const alunosAvaliados = alunos

  // Turnos presentes nos alunos avaliados
  const turnosSet = new Set(alunosAvaliados.map((a) => a.turno).filter(Boolean))
  let turnosTexto = 'Matutino e Noturno'
  if (turnosSet.size === 1) {
    turnosTexto = Array.from(turnosSet)[0]
  } else if (turnosSet.size > 1) {
    turnosTexto = Array.from(turnosSet).join(' e ')
  }

  let totalAptosColacao = 0
  let totalCumpriramMeta = 0
  let totalAlertaPedagogico = 0
  let totalHorasDeferidasSemestre = 0

  const balancoAlunos = alunosAvaliados.map((aluno) => {
    const lancsDoAluno = lancamentos.filter((l) => l.aluno_id === aluno.id)
    const prog = calcularProgressoAluno(aluno, lancsDoAluno, categorias, config)

    // Horas específicas deste semestre
    const horasSemestre = lancsDoAluno
      .filter((l) => l.semestre_letivo_atividade === semestreAtivo)
      .reduce((acc, cur) => acc + Number(cur.horas_aceitas || 0), 0)

    totalHorasDeferidasSemestre += Math.max(0, horasSemestre)

    const cumpriuMeta = horasSemestre >= minimoSemestral
    const apto = prog.totalGeralHoras >= metaCurso

    if (apto) totalAptosColacao++
    if (cumpriuMeta) totalCumpriramMeta++
    else totalAlertaPedagogico++

    return {
      alunoId: aluno.id,
      nome: aluno.nome,
      matricula: aluno.matricula,
      turno: aluno.turno,
      semestreAtual: aluno.semestre_atual,
      horasSemestre,
      totalGeralHoras: prog.totalGeralHoras,
      cumpriuSemestre: cumpriuMeta,
      aptoColacao: apto,
    }
  })

  return {
    semestreAtivo,
    totalAlunosAvaliados: alunosAvaliados.length,
    turnosTexto,
    totalAptosColacao,
    totalCumpriramMeta,
    totalAlertaPedagogico,
    totalHorasDeferidasSemestre,
    balancoAlunos,
    minimoSemestral,
    metaCurso,
  }
}
