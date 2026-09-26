import * as XLSX from 'xlsx'
import type { Aluno, Categoria, Lancamento } from '@/types'

/**
 * Interface que representa os dados extraídos de uma linha da planilha
 */
export interface LinhaPlanilhaBruta {
  [chave: string]: unknown
}

export interface LinhaImportacaoValidada {
  linhaNumero: number
  // Identificador único da linha no lote
  idLinhaLote: string
  // Dados do aluno
  nome: string
  matricula: string
  turno: 'Matutino' | 'Vespertino' | 'Noturno' | 'Especial'
  semestreAtual: number
  periodoEntrada: string
  email: string
  // Dados do lançamento
  categoriaTexto: string
  categoriaIdCorrespondente?: string
  categoriaNomeOficial?: string
  horas: number
  dataLancamento: string // ISO yyyy-mm-dd
  semestreAtividade: string // ex: 2024.1, 2024.2, 2025.1, 2025.2, 2026.1
  semestreFallbackUtilizado: boolean // true se a linha não informou semestre e assumiu o padrão
  observacao: string
  // Status de validação
  status: 'valida' | 'aviso' | 'erro'
  erros: string[]
  avisos: string[]
  // Status de deduplicação
  isDuplicado?: boolean
  chaveDeducao?: string
  // Identificação do aluno já existente no banco
  alunoExistenteId?: string
  // Saldo total declarado para o aluno se presente nesta linha
  saldoDeclaradoLinha?: number
  // Saldos por categoria declarados nesta linha se houver
  saldosPorCategoriaDeclarados?: Record<string, number>
}

export interface ConfiguracaoDetectadaPlanilha {
  semestreLetivoAtual?: string
  minimoExigidoSemestre?: number
  metaCurso?: number
  categorias: Array<{
    nome: string
    regraHoras: string
    tetoMaximo: number
  }>
}

export interface ResumoValidacao {
  totalLinhasLidas: number
  linhasValidas: number
  linhasComErro: number
  linhasComAviso: number
  alunosUnicos: number
  alunosNovos: number
  alunosExistentes: number
  totalLancamentosValidos: number
  totalHorasValidas: number
  lancamentosDuplicadosIgnorados: number
  categoriasNaoEncontradas: { [categoriaTexto: string]: number }
  linhasComSemestreFallback: number
  configDetectada?: ConfiguracaoDetectadaPlanilha
  origemSaldoDeclarado?: 'aba_lancamentos' | 'aba_painel_turma' | 'nenhuma'
}

export type StatusConciliacao = 'CONCILIADO' | 'DIVERGENTE' | 'SEM_REFERENCIA'

export interface ConciliacaoCategoriaDetalhamento {
  categoriaId: string
  categoriaNome: string
  horasBancoAtual: number
  horasLote: number
  horasProjetadas: number
  horasDeclaradas?: number
  diferenca?: number
}

export interface ConciliacaoAluno {
  matricula: string
  nome: string
  turno: 'Matutino' | 'Vespertino' | 'Noturno' | 'Especial'
  semestreAtual: number
  periodoEntrada: string
  email: string
  alunoExistenteId?: string
  // Métricas de horas
  horasLote: number
  saldoBancoAtual: number
  saldoProjetado: number
  saldoDeclarado?: number // undefined se a planilha não trouxer total
  origemSaldoDeclarado?: 'aba_lancamentos' | 'aba_painel_turma' | 'nenhuma'
  diferenca?: number // saldoProjetado - saldoDeclarado
  statusConciliacao: StatusConciliacao
  // Detalhamento por categoria
  categorias: ConciliacaoCategoriaDetalhamento[]
  // IDs das linhas do lote vinculadas a este aluno
  idsLinhasLote: string[]
  // Quantidade de linhas ativas no lote
  totalLinhasAtivas: number
  // Linhas que utilizaram semestre fallback
  linhasComFallbackSemestre: number
}

export interface ResumoConciliacao {
  totalAlunos: number
  totalConciliados: number
  totalDivergentes: number
  totalSemReferencia: number
  totalHorasLote: number
  totalHorasBancoAtuais: number
  totalHorasProjetadas: number
}

export interface ResultadoEfetivacaoImportacao {
  alunosCriados: number
  alunosAtualizados: number
  lancamentosCriados: number
  lancamentosIgnoradosDuplicados: number
  errosAoGravar: Array<{ linhaNumero: number; item: string; motivo: string }>
  // Auditoria de conciliação no momento da consolidação
  totalAlunosConciliadosNoMomento: number
  totalAlunosDivergentesNoMomento: number
  totalAlunosSemReferenciaNoMomento: number
}

/**
 * Normaliza strings para comparação tolerante (remove acentos, pontuação, múltiplos espaços e lowercase)
 */
