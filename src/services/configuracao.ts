import pb from '@/lib/pocketbase/client'
import type { ConfiguracaoGlobal } from '@/types'

export async function getConfiguracaoGlobal(): Promise<ConfiguracaoGlobal> {
  const records = await pb.collection('configuracao_global').getFullList<ConfiguracaoGlobal>({
    sort: '-created',
  })
  if (records.length > 0) {
    return records[0]
  }
  // Fallback defaults se vazio
  return {
    id: '',
    semestre_letivo_atual: '2026.2',
    minimo_exigido_semestre: 20,
    meta_curso: 200,
    nome_da_coordenadora: 'Roberta Andrea de Oliveira',
    crp_coordenadora: '06/77114',
  }
}

export async function salvarConfiguracaoGlobal(
  id: string,
  data: Partial<Omit<ConfiguracaoGlobal, 'id' | 'created' | 'updated'>>,
): Promise<ConfiguracaoGlobal> {
  if (id) {
    return await pb.collection('configuracao_global').update<ConfiguracaoGlobal>(id, data)
  }
  return await pb.collection('configuracao_global').create<ConfiguracaoGlobal>(data)
}
