export interface AtaNdeBalancoAluno {
  alunoId: string
  nome: string
  matricula: string
  turno: string
  semestreAtual: number
  horasSemestre: number
  totalGeralHoras: number
  cumpriuSemestre: boolean
  aptoColacao: boolean
}

export interface AtaNDE {
  id: string
  numero_ata: string // ex: "01/2026"
  semestre_letivo: string // ex: "2026.1"
  data_homologacao: string // ISO string
  status: 'HOMOLOGADA' | 'EM_ANDAMENTO' | 'FECHADA'
  total_alunos_avaliados: number
  total_concluintes_aptos: number
  total_cumpriram_meta: number
  total_alerta_pedagogico: number
  total_horas_deferidas: number
  presidente_coordenadora: string
  crp_coordenadora: string
  resumo_deliberacao: string
  dados_balanco?: AtaNdeBalancoAluno[]
  created?: string
  updated?: string
}

export type TipoEventoAuditoria =
  | 'HOMOLOGACAO_SEMESTRE'
  | 'LANCAMENTO_CRIADO'
  | 'ESTORNO_REGISTRADO'
  | 'IMPORTACAO_LEGADA'
  | 'VIRADA_SEMESTRE'
  | 'CONFIGURACAO_ALTERADA'

export interface AuditoriaLog {
  id: string
  tipo_evento: TipoEventoAuditoria
  ator_nome: string
  ator_email?: string
  aluno_nome?: string
  aluno_matricula?: string
  semestre_letivo?: string
  descricao: string
  detalhes?: Record<string, unknown>
  created: string
}