export function normalizarChave(texto: string): string {
  if (!texto) return ''
  return texto
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

/**
 * Mapeamento tolerante de colunas para chaves lógicas
 */
/**
 * Normaliza e valida um semestre letivo (ex: '2024.1', '2024/1', '2024-1', '2024.2', '2025.1', '2025.2', '2026.1')
 * Retorna no formato canônico YYYY.[1|2] ou null se inválido
 */
export function normalizarSemestreLetivo(valor: unknown): string | null {
  if (!valor) return null
  const str = String(valor).trim()
  if (!str) return null

  // 1. Já no formato padrão 2024.1, 2025.2, etc.
  const matchPadrao = str.match(/\b(20\d{2})[./\-_ ]?([12])\b/)
  if (matchPadrao) {
    const ano = matchPadrao[1]
    const sem = matchPadrao[2]
    return `${ano}.${sem}`
  }

  // 2. Formato inverso: 1/2024 ou 2º/2025
  const matchInverso = str.match(/\b([12])(?:º|o)?[./\-_ ]?(20\d{2})\b/i)
  if (matchInverso) {
    const sem = matchInverso[1]
    const ano = matchInverso[2]
    return `${ano}.${sem}`
  }

  // 3. Formato com texto: "2024 1º semestre" ou "2024 2 sem"
  const matchExtenso = str.match(/(20\d{2}).*?([12])(?:º|o)?\s*(?:sem|semestre|termo|periodo)?/i)
  if (matchExtenso) {
    return `${matchExtenso[1]}.${matchExtenso[2]}`
  }

  return null
}

/**
 * Converte valor numérico de horas/saldos da planilha (trata vírgula, texto, etc.)
 */
export function converterParaNumero(valor: unknown): number {
  if (valor === null || valor === undefined || valor === '') return 0
  if (typeof valor === 'number') return isNaN(valor) ? 0 : valor
  const str = String(valor)
    .trim()
    .replace(',', '.')
    .replace(/[^\d.-]/g, '')
  const num = parseFloat(str)
  return isNaN(num) ? 0 : num
}

/**
 * Mapeamento tolerante de colunas para chaves lógicas
 */
export function identificarColunas(colunasReais: string[]): Record<string, string> {
  const mapa: Record<string, string> = {}

  colunasReais.forEach((col) => {
    const limpo = normalizarChave(col)

    // Coluna específica de Semestre Letivo da Atividade
    // Reconhece variações: "Semestre", "Período", "Semestre Letivo", "Ano/Período", "Semestre Atividade", etc.
    const isSemestreAtividade =
      limpo === 'semestreletivoatividade' ||
      limpo === 'semestreatividade' ||
      limpo === 'semestreletivo' ||
      limpo === 'semestreletivodaatividade' ||
      limpo === 'anoperiodo' ||
      limpo === 'periodoletivo' ||
      limpo === 'semestredocertificado' ||
      limpo === 'periodoatividade' ||
      limpo === 'semestrecursado' ||
      limpo === 'semestredarealizacao'

    // Coluna específica de Saldo Declarado na Planilha
    const isSaldoDeclarado =
      limpo === 'total' ||
      limpo === 'totalgeral' ||
      limpo === 'totalgeralacumulado' ||
      limpo === 'horastotais' ||
      limpo === 'saldototal' ||
      limpo === 'totalhoras' ||
      limpo === 'saldodeclarado' ||
      limpo === 'totaldeclarado' ||
      limpo === 'totalacumulado' ||
      limpo === 'horascumpridas' ||
      limpo === 'totaldehoras'

    if (isSaldoDeclarado) {
      if (!mapa['saldoDeclarado']) mapa['saldoDeclarado'] = col
    } else if (isSemestreAtividade) {
      if (!mapa['semestreAtividade']) mapa['semestreAtividade'] = col
    } else if (
      limpo === 'matricula' ||
      limpo === 'ra' ||
      limpo === 'codaluno' ||
      limpo === 'codigo' ||
      limpo === 'registro' ||
      limpo.includes('matric')
    ) {
      if (!mapa['matricula']) mapa['matricula'] = col
    } else if (
      limpo === 'nome' ||
      limpo === 'aluno' ||
      limpo === 'estudante' ||
      limpo === 'nomealuno' ||
      limpo === 'nomedoaluno' ||
      limpo === 'nomecompleto'
    ) {
      if (!mapa['nome']) mapa['nome'] = col
    } else if (limpo === 'turno' || limpo.startsWith('turno')) {
      if (!mapa['turno']) mapa['turno'] = col
    } else if (
      limpo === 'semestreatual' ||
      limpo === 'termo' ||
      limpo === 'etapa' ||
      limpo === 'serie'
    ) {
      if (!mapa['semestreAtual']) mapa['semestreAtual'] = col
    } else if (
      limpo === 'entrada' ||
      limpo === 'periodoentrada' ||
      limpo === 'semestreentrada' ||
      limpo === 'anoentrada' ||
      limpo === 'turma'
    ) {
      if (!mapa['periodoEntrada']) mapa['periodoEntrada'] = col
    } else if (
      limpo === 'email' ||
      limpo === 'emailaluno' ||
      limpo === 'correio' ||
      limpo === 'contato'
    ) {
      if (!mapa['email']) mapa['email'] = col
    } else if (
      limpo === 'categoria' ||
      limpo === 'tipo' ||
      limpo === 'tipoatividade' ||
      limpo === 'categoriaatividade' ||
      limpo === 'modalidade'
    ) {
      if (!mapa['categoria']) mapa['categoria'] = col
    } else if (
      limpo === 'horas' ||
      limpo === 'horasaceitas' ||
      limpo === 'cargahoraria' ||
      limpo === 'ch' ||
      limpo === 'qtdhoras' ||
      limpo === 'quantidadehoras' ||
      limpo === 'horascomputadas'
    ) {
      if (!mapa['horas']) mapa['horas'] = col
    } else if (
      limpo === 'data' ||
      limpo === 'datalancamento' ||
      limpo === 'dataevento' ||
      limpo === 'dataatividade'
    ) {
      if (!mapa['data']) mapa['data'] = col
    } else if (limpo.includes('comprovante') || limpo.includes('comprovanteok')) {
      if (!mapa['comprovante']) mapa['comprovante'] = col
    } else if (limpo.includes('relatorio') || limpo.includes('relatoriook')) {
      if (!mapa['relatorio']) mapa['relatorio'] = col
    } else if (limpo === 'semestre' || limpo === 'periodo' || limpo === 'anoperiodo') {
      // Se não foi pego como semestreAtividade e nem semestreAtual
      if (!mapa['semestreAtividade']) {
        mapa['semestreAtividade'] = col
      } else if (!mapa['semestreAtual']) {
        mapa['semestreAtual'] = col
      }
    } else if (limpo === 'atividade') {
      if (!mapa['categoria']) mapa['categoria'] = col
    } else if (
      limpo === 'observacao' ||
      limpo === 'obs' ||
      limpo === 'descricao' ||
      limpo === 'historico' ||
      limpo === 'titulo' ||
      limpo === 'certificado' ||
      limpo === 'detalhes'
    ) {
      if (!mapa['observacao']) mapa['observacao'] = col
    }
  })

  return mapa
}

/**
 * Detecta e extrai parâmetros e categorias da aba "Config Tabela" (ex: "Config Tabela 2026.2")
 */
export function extrairConfigTabelaWorksheet(
  worksheet: XLSX.WorkSheet,
): ConfiguracaoDetectadaPlanilha | null {
  const matriz = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    defval: '',
    blankrows: false,
  })

  if (!matriz || matriz.length === 0) return null

  let semestreLetivoAtual: string | undefined
  let minimoExigidoSemestre: number | undefined
  let metaCurso: number | undefined
  const categorias: Array<{
    nome: string
    regraHoras: string
    tetoMaximo: number
  }> = []

  let lendoTabelaCategorias = false

  for (const linha of matriz) {
    if (!Array.isArray(linha)) continue
    const colA = String(linha[0] ?? '').trim()
    const colB = linha[1]
    const colC = linha[2]
    const normA = normalizarChave(colA)

    if (normA.includes('semestreletivoatual')) {
      const sem = normalizarSemestreLetivo(colB)
      if (sem) semestreLetivoAtual = sem
      continue
    }

    if (normA.includes('minimoexigidoporsemestre') || normA.includes('minimoexigido')) {
      const minNum = converterParaNumero(colB)
      if (minNum > 0) minimoExigidoSemestre = minNum
      continue
    }

    if (normA.includes('metadocurso') || normA.includes('metacurso')) {
      const metaNum = converterParaNumero(colB)
      if (metaNum > 0) metaCurso = metaNum
      continue
    }

    // Identificar cabeçalho da tabela de categorias: "Categoria" | "Horas por atividade" | "Máximo do curso"
    if (
      (normA === 'categoria' || normA.startsWith('categoria')) &&
      (normalizarChave(String(colB)).includes('horas') ||
        normalizarChave(String(colC)).includes('maximo'))
    ) {
      lendoTabelaCategorias = true
      continue
    }

    if (lendoTabelaCategorias) {
      if (normA.startsWith('nota') || normA.includes('editeapenas') || !colA) {
        // Encerrou tabela de categorias
        lendoTabelaCategorias = false
        continue
      }

      // Linha de categoria
      const nomeCat = colA
      const regraHoras = String(colB ?? '').trim()
      const tetoNum = converterParaNumero(colC)

      if (nomeCat && tetoNum > 0) {
        categorias.push({
          nome: nomeCat,
          regraHoras: regraHoras || `${tetoNum}h no curso`,
          tetoMaximo: tetoNum,
        })
      }
    }
  }

  if (!semestreLetivoAtual && !minimoExigidoSemestre && !metaCurso && categorias.length === 0) {
    return null
  }

  return {
    semestreLetivoAtual,
    minimoExigidoSemestre,
    metaCurso,
    categorias,
  }
}

/**
 * Converte uma folha de cálculo (Worksheet) em lista de objetos tolerando banners
 * na linha 1 (ou primeiras linhas) e detectando automaticamente onde está a linha de cabeçalho.
 */
