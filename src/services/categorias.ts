import pb from '@/lib/pocketbase/client'
import type { Categoria } from '@/types'

export async function listarCategorias(somenteAtivas = false): Promise<Categoria[]> {
  const filter = somenteAtivas ? 'ativo = true' : ''
  return await pb.collection('categorias').getFullList<Categoria>({
    filter,
    sort: 'nome',
  })
}

export async function criarCategoria(
  data: Omit<Categoria, 'id' | 'created' | 'updated'>,
): Promise<Categoria> {
  return await pb.collection('categorias').create<Categoria>(data)
}

export async function atualizarCategoria(
  id: string,
  data: Partial<Omit<Categoria, 'id' | 'created' | 'updated'>>,
): Promise<Categoria> {
  return await pb.collection('categorias').update<Categoria>(id, data)
}

export async function excluirCategoria(id: string): Promise<boolean> {
  return await pb.collection('categorias').delete(id)
}
