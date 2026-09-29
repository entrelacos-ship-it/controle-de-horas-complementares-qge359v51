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

export interface LinhaMultiplaCategoria {
  id: string
  categoriaId: string
  horas: number | string
}

export interface ResultadoValidacaoLinha {
  linhaId: string
  categoriaId: string
  categoriaNome: string
  horasValidas: number
  horasAcumuladasAtuais: number
  teto: number
  saldoRestante: number
  estourouTeto: boolean
  bloqueadaPrevia: boolean
  valida: boolean
  erro?: string
}

export interface ResultadoValidacaoMultipla {
  valido: boolean
  erroGeral?: string
  linhas: ResultadoValidacaoLinha[]
  totalHorasOperacao: number
}

/**
 * Validação de múltiplas linhas de categoria no mesmo lançamento:
 * 1. Pelo menos uma linha
 * 2. Recusa de categorias duplicadas
 * 3. Validação individual de horas (> 0)
 * 4. Verificação independente de teto para cada categoria
 * 5. Checklist documental obrigatório
 */
export function validarMultiplosLancamentos(params: {
  linhas: LinhaMultiplaCategoria[]
  categorias: Categoria[]
  lancamentosDoAluno: Lancamento[]
  comprovanteOk: boolean
  relatorioOk: boolean
}): ResultadoValidacaoMultipla {
  const { linhas, categorias, lancamentosDoAluno, comprovanteOk, relatorioOk } = params

  if (!comprovanteOk || !relatorioOk) {
    return {
      valido: false,
      erroGeral:
        'É obrigatório atestar SIM para Comprovante de Participação e Relatório Reflexivo.',
      linhas: [],
      totalHorasOperacao: 0,
    }
  }

  if (linhas.length === 0) {
    return {
      valido: false,
      erroGeral: 'Adicione pelo menos uma categoria ao lançamento.',
      linhas: [],
      totalHorasOperacao: 0,
    }
  }

  // Verifica duplicidade de categoria
  const categoriasVistas = new Set<string>()
  for (const l of linhas) {
    if (!l.categoriaId) {
      return {
        valido: false,
        erroGeral: 'Selecione uma categoria para todas as linhas da operação.',
        linhas: [],
        totalHorasOperacao: 0,
      }
    }
    if (categoriasVistas.has(l.categoriaId)) {
      const cat = categorias.find((c) => c.id === l.categoriaId)
      return {
        valido: false,
        erroGeral: `A categoria "${cat?.nome || l.categoriaId}" foi adicionada mais de uma vez. Remova a duplicata para prosseguir.`,
        linhas: [],
        totalHorasOperacao: 0,
      }
    }
    categoriasVistas.add(l.categoriaId)
  }

  let totalHorasOperacao = 0
  const resultadosLinhas: ResultadoValidacaoLinha[] = []
  let algumErro = false
  let primeiroErro: string | undefined

  for (const linha of linhas) {
    const cat = categorias.find((c) => c.id === linha.categoriaId)
    if (!cat) {
      algumErro = true
      primeiroErro = 'Categoria não encontrada.'
      resultadosLinhas.push({
        linhaId: linha.id,
        categoriaId: linha.categoriaId,
        categoriaNome: 'Desconhecida',
        horasValidas: 0,
        horasAcumuladasAtuais: 0,
        teto: 0,
        saldoRestante: 0,
        estourouTeto: true,
        bloqueadaPrevia: false,
        valida: false,
        erro: 'Categoria não encontrada no sistema.',
      })
      continue
    }

    const numHoras = Math.max(0, parseFloat(String(linha.horas)) || 0)
    if (numHoras <= 0) {
      algumErro = true
      if (!primeiroErro) {
        primeiroErro = `Informe uma quantidade de horas maior que zero para a categoria "${cat.nome}".`
      }
      resultadosLinhas.push({
        linhaId: linha.id,
        categoriaId: cat.id,
        categoriaNome: cat.nome,
        horasValidas: 0,
        horasAcumuladasAtuais: calcularHorasCategoria(cat.id, lancamentosDoAluno),
        teto: cat.teto_maximo_curso,
        saldoRestante: Math.max(
          0,
          cat.teto_maximo_curso - calcularHorasCategoria(cat.id, lancamentosDoAluno),
        ),
        estourouTeto: false,
        bloqueadaPrevia: isCategoriaBloqueada(
          calcularHorasCategoria(cat.id, lancamentosDoAluno),
          cat.teto_maximo_curso,
        ),
        valida: false,
        erro: 'Horas devem ser maiores que zero.',
      })
      continue
    }

    const acumuladoAtual = calcularHorasCategoria(cat.id, lancamentosDoAluno)
    const teto = Number(cat.teto_maximo_curso) || 0
    const bloqueadaPrevia = isCategoriaBloqueada(acumuladoAtual, teto)
    const novoTotal = acumuladoAtual + numHoras
    const estourouTeto = novoTotal > teto
    const saldoRestante = Math.max(0, teto - acumuladoAtual)

    if (bloqueadaPrevia) {
      algumErro = true
      if (!primeiroErro) {
        primeiroErro = `⛔ Categoria "${cat.nome}" com teto de ${teto}h já integralmente atingido por este estudante (${acumuladoAtual}h registradas). Não é possível deferir novos lançamentos nesta categoria.`
      }
      resultadosLinhas.push({
        linhaId: linha.id,
        categoriaId: cat.id,
        categoriaNome: cat.nome,
        horasValidas: numHoras,
        horasAcumuladasAtuais: acumuladoAtual,
        teto,
        saldoRestante,
        estourouTeto: true,
        bloqueadaPrevia: true,
        valida: false,
        erro: `Categoria bloqueada (já atingiu o teto de ${teto}h).`,
      })
      continue
    }

    if (estourouTeto) {
      algumErro = true
      if (!primeiroErro) {
        primeiroErro = `⛔ As ${numHoras}h solicitadas somadas ao saldo de ${acumuladoAtual}h totalizam ${novoTotal}h e ultrapassam o teto de ${teto}h desta categoria. Você ainda pode lançar até ${saldoRestante}h nesta categoria.`
      }
      resultadosLinhas.push({
        linhaId: linha.id,
        categoriaId: cat.id,
        categoriaNome: cat.nome,
        horasValidas: numHoras,
        horasAcumuladasAtuais: acumuladoAtual,
        teto,
        saldoRestante,
        estourouTeto: true,
        bloqueadaPrevia: false,
        valida: false,
        erro: `Ultrapassa teto de ${teto}h (saldo disponível: ${saldoRestante}h).`,
      })
      continue
    }

    totalHorasOperacao += numHoras
    resultadosLinhas.push({
      linhaId: linha.id,
      categoriaId: cat.id,
      categoriaNome: cat.nome,
      horasValidas: numHoras,
      horasAcumuladasAtuais: acumuladoAtual,
      teto,
      saldoRestante,
      estourouTeto: false,
      bloqueadaPrevia: false,
      valida: true,
    })
  }

  return {
    valido: !algumErro,
    erroGeral: primeiroErro,
    linhas: resultadosLinhas,
    totalHorasOperacao,
  }
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