export function extrairLinhasComCabecalhoInteligente(
  worksheet: XLSX.WorkSheet,
  colunasEsperadas: string[],
): {
  linhas: LinhaPlanilhaBruta[]
  linhaCabecalhoIdx: number // 0-based
  cabecalhos: string[]
} {
  const matriz = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    defval: '',
    blankrows: false,
  })

  if (!matriz || matriz.length === 0) {
    return { linhas: [], linhaCabecalhoIdx: -1, cabecalhos: [] }
  }

  const setEsperados = new Set(colunasEsperadas.map((c) => normalizarChave(c)))

  // Percorre as primeiras linhas (até 15) buscando a linha com mais correspondências de cabeçalho
  let melhorLinhaIdx = 0
  let maxMatches = 0

  const limiteBusca = Math.min(15, matriz.length)
  for (let i = 0; i < limiteBusca; i++) {
    const linha = matriz[i]
    if (!Array.isArray(linha)) continue

    let matches = 0
    linha.forEach((celula) => {
      if (!celula) return
      const limpo = normalizarChave(String(celula))
      if (!limpo) return

      if (setEsperados.has(limpo)) {
        matches++
        return
      }
      // Checagem parcial para cabeçalhos compostos (ex: "comprovanteoksimnao" contendo "comprovante")
      for (const esp of setEsperados) {
        if (limpo.includes(esp) || esp.includes(limpo)) {
          matches++
          break
        }
      }
    })

    if (matches > maxMatches) {
      maxMatches = matches
      melhorLinhaIdx = i
    }
  }

  // Se não encontrou nenhuma correspondência específica, usa a linha 0
  if (maxMatches === 0) {
    melhorLinhaIdx = 0
  }

  const linhaCabecalho = (matriz[melhorLinhaIdx] || []) as unknown[]
  const cabecalhos: string[] = []
  const contadores: Record<string, number> = {}

  linhaCabecalho.forEach((col, idx) => {
    let colNome = String(col ?? '').trim()
    if (!colNome) {
      colNome = `coluna_${idx + 1}`
    }
    if (contadores[colNome] !== undefined) {
      contadores[colNome]++
      colNome = `${colNome}_${contadores[colNome]}`
    } else {
      contadores[colNome] = 0
    }
    cabecalhos.push(colNome)
  })

  const linhas: LinhaPlanilhaBruta[] = []
  for (let i = melhorLinhaIdx + 1; i < matriz.length; i++) {
    const linhaDados = matriz[i] as unknown[]
    if (!Array.isArray(linhaDados)) continue

    const obj: LinhaPlanilhaBruta = {}
    let temConteudo = false

    cabecalhos.forEach((cab, idx) => {
      const val = linhaDados[idx] ?? ''
      obj[cab] = val
      if (val !== '' && val !== null && val !== undefined) {
        temConteudo = true
      }
    })

    if (temConteudo) {
      linhas.push(obj)
    }
  }

  return {
    linhas,
    linhaCabecalhoIdx: melhorLinhaIdx,
    cabecalhos,
  }
}

/**
 * Tenta casar uma string de categoria lida da planilha com a categoria do NDE
 */
export function encontrarCategoriaCorrespondente(
  categoriaTexto: string,
  categoriasNde: Categoria[],
): Categoria | undefined {
  if (!categoriaTexto) return undefined
  const catNormalizada = normalizarChave(categoriaTexto)

  // 1. Casamento exato normalizado
  const exata = categoriasNde.find((c) => normalizarChave(c.nome) === catNormalizada)
  if (exata) return exata

  // 2. Casamento por contenção ou palavras-chave comuns
  for (const c of categoriasNde) {
    const nomeNorm = normalizarChave(c.nome)
    if (nomeNorm.includes(catNormalizada) || catNormalizada.includes(nomeNorm)) {
      return c
    }
  }

  // 3. Palavras-chave específicas da FAUSP Psicologia
  if (
    catNormalizada.includes('artes') ||
    catNormalizada.includes('cultura') ||
    catNormalizada.includes('cinema') ||
    catNormalizada.includes('museu')
  ) {
    return categoriasNde.find((c) => normalizarChave(c.nome).includes('artes'))
  }
  if (
    catNormalizada.includes('iniciacao') ||
    catNormalizada.includes('pibic') ||
    catNormalizada.includes('pesquisa')
  ) {
    return categoriasNde.find((c) => normalizarChave(c.nome).includes('iniciacao'))
  }
  if (catNormalizada.includes('estagio') || catNormalizada.includes('extracurricular')) {
    return categoriasNde.find((c) => normalizarChave(c.nome).includes('estagio'))
  }
  if (
    catNormalizada.includes('evento') ||
    catNormalizada.includes('congresso') ||
    catNormalizada.includes('simposio') ||
    catNormalizada.includes('apresentacao')
  ) {
    return categoriasNde.find((c) => normalizarChave(c.nome).includes('evento'))
  }
  if (
    catNormalizada.includes('curso') ||
    catNormalizada.includes('extensao') ||
    catNormalizada.includes('livre') ||
    catNormalizada.includes('online')
  ) {
    return categoriasNde.find((c) => normalizarChave(c.nome).includes('curso'))
  }

  return undefined
}

/**
 * Calcula a conciliação de saldos aluno por aluno comparando o saldo atual no banco,
 * as horas ativas a importar no lote, o saldo projetado pós-importação e o saldo declarado na planilha.
 */
