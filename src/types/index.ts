export type UserRole = 'Coordenador' | 'Administrador'

export interface User {
  id: string
  email: string
  name: string
  role?: UserRole
  avatar?: string
  created: string
  updated: string
}

export interface ConfiguracaoGlobal {
  id: string
  semestre_letivo_atual: string
  minimo_exigido_semestre: number
  meta_curso: number
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

export interface Aluno {
  id: string
  matricula: string
  nome: string
  turno: 'Matutino' | 'Noturno'
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
