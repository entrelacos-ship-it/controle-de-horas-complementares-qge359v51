export type UserRole = 'Coordenador' | 'Administrador'

export interface User {
  id: string
  email: string
  name: string
  role?: UserRole
  avatar?: string
  verified?: boolean
  created: string
  updated: string
}

export interface ConfiguracaoGlobal {
  id: string
  semestre_letivo_atual: string
  minimo_exigido_semestre: number
  meta_curso: number
  nome_da_coordenadora?: string
  crp_coordenadora?: string
  ultima_virada_semestre?: string
  ultima_virada_data?: string
  ultima_virada_alunos_promovidos?: number
  created?: string
  updated?: string
}

export interface Categoria {
  id: string
  nome: string
  regra_horas_unitaria: string
  teto_maximo_curso: number
  ativo: boolean
  created?: string
  updated?: string
}

export type TurnoAluno = 'Matutino' | 'Vespertino' | 'Noturno' | 'Especial'

export interface Aluno {
  id: string
  matricula: string
  nome: string
  turno: TurnoAluno
  semestre_atual: number // 1 to 10
  periodo_entrada: string
  email: string
  created?: string
  updated?: string
}

export interface Lancamento {
  id: string
  aluno_id: string
  categoria_id: string
  data_lancamento: string
  semestre_letivo_atividade: string
  horas_aceitas: number
  comprovante_ok: boolean
  relatorio_ok: boolean
  observacao?: string
  created: string
  updated: string
  // PocketBase expands
  expand?: {
    aluno_id?: Aluno
    categoria_id?: Categoria
  }
}

export interface CategoriaProgresso {
  categoria: Categoria
  horasAcumuladas: number
  teto: number
  bloqueada: boolean
  porcentagem: number
}

export interface AlunoProgresso {
  aluno: Aluno
  totalGeralHoras: number
  metaCurso: number
  porcentagemCurso: number
  horasSemestreAtual: number
  minimoSemestral: number
  restanteSemestreAtual: number
  cumpriuSemestre: boolean
  categoriasProgresso: CategoriaProgresso[]
  categoriasBloqueadasIds: Set<string>
  totalEstornos: number
}

export type AtaNdeStatus = 'HOMOLOGADA' | 'RASCUNHO' | 'REVOGADA'

export interface AtaNdeBalancoItem {
  matricula: string
  nome: string
  turno: TurnoAluno
  semestreAtual: number
  horasSemestre: number
  horasAcumuladasTotal: number
  cumpreMetaSemestral: boolean
  aptoColacao: boolean
}

export interface AtaNde {
  id: string
  numero_ata: string
  semestre_letivo: string
  data_homologacao: string
  status: AtaNdeStatus | string
  total_alunos_avaliados: number
  total_concluintes_aptos: number
  total_cumpriram_meta: number
  total_alerta_pedagogico: number
  total_horas_deferidas: number
  presidente_coordenadora: string
  crp_coordenadora: string
  resumo_deliberacao: string
  dados_balanco_json?: {
    itens?: AtaNdeBalancoItem[]
    metaSemestral?: number
    metaCurso?: number
    turnos?: string[]
  } | null
  created: string
  updated: string
}

export type TipoAuditoriaEvento =
  | 'HOMOLOGACAO_SEMESTRE'
  | 'VIRADA_SEMESTRE'
  | 'IMPORTACAO_LEGADA'
  | 'LANCAMENTO_HORAS'
  | 'ESTORNO_HORAS'
  | 'CONFIG_NDE_ALTERADA'
  | 'ALUNO_CRIADO'
  | 'ALUNO_ATUALIZADO'
  | 'CATEGORIA_ATUALIZADA'

export interface AuditoriaLog {
  id: string
  tipo_evento: TipoAuditoriaEvento | string
  ator_nome: string
  ator_email: string
  aluno_nome?: string
  aluno_matricula?: string
  semestre_letivo?: string
  descricao: string
  detalhes_json?: Record<string, unknown> | null
  created: string
  updated: string
}