export function calcularConciliacaoSaldos(params: {
  linhasLote: LinhaImportacaoValidada[]
  idsLinhasExcluidas?: Set<string>
  alunosExistentes: Aluno[]
  lancamentosExistentes: Lancamento[]
  categoriasNde: Categoria[]
  saldosDeclaradosPainelTurma?: Map<string, number>
}): {
  alunosConciliacao: ConciliacaoAluno[]
  resumo: ResumoConciliacao
} {
  const {
    linhasLote,
    idsLinhasExcluidas = new Set<string>(),
    alunosExistentes,
    lancamentosExistentes,
    categoriasNde,
    saldosDeclaradosPainelTurma = new Map<string, number>(),
  } = params

  // Mapeamentos de suporte
  const alunoPorMatricula = new Map<string, Aluno>()
  alunosExistentes.forEach((a) => alunoPorMatricula.set(a.matricula.trim().toUpperCase(), a))

  // Agrupamento de lançamentos existentes por alunoId -> categoriaId -> totalHoras
  const saldoExistentePorAlunoECat = new Map<string, Map<string, number>>()
  const saldoExistenteTotalPorAluno = new Map<string, number>()

  lancamentosExistentes.forEach((l) => {
    const alunoId = l.aluno_id
    const catId = l.categoria_id
    const horas = Number(l.horas_aceitas) || 0

    // Por categoria
    if (!saldoExistentePorAlunoECat.has(alunoId)) {
      saldoExistentePorAlunoECat.set(alunoId, new Map<string, number>())
    }
    const mapaCat = saldoExistentePorAlunoECat.get(alunoId)!
    mapaCat.set(catId, (mapaCat.get(catId) || 0) + horas)

    // Total
    saldoExistenteTotalPorAluno.set(
      alunoId,
      (saldoExistenteTotalPorAluno.get(alunoId) || 0) + horas,
    )
  })

  // Agrupamento das linhas da planilha por aluno (matrícula)
  const linhasPorAluno = new Map<string, LinhaImportacaoValidada[]>()
  linhasLote.forEach((linha) => {
    if (!linha.matricula) return
    const mat = linha.matricula.trim().toUpperCase()
    if (!linhasPorAluno.has(mat)) {
      linhasPorAluno.set(mat, [])
    }
    linhasPorAluno.get(mat)!.push(linha)
  })

  const listaConciliacao: ConciliacaoAluno[] = []
  let totalConciliados = 0
  let totalDivergentes = 0
  let totalSemReferencia = 0
  let totalHorasLote = 0
  let totalHorasBancoAtuais = 0
  let totalHorasProjetadas = 0

  for (const [matricula, linhasDoAluno] of linhasPorAluno) {
    const primeiraLinha = linhasDoAluno[0]
    const alunoExistente = alunoPorMatricula.get(matricula)
    const alunoId = alunoExistente?.id

    const saldoBancoAtual = alunoId ? saldoExistenteTotalPorAluno.get(alunoId) || 0 : 0

    // Filtra apenas linhas que NÃO foram excluídas pelo usuário do lote, que não têm erro fatal e não são duplicadas
    const linhasAtivas = linhasDoAluno.filter(
      (l) =>
        !idsLinhasExcluidas.has(l.idLinhaLote) &&
        l.status !== 'erro' &&
        !l.isDuplicado &&
        l.categoriaIdCorrespondente,
    )

    const horasLoteAluno = linhasAtivas.reduce((acc, curr) => acc + (Number(curr.horas) || 0), 0)
    const saldoProjetado = saldoBancoAtual + horasLoteAluno

    // Verifica se a planilha trouxe saldo declarado para este aluno
    // Pode vir na coluna de total (saldoDeclaradoLinha) da aba Lançamentos
    // ou pela aba Painel por Turma (casando por matrícula)
    let saldoDeclarado: number | undefined = undefined
    let origemSaldoDeclarado: 'aba_lancamentos' | 'aba_painel_turma' | 'nenhuma' = 'nenhuma'

    for (const l of linhasDoAluno) {
      if (l.saldoDeclaradoLinha !== undefined && !isNaN(l.saldoDeclaradoLinha)) {
        saldoDeclarado = l.saldoDeclaradoLinha
        origemSaldoDeclarado = 'aba_lancamentos'
        break
      }
    }

    if (saldoDeclarado === undefined && saldosDeclaradosPainelTurma.has(matricula)) {
      saldoDeclarado = saldosDeclaradosPainelTurma.get(matricula)
      origemSaldoDeclarado = 'aba_painel_turma'
    }

    // Status de conciliação
    let statusConciliacao: StatusConciliacao = 'SEM_REFERENCIA'
    let diferenca: number | undefined = undefined

    if (saldoDeclarado !== undefined) {
      // Arredondamento para evitar problemas de ponto flutuante em comparações decimais
      const dif = Math.round((saldoProjetado - saldoDeclarado) * 100) / 100
      diferenca = dif
      if (Math.abs(dif) < 0.001) {
        statusConciliacao = 'CONCILIADO'
        totalConciliados++
      } else {
        statusConciliacao = 'DIVERGENTE'
        totalDivergentes++
      }
    } else {
      totalSemReferencia++
    }

    // Detalhamento por categoria NDE
    const mapaHorasLotePorCat = new Map<string, number>()
    linhasAtivas.forEach((l) => {
      if (l.categoriaIdCorrespondente) {
        mapaHorasLotePorCat.set(
          l.categoriaIdCorrespondente,
          (mapaHorasLotePorCat.get(l.categoriaIdCorrespondente) || 0) + (Number(l.horas) || 0),
        )
      }
    })

    const categoriasDetalhadas: ConciliacaoCategoriaDetalhamento[] = categoriasNde
      .filter((cat) => {
        const temNoBanco = alunoId
          ? (saldoExistentePorAlunoECat.get(alunoId)?.get(cat.id) || 0) > 0
          : false
        const temNoLote = (mapaHorasLotePorCat.get(cat.id) || 0) > 0
        return temNoBanco || temNoLote
      })
      .map((cat) => {
        const hBanco = alunoId ? saldoExistentePorAlunoECat.get(alunoId)?.get(cat.id) || 0 : 0
        const hLote = mapaHorasLotePorCat.get(cat.id) || 0
        const hProj = hBanco + hLote
        return {
          categoriaId: cat.id,
          categoriaNome: cat.nome,
          horasBancoAtual: hBanco,
          horasLote: hLote,
          horasProjetadas: hProj,
        }
      })

    const linhasComFallbackSemestre = linhasDoAluno.filter(
      (l) => l.semestreFallbackUtilizado && !idsLinhasExcluidas.has(l.idLinhaLote),
    ).length

    totalHorasLote += horasLoteAluno
    totalHorasBancoAtuais += saldoBancoAtual
    totalHorasProjetadas += saldoProjetado

    listaConciliacao.push({
      matricula,
      nome: primeiraLinha.nome,
      turno: primeiraLinha.turno,
      semestreAtual: primeiraLinha.semestreAtual,
      periodoEntrada: primeiraLinha.periodoEntrada,
      email: primeiraLinha.email,
      alunoExistenteId: alunoId,
      horasLote: horasLoteAluno,
      saldoBancoAtual,
      saldoProjetado,
      saldoDeclarado,
      origemSaldoDeclarado,
      diferenca,
      statusConciliacao,
      categorias: categoriasDetalhadas,
      idsLinhasLote: linhasDoAluno.map((l) => l.idLinhaLote),
      totalLinhasAtivas: linhasAtivas.length,
      linhasComFallbackSemestre,
    })
  }

  // Ordena prioritariamente os divergentes, depois sem referência e por fim conciliados
  listaConciliacao.sort((a, b) => {
    const peso = { DIVERGENTE: 0, SEM_REFERENCIA: 1, CONCILIADO: 2 }
    if (peso[a.statusConciliacao] !== peso[b.statusConciliacao]) {
      return peso[a.statusConciliacao] - peso[b.statusConciliacao]
    }
    return a.nome.localeCompare(b.nome)
  })

  const resumo: ResumoConciliacao = {
    totalAlunos: listaConciliacao.length,
    totalConciliados,
    totalDivergentes,
    totalSemReferencia,
    totalHorasLote,
    totalHorasBancoAtuais,
    totalHorasProjetadas,
  }

  return {
    alunosConciliacao: listaConciliacao,
    resumo,
  }
}

/**
 * Converte data da planilha (que pode ser número serial do Excel, Date, ou string no formato BR / ISO) para YYYY-MM-DD
 */
export function converterDataParaIso(valor: unknown): string {
  if (!valor) {
    const hoje = new Date()
    return hoje.toISOString().split('T')[0]
  }

  // Serial Excel
  if (typeof valor === 'number') {
    // Dias desde 1900-01-01 menos ajuste de leap year de 1900
    const dataJs = new Date(Math.round((valor - 25569) * 86400 * 1000))
    if (!isNaN(dataJs.getTime())) {
      return dataJs.toISOString().split('T')[0]
    }
  }

  if (valor instanceof Date && !isNaN(valor.getTime())) {
    return valor.toISOString().split('T')[0]
  }

  const str = String(valor).trim()

  // Formato BR DD/MM/AAAA ou DD-MM-AAAA
  const brMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (brMatch) {
    const dia = brMatch[1].padStart(2, '0')
    const mes = brMatch[2].padStart(2, '0')
    const ano = brMatch[3]
    return `${ano}-${mes}-${dia}`
  }

  // Formato ISO YYYY-MM-DD ou ISO datetime com timestamp/fuso (ex: 2026-10-04T03:06:28.000Z)
  const isoMatch = str.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/)
  if (isoMatch) {
    const ano = isoMatch[1]
    const mes = isoMatch[2].padStart(2, '0')
    const dia = isoMatch[3].padStart(2, '0')
    return `${ano}-${mes}-${dia}`
  }

  // Tentar Date.parse para outros formatos de string válidos
  const parsedDate = new Date(str)
  if (!isNaN(parsedDate.getTime())) {
    return parsedDate.toISOString().split('T')[0]
  }

  return new Date().toISOString().split('T')[0]
}

/**
 * Gera chave única para identificar dedup de lançamento
 * Chave: matricula|categoria_id|data_ou_semestre|horas
 */
export function gerarChaveDeducao(
  matricula: string,
  categoriaId: string,
  dataOuSemestre: string,
  horas: number,
): string {
  const matLimpa = matricula.trim().toUpperCase()
  return `${matLimpa}|${categoriaId}|${dataOuSemestre}|${horas}`
}

/**
 * Lê o arquivo ArrayBuffer do Excel e faz a validação completa linha a linha
 */
