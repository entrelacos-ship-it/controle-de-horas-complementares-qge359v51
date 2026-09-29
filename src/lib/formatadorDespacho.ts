import type { Aluno, Categoria, Lancamento, ConfiguracaoGlobal } from '../types'
import { calcularHorasCategoria, isCategoriaBloqueada } from './calculoHoras'

/**
 * Formata data no padrão brasileiro dd/mm/aaaa
 */
export function formatarDataBr(dataStr?: string | Date): string {
  if (!dataStr) {
    const hoje = new Date()
    return hoje.toLocaleDateString('pt-BR')
  }
  const d = typeof dataStr === 'string' ? new Date(dataStr) : dataStr
  if (isNaN(d.getTime())) {
    return new Date().toLocaleDateString('pt-BR')
  }
  return d.toLocaleDateString('pt-BR')
}

/**
 * Formata data no padrão oficial MM/YYYY (apenas Mês e Ano, sem dia)
 * Aceita strings ISO (2025-03-15, 2025-03), Date ou formatos BR
 */
export function formatarMesAno(dataStr?: string | Date | null): string {
  if (!dataStr) {
    const agora = new Date()
    const mes = String(agora.getMonth() + 1).padStart(2, '0')
    return `${mes}/${agora.getFullYear()}`
  }

  if (typeof dataStr === 'string') {
    const str = dataStr.trim()
    // Caso já venha no formato MM/YYYY
    if (/^\d{2}\/\d{4}$/.test(str)) {
      return str
    }
    // Caso venha YYYY-MM ou YYYY-MM-DD
    const isoMatch = str.match(/^(\d{4})[-/](\d{1,2})/)
    if (isoMatch) {
      const ano = isoMatch[1]
      const mes = isoMatch[2].padStart(2, '0')
      return `${mes}/${ano}`
    }
    // Caso venha DD/MM/YYYY
    const brMatch = str.match(/^\d{1,2}\/(\d{1,2})\/(\d{4})$/)
    if (brMatch) {
      const mes = brMatch[1].padStart(2, '0')
      const ano = brMatch[2]
      return `${mes}/${ano}`
    }
  }

  const d = typeof dataStr === 'string' ? new Date(dataStr) : dataStr
  if (!d || isNaN(d.getTime())) {
    const agora = new Date()
    const mes = String(agora.getMonth() + 1).padStart(2, '0')
    return `${mes}/${agora.getFullYear()}`
  }

  const mes = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${mes}/${d.getUTCFullYear()}`
}

export interface ItemDespachoCategoria {
  categoria: Categoria
  horas: number
}

export interface GerarDespachoParams {
  aluno: Aluno
  categoriaAtividade?: Categoria
  horasLancamento?: number
  atividadesLancadas?: ItemDespachoCategoria[]
  semestreAtividade: string
  lancamentosDoAluno: Lancamento[]
  categorias: Categoria[]
  config: ConfiguracaoGlobal
  dataDespacho?: string | Date
}

/**
 * Gera o texto do despacho oficial conforme as regras do PRD:
 * - Abertura exata:
 *   Para 1 categoria:
 *   "Horas Complementares aceitas pela Coordenação do Curso de Psicologia, Roberta Andrea de Oliveira, CRP. 06/77114, na categoria [Nome Categoria], totalizando [X] horas, de acordo com a tabela atual de [Semestre Letivo]."
 *   Para múltiplas categorias na mesma operação:
 *   "Horas Complementares aceitas pela Coordenação do Curso de Psicologia, Roberta Andrea de Oliveira, CRP. 06/77114, nas categorias: [Cat 1] ([X]h), [Cat 2] ([Y]h), totalizando [X+Y] horas, de acordo com a tabela atual de [Semestre Letivo]."
 * - "Situação atual do/a estudante:"
 *   Para cada categoria com horas: "[Nome Categoria] (máx [Teto]h): total geral [X] horas"
 * - Semestres do atual até o 10º:
 *   - Atual: "Restante para integralizar o semestre ([N]º): [X] horas" (mínimo - horas do semestre atual)
 *   - Regra do numeral 0: do atual+1 até o 10º exibe OBRIGATORIAMENTE "Restante para integralizar o semestre ([N]º): 0 horas"
 * - "Restante para integralizar o curso: [X] horas"
 * - "Total geral de horas complementares até [dd/mm/aaaa]: [X] horas."
 * - Para cada categoria no teto: "Informamos que a categoria [Nome Categoria] atingiu o limite máximo e não será mais aceita para este/a estudante."
 */
export function gerarTextoDespacho(params: GerarDespachoParams): string {
  const {
    aluno,
    categoriaAtividade,
    horasLancamento = 0,
    atividadesLancadas,
    semestreAtividade,
    lancamentosDoAluno,
    categorias,
    config,
    dataDespacho,
  } = params

  const semestreAtualLetivo = config.semestre_letivo_atual || '2026.2'
  const minimoSemestre = config.minimo_exigido_semestre || 20
  const metaCurso = config.meta_curso || 200
  const nomeCoordenadora = config.nome_da_coordenadora?.trim() || 'Roberta Andrea de Oliveira'
  const crpCoordenadora = config.crp_coordenadora?.trim() || '06/77114'

  // Determina as categorias e horas lançadas nesta operação
  const listaOperacao: ItemDespachoCategoria[] = []
  if (atividadesLancadas && atividadesLancadas.length > 0) {
    listaOperacao.push(...atividadesLancadas)
  } else if (categoriaAtividade) {
    listaOperacao.push({
      categoria: categoriaAtividade,
      horas: horasLancamento,
    })
  }

  const totalHorasOperacao = listaOperacao.reduce((acc, item) => acc + (Number(item.horas) || 0), 0)

  // 1. Abertura parametrizada com a Coordenadora e seu CRP
  const linhas: string[] = []
  if (listaOperacao.length > 1) {
    const detalheCategorias = listaOperacao
      .map((item) => `${item.categoria.nome} (${item.horas}h)`)
      .join(', ')
    linhas.push(
      `Horas Complementares aceitas pela Coordenação do Curso de Psicologia, ${nomeCoordenadora}, CRP. ${crpCoordenadora}, nas categorias: ${detalheCategorias}, totalizando ${totalHorasOperacao} horas, de acordo com a tabela atual de ${semestreAtividade || semestreAtualLetivo}.`,
    )
  } else if (listaOperacao.length === 1) {
    linhas.push(
      `Horas Complementares aceitas pela Coordenação do Curso de Psicologia, ${nomeCoordenadora}, CRP. ${crpCoordenadora}, na categoria ${listaOperacao[0].categoria.nome}, totalizando ${listaOperacao[0].horas} horas, de acordo com a tabela atual de ${semestreAtividade || semestreAtualLetivo}.`,
    )
  } else {
    linhas.push(
      `Horas Complementares aceitas pela Coordenação do Curso de Psicologia, ${nomeCoordenadora}, CRP. ${crpCoordenadora}, de acordo com a tabela atual de ${semestreAtividade || semestreAtualLetivo}.`,
    )
  }
  linhas.push('')
  linhas.push('Situação atual do/a estudante:')

  // 2. Horas por categoria (apenas onde o aluno tem horas registradas)
  // Calculamos acumulados
  let totalGeral = 0
  let horasSemestreAtual = 0
  const categoriasNoTeto: Categoria[] = []

  for (const cat of categorias) {
    const horasCat = calcularHorasCategoria(cat.id, lancamentosDoAluno)
    if (horasCat > 0) {
      linhas.push(`${cat.nome} (máx ${cat.teto_maximo_curso}h): total geral ${horasCat} horas`)
    }
    if (isCategoriaBloqueada(horasCat, cat.teto_maximo_curso)) {
      categoriasNoTeto.push(cat)
    }
  }

  // 3. Totais gerais e semestrais
  for (const l of lancamentosDoAluno) {
    const h = Number(l.horas_aceitas) || 0
    totalGeral += h
    if (l.semestre_letivo_atividade === semestreAtualLetivo) {
      horasSemestreAtual += h
    }
  }

  const semestreAluno = Math.min(10, Math.max(1, aluno.semestre_atual || 1))
  const restanteSemestreAtual = Math.max(0, minimoSemestre - horasSemestreAtual)

  // Linhas por semestre (do semestre atual do aluno até o 10º)
  linhas.push(
    `Restante para integralizar o semestre (${semestreAluno}º): ${restanteSemestreAtual} horas`,
  )

  // REGRA DO NUMERAL 0: semestres futuros (semestreAluno + 1 até 10)
  for (let sem = semestreAluno + 1; sem <= 10; sem++) {
    linhas.push(`Restante para integralizar o semestre (${sem}º): 0 horas`)
  }

  // Restante para o curso
  const restanteCurso = Math.max(0, metaCurso - totalGeral)
  linhas.push(`Restante para integralizar o curso: ${restanteCurso} horas`)

  // Fechamento com data
  const dataFormatada = formatarDataBr(dataDespacho)
  linhas.push(`Total geral de horas complementares até ${dataFormatada}: ${totalGeral} horas.`)

  // Avisos de teto atingido
  if (categoriasNoTeto.length > 0) {
    linhas.push('')
    for (const cat of categoriasNoTeto) {
      linhas.push(
        `Informamos que a categoria ${cat.nome} atingiu o limite máximo e não será mais aceita para este/a estudante.`,
      )
    }
  }

  return linhas.join('\n')
}
