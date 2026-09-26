import {
  salvarBackupLocalNoStorage,
  carregarBackupLocalDoStorage,
  validarBackupLocal,
  obterMetadataUltimoBackup,
  criarPayloadBackupLocal,
  LOCAL_STORAGE_BACKUP_KEY,
  BACKUP_CURRENT_SCHEMA_VERSION,
} from './localStorageBackup'
import type { Aluno, Categoria, Lancamento, ConfiguracaoGlobal } from '@/types'

/**
 * Mock de Storage para testar isoladamente sem interferir em outros testes
 */
class MemoryStorage implements Storage {
  private store: Map<string, string> = new Map()

  get length(): number {
    return this.store.size
  }

  clear(): void {
    this.store.clear()
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null
  }

  key(index: number): string | null {
    const keys = Array.from(this.store.keys())
    return keys[index] ?? null
  }

  removeItem(key: string): void {
    this.store.delete(key)
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value)
  }
}

/**
 * Storage que simula QuotaExceededError
 */
class QuotaExceededStorage extends MemoryStorage {
  override setItem(_key: string, _value: string): void {
    const err = new Error('The quota has been exceeded.')
    err.name = 'QuotaExceededError'
    throw err
  }
}

export function executarTestesLocalStorageBackup(): {
  todosPassaram: boolean
  resultados: string[]
} {
  const resultados: string[] = []

  const mockConfig: ConfiguracaoGlobal = {
    id: 'cfg_backup_1',
    semestre_letivo_atual: '2026.2',
    minimo_exigido_semestre: 20,
    meta_curso: 200,
    nome_da_coordenadora: 'Roberta Andrea de Oliveira',
    crp_coordenadora: '06/77114',
  }

  const mockCategorias: Categoria[] = [
    {
      id: 'cat_1',
      nome: 'Eventos científicos com apresentação de trabalho',
      regra_horas_unitaria: '20h por evento',
      teto_maximo_curso: 40,
      ativo: true,
    },
    {
      id: 'cat_2',
      nome: 'Cursos Livres Presenciais ou Online',
      regra_horas_unitaria: '10h por atividade',
      teto_maximo_curso: 120,
      ativo: true,
    },
  ]

  const mockAlunos: Aluno[] = [
    {
      id: 'aluno_1',
      matricula: 'PSI2026201',
      nome: 'Estudante Teste Backup',
      turno: 'Matutino',
      semestre_atual: 2,
      periodo_entrada: '2026.1',
      email: 'teste.backup@aluno.fausp.br',
    },
  ]

  const mockLancamentos: Lancamento[] = [
    {
      id: 'lanc_1',
      aluno_id: 'aluno_1',
      categoria_id: 'cat_1',
      data_lancamento: '2026-08-20',
      semestre_letivo_atividade: '2026.2',
      horas_aceitas: 20,
      comprovante_ok: true,
      relatorio_ok: true,
      observacao: 'Participação com painel científico',
      created: '2026-08-20T10:00:00.000Z',
      updated: '2026-08-20T10:00:00.000Z',
    },
    {
      id: 'lanc_2',
      aluno_id: 'aluno_1',
      categoria_id: 'cat_1',
      data_lancamento: '2026-08-25',
      semestre_letivo_atividade: '2026.2',
      horas_aceitas: -5,
      comprovante_ok: true,
      relatorio_ok: true,
      observacao: 'Estorno de 5h duplicadas',
      created: '2026-08-25T14:00:00.000Z',
      updated: '2026-08-25T14:00:00.000Z',
    },
  ]

  // CT-BK-01: Geração de payload versionado com savedAt e sanitização
  const payload = criarPayloadBackupLocal({
    configuracao: mockConfig,
    categorias: mockCategorias,
    alunos: mockAlunos,
    lancamentos: mockLancamentos,
  })

  if (
    payload.version === BACKUP_CURRENT_SCHEMA_VERSION &&
    typeof payload.savedAt === 'string' &&
    !isNaN(Date.parse(payload.savedAt)) &&
    payload.alunos.length === 1 &&
    payload.categorias.length === 2 &&
    payload.lancamentos.length === 2
  ) {
    resultados.push('CT-BK-01: Criação de payload versionado de backup passou.')
  } else {
    throw new Error('CT-BK-01 falhou: payload versionado inválido.')
  }

  // CT-BK-02: Salvamento com sucesso no storage
  const storageValido = new MemoryStorage()
  const resSalvar = salvarBackupLocalNoStorage(
    {
      configuracao: mockConfig,
      categorias: mockCategorias,
      alunos: mockAlunos,
      lancamentos: mockLancamentos,
    },
    storageValido,
  )

  if (resSalvar.sucesso && resSalvar.salvoEm && storageValido.getItem(LOCAL_STORAGE_BACKUP_KEY)) {
    resultados.push('CT-BK-02: Salvamento de backup no localStorage com chave versionada passou.')
  } else {
    throw new Error('CT-BK-02 falhou: salvamento no localStorage falhou.')
  }

  // CT-BK-03: Restauração íntegra a partir do storage
  const resCarregar = carregarBackupLocalDoStorage(storageValido)
  if (
    resCarregar.sucesso &&
    resCarregar.payload &&
    resCarregar.payload.alunos[0].matricula === 'PSI2026201' &&
    resCarregar.payload.lancamentos.length === 2 &&
    resCarregar.payload.lancamentos[1].horas_aceitas === -5
  ) {
    resultados.push('CT-BK-03: Restauração íntegra de dados e estornos a partir do storage passou.')
  } else {
    throw new Error('CT-BK-03 falhou: carregamento do backup restaurado divergente.')
  }

  // CT-BK-04: Obtenção rápida de metadata (savedAt)
  const metadata = obterMetadataUltimoBackup(storageValido)
  if (metadata.salvoEm && metadata.salvoEm === resSalvar.salvoEm) {
    resultados.push('CT-BK-04: Leitura rápida de metadata de backup passou.')
  } else {
    throw new Error('CT-BK-04 falhou: metadata do backup não coincide.')
  }

  // CT-BK-05: Tratamento de JSON corrompido (descarta chave corrompida sem travar)
  const storageCorrompido = new MemoryStorage()
  storageCorrompido.setItem(LOCAL_STORAGE_BACKUP_KEY, '{ invalid_json_syntax: true, [')

  const resCorrompido = carregarBackupLocalDoStorage(storageCorrompido)
  const chaveRemovida = storageCorrompido.getItem(LOCAL_STORAGE_BACKUP_KEY) === null

  if (!resCorrompido.sucesso && chaveRemovida) {
    resultados.push('CT-BK-05: Detecção de JSON corrompido e descarte automático seguro passou.')
  } else {
    throw new Error('CT-BK-05 falhou: não descartou JSON corrompido adequadamente.')
  }

  // CT-BK-06: Validação de estrutura incompleta / incompatível
  const validacaoInvalida = validarBackupLocal({
    version: 0, // versão inválida
    savedAt: 'data_invalida',
    alunos: 'não é array',
  })

  if (!validacaoInvalida.valido && validacaoInvalida.erro) {
    resultados.push('CT-BK-06: Rejeição de esquema inválido ou versão incompatível passou.')
  } else {
    throw new Error('CT-BK-06 falhou: aceitou esquema de backup inválido.')
  }

  // CT-BK-07: Resiliência contra QuotaExceededError (não lança exceção impeditiva na UI)
  const storageCotaExcedida = new QuotaExceededStorage()
  const resCota = salvarBackupLocalNoStorage(
    {
      configuracao: mockConfig,
      categorias: mockCategorias,
      alunos: mockAlunos,
      lancamentos: mockLancamentos,
    },
    storageCotaExcedida,
  )

  if (!resCota.sucesso && resCota.erro?.includes('quota')) {
    resultados.push('CT-BK-07: Tratamento seguro de cota de armazenamento estourada passou.')
  } else {
    throw new Error('CT-BK-07 falhou: tratamento de QuotaExceededError incorreto.')
  }

  return { todosPassaram: true, resultados }
}