export function processarPlanilhaExcel(params: {
  arquivoBuffer: ArrayBuffer
  alunosExistentes: Aluno[]
  categoriasNde: Categoria[]
  lancamentosExistentes: Lancamento[]
  semestreAtualPadrao: string
  mapeamentoManualCategorias?: Record<string, string> // textoPlanilha -> categoriaId
}): {
  linhas: LinhaImportacaoValidada[]
  resumo: ResumoValidacao
  nomeAbaUsada: string
  colunasIdentificadas: Record<string, string>
  saldosDeclaradosPainelTurma: Map<string, number>
  configDetectada: ConfiguracaoDetectadaPlanilha | null
} {
  const {
    arquivoBuffer,
    alunosExistentes,
    categoriasNde,
    lancamentosExistentes,
    semestreAtualPadrao,
    mapeamentoManualCategorias = {},
  } = params

  const workbook = XLSX.read(arquivoBuffer, { type: 'array', cellDates: true })
  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('A planilha está vazia ou não contém abas válidas.')
  }

  // 1. Identificar abas no workbook multi-aba
  let abaLancamentosNome = workbook.SheetNames.find((nome) => {
    const n = normalizarChave(nome)
    return n.includes('lancamento') || n.includes('atividade')
  })

  let abaAlunosNome = workbook.SheetNames.find((nome) => {
    const n = normalizarChave(nome)
    return n.includes('aluno') && !n.includes('painel')
  })

  let abaPainelTurmaNome = workbook.SheetNames.find((nome) => {
    const n = normalizarChave(nome)
    return n.includes('painelporturma') || (n.includes('turma') && n.includes('painel'))
  })

  const abaConfigNome = workbook.SheetNames.find((nome) => {
    const n = normalizarChave(nome)
    return n.includes('config') || n.includes('tabela')
  })

  // Se não encontrou abas nomeadas "Lançamentos", verificar a primeira aba
  if (!abaLancamentosNome) {
    abaLancamentosNome = workbook.SheetNames[0]
  }

  // Extrair configurações detectadas da aba Config Tabela (se existir)
  let configDetectada: ConfiguracaoDetectadaPlanilha | null = null
  if (abaConfigNome && workbook.Sheets[abaConfigNome]) {
    configDetectada = extrairConfigTabelaWorksheet(workbook.Sheets[abaConfigNome])
  }

  // 2. Extrair mapa de alunos da aba "Alunos" (se existir)
  // Cabeçalhos esperados: Nome, Matrícula, Turno, Semestre atual, Entrada, E-mail
  interface DadosCadastroAlunoPlanilha {
    nome: string
    matricula: string
    turno: 'Matutino' | 'Vespertino' | 'Noturno' | 'Especial'
    semestreAtual: number
    periodoEntrada: string
    email: string
  }
  const cadastroAlunosMap = new Map<string, DadosCadastroAlunoPlanilha>()

  if (abaAlunosNome && workbook.Sheets[abaAlunosNome]) {
    const extraidoAlunos = extrairLinhasComCabecalhoInteligente(workbook.Sheets[abaAlunosNome], [
      'nome',
      'matricula',
      'turno',
      'semestreatual',
      'entrada',
      'email',
    ])
    const mapaColAlunos = identificarColunas(extraidoAlunos.cabecalhos)

    extraidoAlunos.linhas.forEach((r) => {
      const matRaw = String(r[mapaColAlunos['matricula'] || 'matricula'] ?? '')
        .trim()
        .toUpperCase()
      const nomeRaw = String(r[mapaColAlunos['nome'] || 'nome'] ?? '').trim()
      if (!matRaw && !nomeRaw) return

      const turnoRaw = String(r[mapaColAlunos['turno'] || 'turno'] ?? '')
      let turno: 'Matutino' | 'Vespertino' | 'Noturno' | 'Especial' = 'Matutino'
      const turnoStr = normalizarChave(turnoRaw)
      if (turnoStr.includes('especial') || turnoStr === 'esp' || turnoStr === 'e') {
        turno = 'Especial'
      } else if (turnoStr.includes('vesp') || turnoStr.includes('tarde') || turnoStr === 'v') {
        turno = 'Vespertino'
      } else if (turnoStr.includes('not') || turnoStr.includes('noite') || turnoStr === 'n') {
        turno = 'Noturno'
      } else if (turnoStr.includes('mat') || turnoStr.includes('manha') || turnoStr === 'm') {
        turno = 'Matutino'
      }

      // Semestre atual (ordinal "1º", "3º" etc.)
      const semRaw = String(r[mapaColAlunos['semestreAtual'] || 'semestre'] ?? '').trim()
      let semestreAtual = 1
      const ordMatch = semRaw.match(/^(\d{1,2})(?:º|ª|o|a)?$/i)
      if (ordMatch) {
        const parsed = parseInt(ordMatch[1], 10)
        if (parsed >= 1 && parsed <= 10) semestreAtual = parsed
      } else {
        const parsed = parseInt(semRaw.replace(/\D/g, ''), 10)
        if (!isNaN(parsed) && parsed >= 1 && parsed <= 10) semestreAtual = parsed
      }

      const periodoEntrada = String(r[mapaColAlunos['periodoEntrada'] || 'entrada'] ?? '').trim()
      const emailRaw = String(r[mapaColAlunos['email'] || 'email'] ?? '').trim()

      cadastroAlunosMap.set(matRaw, {
        nome: nomeRaw,
        matricula: matRaw,
        turno,
        semestreAtual,
        periodoEntrada,
        email: emailRaw,
      })
    })
  }

  // 3. Extrair mapa de saldos da aba "Painel por Turma" (se existir)
  // Cabeçalhos esperados: Nome | Turno | Semestre atual | Entrada | Total geral acumulado | Horas do semestre atual | ...
  const saldosDeclaradosPainelTurma = new Map<string, number>()
  if (abaPainelTurmaNome && workbook.Sheets[abaPainelTurmaNome]) {
    const extraidoTurma = extrairLinhasComCabecalhoInteligente(
      workbook.Sheets[abaPainelTurmaNome],
      [
        'nome',
        'matricula',
        'turno',
        'semestreatual',
        'entrada',
        'totalgeralacumulado',
        'totalgeral',
        'total',
      ],
    )
    const mapaColTurma = identificarColunas(extraidoTurma.cabecalhos)
    const colTotalTurma =
      mapaColTurma['saldoDeclarado'] ||
      extraidoTurma.cabecalhos.find((c) => normalizarChave(c).includes('totalgeral')) ||
      extraidoTurma.cabecalhos.find((c) => normalizarChave(c).includes('acumulado'))

    // Mapeamento auxiliar de Aluno por Nome caso a aba Painel por Turma não tenha coluna Matrícula explícita
    const alunoPorNomeMap = new Map<string, string>() // nomeNorm -> matricula
    cadastroAlunosMap.forEach((dados, mat) => {
      alunoPorNomeMap.set(normalizarChave(dados.nome), mat)
    })
    alunosExistentes.forEach((a) => {
      alunoPorNomeMap.set(normalizarChave(a.nome), a.matricula.trim().toUpperCase())
    })

    extraidoTurma.linhas.forEach((r) => {
      const matRaw = String(r[mapaColTurma['matricula'] || 'matricula'] ?? '')
        .trim()
        .toUpperCase()
      const nomeRaw = String(r[mapaColTurma['nome'] || 'nome'] ?? '').trim()
      const totalRaw = colTotalTurma ? r[colTotalTurma] : undefined
      const totalNum = converterParaNumero(totalRaw)

      let matriculaEfetiva = matRaw
      if (!matriculaEfetiva && nomeRaw) {
        matriculaEfetiva = alunoPorNomeMap.get(normalizarChave(nomeRaw)) || ''
      }

      if (matriculaEfetiva) {
        saldosDeclaradosPainelTurma.set(matriculaEfetiva, totalNum)
      }
    })
  }

  // 4. Extrair linhas da aba de lançamentos (com detecção inteligente de cabeçalhos)
  const worksheetLancamentos = workbook.Sheets[abaLancamentosNome]
  if (!worksheetLancamentos) {
    throw new Error(`Aba de lançamentos "${abaLancamentosNome}" não encontrada na planilha.`)
  }

  const extraidoLancamentos = extrairLinhasComCabecalhoInteligente(worksheetLancamentos, [
    'data',
    'matricula',
    'nome',
    'semestreletivodaatividade',
    'semestreletivo',
    'categoria',
    'horasaceitas',
    'horas',
    'comprovante',
    'relatorio',
    'observacao',
    'totalgeralacumulado',
  ])

  const linhasBrutas = extraidoLancamentos.linhas
  if (!linhasBrutas || linhasBrutas.length === 0) {
    throw new Error(`Nenhuma linha de dados encontrada na aba "${abaLancamentosNome}".`)
  }

  const colunasReais = extraidoLancamentos.cabecalhos
  const mapaColunas = identificarColunas(colunasReais)

  // Conjunto de chaves existentes no banco para deduplicação rápida
  const setChavesBanco = new Set<string>()
  const mapAlunosPorId = new Map<string, Aluno>()
  alunosExistentes.forEach((a) => mapAlunosPorId.set(a.id, a))
  const mapAlunosPorMatricula = new Map<string, Aluno>()
  alunosExistentes.forEach((a) => {
    mapAlunosPorMatricula.set(a.matricula.trim().toUpperCase(), a)
  })

  lancamentosExistentes.forEach((l) => {
    const aluno = mapAlunosPorId.get(l.aluno_id)
    if (aluno) {
      const dataStr = l.data_lancamento
        ? l.data_lancamento.split('T')[0]
        : l.semestre_letivo_atividade
      setChavesBanco.add(
        gerarChaveDeducao(aluno.matricula, l.categoria_id, dataStr, l.horas_aceitas),
      )
      setChavesBanco.add(
        gerarChaveDeducao(
          aluno.matricula,
          l.categoria_id,
          l.semestre_letivo_atividade,
          l.horas_aceitas,
        ),
      )
    }
  })

  const chavesLoteAtual = new Set<string>()
  const categoriasNaoEncontradasMap: { [cat: string]: number } = {}
  const alunosUnicosSet = new Set<string>()
  const alunosNovosSet = new Set<string>()
  const alunosExistentesSet = new Set<string>()

  let totalLancamentosValidos = 0
  let totalHorasValidas = 0
  let lancamentosDuplicadosIgnorados = 0

  const linhasValidadas: LinhaImportacaoValidada[] = []

  linhasBrutas.forEach((raw, idx) => {
    const linhaNumero = idx + 2 // +2 pelo cabeçalho no Excel (base 1)
    const erros: string[] = []
    const avisos: string[] = []

    // 1. Extração com tolerância
    const matriculaVal = raw[mapaColunas['matricula'] || 'matricula'] ?? ''
    const nomeVal = raw[mapaColunas['nome'] || 'nome'] ?? ''
    const turnoVal = raw[mapaColunas['turno'] || 'turno'] ?? ''
    const semestreAtualVal = raw[mapaColunas['semestreAtual'] || 'semestre'] ?? ''
    const periodoEntradaVal = raw[mapaColunas['periodoEntrada'] || 'entrada'] ?? ''
    const emailVal = raw[mapaColunas['email'] || 'email'] ?? ''
    const categoriaVal = raw[mapaColunas['categoria'] || 'categoria'] ?? ''
    const horasVal = raw[mapaColunas['horas'] || 'horas'] ?? ''
    const dataVal = raw[mapaColunas['data'] || 'data'] ?? ''
    const semestreAtividadeVal = raw[mapaColunas['semestreAtividade'] || 'semestreAtividade'] ?? ''
    const obsVal = raw[mapaColunas['observacao'] || 'observacao'] ?? ''

    // Se a linha for totalmente vazia, pula
    const temAlgumDado = [matriculaVal, nomeVal, categoriaVal, horasVal].some(
      (v) => String(v).trim().length > 0,
    )

    if (!temAlgumDado) {
      return // linha vazia ignorada
    }

    // Normalização de Matrícula
    let matriculaLimpa = String(matriculaVal).trim().toUpperCase()

    // Normalização de Nome
    let nomeLimpo = String(nomeVal).trim()

    // Enriquecimento a partir do cadastro na aba "Alunos" (se disponível)
    const cadastroAlunoAba = cadastroAlunosMap.get(matriculaLimpa)
    if (!nomeLimpo && cadastroAlunoAba?.nome) {
      nomeLimpo = cadastroAlunoAba.nome
    }
    if (!matriculaLimpa && nomeLimpo) {
      // Tentar encontrar matrícula pelo nome do aluno
      for (const [mat, cad] of cadastroAlunosMap) {
        if (normalizarChave(cad.nome) === normalizarChave(nomeLimpo)) {
          matriculaLimpa = mat
          break
        }
      }
    }

    if (!matriculaLimpa) {
      erros.push('Matrícula ausente ou em branco.')
    }
    if (!nomeLimpo) {
      erros.push('Nome do estudante ausente.')
    }

    // Turno: prioriza linha da atividade, depois aba Alunos, depois fallback Matutino
    let turno: 'Matutino' | 'Vespertino' | 'Noturno' | 'Especial' = 'Matutino'
    const turnoFonte = String(turnoVal || cadastroAlunoAba?.turno || '')
    const turnoStr = normalizarChave(turnoFonte)
    if (turnoStr.includes('especial') || turnoStr === 'esp' || turnoStr === 'e') {
      turno = 'Especial'
    } else if (turnoStr.includes('vesp') || turnoStr.includes('tarde') || turnoStr === 'v') {
      turno = 'Vespertino'
    } else if (turnoStr.includes('not') || turnoStr.includes('noite') || turnoStr === 'n') {
      turno = 'Noturno'
    } else if (turnoStr.includes('mat') || turnoStr.includes('manha') || turnoStr === 'm') {
      turno = 'Matutino'
    } else {
      avisos.push('Turno não especificado claramente: assumido Matutino por padrão.')
    }

    // Semestre atual (1 a 10, com suporte a ordinais como "1º", "3º", "5º")
    let semestreAtual = 1
    const semStr = String(semestreAtualVal || cadastroAlunoAba?.semestreAtual || '').trim()
    const semOrdinalMatch = semStr.match(/^(\d{1,2})(?:º|ª|o|a)?$/i)
    if (semOrdinalMatch) {
      const parsed = parseInt(semOrdinalMatch[1], 10)
      if (parsed >= 1 && parsed <= 10) {
        semestreAtual = parsed
      } else {
        avisos.push('Semestre atual fora da faixa 1 a 10: assumido 1º semestre.')
      }
    } else {
      const semNum = parseInt(semStr.replace(/\D/g, ''), 10)
      if (!isNaN(semNum) && semNum >= 1 && semNum <= 10) {
        semestreAtual = semNum
      } else {
        avisos.push('Semestre atual não informado ou inválido: assumido 1º semestre.')
      }
    }

    // Período de entrada (ex: 2024.1, 2025.2)
    let periodoEntrada = String(periodoEntradaVal || cadastroAlunoAba?.periodoEntrada || '').trim()
    if (!periodoEntrada) {
      // Tentar inferir da matrícula (ex PSI2024101 -> 2024.1)
      const matchMatricula = matriculaLimpa.match(/(\d{4})([12])/)
      if (matchMatricula) {
        periodoEntrada = `${matchMatricula[1]}.${matchMatricula[2]}`
      } else {
        periodoEntrada = semestreAtualPadrao
      }
      avisos.push(`Período de entrada inferido como ${periodoEntrada}.`)
    }

    // Email
    let email = String(emailVal || cadastroAlunoAba?.email || '').trim()
    if (!email || !email.includes('@')) {
      const slug = normalizarChave(nomeLimpo).slice(0, 15) || matriculaLimpa.toLowerCase()
      email = `${slug}@aluno.fausp.br`
    }

    // Horas aceitas
    let horas = 0
    if (typeof horasVal === 'number') {
      horas = horasVal
    } else {
      const horasParsed = parseFloat(
        String(horasVal)
          .replace(',', '.')
          .replace(/[^\d.-]/g, ''),
      )
      horas = isNaN(horasParsed) ? 0 : horasParsed
    }

    if (horas <= 0) {
      erros.push(`Quantidade de horas inválida (${horasVal}). Deve ser maior que 0.`)
    }

    // Categoria
    const categoriaTexto = String(categoriaVal).trim()
    let categoriaCorrespondente: Categoria | undefined

    if (!categoriaTexto) {
      erros.push('Categoria da atividade ausente.')
    } else {
      // Verifica mapeamento manual fornecido pelo usuário na UI
      const idManual = mapeamentoManualCategorias[categoriaTexto]
      if (idManual) {
        categoriaCorrespondente = categoriasNde.find((c) => c.id === idManual)
      }

      if (!categoriaCorrespondente) {
        categoriaCorrespondente = encontrarCategoriaCorrespondente(categoriaTexto, categoriasNde)
      }

      if (!categoriaCorrespondente) {
        avisos.push(
          `Categoria "${categoriaTexto}" não consta no regulamento NDE ativo. Mapeie para uma categoria válida ou será necessário cadastrá-la.`,
        )
        categoriasNaoEncontradasMap[categoriaTexto] =
          (categoriasNaoEncontradasMap[categoriaTexto] || 0) + 1
      }
    }

    // Data de Lançamento
    const dataIso = converterDataParaIso(dataVal)

    // Semestre de Atividade (2024.1 a 2026.1 e outras)
    // Se a linha não informar semestre, usar o semestre letivo atual configurado como fallback e sinalizar
    let semestreAtividade = normalizarSemestreLetivo(semestreAtividadeVal)
    let semestreFallbackUtilizado = false

    if (!semestreAtividade) {
      // Se não veio na coluna de semestre da atividade, verificar se a data pode dar uma pista
      // ou usar diretamente o semestreAtualPadrao como fallback
      if (semestreAtualPadrao) {
        semestreAtividade = semestreAtualPadrao
        semestreFallbackUtilizado = true
        avisos.push(
          `Semestre da atividade não informado: atribuído semestre padrão (${semestreAtualPadrao}) como fallback.`,
        )
      } else {
        const ano = dataIso.split('-')[0]
        const mes = parseInt(dataIso.split('-')[1] || '6', 10)
        semestreAtividade = `${ano}.${mes <= 6 ? '1' : '2'}`
        semestreFallbackUtilizado = true
        avisos.push(`Semestre inferido pela data da atividade (${semestreAtividade}).`)
      }
    }

    // Identificação de Saldo Declarado na linha (se houver coluna na aba Lançamentos)
    // Se não houver, verificamos se a aba "Painel por Turma" trouxe o saldo acumulado
    let saldoDeclaradoLinha: number | undefined
    if (mapaColunas['saldoDeclarado'] && raw[mapaColunas['saldoDeclarado']] !== undefined) {
      const valDeclarado = raw[mapaColunas['saldoDeclarado']]
      if (valDeclarado !== '' && valDeclarado !== null) {
        saldoDeclaradoLinha = converterParaNumero(valDeclarado)
      }
    } else if (matriculaLimpa && saldosDeclaradosPainelTurma.has(matriculaLimpa)) {
      saldoDeclaradoLinha = saldosDeclaradosPainelTurma.get(matriculaLimpa)
    }

    // Observação
    const observacaoBase = String(obsVal).trim()
    const observacaoFinal = observacaoBase
      ? `[Importação legada] ${observacaoBase}`
      : `[Importação legada] Histórico importado via planilha`

    // Aluno existente no banco
    const alunoExistente = mapAlunosPorMatricula.get(matriculaLimpa)
    if (matriculaLimpa) {
      alunosUnicosSet.add(matriculaLimpa)
      if (alunoExistente) {
        alunosExistentesSet.add(matriculaLimpa)
      } else {
        alunosNovosSet.add(matriculaLimpa)
      }
    }

    // Verificação de deduplicação
    const catId = categoriaCorrespondente?.id || 'sem_cat'
    const chaveDeducao1 = gerarChaveDeducao(matriculaLimpa, catId, dataIso, horas)
    const chaveDeducao2 = gerarChaveDeducao(matriculaLimpa, catId, semestreAtividade, horas)

    let isDuplicado = false
    if (setChavesBanco.has(chaveDeducao1) || setChavesBanco.has(chaveDeducao2)) {
      isDuplicado = true
      avisos.push('Lançamento idêntico já cadastrado no banco (será ignorado na gravação).')
      lancamentosDuplicadosIgnorados++
    } else if (chavesLoteAtual.has(chaveDeducao1)) {
      isDuplicado = true
      avisos.push('Lançamento duplicado dentro do próprio lote da planilha.')
      lancamentosDuplicadosIgnorados++
    } else {
      chavesLoteAtual.add(chaveDeducao1)
    }

    let status: 'valida' | 'aviso' | 'erro' = 'valida'
    if (erros.length > 0) {
      status = 'erro'
    } else if (avisos.length > 0 || !categoriaCorrespondente) {
      status = 'aviso'
    }

    if (erros.length === 0 && categoriaCorrespondente && !isDuplicado) {
      totalLancamentosValidos++
      totalHorasValidas += horas
    }

    const idLinhaLote = `linha_${linhaNumero}_${matriculaLimpa || 'sem_mat'}_${idx}`

    linhasValidadas.push({
      linhaNumero,
      idLinhaLote,
      nome: nomeLimpo,
      matricula: matriculaLimpa,
      turno,
      semestreAtual,
      periodoEntrada,
      email,
      categoriaTexto,
      categoriaIdCorrespondente: categoriaCorrespondente?.id,
      categoriaNomeOficial: categoriaCorrespondente?.nome,
      horas,
      dataLancamento: dataIso,
      semestreAtividade,
      semestreFallbackUtilizado,
      observacao: observacaoFinal,
      status,
      erros,
      avisos,
      isDuplicado,
      chaveDeducao: chaveDeducao1,
      alunoExistenteId: alunoExistente?.id,
      saldoDeclaradoLinha,
    })
  })

  const linhasComSemestreFallback = linhasValidadas.filter(
    (l) => l.semestreFallbackUtilizado,
  ).length

  const temSaldoDeclaradoNaAbaLancamentos = !!mapaColunas['saldoDeclarado']
  const temSaldoDeclaradoNoPainelTurma = saldosDeclaradosPainelTurma.size > 0
  const origemSaldoDeclarado: 'aba_lancamentos' | 'aba_painel_turma' | 'nenhuma' =
    temSaldoDeclaradoNaAbaLancamentos
      ? 'aba_lancamentos'
      : temSaldoDeclaradoNoPainelTurma
        ? 'aba_painel_turma'
        : 'nenhuma'

  const resumo: ResumoValidacao = {
    totalLinhasLidas: linhasValidadas.length,
    linhasValidas: linhasValidadas.filter((l) => l.status === 'valida').length,
    linhasComAviso: linhasValidadas.filter((l) => l.status === 'aviso').length,
    linhasComErro: linhasValidadas.filter((l) => l.status === 'erro').length,
    alunosUnicos: alunosUnicosSet.size,
    alunosNovos: alunosNovosSet.size,
    alunosExistentes: alunosExistentesSet.size,
    totalLancamentosValidos,
    totalHorasValidas,
    lancamentosDuplicadosIgnorados,
    categoriasNaoEncontradas: categoriasNaoEncontradasMap,
    linhasComSemestreFallback,
    configDetectada: configDetectada || undefined,
    origemSaldoDeclarado,
  }

  return {
    linhas: linhasValidadas,
    resumo,
    nomeAbaUsada: abaLancamentosNome,
    colunasIdentificadas: mapaColunas,
    saldosDeclaradosPainelTurma,
    configDetectada,
  }
}

