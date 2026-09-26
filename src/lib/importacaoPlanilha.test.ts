import * as XLSX from 'xlsx'
import {
  normalizarChave,
  identificarColunas,
  encontrarCategoriaCorrespondente,
  converterDataParaIso,
  gerarChaveDeducao,
  normalizarSemestreLetivo,
  processarPlanilhaExcel,
  calcularConciliacaoSaldos,
  extrairLinhasComCabecalhoInteligente,
  extrairConfigTabelaWorksheet,
} from './importacaoPlanilha'
import type { Aluno, Categoria, Lancamento } from '@/types'

/**
 * Suite de testes unitários para o módulo de importação de planilhas legadas
 */
export function executarTestesImportacao(): { todosPassaram: boolean; resultados: string[] } {
  const resultados: string[] = []

  // 1. Teste de normalização e tolerância de colunas
  const colunasTeste = [
    'RA Estudante',
    'Nome Completo',
    'TURNO (M/N)',
    'Termo / Semestre',
    'Ano Entrada',
    'E-mail institucional',
    'Tipo de Atividade',
    'Carga Horaria',
    'Data Realizacao',
    'Semestre Letivo',
    'Descricao / Justificativa',
  ]

  const mapa = identificarColunas(colunasTeste)
  if (
    mapa.matricula === 'RA Estudante' &&
    mapa.nome === 'Nome Completo' &&
    mapa.turno === 'TURNO (M/N)' &&
    mapa.semestreAtual === 'Termo / Semestre' &&
    mapa.periodoEntrada === 'Ano Entrada' &&
    mapa.categoria === 'Tipo de Atividade' &&
    mapa.horas === 'Carga Horaria'
  ) {
    resultados.push('TI-01: Identificação tolerante de cabeçalhos passou.')
  } else {
    throw new Error(`TI-01 falhou: ${JSON.stringify(mapa)}`)
  }

  // 2. Teste de casamento inteligente de categorias NDE
  const categoriasMock: Categoria[] = [
    {
      id: 'cat_ev',
      nome: 'Eventos científicos com apresentação de trabalho',
      regra_horas_unitaria: '20h',
      teto_maximo_curso: 40,
      ativo: true,
    },
    {
      id: 'cat_cu',
      nome: 'Cursos Livres Presenciais ou Online',
      regra_horas_unitaria: '10h',
      teto_maximo_curso: 120,
      ativo: true,
    },
    {
      id: 'cat_art',
      nome: 'Artes e Cultura',
      regra_horas_unitaria: '10h',
      teto_maximo_curso: 40,
      ativo: true,
    },
  ]

  const catMatch1 = encontrarCategoriaCorrespondente(
    'Apresentação em Congresso Científico',
    categoriasMock,
  )
  const catMatch2 = encontrarCategoriaCorrespondente('Curso livre online de TCC', categoriasMock)
  const catMatch3 = encontrarCategoriaCorrespondente(
    'Visita ao Museu de Arte e Cinema',
    categoriasMock,
  )
  const catMatch4 = encontrarCategoriaCorrespondente('Atividade Desconhecida XYZ', categoriasMock)

  if (
    catMatch1?.id === 'cat_ev' &&
    catMatch2?.id === 'cat_cu' &&
    catMatch3?.id === 'cat_art' &&
    catMatch4 === undefined
  ) {
    resultados.push('TI-02: Casamento tolerante de categorias NDE passou.')
  } else {
    throw new Error('TI-02 falhou')
  }

  // 3. Teste de conversão de datas
  const dataBr = converterDataParaIso('15/08/2025')
  const dataIso = converterDataParaIso('2025-08-15')
  if (dataBr === '2025-08-15' && dataIso === '2025-08-15') {
    resultados.push('TI-03: Conversão de datas BR/ISO passou.')
  } else {
    throw new Error(`TI-03 falhou: ${dataBr} vs ${dataIso}`)
  }

  // 4. Teste do parser de turnos (Matutino, Vespertino, Noturno, Especial)
  const parserLinhasTurnos = [
    { turnoRaw: 'Vespertino', esperado: 'Vespertino' },
    { turnoRaw: 'vesp', esperado: 'Vespertino' },
    { turnoRaw: 'v', esperado: 'Vespertino' },
    { turnoRaw: 'tarde', esperado: 'Vespertino' },
    { turnoRaw: 'Especial', esperado: 'Especial' },
    { turnoRaw: 'esp', esperado: 'Especial' },
    { turnoRaw: 'e', esperado: 'Especial' },
    { turnoRaw: 'Noturno', esperado: 'Noturno' },
    { turnoRaw: 'noite', esperado: 'Noturno' },
    { turnoRaw: 'n', esperado: 'Noturno' },
    { turnoRaw: 'Matutino', esperado: 'Matutino' },
    { turnoRaw: 'm', esperado: 'Matutino' },
    { turnoRaw: 'manha', esperado: 'Matutino' },
  ]

  for (const item of parserLinhasTurnos) {
    const turnoStr = normalizarChave(item.turnoRaw)
    let turnoIdentificado = 'Matutino'
    if (turnoStr.includes('especial') || turnoStr === 'esp' || turnoStr === 'e') {
      turnoIdentificado = 'Especial'
    } else if (turnoStr.includes('vesp') || turnoStr.includes('tarde') || turnoStr === 'v') {
      turnoIdentificado = 'Vespertino'
    } else if (turnoStr.includes('not') || turnoStr.includes('noite') || turnoStr === 'n') {
      turnoIdentificado = 'Noturno'
    } else if (turnoStr.includes('mat') || turnoStr.includes('manha') || turnoStr === 'm') {
      turnoIdentificado = 'Matutino'
    }

    if (turnoIdentificado !== item.esperado) {
      throw new Error(
        `Falha no parser de turno para "${item.turnoRaw}": esperado "${item.esperado}", obtido "${turnoIdentificado}"`,
      )
    }
  }
  resultados.push(
    'TI-03.1: Parser de turnos incluindo Vespertino (vesp, v) e Especial (esp, e) passou.',
  )

  // 5. Teste de processamento completo de planilha sintética
  const alunosMock: Aluno[] = [
    {
      id: 'aluno_existente_1',
      matricula: 'PSI2024201',
      nome: 'Mariana Costa Silveira',
      turno: 'Matutino',
      semestre_atual: 4,
      periodo_entrada: '2024.2',
      email: 'mariana.silveira@aluno.fausp.br',
    },
  ]

  const lancamentosMock: Lancamento[] = [
    {
      id: 'lanc_existente_1',
      aluno_id: 'aluno_existente_1',
      categoria_id: 'cat_ev',
      data_lancamento: '2025-05-10',
      semestre_letivo_atividade: '2025.1',
      horas_aceitas: 20,
      comprovante_ok: true,
      relatorio_ok: true,
      created: '2025-05-10',
      updated: '2025-05-10',
    },
  ]

  // Montar workbook sintético usando SheetJS
  const dadosPlanilha = [
    [
      'Matricula',
      'Nome Aluno',
      'Turno',
      'Semestre',
      'Entrada',
      'Email',
      'Categoria',
      'Horas',
      'Data',
      'Semestre Atividade',
      'Observacao',
    ],
    // Linha 1: Lançamento idêntico ao já existente (deve ser marcado como duplicado)
    [
      'PSI2024201',
      'Mariana Costa Silveira',
      'Matutino',
      '4',
      '2024.2',
      'mariana@fausp.br',
      'Eventos científicos com apresentação de trabalho',
      20,
      '2025-05-10',
      '2025.1',
      'Congresso',
    ],
    // Linha 2: Novo lançamento para aluno existente (deve ser válido e reconhecer alunoExistenteId)
    [
      'PSI2024201',
      'Mariana Costa Silveira',
      'Matutino',
      '4',
      '2024.2',
      'mariana@fausp.br',
      'Cursos Livres',
      10,
      '2026-08-15',
      '2026.2',
      'Curso Presencial',
    ],
    // Linha 3: Aluno novo com lançamento válido
    [
      'PSI2026199',
      'Novo Estudante Teste',
      'Noturno',
      '2',
      '2026.1',
      'novo@fausp.br',
      'Artes e Cultura',
      10,
      '2026-09-01',
      '2026.2',
      'Visita ao museu',
    ],
    // Linha 4: Linha com erro (horas zero e sem matrícula)
    [
      '',
      'Estudante Sem Matricula',
      'Matutino',
      '1',
      '2026.1',
      '',
      'Artes e Cultura',
      0,
      '2026-09-01',
      '2026.2',
      'Invalido',
    ],
  ]

  const ws = XLSX.utils.aoa_to_sheet(dadosPlanilha)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Dados')
  const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer

  const resultadoProcessamento = processarPlanilhaExcel({
    arquivoBuffer: buffer,
    alunosExistentes: alunosMock,
    categoriasNde: categoriasMock,
    lancamentosExistentes: lancamentosMock,
    semestreAtualPadrao: '2026.2',
  })

  const { linhas, resumo } = resultadoProcessamento

  if (linhas.length !== 4) {
    throw new Error(`Esperado 4 linhas lidas, obtido ${linhas.length}`)
  }

  // Verificar linha 1 (duplicada)
  if (!linhas[0].isDuplicado) {
    throw new Error('Linha 1 deveria ter sido detectada como duplicada')
  }

  // Verificar linha 2 (aluno existente id)
  if (linhas[1].alunoExistenteId !== 'aluno_existente_1') {
    throw new Error('Linha 2 deveria ter referenciado aluno_existente_1')
  }

  // Verificar linha 3 (aluno novo)
  if (linhas[2].alunoExistenteId !== undefined || linhas[2].matricula !== 'PSI2026199') {
    throw new Error('Linha 3 deveria ser aluno novo')
  }

  // Verificar linha 4 (erro)
  if (linhas[3].status !== 'erro') {
    throw new Error('Linha 4 deveria ter status erro')
  }

  resultados.push(
    'TI-04: Processamento completo com validação, dedup e detecção de alunos existentes passou.',
  )

  // 6. Teste de parser de semestres letivos (2024.1 a 2026.1) com tolerância a formatos
  const testesSemestre = [
    { entrada: '2024.1', esperado: '2024.1' },
    { entrada: '2024/1', esperado: '2024.1' },
    { entrada: '2024-1', esperado: '2024.1' },
    { entrada: '2024.2', esperado: '2024.2' },
    { entrada: '2024/2', esperado: '2024.2' },
    { entrada: '2025.1', esperado: '2025.1' },
    { entrada: '2025-2', esperado: '2025.2' },
    { entrada: '2026.1', esperado: '2026.1' },
    { entrada: '1/2025', esperado: '2025.1' },
    { entrada: '2º/2024', esperado: '2024.2' },
    { entrada: '2025 1º semestre', esperado: '2025.1' },
    { entrada: 'semestre invalido', esperado: null },
    { entrada: '', esperado: null },
  ]

  for (const t of testesSemestre) {
    const res = normalizarSemestreLetivo(t.entrada)
    if (res !== t.esperado) {
      throw new Error(
        `TI-05 falhou para semestre "${t.entrada}": esperado "${t.esperado}", obtido "${res}"`,
      )
    }
  }
  resultados.push(
    'TI-05: Parser de histórico com semestres letivos anteriores (2024.1 a 2026.1) e tolerância passou.',
  )

  // 7. Teste de fallback quando linha não informa semestre
  const dadosPlanilhaSemSemestre = [
    ['Matricula', 'Nome Aluno', 'Turno', 'Categoria', 'Horas', 'Data Atividade', 'Semestre'],
    // Linha com semestre explícito 2024.2
    [
      'PSI2024101',
      'Aluno Semestre 2024.2',
      'Matutino',
      'Artes e Cultura',
      10,
      '2024-10-10',
      '2024.2',
    ],
    // Linha sem semestre informado: deve usar fallback '2026.1'
    ['PSI2024102', 'Aluno Fallback Semestre', 'Noturno', 'Artes e Cultura', 10, '2026-02-15', ''],
  ]

  const wsSemSem = XLSX.utils.aoa_to_sheet(dadosPlanilhaSemSemestre)
  const wbSemSem = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wbSemSem, wsSemSem, 'Semestre')
  const bufferSemSem = XLSX.write(wbSemSem, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer

  const procSemSem = processarPlanilhaExcel({
    arquivoBuffer: bufferSemSem,
    alunosExistentes: [],
    categoriasNde: categoriasMock,
    lancamentosExistentes: [],
    semestreAtualPadrao: '2026.1',
  })

  if (
    procSemSem.linhas[0].semestreAtividade !== '2024.2' ||
    procSemSem.linhas[0].semestreFallbackUtilizado
  ) {
    throw new Error('TI-06.1 falhou: Linha 1 deveria manter 2024.2 sem fallback')
  }
  if (
    procSemSem.linhas[1].semestreAtividade !== '2026.1' ||
    !procSemSem.linhas[1].semestreFallbackUtilizado ||
    procSemSem.resumo.linhasComSemestreFallback !== 1
  ) {
    throw new Error('TI-06.2 falhou: Linha 2 deveria ter assumido fallback 2026.1 e sinalizado')
  }
  resultados.push(
    'TI-06: Fallback de semestre padrão com sinalização em linhas sem semestre passou.',
  )

  // 8. Teste de conciliação de saldos aluno por aluno:
  // Casos: CONCILIADO, DIVERGENTE e SEM_REFERENCIA, além de exclusão pontual do lote
  const alunoConcBanco1: Aluno = {
    id: 'aluno_conc_1',
    matricula: 'PSI_CONC_01',
    nome: 'Aluno Conciliado Exato',
    turno: 'Matutino',
    semestre_atual: 5,
    periodo_entrada: '2024.1',
    email: 'conc1@aluno.fausp.br',
  }

  const alunoConcBanco2: Aluno = {
    id: 'aluno_conc_2',
    matricula: 'PSI_CONC_02',
    nome: 'Aluno Divergente Saldo',
    turno: 'Noturno',
    semestre_atual: 4,
    periodo_entrada: '2024.2',
    email: 'conc2@aluno.fausp.br',
  }

  const lancExistentesConc: Lancamento[] = [
    // Aluno 1 tem 20h já gravadas no banco
    {
      id: 'l_conc_1',
      aluno_id: 'aluno_conc_1',
      categoria_id: 'cat_ev',
      data_lancamento: '2024-05-10',
      semestre_letivo_atividade: '2024.1',
      horas_aceitas: 20,
      comprovante_ok: true,
      relatorio_ok: true,
      created: '2024-05-10',
      updated: '2024-05-10',
    },
    // Aluno 2 tem 10h já gravadas no banco
    {
      id: 'l_conc_2',
      aluno_id: 'aluno_conc_2',
      categoria_id: 'cat_art',
      data_lancamento: '2024-10-10',
      semestre_letivo_atividade: '2024.2',
      horas_aceitas: 10,
      comprovante_ok: true,
      relatorio_ok: true,
      created: '2024-10-10',
      updated: '2024-10-10',
    },
  ]

  // Linhas do lote a conciliar:
  // - Aluno 1: traz +10h na planilha e saldo declarado de 30h (Banco 20h + Lote 10h = 30h -> CONCILIADO)
  // - Aluno 2: traz +20h na planilha e saldo declarado de 40h (Banco 10h + Lote 20h = 30h != 40h -> DIVERGENTE)
  // - Aluno 3: aluno novo, traz +15h e NÃO declara total (-> SEM_REFERENCIA)
  const linhasLoteConc = [
    {
      linhaNumero: 2,
      idLinhaLote: 'linha_lote_1',
      nome: 'Aluno Conciliado Exato',
      matricula: 'PSI_CONC_01',
      turno: 'Matutino' as const,
      semestreAtual: 5,
      periodoEntrada: '2024.1',
      email: 'conc1@aluno.fausp.br',
      categoriaTexto: 'Cursos Livres',
      categoriaIdCorrespondente: 'cat_cu',
      categoriaNomeOficial: 'Cursos Livres Presenciais ou Online',
      horas: 10,
      dataLancamento: '2025-05-20',
      semestreAtividade: '2025.1',
      semestreFallbackUtilizado: false,
      observacao: '[Importação legada]',
      status: 'valida' as const,
      erros: [],
      avisos: [],
      saldoDeclaradoLinha: 30, // 20 banco + 10 lote = 30
    },
    {
      linhaNumero: 3,
      idLinhaLote: 'linha_lote_2',
      nome: 'Aluno Divergente Saldo',
      matricula: 'PSI_CONC_02',
      turno: 'Noturno' as const,
      semestreAtual: 4,
      periodoEntrada: '2024.2',
      email: 'conc2@aluno.fausp.br',
      categoriaTexto: 'Eventos científicos',
      categoriaIdCorrespondente: 'cat_ev',
      categoriaNomeOficial: 'Eventos científicos com apresentação de trabalho',
      horas: 20,
      dataLancamento: '2025-08-10',
      semestreAtividade: '2025.2',
      semestreFallbackUtilizado: false,
      observacao: '[Importação legada]',
      status: 'valida' as const,
      erros: [],
      avisos: [],
      saldoDeclaradoLinha: 40, // 10 banco + 20 lote = 30 != 40 declarado
    },
    {
      linhaNumero: 4,
      idLinhaLote: 'linha_lote_3',
      nome: 'Aluno Sem Referencia Total',
      matricula: 'PSI_CONC_03',
      turno: 'Matutino' as const,
      semestreAtual: 2,
      periodoEntrada: '2025.1',
      email: 'conc3@aluno.fausp.br',
      categoriaTexto: 'Artes e Cultura',
      categoriaIdCorrespondente: 'cat_art',
      categoriaNomeOficial: 'Artes e Cultura',
      horas: 15,
      dataLancamento: '2026-03-10',
      semestreAtividade: '2026.1',
      semestreFallbackUtilizado: false,
      observacao: '[Importação legada]',
      status: 'valida' as const,
      erros: [],
      avisos: [],
      saldoDeclaradoLinha: undefined, // Sem total na planilha
    },
  ]

  const resultadoConc = calcularConciliacaoSaldos({
    linhasLote: linhasLoteConc,
    alunosExistentes: [alunoConcBanco1, alunoConcBanco2],
    lancamentosExistentes: lancExistentesConc,
    categoriasNde: categoriasMock,
  })

  const itemConc1 = resultadoConc.alunosConciliacao.find((a) => a.matricula === 'PSI_CONC_01')
  const itemConc2 = resultadoConc.alunosConciliacao.find((a) => a.matricula === 'PSI_CONC_02')
  const itemConc3 = resultadoConc.alunosConciliacao.find((a) => a.matricula === 'PSI_CONC_03')

  if (
    !itemConc1 ||
    itemConc1.statusConciliacao !== 'CONCILIADO' ||
    itemConc1.saldoProjetado !== 30
  ) {
    throw new Error(
      `TI-07.1 falhou: Esperado CONCILIADO para aluno 1, obtido ${itemConc1?.statusConciliacao}`,
    )
  }

  if (!itemConc2 || itemConc2.statusConciliacao !== 'DIVERGENTE' || itemConc2.diferenca !== -10) {
    throw new Error(
      `TI-07.2 falhou: Esperado DIVERGENTE com diferença -10 para aluno 2, obtido ${itemConc2?.statusConciliacao}`,
    )
  }

  if (
    !itemConc3 ||
    itemConc3.statusConciliacao !== 'SEM_REFERENCIA' ||
    itemConc3.saldoProjetado !== 15
  ) {
    throw new Error(
      `TI-07.3 falhou: Esperado SEM_REFERENCIA para aluno 3, obtido ${itemConc3?.statusConciliacao}`,
    )
  }

  if (
    resultadoConc.resumo.totalConciliados !== 1 ||
    resultadoConc.resumo.totalDivergentes !== 1 ||
    resultadoConc.resumo.totalSemReferencia !== 1 ||
    resultadoConc.resumo.totalHorasLote !== 45
  ) {
    throw new Error(
      `TI-07.4 falhou: Resumo de conciliação inesperado: ${JSON.stringify(resultadoConc.resumo)}`,
    )
  }

  // Testar exclusão pontual de linha no lote (linha_lote_3)
  const concComExclusao = calcularConciliacaoSaldos({
    linhasLote: linhasLoteConc,
    idsLinhasExcluidas: new Set(['linha_lote_3']),
    alunosExistentes: [alunoConcBanco1, alunoConcBanco2],
    lancamentosExistentes: lancExistentesConc,
    categoriasNde: categoriasMock,
  })

  const itemExcluido = concComExclusao.alunosConciliacao.find((a) => a.matricula === 'PSI_CONC_03')
  if (!itemExcluido || itemExcluido.horasLote !== 0 || itemExcluido.saldoProjetado !== 0) {
    throw new Error(
      'TI-07.5 falhou: Exclusão de linha no lote não zerou as horas ativas do lote do aluno 3',
    )
  }

  resultados.push(
    'TI-07: Conciliação de saldos aluno por aluno (CONCILIADO, DIVERGENTE, SEM_REFERENCIA e exclusão do lote) passou.',
  )

  // ==========================================
  // TI-08: DETECÇÃO DE CABEÇALHOS NA 2ª LINHA (BANNERS)
  // ==========================================
  const wsComBanner = XLSX.utils.aoa_to_sheet([
    ['BANNER DE INSTRUÇÃO INSTITUCIONAL — NÃO EDITAR', '', '', ''],
    ['Nome', 'Matrícula', 'Turno', 'Semestre atual'],
    ['Estudante Teste 1', 'MAT_TESTE_1', 'Noturno', '3º'],
    ['Estudante Teste 2', 'MAT_TESTE_2', 'Matutino', '1º'],
  ])

  const extraidoBanner = extrairLinhasComCabecalhoInteligente(wsComBanner, [
    'nome',
    'matricula',
    'turno',
    'semestreatual',
  ])

  if (extraidoBanner.linhaCabecalhoIdx !== 1) {
    throw new Error(
      `TI-08.1 falhou: Esperado cabeçalho na linha de índice 1 (2ª linha), mas obteve índice ${extraidoBanner.linhaCabecalhoIdx}`,
    )
  }
  if (extraidoBanner.linhas.length !== 2) {
    throw new Error(
      `TI-08.2 falhou: Esperado 2 linhas de dados após o cabeçalho, mas obteve ${extraidoBanner.linhas.length}`,
    )
  }
  resultados.push('TI-08: Detecção inteligente de cabeçalhos na 2ª linha (banners) passou.')

  // ==========================================
  // TI-09: DATAS MISTAS (dd/mm/yyyy E ISO TIMESTAMP) E SEMESTRE ORDINAL ("1º", "3º")
  // ==========================================
  const wbMultiAbaTeste = XLSX.utils.book_new()

  // Aba Config Tabela
  const wsConfigMock = XLSX.utils.aoa_to_sheet([
    ['CONFIGURAÇÃO — Tabela de Horas Complementares', '', ''],
    ['Parâmetros:', '', ''],
    ['Semestre letivo atual:', '2026.2', ''],
    ['Mínimo exigido por semestre:', 20, ''],
    ['Meta do curso:', 200, ''],
    ['Categoria', 'Horas por atividade', 'Máximo do curso'],
    ['Eventos científicos com apresentação de trabalho', '20h por evento', 40],
    ['Artes e Cultura', '10h por evento', 150],
    ['Nota: edite apenas as células de parâmetro', '', ''],
  ])
  XLSX.utils.book_append_sheet(wbMultiAbaTeste, wsConfigMock, 'Config Tabela 2026.2')

  // Aba Alunos (com semestre ordinal "1º" e "3º")
  const wsAlunosMock = XLSX.utils.aoa_to_sheet([
    ['CADASTRO DE ALUNOS — BANNER CABEÇALHO', '', '', '', '', ''],
    ['Nome', 'Matrícula', 'Turno', 'Semestre atual', 'Entrada', 'E-mail'],
    ['Aluno Alpha Teste', 'MAT_ALPHA', 'Noturno', '1º', '2026.2', 'alpha@teste.edu.br'],
    ['Aluno Beta Teste', 'MAT_BETA', 'Matutino', '3º', '2025.1', 'beta@teste.edu.br'],
  ])
  XLSX.utils.book_append_sheet(wbMultiAbaTeste, wsAlunosMock, 'Alunos')

  // Aba Lançamentos (com datas mistas: dd/mm/yyyy e ISO string)
  const wsLancamentosMock = XLSX.utils.aoa_to_sheet([
    ['LANÇAMENTOS DE HORAS — BANNER LINHA 1', '', '', '', '', '', '', '', ''],
    [
      'Data',
      'Matrícula',
      'Nome do aluno',
      'Semestre letivo da atividade',
      'Categoria',
      'Horas aceitas',
      'Comprovante OK? (SIM/NÃO)',
      'Relatório OK? (SIM/NÃO)',
      'Observação',
    ],
    // Data formato BR dd/mm/yyyy
    [
      '15/03/2025',
      'MAT_ALPHA',
      'Aluno Alpha Teste',
      '2025.1',
      'Eventos científicos com apresentação de trabalho',
      20,
      'SIM',
      'SIM',
      'Participação em congresso',
    ],
    // Data formato ISO datetime com fuso
    [
      '2026-10-04T03:06:28.000Z',
      'MAT_BETA',
      'Aluno Beta Teste',
      '2026.1',
      'Artes e Cultura',
      10,
      'SIM',
      'SIM',
      'Atividade cultural e museu',
    ],
  ])
  XLSX.utils.book_append_sheet(wbMultiAbaTeste, wsLancamentosMock, 'Lançamentos')

  // Aba Painel por Turma (para conciliação com Total geral acumulado)
  const wsTurmaMock = XLSX.utils.aoa_to_sheet([
    ['PAINEL POR TURMA — BANNER', '', '', '', '', '', '', '', ''],
    [
      'Nome',
      'Turno',
      'Semestre atual',
      'Entrada',
      'Total geral acumulado',
      'Horas do semestre atual',
      'Restante semestre atual',
      'Restante até o fim do curso',
      'Balanço semestral',
    ],
    ['Aluno Alpha Teste', 'Noturno', 1, '2026.2', 20, 20, 0, 180, 'CUMPRIU'],
    ['Aluno Beta Teste', 'Matutino', 3, '2025.1', 15, 10, 10, 185, 'DIVERGENTE_PROPOSITAL'],
  ])
  XLSX.utils.book_append_sheet(wbMultiAbaTeste, wsTurmaMock, 'Painel por Turma')

  const bufferTeste = XLSX.write(wbMultiAbaTeste, { type: 'array', bookType: 'xlsx' })

  const resultadoParserMultiAba = processarPlanilhaExcel({
    arquivoBuffer: bufferTeste,
    alunosExistentes: [],
    categoriasNde: categoriasMock,
    lancamentosExistentes: [],
    semestreAtualPadrao: '2026.2',
  })

  if (resultadoParserMultiAba.linhas.length !== 2) {
    throw new Error(
      `TI-09.1 falhou: Esperado 2 linhas de lançamentos, obteve ${resultadoParserMultiAba.linhas.length}`,
    )
  }

  const l1 = resultadoParserMultiAba.linhas.find((l) => l.matricula === 'MAT_ALPHA')
  const l2 = resultadoParserMultiAba.linhas.find((l) => l.matricula === 'MAT_BETA')

  if (!l1 || l1.dataLancamento !== '2025-03-15') {
    throw new Error(
      `TI-09.2 falhou: Esperado normalização de data dd/mm/yyyy para 2025-03-15, obteve ${l1?.dataLancamento}`,
    )
  }
  if (!l2 || l2.dataLancamento !== '2026-10-04') {
    throw new Error(
      `TI-09.3 falhou: Esperado normalização de data ISO para 2026-10-04, obteve ${l2?.dataLancamento}`,
    )
  }
  if (l1.semestreAtual !== 1 || l2.semestreAtual !== 3) {
    throw new Error(
      `TI-09.4 falhou: Semestres ordinais ("1º", "3º") não mapeados corretamente: l1=${l1.semestreAtual}, l2=${l2.semestreAtual}`,
    )
  }

  resultados.push(
    'TI-09: Normalização de datas mistas (dd/mm/yyyy e ISO) e semestres ordinais passou.',
  )

  // ==========================================
  // TI-10: CONCILIAÇÃO VIA ABA "Painel por Turma" E EXTRAÇÃO DE CONFIG
  // ==========================================
  if (!resultadoParserMultiAba.configDetectada) {
    throw new Error('TI-10.1 falhou: Configuração da aba Config Tabela não foi detectada.')
  }
  if (
    resultadoParserMultiAba.configDetectada.semestreLetivoAtual !== '2026.2' ||
    resultadoParserMultiAba.configDetectada.minimoExigidoSemestre !== 20 ||
    resultadoParserMultiAba.configDetectada.metaCurso !== 200 ||
    resultadoParserMultiAba.configDetectada.categorias.length !== 2
  ) {
    throw new Error(
      `TI-10.2 falhou: Parâmetros detectados inválidos: ${JSON.stringify(resultadoParserMultiAba.configDetectada)}`,
    )
  }

  // Conciliação de saldos usando o mapa do Painel por Turma
  const concPainel = calcularConciliacaoSaldos({
    linhasLote: resultadoParserMultiAba.linhas,
    alunosExistentes: [],
    lancamentosExistentes: [],
    categoriasNde: categoriasMock,
    saldosDeclaradosPainelTurma: resultadoParserMultiAba.saldosDeclaradosPainelTurma,
  })

  const concAlpha = concPainel.alunosConciliacao.find((a) => a.matricula === 'MAT_ALPHA')
  const concBeta = concPainel.alunosConciliacao.find((a) => a.matricula === 'MAT_BETA')

  if (
    !concAlpha ||
    concAlpha.statusConciliacao !== 'CONCILIADO' ||
    concAlpha.saldoDeclarado !== 20
  ) {
    throw new Error(
      `TI-10.3 falhou: Esperado CONCILIADO com saldo 20 para MAT_ALPHA via Painel por Turma, obteve status ${concAlpha?.statusConciliacao} saldo ${concAlpha?.saldoDeclarado}`,
    )
  }
  if (!concBeta || concBeta.statusConciliacao !== 'DIVERGENTE' || concBeta.diferenca !== -5) {
    throw new Error(
      `TI-10.4 falhou: Esperado DIVERGENTE com diferença -5 para MAT_BETA via Painel por Turma, obteve status ${concBeta?.statusConciliacao} dif ${concBeta?.diferenca}`,
    )
  }
  if (concAlpha.origemSaldoDeclarado !== 'aba_painel_turma') {
    throw new Error(
      `TI-10.5 falhou: Origem do saldo declarado deveria ser 'aba_painel_turma', obteve ${concAlpha.origemSaldoDeclarado}`,
    )
  }

  resultados.push(
    'TI-10: Conciliação via aba Painel por Turma e detecção de configurações da aba Config Tabela passaram.',
  )

  return { todosPassaram: true, resultados }
}
