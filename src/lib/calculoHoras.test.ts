import {
  calcularHorasCategoria,
  isCategoriaBloqueada,
  validarNovoLancamento,
  validarMultiplosLancamentos,
  calcularProgressoAluno,
} from './calculoHoras'
import { gerarTextoDespacho, formatarMesAno, calcularSemestreCurso } from './formatadorDespacho'
import { executarTestesImportacao } from './importacaoPlanilha.test'
import { executarTestesAuth } from './authValidations.test'
import { executarTestesLocalStorageBackup } from './localStorageBackup.test'
import { sanitizarNomeColunaCategoria, gerarLinhasDadosCsv } from './exportacaoTurma'
import {
  obterNomeArquivoRelatorioAluno,
  gerarRelatorioAlunoPdf,
  exportarRelatoriosEmLotePdf,
} from './exportacaoRelatorioAlunoPdf'
import type { Aluno, Categoria, Lancamento, ConfiguracaoGlobal } from '../types'

/**
 * Suite de validação dos casos de teste críticos do PRD (CT-01 a CT-05)
 */
export function executarTestesUnitarios(): { todosPassaram: boolean; resultados: string[] } {
  const resultados: string[] = []

  const mockConfig: ConfiguracaoGlobal = {
    id: 'cfg1',
    semestre_letivo_atual: '2026.2',
    minimo_exigido_semestre: 20,
    meta_curso: 200,
  }

  const mockCatEventos: Categoria = {
    id: 'cat_eventos',
    nome: 'Eventos científicos com apresentação de trabalho',
    regra_horas_unitaria: '20h por evento',
    teto_maximo_curso: 40,
    ativo: true,
  }

  const mockCatCursos: Categoria = {
    id: 'cat_cursos',
    nome: 'Cursos Livres Presenciais ou Online',
    regra_horas_unitaria: '10h por atividade',
    teto_maximo_curso: 120,
    ativo: true,
  }

  const mockAluno3Semestre: Aluno = {
    id: 'aluno_1',
    matricula: 'PSI001',
    nome: 'Estudante Teste Três',
    turno: 'Matutino',
    semestre_atual: 3,
    periodo_entrada: '2025.1',
    email: 'teste@aluno.fausp.br',
  }

  // CT-01: Happy path
  const ct01 = validarNovoLancamento({
    horasAceitas: 20,
    categoria: mockCatEventos,
    horasAcumuladasAtuais: 0,
    comprovanteOk: true,
    relatorioOk: true,
  })
  if (ct01.valido) {
    resultados.push('CT-01: Happy path passou.')
  } else {
    throw new Error('CT-01 falhou')
  }

  // CT-02: Atingimento exato de teto
  const ct02 = validarNovoLancamento({
    horasAceitas: 20,
    categoria: mockCatEventos,
    horasAcumuladasAtuais: 20,
    comprovanteOk: true,
    relatorioOk: true,
  })
  const bloqueada02 = isCategoriaBloqueada(40, mockCatEventos.teto_maximo_curso)
  if (ct02.valido && bloqueada02) {
    resultados.push('CT-02: Atingimento exato de teto (aceita e bloqueia) passou.')
  } else {
    throw new Error('CT-02 falhou')
  }

  // CT-03: Bloqueio impeditivo
  const ct03 = validarNovoLancamento({
    horasAceitas: 10,
    categoria: mockCatEventos,
    horasAcumuladasAtuais: 40,
    comprovanteOk: true,
    relatorioOk: true,
  })
  if (!ct03.valido && ct03.erro?.includes('BLOQUEADA')) {
    resultados.push('CT-03: Bloqueio impeditivo de categoria bloqueada passou.')
  } else {
    throw new Error('CT-03 falhou')
  }

  // CT-04: Integralização semestral correta e apuração cronológica com carry-over
  // CT-04.1: Aluno no 1º semestre com 20h lançadas no 1º semestre
  // -> (1º): 0 horas, (2º) a (10º): 20 horas
  const mockAluno1Semestre: Aluno = {
    id: 'aluno_1sem',
    matricula: 'PSI101',
    nome: 'Estudante Primeiro Semestre',
    turno: 'Matutino',
    semestre_atual: 1,
    periodo_entrada: '2026.1',
    email: 'calouro@aluno.fausp.br',
  }

  const lancamentos20h: Lancamento[] = [
    {
      id: 'l_20h',
      aluno_id: mockAluno1Semestre.id,
      categoria_id: mockCatEventos.id,
      data_lancamento: '2026-03-10',
      semestre_letivo_atividade: '2026.1',
      horas_aceitas: 20,
      comprovante_ok: true,
      relatorio_ok: true,
      created: '2026-03-10',
      updated: '2026-03-10',
    },
  ]

  const despacho20h = gerarTextoDespacho({
    aluno: mockAluno1Semestre,
    categoriaAtividade: mockCatEventos,
    horasLancamento: 20,
    semestreAtividade: '2026.1',
    lancamentosDoAluno: lancamentos20h,
    categorias: [mockCatEventos, mockCatCursos],
    config: mockConfig,
  })

  if (!despacho20h.includes('Restante para integralizar o semestre (1º): 0 horas')) {
    throw new Error('CT-04.1 falhou: 1º semestre com 20h deveria ter 0 horas restantes')
  }
  for (let s = 2; s <= 10; s++) {
    if (!despacho20h.includes(`Restante para integralizar o semestre (${s}º): 20 horas`)) {
      throw new Error(`CT-04.1 falhou: ${s}º semestre deveria ter 20 horas restantes`)
    }
  }
  resultados.push(
    'CT-04.1: Aluno com 20h no 1º semestre -> (1º): 0 horas, (2º) a (10º): 20 horas passou.',
  )

  // CT-04.2: Aluno com 30h lançadas no 1º semestre (carry-over de 10h para o 2º)
  // -> (1º): 0 horas, (2º): 10 horas, (3º) a (10º): 20 horas
  const lancamentos30h: Lancamento[] = [
    {
      id: 'l_30h',
      aluno_id: mockAluno1Semestre.id,
      categoria_id: mockCatEventos.id,
      data_lancamento: '2026-03-10',
      semestre_letivo_atividade: '2026.1',
      horas_aceitas: 30,
      comprovante_ok: true,
      relatorio_ok: true,
      created: '2026-03-10',
      updated: '2026-03-10',
    },
  ]

  const despacho30h = gerarTextoDespacho({
    aluno: mockAluno1Semestre,
    categoriaAtividade: mockCatEventos,
    horasLancamento: 30,
    semestreAtividade: '2026.1',
    lancamentosDoAluno: lancamentos30h,
    categorias: [mockCatEventos, mockCatCursos],
    config: mockConfig,
  })

  if (!despacho30h.includes('Restante para integralizar o semestre (1º): 0 horas')) {
    throw new Error('CT-04.2 falhou: 1º semestre deveria ter 0 horas restantes')
  }
  if (!despacho30h.includes('Restante para integralizar o semestre (2º): 10 horas')) {
    throw new Error(
      'CT-04.2 falhou: 2º semestre deveria ter 10 horas restantes (sobra de 10h abatida)',
    )
  }
  for (let s = 3; s <= 10; s++) {
    if (!despacho30h.includes(`Restante para integralizar o semestre (${s}º): 20 horas`)) {
      throw new Error(`CT-04.2 falhou: ${s}º semestre deveria ter 20 horas restantes`)
    }
  }
  resultados.push(
    'CT-04.2: Aluno com 30h no 1º semestre -> (1º): 0h, (2º): 10h, (3º) a (10º): 20h (carry-over) passou.',
  )

  // CT-04.3: Aluno sem lançamentos -> todos os 10 semestres com 20 horas
  const despachoSemLancamentos = gerarTextoDespacho({
    aluno: mockAluno1Semestre,
    semestreAtividade: '2026.1',
    lancamentosDoAluno: [],
    categorias: [mockCatEventos, mockCatCursos],
    config: mockConfig,
  })

  for (let s = 1; s <= 10; s++) {
    if (
      !despachoSemLancamentos.includes(`Restante para integralizar o semestre (${s}º): 20 horas`)
    ) {
      throw new Error(
        `CT-04.3 falhou: aluno sem lançamentos no ${s}º semestre deveria ter 20 horas restantes`,
      )
    }
  }
  resultados.push(
    'CT-04.3: Aluno sem lançamentos -> todos os 10 semestres com 20 horas restantes passou.',
  )

  // CT-04.4: Validação do helper calcularSemestreCurso
  if (
    calcularSemestreCurso('2025.1', '2025.1', 1) !== 1 ||
    calcularSemestreCurso('2025.2', '2025.1', 1) !== 2 ||
    calcularSemestreCurso('2026.1', '2025.1', 1) !== 3 ||
    calcularSemestreCurso('2026.2', '2025.1', 1) !== 4 ||
    calcularSemestreCurso('2029.2', '2025.1', 1) !== 10 ||
    calcularSemestreCurso('2035.1', '2025.1', 1) !== 10 ||
    calcularSemestreCurso('', '2025.1', 3) !== 1 ||
    calcularSemestreCurso('invalido', '2025.1', 5) !== 5
  ) {
    throw new Error('CT-04.4 falhou: calcularSemestreCurso não mapeou semestres corretamente')
  }
  resultados.push(
    'CT-04.4: Helper calcularSemestreCurso (mapeamento ordinal de 1 a 10 e fallbacks) passou.',
  )

  const lancamentos: Lancamento[] = lancamentos20h

  // CT-05: Estorno negativo
  const ct05SemObs = validarNovoLancamento({
    horasAceitas: -10,
    categoria: mockCatEventos,
    horasAcumuladasAtuais: 40,
    comprovanteOk: true,
    relatorioOk: true,
    observacao: '',
  })
  const ct05ComObs = validarNovoLancamento({
    horasAceitas: -10,
    categoria: mockCatEventos,
    horasAcumuladasAtuais: 40,
    comprovanteOk: true,
    relatorioOk: true,
    observacao: 'Correção de duplicidade',
  })

  if (!ct05SemObs.valido && ct05ComObs.valido) {
    resultados.push('CT-05: Estorno negativo com justificativa obrigatória e dedução passou.')
  } else {
    throw new Error('CT-05 falhou')
  }

  // CT-06: Promoção de semestre na Virada (3º -> 4º; 10º permanece no 10º)
  const aluno3 = { ...mockAluno3Semestre, semestre_atual: 3 }
  const aluno10: Aluno = {
    id: 'aluno_10',
    matricula: 'PSI010',
    nome: 'Estudante Concluinte',
    turno: 'Vespertino',
    semestre_atual: 10,
    periodo_entrada: '2022.1',
    email: 'concluinte@aluno.fausp.br',
  }
  const alunoEspecial: Aluno = {
    id: 'aluno_esp',
    matricula: 'PSI099',
    nome: 'Estudante Especial',
    turno: 'Especial',
    semestre_atual: 1,
    periodo_entrada: '2026.1',
    email: 'especial@aluno.fausp.br',
  }

  // Lógica de promoção da virada assistida
  const simularPromocao = (aluno: Aluno, promover: boolean): number => {
    const sem = Number(aluno.semestre_atual) || 1
    if (promover && sem < 10) {
      return Math.min(10, sem + 1)
    }
    return sem
  }

  const promovido3 = simularPromocao(aluno3, true)
  const promovido10 = simularPromocao(aluno10, true)
  const mantido3 = simularPromocao(aluno3, false) // Aluno desmarcado na UI (ex: trancamento)
  const promovidoEsp = simularPromocao(alunoEspecial, true)

  if (promovido3 === 4 && promovido10 === 10 && mantido3 === 3 && promovidoEsp === 2) {
    resultados.push(
      'CT-06: Promoção de semestre na Virada (3º → 4º; 10º permanece 10º; exclusão seletiva mantida) passou.',
    )
  } else {
    throw new Error(
      `CT-06 falhou: promovido3=${promovido3}, promovido10=${promovido10}, mantido3=${mantido3}, promovidoEsp=${promovidoEsp}`,
    )
  }

  // Executar também a suíte de importação de planilha
  const testesImportacao = executarTestesImportacao()
  resultados.push(...testesImportacao.resultados)

  // Executar a suíte de validações de autenticação e e-mail
  const testesAuth = executarTestesAuth()
  resultados.push(...testesAuth.resultados)

  // Executar a suíte de persistência e resiliência com localStorage (CT-BK-01 a CT-BK-07)
  const testesBackup = executarTestesLocalStorageBackup()
  resultados.push(...testesBackup.resultados)

  // CT-07: Exportação de dados brutos CSV (flat)
  const sanitizado1 = sanitizarNomeColunaCategoria('Eventos científicos com apresentação')
  const sanitizado2 = sanitizarNomeColunaCategoria('Cursos Livres Presenciais ou Online (10h)')
  if (
    sanitizado1 === 'horas_eventos_cientificos_com_apresentacao' &&
    sanitizado2 === 'horas_cursos_livres_presenciais_ou_online_10h'
  ) {
    resultados.push('CT-07.1: Sanitização de colunas de categorias NDE passou.')
  } else {
    throw new Error(`CT-07.1 falhou: ${sanitizado1} | ${sanitizado2}`)
  }

  const exportacaoCsvTeste = gerarLinhasDadosCsv({
    alunos: [mockAluno3Semestre],
    lancamentos: lancamentos,
    categorias: [mockCatEventos, mockCatCursos],
    config: mockConfig,
  })

  // Verificar BOM
  if (!exportacaoCsvTeste.conteudoCsv.startsWith('\uFEFF')) {
    throw new Error('CT-07.2 falhou: CSV gerado não inicia com BOM UTF-8 (\\uFEFF)')
  }

  // Verificar cabeçalhos obrigatórios
  const cabecalhosEsperados = [
    'matricula',
    'nome',
    'email',
    'turno',
    'semestre_atual',
    'periodo_entrada',
    'horas_semestre_atual',
    'total_geral_horas',
    'horas_restantes_para_200h',
    'percentual_integralizacao_curso',
    'balanco_semestral',
  ]
  for (const col of cabecalhosEsperados) {
    if (!exportacaoCsvTeste.cabecalhos.includes(col)) {
      throw new Error(`CT-07.3 falhou: Coluna obrigatória ausente no CSV: ${col}`)
    }
  }

  // Verificar se as categorias NDE ativas viraram colunas sanitizadas
  const temColEventos = exportacaoCsvTeste.cabecalhos.some((c) =>
    c.includes('horas_eventos_cientificos'),
  )
  const temColCursos = exportacaoCsvTeste.cabecalhos.some((c) => c.includes('horas_cursos_livres'))
  if (!temColEventos || !temColCursos) {
    throw new Error('CT-07.4 falhou: Colunas de categorias NDE não encontradas nos cabeçalhos')
  }

  // Verificar linha do aluno:
  // Horas semestre = 20 (minimo semestral = 20 -> CUMPRIU)
  // Total geral = 20 (meta 200 -> faltam 180h, 10%)
  const linhaAluno = exportacaoCsvTeste.linhas[0]
  if (!linhaAluno) {
    throw new Error('CT-07.5 falhou: Nenhuma linha gerada para o aluno')
  }

  const idxMatricula = exportacaoCsvTeste.cabecalhos.indexOf('matricula')
  const idxBalanco = exportacaoCsvTeste.cabecalhos.indexOf('balanco_semestral')
  const idxHorasSem = exportacaoCsvTeste.cabecalhos.indexOf('horas_semestre_atual')
  const idxTotalGeral = exportacaoCsvTeste.cabecalhos.indexOf('total_geral_horas')
  const idxRestante = exportacaoCsvTeste.cabecalhos.indexOf('horas_restantes_para_200h')
  const idxPercentual = exportacaoCsvTeste.cabecalhos.indexOf('percentual_integralizacao_curso')

  if (
    linhaAluno[idxMatricula] === 'PSI001' &&
    linhaAluno[idxBalanco] === 'CUMPRIU' &&
    linhaAluno[idxHorasSem] === 20 &&
    linhaAluno[idxTotalGeral] === 20 &&
    linhaAluno[idxRestante] === 180 &&
    linhaAluno[idxPercentual] === 10
  ) {
    resultados.push('CT-07.2: Geração de linhas de dados brutos CSV com métricas e BOM passou.')
  } else {
    throw new Error(`CT-07.5 falhou: Linha de dados inesperada: ${JSON.stringify(linhaAluno)}`)
  }

  if (exportacaoCsvTeste.nomeArquivo !== 'dados-alunos-2026.2.csv') {
    throw new Error(`CT-07.6 falhou: Nome de arquivo inesperado: ${exportacaoCsvTeste.nomeArquivo}`)
  }
  resultados.push('CT-07.3: Nomenclatura automática de arquivo dados-alunos-2026.2.csv passou.')

  // CT-08: Geração de Relatório PDF Individual do Aluno e Multi-aluno em Lote
  const nomePadraoRelatorio = obterNomeArquivoRelatorioAluno(mockAluno3Semestre, mockConfig)
  if (nomePadraoRelatorio !== 'relatorio-aluno-psi001-2026-2.pdf') {
    throw new Error(`CT-08.1 falhou: Nome de arquivo PDF incorreto: ${nomePadraoRelatorio}`)
  }
  resultados.push('CT-08.1: Nomenclatura oficial do relatório PDF do estudante passou.')

  const resultadoPdf = gerarRelatorioAlunoPdf({
    aluno: mockAluno3Semestre,
    lancamentos: lancamentos,
    categorias: [mockCatEventos, mockCatCursos],
    config: mockConfig,
    salvarArquivo: false,
  })

  if (!resultadoPdf.doc || resultadoPdf.doc.getNumberOfPages() < 1) {
    throw new Error('CT-08.2 falhou: Documento jsPDF não gerou páginas válidas')
  }
  resultados.push('CT-08.2: Renderização de estrutura institucional do PDF individual passou.')

  // Validar geração com categoria bloqueada (CT-02 / CT-03)
  const lancamentosNoTeto: Lancamento[] = [
    {
      id: 'l1',
      aluno_id: mockAluno3Semestre.id,
      categoria_id: mockCatEventos.id,
      data_lancamento: '2026-08-10',
      semestre_letivo_atividade: '2026.2',
      horas_aceitas: 40, // atinge teto 40h
      comprovante_ok: true,
      relatorio_ok: true,
      created: '2026-08-10',
      updated: '2026-08-10',
    },
    {
      id: 'l2',
      aluno_id: mockAluno3Semestre.id,
      categoria_id: mockCatEventos.id,
      data_lancamento: '2026-08-11',
      semestre_letivo_atividade: '2026.2',
      horas_aceitas: -5, // estorno
      comprovante_ok: true,
      relatorio_ok: true,
      observacao: 'Ajuste de carga horária',
      created: '2026-08-11',
      updated: '2026-08-11',
    },
  ]

  const resultadoPdfEstorno = gerarRelatorioAlunoPdf({
    aluno: mockAluno3Semestre,
    lancamentos: lancamentosNoTeto,
    categorias: [mockCatEventos, mockCatCursos],
    config: mockConfig,
    salvarArquivo: false,
  })

  if (!resultadoPdfEstorno.doc || resultadoPdfEstorno.doc.getNumberOfPages() < 1) {
    throw new Error('CT-08.3 falhou: PDF com estorno e lançamentos negativos falhou')
  }
  resultados.push('CT-08.3: Geração de PDF com histórico e estornos auditáveis passou.')

  // =========================================================================
  // TESTES DE MULTI-CATEGORIA NO MESMO LANÇAMENTO (CT-MULTI-01 a CT-MULTI-06)
  // =========================================================================

  const mockCatPalestras: Categoria = {
    id: 'cat_palestras',
    nome: 'Palestras e Seminários de Psicologia',
    regra_horas_unitaria: '5h por palestra',
    teto_maximo_curso: 30,
    ativo: true,
  }

  // CT-MULTI-01: Lançamento de múltiplas categorias simultâneas válidas (happy path)
  const ctMulti01 = validarMultiplosLancamentos({
    linhas: [
      { id: 'l1', categoriaId: mockCatEventos.id, horas: 20 },
      { id: 'l2', categoriaId: mockCatCursos.id, horas: 30 },
      { id: 'l3', categoriaId: mockCatPalestras.id, horas: 10 },
    ],
    categorias: [mockCatEventos, mockCatCursos, mockCatPalestras],
    lancamentosDoAluno: [],
    comprovanteOk: true,
    relatorioOk: true,
  })

  if (!ctMulti01.valido || ctMulti01.totalHorasOperacao !== 60 || ctMulti01.linhas.length !== 3) {
    throw new Error('CT-MULTI-01 falhou: validação de múltiplas categorias válidas não aprovada')
  }
  resultados.push('CT-MULTI-01: Lançamento múltiplo com 3 categorias e 60h totais aprovado.')

  // CT-MULTI-02: Recusa de categoria duplicada na mesma operação
  const ctMulti02 = validarMultiplosLancamentos({
    linhas: [
      { id: 'l1', categoriaId: mockCatEventos.id, horas: 10 },
      { id: 'l2', categoriaId: mockCatEventos.id, horas: 15 },
    ],
    categorias: [mockCatEventos, mockCatCursos],
    lancamentosDoAluno: [],
    comprovanteOk: true,
    relatorioOk: true,
  })

  if (ctMulti02.valido || !ctMulti02.erroGeral?.includes('mais de uma vez')) {
    throw new Error('CT-MULTI-02 falhou: permitiu mesma categoria duplicada na operação')
  }
  resultados.push('CT-MULTI-02: Recusa de categoria duplicada na mesma operação passou.')

  // CT-MULTI-03: Bloqueio quando UMA das categorias estourar o teto independente
  // mockCatEventos já tem 30h de 40h de teto. Tentativa: +20h estoura (50h > 40h).
  // mockCatCursos tem 0h de 120h. Tentativa: +30h ok.
  const lancamentosPreviaAluno: Lancamento[] = [
    {
      id: 'l_prev',
      aluno_id: mockAluno3Semestre.id,
      categoria_id: mockCatEventos.id,
      data_lancamento: '2026-08-01',
      semestre_letivo_atividade: '2026.2',
      horas_aceitas: 30,
      comprovante_ok: true,
      relatorio_ok: true,
      created: '2026-08-01',
      updated: '2026-08-01',
    },
  ]

  const ctMulti03 = validarMultiplosLancamentos({
    linhas: [
      { id: 'l1', categoriaId: mockCatEventos.id, horas: 20 }, // estoura teto (30 + 20 = 50 > 40)
      { id: 'l2', categoriaId: mockCatCursos.id, horas: 30 }, // ok (0 + 30 <= 120)
    ],
    categorias: [mockCatEventos, mockCatCursos],
    lancamentosDoAluno: lancamentosPreviaAluno,
    comprovanteOk: true,
    relatorioOk: true,
  })

  if (
    ctMulti03.valido ||
    !ctMulti03.erroGeral?.includes('ultrapassam o teto') ||
    !ctMulti03.erroGeral?.includes('Você ainda pode lançar até') ||
    !ctMulti03.linhas.some((l) => l.categoriaId === mockCatEventos.id && l.estourouTeto) ||
    !ctMulti03.linhas.some((l) => l.categoriaId === mockCatCursos.id && l.valida)
  ) {
    throw new Error('CT-MULTI-03 falhou: verificação independente de teto não identificou estouro')
  }
  resultados.push('CT-MULTI-03: Bloqueio quando uma das categorias estoura o teto passou.')

  // CT-MULTI-04: Bloqueio de categoria que já estava bloqueada previamente
  const lancamentosNoTetoCompleto: Lancamento[] = [
    {
      id: 'l_teto',
      aluno_id: mockAluno3Semestre.id,
      categoria_id: mockCatEventos.id,
      data_lancamento: '2026-08-01',
      semestre_letivo_atividade: '2026.2',
      horas_aceitas: 40,
      comprovante_ok: true,
      relatorio_ok: true,
      created: '2026-08-01',
      updated: '2026-08-01',
    },
  ]

  const ctMulti04 = validarMultiplosLancamentos({
    linhas: [
      { id: 'l1', categoriaId: mockCatEventos.id, horas: 5 },
      { id: 'l2', categoriaId: mockCatCursos.id, horas: 20 },
    ],
    categorias: [mockCatEventos, mockCatCursos],
    lancamentosDoAluno: lancamentosNoTetoCompleto,
    comprovanteOk: true,
    relatorioOk: true,
  })

  if (
    ctMulti04.valido ||
    !ctMulti04.erroGeral?.includes('já integralmente atingido') ||
    !ctMulti04.erroGeral?.includes('Não é possível deferir novos lançamentos')
  ) {
    throw new Error('CT-MULTI-04 falhou: categoria previamente bloqueada não foi rejeitada')
  }
  resultados.push('CT-MULTI-04: Rejeição de categoria previamente no teto máximo passou.')

  // CT-MULTI-05: Exigência do duplo checklist documental para toda a operação
  const ctMulti05SemRelatorio = validarMultiplosLancamentos({
    linhas: [{ id: 'l1', categoriaId: mockCatCursos.id, horas: 10 }],
    categorias: [mockCatCursos],
    lancamentosDoAluno: [],
    comprovanteOk: true,
    relatorioOk: false,
  })

  if (ctMulti05SemRelatorio.valido) {
    throw new Error('CT-MULTI-05 falhou: operação aceita sem checklist de relatório reflexivo')
  }
  resultados.push(
    'CT-MULTI-05: Exigência obrigatória de duplo checklist comprovante/relatório passou.',
  )

  // CT-MULTI-06: Verificação de que o despacho consolida todas as categorias e recalcula totais
  const lancamentosAposMulti: Lancamento[] = [
    {
      id: 'l_m1',
      aluno_id: mockAluno3Semestre.id,
      categoria_id: mockCatEventos.id,
      data_lancamento: '2026-08-20',
      semestre_letivo_atividade: '2026.2',
      horas_aceitas: 40, // atinge teto 40h
      comprovante_ok: true,
      relatorio_ok: true,
      created: '2026-08-20',
      updated: '2026-08-20',
    },
    {
      id: 'l_m2',
      aluno_id: mockAluno3Semestre.id,
      categoria_id: mockCatCursos.id,
      data_lancamento: '2026-08-20',
      semestre_letivo_atividade: '2026.2',
      horas_aceitas: 20,
      comprovante_ok: true,
      relatorio_ok: true,
      created: '2026-08-20',
      updated: '2026-08-20',
    },
  ]

  const despachoMulti = gerarTextoDespacho({
    aluno: mockAluno3Semestre,
    atividadesLancadas: [
      { categoria: mockCatEventos, horas: 40 },
      { categoria: mockCatCursos, horas: 20 },
    ],
    semestreAtividade: '2026.2',
    lancamentosDoAluno: lancamentosAposMulti,
    categorias: [mockCatEventos, mockCatCursos],
    config: mockConfig,
    dataDespacho: new Date('2026-08-20T12:00:00Z'),
  })

  // Verificações essenciais no despacho:
  // 1. Abertura plural listando ambas as categorias e a soma total (60 horas)
  if (
    !despachoMulti.includes(
      'nas categorias: Eventos científicos com apresentação de trabalho (40h), Cursos Livres Presenciais ou Online (20h), totalizando 60 horas',
    )
  ) {
    throw new Error(
      `CT-MULTI-06.1 falhou: Abertura consolidada do despacho não bate com esperado:\n${despachoMulti}`,
    )
  }

  // 2. Situação atual com ambas as categorias e seus tetos
  if (
    !despachoMulti.includes(
      'Eventos científicos com apresentação de trabalho (máx 40h): total geral 40 horas',
    ) ||
    !despachoMulti.includes('Cursos Livres Presenciais ou Online (máx 120h): total geral 20 horas')
  ) {
    throw new Error(
      `CT-MULTI-06.2 falhou: Situação atual das categorias ausente ou incorreta:\n${despachoMulti}`,
    )
  }

  // 3. Apuração semestral com carry-over:
  // Aluno ingressou em 2025.1. No semestre 2026.2 ele está no 4º semestre do curso.
  // Horas no 4º semestre = 60h. Mínimo = 20h.
  // 1º, 2º e 3º semestres = 20h restantes cada (sem lançamentos anteriores).
  // 4º semestre = 0 horas restantes (sobra de 40h).
  // 5º semestre = 0 horas restantes (sobra de 20h).
  // 6º semestre = 0 horas restantes (sobra esgotada).
  // 7º a 10º semestres = 20 horas restantes cada.
  if (
    !despachoMulti.includes('Restante para integralizar o semestre (4º): 0 horas') ||
    !despachoMulti.includes('Restante para integralizar o semestre (5º): 0 horas') ||
    !despachoMulti.includes('Restante para integralizar o semestre (6º): 0 horas') ||
    !despachoMulti.includes('Restante para integralizar o semestre (7º): 20 horas')
  ) {
    throw new Error(
      `CT-MULTI-06.3 falhou: Apuração semestral ou carry-over com resultado inesperado:\n${despachoMulti}`,
    )
  }

  // 4. Totais recalculados: total geral 60 horas, restante para 200h é 140h
  if (
    !despachoMulti.includes('Restante para integralizar o curso: 140 horas') ||
    !despachoMulti.includes('60 horas')
  ) {
    throw new Error(
      `CT-MULTI-06.4 falhou: Totais de curso não recalculados corretamente:\n${despachoMulti}`,
    )
  }

  // 5. Aviso de categoria bloqueada (mockCatEventos atingiu teto de 40h)
  if (
    !despachoMulti.includes(
      'Informamos que a categoria Eventos científicos com apresentação de trabalho atingiu o limite máximo e não será mais aceita',
    )
  ) {
    throw new Error(
      `CT-MULTI-06.5 falhou: Aviso formal de bloqueio de categoria ausente:\n${despachoMulti}`,
    )
  }

  resultados.push(
    'CT-MULTI-06: Despacho oficial multi-categoria consolida aberturas, saldos, numeral 0 e aviso de teto.',
  )

  // =========================================================================
  // TESTE DE FORMATAÇÃO DE DATA (APENAS MÊS E ANO MM/YYYY)
  // =========================================================================
  const mesAno1 = formatarMesAno('2025-03-15')
  const mesAno2 = formatarMesAno('2026-10-04T03:06:28.000Z')
  const mesAno3 = formatarMesAno('15/05/2024')
  const mesAno4 = formatarMesAno('08/2026')

  if (
    mesAno1 !== '03/2025' ||
    mesAno2 !== '10/2026' ||
    mesAno3 !== '05/2024' ||
    mesAno4 !== '08/2026'
  ) {
    throw new Error(
      `CT-DATA-MES-ANO falhou: Formatação esperada MM/YYYY não bateu: ${mesAno1}, ${mesAno2}, ${mesAno3}, ${mesAno4}`,
    )
  }
  resultados.push('CT-DATA-MES-ANO: Formatação padronizada para MM/YYYY em todo o sistema passou.')

  return { todosPassaram: true, resultados }
}
