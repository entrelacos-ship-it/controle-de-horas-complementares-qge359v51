import pb from '@/lib/pocketbase/client'
import type { Lancamento } from '@/types'

export async function listarLancamentosPorAluno(alunoId: string): Promise<Lancamento[]> {
  return await pb.collection('lancamentos').getFullList<Lancamento>({
    filter: `aluno_id = "${alunoId}"`,
    sort: '-created',
    expand: 'categoria_id,aluno_id',
  })
}

export async function listarTodosLancamentos(): Promise<Lancamento[]> {
  return await pb.collection('lancamentos').getFullList<Lancamento>({
    sort: '-created',
    expand: 'categoria_id,aluno_id',
  })
}

export async function listarLancamentosRecentes(limit = 5): Promise<Lancamento[]> {
  const res = await pb.collection('lancamentos').getList<Lancamento>(1, limit, {
    sort: '-created',
    expand: 'categoria_id,aluno_id',
  })
  return res.items
}

export async function contarLancamentosPorCategoria(categoriaId: string): Promise<number> {
  const res = await pb.collection('lancamentos').getList(1, 1, {
    filter: `categoria_id = "${categoriaId}"`,
  })
  return res.totalItems
}

/**
 * RN-003.x & Imutabilidade:
 * Salva um novo lançamento. PocketBase bloqueia update e delete na coleção via RLS.
 */
export async function criarLancamento(data: {
  aluno_id: string
  categoria_id: string
  data_lancamento: string
  semestre_letivo_atividade: string
  horas_aceitas: number
  comprovante_ok: boolean
  relatorio_ok: boolean
  observacao?: string
}): Promise<Lancamento> {
  return await pb.collection('lancamentos').create<Lancamento>(data, {
    expand: 'categoria_id,aluno_id',
  })
}