/**
 * Gera arquivo Excel com o modelo/template esperado para orientar o usuário
 */
export function gerarPlanilhaModelo(): void {
  const wb = XLSX.utils.book_new()

  // Aba 1: Config Tabela 2026.2 (Banner na linha 1 + Parâmetros + Tabela de Categorias)
  const bannerConfig = [
    'CONFIGURAÇÃO — Tabela de Horas Complementares 2026.2: Fonte única de verdade',
    '',
    '',
  ]
  const instConfig = ['Parâmetros (edite somente estas células):', '', '']
  const paramSemestre = ['Semestre letivo atual:', '2026.2', '']
  const paramMinimo = ['Mínimo exigido por semestre:', 20, '']
  const paramMeta = ['Meta do curso:', 200, '']
  const cabecalhoCategorias = ['Categoria', 'Horas por atividade', 'Máximo do curso']
  const categoriasExemplo = [
    ['Eventos científicos com apresentação de trabalho', '20h por evento', 40],
    ['Eventos científicos sem apresentação de trabalho', '5h por evento', 30],
    ['Publicação: capítulo de livro', '25h por capítulo', 50],
    ['Publicação: artigo científico', '25h por artigo', 50],
    ['Monitoria em disciplinas do curso', '20h por semestre', 60],
    ['Artes e Cultura', '10h por evento', 150],
    ['Visitas Técnicas', '10h por visita', 40],
    ['Estágio Remunerado em Psicologia', '15h a cada 4 meses', 150],
    ['Cursos Livres Presenciais ou Online', '10h por curso', 120],
    ['Club de Leitura Mulheres Força da Resistência', '10h por livro', 80],
  ]
  const wsConfig = XLSX.utils.aoa_to_sheet([
    bannerConfig,
    instConfig,
    paramSemestre,
    paramMinimo,
    paramMeta,
    cabecalhoCategorias,
    ...categoriasExemplo,
  ])
  wsConfig['!cols'] = [{ wch: 45 }, { wch: 25 }, { wch: 18 }]
  XLSX.utils.book_append_sheet(wb, wsConfig, 'Config Tabela 2026.2')

  // Aba 2: Alunos (Banner na linha 1 + Cabeçalhos na linha 2)
  const bannerAlunos = [
    'CADASTRO DE ALUNOS: Matrícula única usada nos lançamentos.',
    '',
    '',
    '',
    '',
    '',
  ]
  const cabecalhoAlunos = ['Nome', 'Matrícula', 'Turno', 'Semestre atual', 'Entrada', 'E-mail']
  const alunosExemplo = [
    [
      'Mariana Costa Silveira',
      'PSI2024201',
      'Matutino',
      '4º',
      '2024.2',
      'mariana.silveira@aluno.fausp.br',
    ],
    [
      'Lucas Gabriel dos Santos',
      'PSI2025102',
      'Noturno',
      '3º',
      '2025.1',
      'lucas.santos@aluno.fausp.br',
    ],
    [
      'Beatriz Ramos Albuquerque',
      'PSI2026103',
      'Matutino',
      '1º',
      '2026.2',
      'beatriz.ramos@aluno.fausp.br',
    ],
  ]
  const wsAlunos = XLSX.utils.aoa_to_sheet([bannerAlunos, cabecalhoAlunos, ...alunosExemplo])
  wsAlunos['!cols'] = [{ wch: 30 }, { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 14 }, { wch: 32 }]
  XLSX.utils.book_append_sheet(wb, wsAlunos, 'Alunos')

  // Aba 3: Lançamentos (Banner na linha 1 + Cabeçalhos na linha 2)
  const bannerLancamentos = [
    'LANÇAMENTOS DE HORAS COMPLEMENTARES: Uma linha por atividade aceita.',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
  ]
  const cabecalhoLancamentos = [
    'Data',
    'Matrícula',
    'Nome do aluno',
    'Semestre letivo da atividade',
    'Categoria',
    'Horas aceitas',
    'Comprovante OK? (SIM/NÃO)',
    'Relatório OK? (SIM/NÃO)',
    'Observação',
  ]
  const lancamentosExemplo = [
    [
      '15/03/2025',
      'PSI2024201',
      'Mariana Costa Silveira',
      '2024.2',
      'Eventos científicos com apresentação de trabalho',
      20,
      'SIM',
      'SIM',
      'Congresso Brasileiro de Psicologia',
    ],
    [
      '2026-10-04T03:06:28.000Z',
      'PSI2024201',
      'Mariana Costa Silveira',
      '2026.1',
      'Artes e Cultura',
      10,
      'SIM',
      'SIM',
      'Visita técnica a centro cultural',
    ],
    [
      '20/09/2025',
      'PSI2025102',
      'Lucas Gabriel dos Santos',
      '2025.1',
      'Cursos Livres Presenciais ou Online',
      10,
      'SIM',
      'SIM',
      'Curso de extensão em Saúde Mental',
    ],
    [
      '15/09/2026',
      'PSI2026103',
      'Beatriz Ramos Albuquerque',
      '2026.2',
      'Artes e Cultura',
      10,
      'SIM',
      'SIM',
      'Seminário e peça de teatro',
    ],
  ]
  const wsLancamentos = XLSX.utils.aoa_to_sheet([
    bannerLancamentos,
    cabecalhoLancamentos,
    ...lancamentosExemplo,
  ])
  wsLancamentos['!cols'] = [
    { wch: 15 },
    { wch: 14 },
    { wch: 28 },
    { wch: 20 },
    { wch: 40 },
    { wch: 12 },
    { wch: 15 },
    { wch: 15 },
    { wch: 35 },
  ]
  XLSX.utils.book_append_sheet(wb, wsLancamentos, 'Lançamentos')

  // Aba 4: Painel por Turma (Banner na linha 1 + Cabeçalhos na linha 2)
  const bannerTurma = [
    'PAINEL POR TURMA — VISÃO GERENCIAL: Balanço semestral',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
  ]
  const cabecalhoTurma = [
    'Nome',
    'Turno',
    'Semestre atual',
    'Entrada',
    'Total geral acumulado',
    'Horas do semestre atual',
    'Restante semestre atual',
    'Restante até o fim do curso',
    'Balanço semestral',
  ]
  const turmaExemplo = [
    ['Mariana Costa Silveira', 'Matutino', 4, '2024.2', 30, 10, 10, 170, 'CUMPRIU'],
    ['Lucas Gabriel dos Santos', 'Noturno', 3, '2025.1', 10, 10, 10, 190, 'CUMPRIU'],
    ['Beatriz Ramos Albuquerque', 'Matutino', 1, '2026.2', 10, 10, 10, 190, 'CUMPRIU'],
  ]
  const wsTurma = XLSX.utils.aoa_to_sheet([bannerTurma, cabecalhoTurma, ...turmaExemplo])
  wsTurma['!cols'] = [
    { wch: 28 },
    { wch: 12 },
    { wch: 14 },
    { wch: 12 },
    { wch: 20 },
    { wch: 22 },
    { wch: 22 },
    { wch: 24 },
    { wch: 16 },
  ]
  XLSX.utils.book_append_sheet(wb, wsTurma, 'Painel por Turma')

  XLSX.writeFile(wb, 'Modelo_Importacao_Horas_Psicologia_FAUSP.xlsx')
}

