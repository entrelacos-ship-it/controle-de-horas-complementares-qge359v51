import type {
  Aluno,
  Categoria,
  Lancamento,
  ConfiguracaoGlobal,
  AlunoProgresso,
  CategoriaProgresso,
} from '../types'

/**
 * RN-003.1: Calcula a soma de horas aceitas por aluno e categoria
 */
export function calcularHorasCategoria(
  categoriaId: string,
  lancamentosDoAluno: Lancamento[],
): number {
  return lancamentosDoAluno
    .filter((l) => l.categoria_id === categoriaId)
    .reduce((sum, l) => sum + (Number(l.horas_aceitas) || 0), 0)
}

/**
 * RN-003.2 e RN-003.3: Verifica se a categoria está bloqueada para o aluno
 * Se Horas_Acumuladas >= Teto_Maximo_Categoria, a categoria é considerada BLOQUEADA.
 */
export function isCategoriaBloqueada(horasAcumuladas: number, tetoMaximo: number): boolean {
  return horasAcumuladas >= tetoMaximo
}

/**
 * RN-003.4 & Regras de Validação:
 * Um novo lançamento com horas positivas em categoria bloqueada deve ser rejeitado.
 * Lançamento de estorno (horas negativas) É PERMITIDO mesmo se bloqueada,
 * pois deduz do saldo acumulado.
 */
export function validarNovoLancamento(params: {
  horasAceitas: number
  categoria: Categoria
  horasAcumuladasAtuais: number
  comprovanteOk: boolean
  relatorioOk: boolean
  observacao?: string
}): { valido: boolean; erro?: string } {
  const { horasAceitas, categoria, horasAcumuladasAtuais, comprovanteOk, relatorioOk, observacao } =
    params

  if (!comprovanteOk || !relatorioOk) {
    return {
      valido: false,
      erro: 'É obrigatório atestar SIM para Comprovante de Participação e Relatório Reflexivo.',
    }
  }

  if (horasAceitas === 0) {
    return {
      valido: false,
      erro: 'Horas aceitas não podem ser 0.',
    }
  }

  // Estorno negativo
  if (horasAceitas < 0) {
    if (!observacao || observacao.trim().length === 0) {
      return {
        valido: false,
        erro: 'Observação com justificativa é obrigatória para lançamentos de estorno (horas negativas).',
      }
    }
    return { valido: true }
  }

  // Horas positivas
  const bloqueada = isCategoriaBloqueada(horasAcumuladasAtuais, categoria.teto_maximo_curso)
  if (bloqueada) {
    return {
      valido: false,
      erro: `⛔ Categoria ${categoria.nome} BLOQUEADA — NÃO ACEITAR MAIS LANÇAMENTOS NESTA CATEGORIA.`,
    }
  }

  return { valido: true }
}

/**
 * Calcula todo o progresso de um aluno (total geral, por categoria, balanço semestral).
 */
export function calcularProgressoAluno(
  aluno: Aluno,
  lancamentosDoAluno: Lancamento[],
  categorias: Categoria[],
  config: ConfiguracaoGlobal,
): AlunoProgresso {
  const metaCurso = config.meta_curso || 200
  const minimoSemestral = config.minimo_exigido_semestre || 20
  const semestreAtual = config.semestre_letivo_atual || '2026.2'

  let totalGeralHoras = 0
  let horasSemestreAtual = 0
  let totalEstornos = 0

  for (const l of lancamentosDoAluno) {
    const h = Number(l.horas_aceitas) || 0
    totalGeralHoras += h
    if (h < 0) {
      totalEstornos++
    }
    if (l.semestre_letivo_atividade === semestreAtual) {
      horasSemestreAtual += h
    }
  }

  const categoriasBloqueadasIds = new Set<string>()
  const categoriasProgresso: CategoriaProgresso[] = categorias.map((cat) => {
    const horas = calcularHorasCategoria(cat.id, lancamentosDoAluno)
    const teto = Number(cat.teto_maximo_curso) || 0
    const bloqueada = isCategoriaBloqueada(horas, teto)
    if (bloqueada) {
      categoriasBloqueadasIds.add(cat.id)
    }
    const porcentagem = teto > 0 ? Math.min(100, Math.round((horas / teto) * 100)) : 0
    return {
      categoria: cat,
      horasAcumuladas: horas,
      teto,
      bloqueada,
      porcentagem,
    }
  })

  const restanteSemestreAtual = Math.max(0, minimoSemestral - horasSemestreAtual)
  const cumpriuSemestre = horasSemestreAtual >= minimoSemestral
  const porcentagemCurso =
    metaCurso > 0 ? Math.min(100, Math.round((totalGeralHoras / metaCurso) * 100)) : 0

  return {
    aluno,
    totalGeralHoras,
    metaCurso,
    porcentagemCurso,
    horasSemestreAtual,
    minimoSemestral,
    restanteSemestreAtual,
    cumpriuSemestre,
    categoriasProgresso,
    categoriasBloqueadasIds,
    totalEstornos,
  }
}
