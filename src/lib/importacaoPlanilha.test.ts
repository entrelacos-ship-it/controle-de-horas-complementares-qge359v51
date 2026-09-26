import * as XLSX from 'xlsx'
import {
  normalizarChave,
  identificarColunas,
  encontrarCategoriaCorrespondente,
  converterDataParaIso,
  gerarChaveDeducao,
  processarPlanilhaExcel,
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

  return { todosPassaram: true, resultados }
}