/**
 * Exporta o relatório de auditoria e erros/avisos da importação em formato .xlsx
 */
export function exportarRelatorioErrosExcel(linhas: LinhaImportacaoValidada[]): void {
  const wb = XLSX.utils.book_new()

  const cabecalho = [
    'Linha Planilha',
    'Status',
    'Matrícula',
    'Nome Estudante',
    'Semestre Atividade',
    'Semestre Fallback?',
    'Categoria Planilha',
    'Horas',
    'Saldo Declarado',
    'Erros Identificados',
    'Avisos / Alertas',
    'Duplicado?',
  ]

  const rows = linhas.map((l) => [
    l.linhaNumero,
    l.status.toUpperCase(),
    l.matricula || 'N/A',
    l.nome || 'N/A',
    l.semestreAtividade,
    l.semestreFallbackUtilizado ? 'SIM (PADRÃO)' : 'NÃO (PLANILHA)',
    l.categoriaTexto || 'N/A',
    l.horas,
    l.saldoDeclaradoLinha !== undefined ? l.saldoDeclaradoLinha : 'N/A',
    l.erros.join(' | ') || 'Nenhum',
    l.avisos.join(' | ') || 'Nenhum',
    l.isDuplicado ? 'SIM' : 'NÃO',
  ])

  const ws = XLSX.utils.aoa_to_sheet([cabecalho, ...rows])
  ws['!cols'] = [
    { wch: 14 },
    { wch: 10 },
    { wch: 16 },
    { wch: 30 },
    { wch: 18 },
    { wch: 18 },
    { wch: 35 },
    { wch: 8 },
    { wch: 16 },
    { wch: 45 },
    { wch: 45 },
    { wch: 12 },
  ]

  XLSX.utils.book_append_sheet(wb, ws, 'Relatorio Auditoria')
  XLSX.writeFile(
    wb,
    `relatorio-auditoria-importacao-${new Date().toISOString().split('T')[0]}.xlsx`,
  )
}
