import pb from '@/lib/pocketbase/client'
import type { Aluno } from '@/types'

export async function listarAlunos(turno?: string, busca?: string): Promise<Aluno[]> {
  const filters: string[] = []
  if (turno && turno !== 'Todos') {
    filters.push(`turno = "${turno}"`)
  }
  if (busca && busca.trim().length > 0) {
    const q = busca.trim()
    filters.push(`(nome ~ "${q}" || matricula ~ "${q}" || email ~ "${q}")`)
  }
  return await pb.collection('alunos').getFullList<Aluno>({
    filter: filters.join(' && '),
    sort: 'nome',
  })
}

export async function buscarAlunoPorId(id: string): Promise<Aluno> {
  return await pb.collection('alunos').getOne<Aluno>(id)
}

export async function criarAluno(data: Omit<Aluno, 'id' | 'created' | 'updated'>): Promise<Aluno> {
  return await pb.collection('alunos').create<Aluno>(data)
}

export async function atualizarAluno(
  id: string,
  data: Partial<Omit<Aluno, 'id' | 'created' | 'updated'>>,
): Promise<Aluno> {
  return await pb.collection('alunos').update<Aluno>(id, data)
}

/**
 * Promove todos os alunos para o próximo semestre (10º permanece 10º)
 */
export async function promoverTodosAlunos(): Promise<number> {
  const alunos = await pb.collection('alunos').getFullList<Aluno>()
  let count = 0
  for (const a of alunos) {
    const semAtual = Number(a.semestre_atual) || 1
    if (semAtual < 10) {
      await pb.collection('alunos').update(a.id, {
        semestre_atual: semAtual + 1,
      })
      count++
    }
  }
  return count
}

export interface ViradaSemestreParams {
  novoSemestreLetivo: string
  idsAlunosParaPromover: string[]
  onProgress?: (porcentagem: number, atual: number, total: number) => void
}

export interface ResultadoViradaSemestre {
  sucesso: boolean
  novoSemestre: string
  alunosPromovidos: number
  alunosMantidos: number
  totalAlunos: number
  dataVirada: string
}

/**
 * Automação assistida da virada de semestre:
 * 1. Promove os alunos selecionados (semestre_atual + 1, limitado a 10)
 * 2. Atualiza o semestre letivo atual e registros de última virada na configuracao_global
 * 3. Idempotente: se já executado para este semestre, previne re-execução acidental
 */
export async function executarViradaSemestreAssistida(
  params: ViradaSemestreParams,
): Promise<ResultadoViradaSemestre> {
  const { novoSemestreLetivo, idsAlunosParaPromover, onProgress } = params
  const novoSemestre = novoSemestreLetivo.trim()

  // Buscar configuração atual
  const configRecords = await pb.collection('configuracao_global').getFullList({ sort: '-created' })
  const config = configRecords.length > 0 ? configRecords[0] : null

  if (config && config.ultima_virada_semestre === novoSemestre) {
    throw new Error(
      `A virada de semestre para "${novoSemestre}" já foi aplicada anteriormente em ${
        config.ultima_virada_data
          ? new Date(config.ultima_virada_data).toLocaleString('pt-BR')
          : 'data anterior'
      }. Para evitar promoção duplicada, esta operação foi bloqueada.`,
    )
  }

  // Buscar todos os alunos atuais
  const todosAlunos = await pb.collection('alunos').getFullList<Aluno>()
  const setIdsParaPromover = new Set(idsAlunosParaPromover)

  let promovidos = 0
  let mantidos = 0
  const total = todosAlunos.length

  for (let i = 0; i < total; i++) {
    const aluno = todosAlunos[i]
    const semAtual = Number(aluno.semestre_atual) || 1

    if (setIdsParaPromover.has(aluno.id) && semAtual < 10) {
      const novoSem = Math.min(10, semAtual + 1)
      await pb.collection('alunos').update(aluno.id, {
        semestre_atual: novoSem,
      })
      promovidos++
    } else {
      mantidos++
    }

    if (onProgress) {
      const pct = Math.round(((i + 1) / total) * 90)
      onProgress(pct, i + 1, total)
    }
  }

  const dataIso = new Date().toISOString()

  // Atualizar configuracao_global
  if (config) {
    await pb.collection('configuracao_global').update(config.id, {
      semestre_letivo_atual: novoSemestre,
      ultima_virada_semestre: novoSemestre,
      ultima_virada_data: dataIso,
      ultima_virada_alunos_promovidos: promovidos,
    })
  } else {
    await pb.collection('configuracao_global').create({
      semestre_letivo_atual: novoSemestre,
      minimo_exigido_semestre: 20,
      meta_curso: 200,
      ultima_virada_semestre: novoSemestre,
      ultima_virada_data: dataIso,
      ultima_virada_alunos_promovidos: promovidos,
    })
  }

  if (onProgress) {
    onProgress(100, total, total)
  }

  return {
    sucesso: true,
    novoSemestre,
    alunosPromovidos: promovidos,
    alunosMantidos: mantidos,
    totalAlunos: total,
    dataVirada: dataIso,
  }
}
