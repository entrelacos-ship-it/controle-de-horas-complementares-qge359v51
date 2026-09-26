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
