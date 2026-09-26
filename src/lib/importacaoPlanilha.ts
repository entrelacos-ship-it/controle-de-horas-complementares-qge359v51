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
  semestreAtividade: string // ex: 2024.1
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
}

export interface ResultadoEfetivacaoImportacao {
  alunosCriados: number
  alunosAtualizados: number
  lancamentosCriados: number
  lancamentosIgnoradosDuplicados: number
  errosAoGravar: Array<{ linhaNumero: number; item: string; motivo: string }>
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
export function identificarColunas(colunasReais: string[]): Record<string, string> {
  const mapa: Record<string, string> = {}

  colunasReais.forEach((col) => {
    const limpo = normalizarChave(col)

    if (
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
    } else if (limpo === 'turno' || limpo === 'periodo' || limpo.startsWith('turno')) {
      if (!mapa['turno']) mapa['turno'] = col
    } else if (
      limpo === 'semestreatual' ||
      limpo === 'semestre' ||
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
      limpo === 'atividade' ||
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
      limpo === 'dataatividade' ||
      limpo === 'periodoatividade'
    ) {
      if (!mapa['data']) mapa['data'] = col
    } else if (
      limpo === 'semestreatividade' ||
      limpo === 'semestreletivo' ||
      limpo === 'semestreletivoatividade' ||
      limpo === 'semestredocertificado'
    ) {
      if (!mapa['semestreAtividade']) mapa['semestreAtividade'] = col
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

  // Formato ISO YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/)
  if (isoMatch) {
    const ano = isoMatch[1]
    const mes = isoMatch[2].padStart(2, '0')
    const dia = isoMatch[3].padStart(2, '0')
    return `${ano}-${mes}-${dia}`
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
  const primeiraAba = workbook.SheetNames[0]
  if (!primeiraAba) {
    throw new Error('A planilha está vazia ou não contém abas válidas.')
  }

  const worksheet = workbook.Sheets[primeiraAba]
  const linhasBrutas = XLSX.utils.sheet_to_json<LinhaPlanilhaBruta>(worksheet, {
    defval: '',
  })

  if (!linhasBrutas || linhasBrutas.length === 0) {
    throw new Error('Nenhuma linha de dados encontrada na primeira aba da planilha.')
  }

  const colunasReais = Object.keys(linhasBrutas[0] || {})
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
    const matriculaLimpa = String(matriculaVal).trim().toUpperCase()
    if (!matriculaLimpa) {
      erros.push('Matrícula ausente ou em branco.')
    }

    // Normalização de Nome
    const nomeLimpo = String(nomeVal).trim()
    if (!nomeLimpo) {
      erros.push('Nome do estudante ausente.')
    }

    // Turno
    let turno: 'Matutino' | 'Vespertino' | 'Noturno' | 'Especial' = 'Matutino'
    const turnoStr = normalizarChave(String(turnoVal))
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

    // Semestre atual (1 a 10)
    let semestreAtual = 1
    const semNum = parseInt(String(semestreAtualVal).replace(/\D/g, ''), 10)
    if (!isNaN(semNum) && semNum >= 1 && semNum <= 10) {
      semestreAtual = semNum
    } else {
      avisos.push('Semestre atual não informado ou inválido: assumido 1º semestre.')
    }

    // Período de entrada (ex: 2024.1, 2025.2)
    let periodoEntrada = String(periodoEntradaVal).trim()
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
    let email = String(emailVal).trim()
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

    // Semestre de Atividade
    let semestreAtividade = String(semestreAtividadeVal).trim()
    if (!semestreAtividade || !semestreAtividade.match(/^\d{4}\.[12]$/)) {
      // Derivar do ano da data ISO (ex: 2025-05-10 -> 2025.1)
      const ano = dataIso.split('-')[0]
      const mes = parseInt(dataIso.split('-')[1] || '6', 10)
      semestreAtividade = `${ano}.${mes <= 6 ? '1' : '2'}`
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

    linhasValidadas.push({
      linhaNumero,
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
      observacao: observacaoFinal,
      status,
      erros,
      avisos,
      isDuplicado,
      chaveDeducao: chaveDeducao1,
      alunoExistenteId: alunoExistente?.id,
    })
  })

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
  }

  return {
    linhas: linhasValidadas,
    resumo,
    nomeAbaUsada: primeiraAba,
    colunasIdentificadas: mapaColunas,
  }
}

/**
 * Gera arquivo Excel com o modelo/template esperado para orientar o usuário
 */
export function gerarPlanilhaModelo(): void {
  const wb = XLSX.utils.book_new()

  const cabecalho = [
    'Matricula',
    'Nome Aluno',
    'Turno',
    'Semestre Atual',
    'Periodo Entrada',
    'Email',
    'Categoria Atividade',
    'Horas',
    'Data Atividade',
    'Semestre Atividade',
    'Observacao',
  ]

  const dadosExemplo = [
    [
      'PSI2024201',
      'Mariana Costa Silveira',
      'Matutino',
      4,
      '2024.2',
      'mariana.silveira@aluno.fausp.br',
      'Eventos científicos com apresentação de trabalho',
      20,
      '2025-05-10',
      '2025.1',
      'Apresentação no Congresso Brasileiro de Psicologia',
    ],
    [
      'PSI2025102',
      'Lucas Gabriel dos Santos',
      'Noturno',
      3,
      '2025.1',
      'lucas.santos@aluno.fausp.br',
      'Cursos Livres Presenciais ou Online',
      10,
      '2026-08-20',
      '2026.2',
      'Curso de Extensão em Saúde Mental',
    ],
    [
      'PSI2026103',
      'Beatriz Ramos Albuquerque',
      'Matutino',
      2,
      '2026.1',
      'beatriz.ramos@aluno.fausp.br',
      'Artes e Cultura',
      10,
      '2026-04-12',
      '2026.1',
      'Visita Técnica e Relatório Crítico de Cinema',
    ],
    [
      'PSI2023104',
      'Felipe Augusto Nogueira',
      'Noturno',
      7,
      '2023.1',
      'felipe.nogueira@aluno.fausp.br',
      'Estágio supervisionado extracurricular',
      30,
      '2025-10-18',
      '2025.2',
      'Estágio Extracurricular Hospitalar',
    ],
  ]

  const ws = XLSX.utils.aoa_to_sheet([cabecalho, ...dadosExemplo])

  ws['!cols'] = [
    { wch: 16 }, // Matricula
    { wch: 32 }, // Nome
    { wch: 12 }, // Turno
    { wch: 15 }, // Semestre Atual
    { wch: 16 }, // Periodo Entrada
    { wch: 30 }, // Email
    { wch: 45 }, // Categoria
    { wch: 10 }, // Horas
    { wch: 15 }, // Data
    { wch: 18 }, // Semestre Atividade
    { wch: 45 }, // Obs
  ]

  XLSX.utils.book_append_sheet(wb, ws, 'Modelo Importacao')
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
    'Categoria Planilha',
    'Horas',
    'Erros Identificados',
    'Avisos / Alertas',
    'Duplicado?',
  ]

  const rows = linhas.map((l) => [
    l.linhaNumero,
    l.status.toUpperCase(),
    l.matricula || 'N/A',
    l.nome || 'N/A',
    l.categoriaTexto || 'N/A',
    l.horas,
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
    { wch: 35 },
    { wch: 8 },
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
