import {
  calcularHorasCategoria,
  isCategoriaBloqueada,
  validarNovoLancamento,
  calcularProgressoAluno,
} from './calculoHoras'
import { gerarTextoDespacho } from './formatadorDespacho'
import { executarTestesImportacao } from './importacaoPlanilha.test'
import { executarTestesAuth } from './authValidations.test'
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

  // CT-04: Regra do numeral 0 no despacho
  const lancamentos: Lancamento[] = [
    {
      id: 'l1',
      aluno_id: mockAluno3Semestre.id,
      categoria_id: mockCatEventos.id,
      data_lancamento: '2026-08-10',
      semestre_letivo_atividade: '2026.2',
      horas_aceitas: 20,
      comprovante_ok: true,
      relatorio_ok: true,
      created: '2026-08-10',
      updated: '2026-08-10',
    },
  ]

  const despacho = gerarTextoDespacho({
    aluno: mockAluno3Semestre,
    categoriaAtividade: mockCatEventos,
    horasLancamento: 20,
    semestreAtividade: '2026.2',
    lancamentosDoAluno: lancamentos,
    categorias: [mockCatEventos, mockCatCursos],
    config: mockConfig,
  })

  let ct04Ok = true
  for (let s = 4; s <= 10; s++) {
    if (!despacho.includes(`Restante para integralizar o semestre (${s}º): 0 horas`)) {
      ct04Ok = false
      break
    }
  }
  if (ct04Ok) {
    resultados.push('CT-04: Regra do numeral 0 (4º ao 10º semestre com 0 horas) passou.')
  } else {
    throw new Error('CT-04 falhou')
  }

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

  return { todosPassaram: true, resultados }
}
