import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Aluno, Categoria, ConfiguracaoGlobal, Lancamento } from '@/types'
import { calcularProgressoAluno } from '@/lib/calculoHoras'
import { formatarMesAno } from '@/lib/formatadorDespacho'

export interface GerarRelatorioAlunoPdfOpcoes {
  aluno: Aluno
  lancamentos: Lancamento[]
  categorias: Categoria[]
  config: ConfiguracaoGlobal | null
  salvarArquivo?: boolean
  docExistente?: jsPDF
  novaPaginaSeExistente?: boolean
}

export interface GerarRelatorioLotePdfOpcoes {
  alunos: Aluno[]
  lancamentos: Lancamento[]
  categorias: Categoria[]
  config: ConfiguracaoGlobal | null
  nomeArquivo?: string
  onProgress?: (atual: number, total: number) => void
}

/**
 * Sanitiza texto para uso em nomes de arquivo
 */
export function sanitizarNomeArquivo(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Retorna o nome padrão do arquivo PDF individual de um aluno
 */
export function obterNomeArquivoRelatorioAluno(
  aluno: Aluno,
  config: ConfiguracaoGlobal | null,
): string {
  const matriculaLimpa = sanitizarNomeArquivo(aluno.matricula || 'aluno')
  const semestre = sanitizarNomeArquivo(config?.semestre_letivo_atual || '2026.2')
  return `relatorio-aluno-${matriculaLimpa}-${semestre}.pdf`
}

/**
 * Renderiza o relatório formal de balanço pedagógico de um aluno em um documento jsPDF (A4 Retrato).
 * Pode criar um novo doc ou estender um doc existente (permitindo geração em lote multi-aluno).
 */
export function gerarRelatorioAlunoPdf(params: GerarRelatorioAlunoPdfOpcoes): {
  doc: jsPDF
  nomeArquivo: string
} {
  const {
    aluno,
    lancamentos,
    categorias,
    config,
    salvarArquivo = true,
    docExistente,
    novaPaginaSeExistente = true,
  } = params

  if (!aluno) {
    throw new Error('Estudante não informado para emissão do relatório PDF.')
  }

  // Filtrar lançamentos exclusivos deste aluno
  const lancamentosDoAluno = lancamentos.filter((l) => l.aluno_id === aluno.id)

  // Filtrar apenas categorias ativas (se nenhuma for ativa, usa todas como fallback)
  const categoriasAtivas = categorias.filter((c) => c.ativo !== false)
  const listaCategorias = categoriasAtivas.length > 0 ? categoriasAtivas : categorias

  // Configuração e parâmetros pedagógicos institucionais
  const configEfetiva: ConfiguracaoGlobal = config || {
    id: '',
    semestre_letivo_atual: '2026.2',
    minimo_exigido_semestre: 20,
    meta_curso: 200,
    nome_da_coordenadora: 'Roberta Andrea de Oliveira',
    crp_coordenadora: '06/77114',
  }

  const semestreAtual = configEfetiva.semestre_letivo_atual || '2026.2'
  const minimoSemestral = Number(configEfetiva.minimo_exigido_semestre) || 20
  const metaCurso = Number(configEfetiva.meta_curso) || 200
  const nomeCoordenadora = configEfetiva.nome_da_coordenadora || 'Roberta Andrea de Oliveira'
  const crpCoordenadora = configEfetiva.crp_coordenadora || '06/77114'

  // Motor oficial de cálculo de progresso
  const progresso = calcularProgressoAluno(
    aluno,
    lancamentosDoAluno,
    listaCategorias,
    configEfetiva,
  )
  const restanteParaCurso = Math.max(0, metaCurso - progresso.totalGeralHoras)

  // Instanciar doc em A4 Retrato (portrait) em pontos
  const doc =
    docExistente ||
    new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'a4',
    })

  // Se já existir doc e novaPaginaSeExistente for true, adiciona nova página
  if (docExistente && novaPaginaSeExistente) {
    doc.addPage()
  }

  const pageStartNumber = doc.getNumberOfPages()

  const pageWidth = doc.internal.pageSize.getWidth() // ~595.28 pt
  const pageHeight = doc.internal.pageSize.getHeight() // ~841.89 pt
  const margemEsq = 36
  const margemDir = 36
  const larguraUtil = pageWidth - margemEsq - margemDir // ~523.28 pt

  const dataEmissao = new Date().toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  // -------------------------------------------------------------
  // 1. CABEÇALHO INSTITUCIONAL (Banner Navy #0f2b48)
  // -------------------------------------------------------------
  doc.setFillColor(15, 43, 72) // FAUSP navy #0f2b48
  doc.rect(0, 0, pageWidth, 54, 'F')

  // Faixa de destaque azul #1d4ed8
  doc.setFillColor(29, 78, 216)
  doc.rect(0, 54, pageWidth, 3, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('FAUSP — FACULDADE DE PSICOLOGIA', margemEsq, 22)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text('Controle de Horas Complementares · Balanço Pedagógico Individual', margemEsq, 36)
  doc.setFontSize(8)
  doc.setTextColor(226, 232, 240)
  doc.text(
    `Coordenação de Curso: Prof.ª ${nomeCoordenadora} (CRP ${crpCoordenadora})`,
    margemEsq,
    48,
  )

  // Metadados à direita do banner
  doc.setFontSize(8)
  doc.setTextColor(255, 255, 255)
  doc.text(`Semestre Letivo: ${semestreAtual}`, pageWidth - margemDir, 22, { align: 'right' })
  doc.text(`Emissão: ${dataEmissao}`, pageWidth - margemDir, 36, { align: 'right' })

  let currentY = 70

  // -------------------------------------------------------------
  // 2. IDENTIFICAÇÃO DO ALUNO (Card com borda)
  // -------------------------------------------------------------
  doc.setFillColor(248, 250, 252) // slate-50
  doc.setDrawColor(226, 232, 240) // slate-200
  doc.setLineWidth(0.8)
  doc.roundedRect(margemEsq, currentY, larguraUtil, 58, 4, 4, 'FD')

  // Barra vertical azul na esquerda do card
  doc.setFillColor(29, 78, 216)
  doc.roundedRect(margemEsq, currentY, 4, 58, 2, 2, 'F')

  doc.setTextColor(15, 43, 72)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text(aluno.nome.toUpperCase(), margemEsq + 12, currentY + 16)

  // Badge da matrícula ao lado do nome
  const nomeWidth = doc.getTextWidth(aluno.nome.toUpperCase())
  const badgeX = margemEsq + 16 + nomeWidth
  if (badgeX < pageWidth - margemDir - 110) {
    doc.setFillColor(29, 78, 216)
    doc.roundedRect(badgeX, currentY + 6, 85, 13, 2, 2, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text(`MATRÍCULA: ${aluno.matricula}`, badgeX + 42.5, currentY + 15, { align: 'center' })
  }

  // Linhas de dados acadêmicos do aluno
  doc.setTextColor(71, 85, 105) // slate-600
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.text(
    `Matrícula: ${aluno.matricula}   |   Turno: ${aluno.turno}   |   Semestre Atual: ${aluno.semestre_atual}º Semestre   |   Entrada: ${aluno.periodo_entrada}`,
    margemEsq + 12,
    currentY + 33,
  )
  doc.text(
    `E-mail Institucional: ${aluno.email || 'Não informado'}   |   Curso: Bacharelado e Licenciatura em Psicologia`,
    margemEsq + 12,
    currentY + 47,
  )

  currentY += 68

  // -------------------------------------------------------------
  // 3. PAINEL DE BALANÇO PEDAGÓGICO & PROGRESSO
  // -------------------------------------------------------------
  // Dividido em 2 colunas:
  // Coluna 1 (esquerda): Progresso do Curso (200h) com barra gráfica
  // Coluna 2 (direita): Balanço do Semestre Letivo Atual (CUMPRIU / NÃO CUMPRIU)
  const colLargura = (larguraUtil - 10) / 2

  // Box 1: Progresso Global
  doc.setFillColor(255, 255, 255)
  doc.setDrawColor(226, 232, 240)
  doc.roundedRect(margemEsq, currentY, colLargura, 68, 4, 4, 'FD')

  doc.setTextColor(15, 43, 72)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text(`PROGRESSO DO CURSO (META: ${metaCurso}h)`, margemEsq + 10, currentY + 15)

  doc.setFontSize(16)
  doc.setTextColor(15, 43, 72)
  doc.text(`${progresso.totalGeralHoras}h`, margemEsq + 10, currentY + 36)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  doc.text(`/ ${metaCurso}h`, margemEsq + 58, currentY + 35)

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(22, 163, 74) // verde #16a34a
  doc.text(`(${progresso.porcentagemCurso}%)`, margemEsq + 96, currentY + 35)

  // Barra de progresso visual
  const barraX = margemEsq + 10
  const barraY = currentY + 42
  const barraW = colLargura - 20
  const barraH = 6
  doc.setFillColor(241, 245, 249) // slate-100
  doc.roundedRect(barraX, barraY, barraW, barraH, 2, 2, 'F')

  const progressoW = Math.min(barraW, Math.max(0, (progresso.porcentagemCurso / 100) * barraW))
  if (progressoW > 0) {
    doc.setFillColor(22, 163, 74) // verde
    doc.roundedRect(barraX, barraY, progressoW, barraH, 2, 2, 'F')
  }

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(100, 116, 139)
  const textoRestante =
    restanteParaCurso > 0
      ? `Faltam ${restanteParaCurso}h para integralizar as ${metaCurso}h.`
      : 'Carga horária total integralizada para colação!'
  doc.text(textoRestante, margemEsq + 10, currentY + 59)

  // Box 2: Balanço Semestral
  const box2X = margemEsq + colLargura + 10
  const cumpriu = progresso.cumpriuSemestre

  if (cumpriu) {
    doc.setFillColor(240, 253, 244) // green-50
    doc.setDrawColor(187, 247, 208) // green-200
  } else {
    doc.setFillColor(254, 252, 232) // yellow-50
    doc.setDrawColor(254, 240, 138) // yellow-200
  }
  doc.roundedRect(box2X, currentY, colLargura, 68, 4, 4, 'FD')

  doc.setTextColor(15, 43, 72)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text(`BALANÇO SEMESTRAL (${semestreAtual})`, box2X + 10, currentY + 15)

  // Badge Status CUMPRIU / NÃO CUMPRIU
  const badgeStatusW = 100
  const badgeStatusH = 18
  const badgeStatusX = box2X + colLargura - badgeStatusW - 10
  const badgeStatusY = currentY + 6

  if (cumpriu) {
    doc.setFillColor(22, 163, 74) // verde
    doc.roundedRect(badgeStatusX, badgeStatusY, badgeStatusW, badgeStatusH, 3, 3, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.text('CUMPRIU', badgeStatusX + badgeStatusW / 2, badgeStatusY + 12, { align: 'center' })
  } else {
    doc.setFillColor(245, 158, 11) // âmbar #f59e0b
    doc.roundedRect(badgeStatusX, badgeStatusY, badgeStatusW, badgeStatusH, 3, 3, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.text('NÃO CUMPRIU', badgeStatusX + badgeStatusW / 2, badgeStatusY + 12, { align: 'center' })
  }

  doc.setFontSize(14)
  doc.setTextColor(15, 43, 72)
  doc.setFont('helvetica', 'bold')
  doc.text(`${progresso.horasSemestreAtual}h`, box2X + 10, currentY + 36)

  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(71, 85, 105)
  doc.text(
    `acumuladas no semestre (mínimo exigido: ${minimoSemestral}h)`,
    box2X + 48,
    currentY + 35,
  )

  doc.setFontSize(7.5)
  if (cumpriu) {
    doc.setTextColor(22, 101, 52) // green-800
    doc.text(
      `Meta semestral atingida (+${progresso.horasSemestreAtual - minimoSemestral}h além do mínimo).`,
      box2X + 10,
      currentY + 54,
    )
  } else {
    doc.setTextColor(180, 83, 9) // amber-700
    doc.text(
      `Restam ${progresso.restanteSemestreAtual}h para o mínimo semestral (instrumento formativo).`,
      box2X + 10,
      currentY + 54,
    )
  }

  currentY += 76

  // -------------------------------------------------------------
  // 4. QUADRO DE CATEGORIAS NDE E TETOS MÁXIMOS
  // -------------------------------------------------------------
  doc.setTextColor(15, 43, 72)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('1. DEMONSTRATIVO POR CATEGORIA NDE & CONTROLE DE TETOS', margemEsq, currentY + 2)

  currentY += 8

  const categoriasBloqueadas = progresso.categoriasProgresso.filter((c) => c.bloqueada)

  const tabelaCategoriasRows = progresso.categoriasProgresso.map((cp) => {
    const restanteCat = Math.max(0, cp.teto - cp.horasAcumuladas)
    let statusTexto = 'Liberada'
    if (cp.bloqueada) {
      statusTexto = 'BLOQUEADA'
    } else if (cp.porcentagem >= 80) {
      statusTexto = 'Próx. do Teto'
    }

    return [
      cp.categoria.nome,
      cp.categoria.regra_horas_unitaria || 'Conforme Edital',
      `${cp.teto}h`,
      `${cp.horasAcumuladas}h`,
      cp.bloqueada ? '0h' : `${restanteCat}h`,
      `${cp.porcentagem}%`,
      statusTexto,
    ]
  })

  autoTable(doc, {
    startY: currentY,
    margin: { left: margemEsq, right: margemDir },
    head: [
      [
        'Categoria de Atividade NDE',
        'Regra Unitária',
        'Teto',
        'Acumulado',
        'Saldo',
        '% Teto',
        'Situação',
      ],
    ],
    body: tabelaCategoriasRows,
    theme: 'grid',
    headStyles: {
      fillColor: [29, 78, 216], // #1d4ed8
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'left',
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 3.5,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.5,
    },
    columnStyles: {
      0: { cellWidth: 'auto', fontStyle: 'bold' }, // Categoria
      1: { cellWidth: 95 }, // Regra
      2: { cellWidth: 38, halign: 'center' }, // Teto
      3: { cellWidth: 46, halign: 'center', fontStyle: 'bold' }, // Acumulado
      4: { cellWidth: 38, halign: 'center' }, // Saldo
      5: { cellWidth: 40, halign: 'center' }, // %
      6: { cellWidth: 70, halign: 'center' }, // Situação
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 6) {
        if (data.cell.raw === 'BLOQUEADA') {
          data.cell.styles.textColor = [185, 28, 28] // red-700
          data.cell.styles.fillColor = [254, 242, 242] // red-50
          data.cell.styles.fontStyle = 'bold'
        } else if (data.cell.raw === 'Próx. do Teto') {
          data.cell.styles.textColor = [180, 83, 9] // amber-700
          data.cell.styles.fillColor = [254, 252, 232]
          data.cell.styles.fontStyle = 'bold'
        } else {
          data.cell.styles.textColor = [22, 101, 52] // green-800
        }
      }
    },
  })

  currentY =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ||
    currentY + 60
  currentY += 6

  // Se houver categorias bloqueadas, insere aviso formal em destaque
  if (categoriasBloqueadas.length > 0) {
    const alturaAviso = 16 + categoriasBloqueadas.length * 11
    if (currentY + alturaAviso > pageHeight - 140) {
      doc.addPage()
      currentY = 40
    }

    doc.setFillColor(254, 242, 242) // red-50
    doc.setDrawColor(239, 68, 68) // red-500
    doc.setLineWidth(0.8)
    doc.roundedRect(margemEsq, currentY, larguraUtil, alturaAviso, 3, 3, 'FD')

    doc.setTextColor(153, 27, 27) // red-800
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text('⛔ AVISO DE TRAVA PEDAGÓGICA (TETO MÁXIMO ATINGIDO):', margemEsq + 8, currentY + 11)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    let avisoY = currentY + 22
    for (const b of categoriasBloqueadas) {
      doc.text(
        `• Informamos que a categoria "${b.categoria.nome}" atingiu o limite máximo (${b.teto}h) e não será mais aceita para este/a estudante.`,
        margemEsq + 10,
        avisoY,
      )
      avisoY += 11
    }

    currentY += alturaAviso + 8
  }

  // -------------------------------------------------------------
  // 5. HISTÓRICO DE LANÇAMENTOS DO ALUNO (Cronológico / Auditável)
  // -------------------------------------------------------------
  if (currentY > pageHeight - 140) {
    doc.addPage()
    currentY = 40
  }

  doc.setTextColor(15, 43, 72)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text(
    `2. HISTÓRICO CRONOLÓGICO DE LANÇAMENTOS AUDITÁVEIS (${lancamentosDoAluno.length} REGISTRO${lancamentosDoAluno.length === 1 ? '' : 'S'})`,
    margemEsq,
    currentY + 2,
  )

  currentY += 8

  // Ordenar lançamentos em ordem cronológica (data do evento ou criação)
  const lancamentosOrdenados = [...lancamentosDoAluno].sort((a, b) => {
    const dataA = a.data_lancamento || a.created || ''
    const dataB = b.data_lancamento || b.created || ''
    return dataA.localeCompare(dataB)
  })

  const tabelaHistoricoRows =
    lancamentosOrdenados.length === 0
      ? [
          [
            '—',
            '—',
            'Nenhum lançamento homologado para este/a estudante até o momento.',
            '0h',
            '—',
            '—',
            'Sem registros',
          ],
        ]
      : lancamentosOrdenados.map((l) => {
          const horasNum = Number(l.horas_aceitas) || 0
          const horasTexto = horasNum < 0 ? `${horasNum}h (Estorno)` : `+${horasNum}h`
          const catNome =
            l.expand?.categoria_id?.nome ||
            categorias.find((c) => c.id === l.categoria_id)?.nome ||
            'Atividade Complementar'

          return [
            formatarMesAno(l.data_lancamento),
            l.semestre_letivo_atividade || '—',
            catNome,
            horasTexto,
            l.comprovante_ok ? 'SIM' : 'NÃO',
            l.relatorio_ok ? 'SIM' : 'NÃO',
            l.observacao || '—',
          ]
        })

  autoTable(doc, {
    startY: currentY,
    margin: { left: margemEsq, right: margemDir },
    head: [
      [
        'Mês/Ano',
        'Semestre',
        'Categoria Homologada',
        'Horas Aceitas',
        'Compr.',
        'Relat.',
        'Observação / Justificativa',
      ],
    ],
    body: tabelaHistoricoRows,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 43, 72], // #0f2b48
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'left',
    },
    styles: {
      fontSize: 7.2,
      cellPadding: 3.5,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.5,
    },
    columnStyles: {
      0: { cellWidth: 55, halign: 'center' }, // Mês/Ano
      1: { cellWidth: 50, halign: 'center' }, // Semestre
      2: { cellWidth: 'auto', fontStyle: 'bold' }, // Categoria
      3: { cellWidth: 65, halign: 'center', fontStyle: 'bold' }, // Horas
      4: { cellWidth: 38, halign: 'center' }, // Compr.
      5: { cellWidth: 38, halign: 'center' }, // Relat.
      6: { cellWidth: 125 }, // Observação
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 3) {
        const val = String(data.cell.raw)
        if (val.includes('Estorno') || val.startsWith('-')) {
          data.cell.styles.textColor = [185, 28, 28] // red-700
          data.cell.styles.fillColor = [254, 242, 242]
        } else {
          data.cell.styles.textColor = [22, 101, 52] // green-800
        }
      }
    },
  })

  currentY =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ||
    currentY + 60
  currentY += 12

  // -------------------------------------------------------------
  // 6. NOTA PEDAGÓGICA OFICIAL INSTITUCIONAL (Obrigatória)
  // -------------------------------------------------------------
  const alturaNotaPedagogica = 48
  const alturaAssinatura = 54
  const espacoNecessario = alturaNotaPedagogica + alturaAssinatura + 20

  if (currentY + espacoNecessario > pageHeight - 30) {
    doc.addPage()
    currentY = 40
  }

  // Caixa âmbar da Nota Pedagógica Oficial
  doc.setFillColor(254, 243, 199) // amber-100
  doc.setDrawColor(217, 119, 6) // amber-600
  doc.setLineWidth(0.8)
  doc.roundedRect(margemEsq, currentY, larguraUtil, alturaNotaPedagogica, 4, 4, 'FD')

  doc.setTextColor(120, 53, 15) // amber-900
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('NOTA PEDAGÓGICA OFICIAL INSTITUCIONAL:', margemEsq + 10, currentY + 13)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.text(
    `O status "NÃO CUMPRIU" (< ${minimoSemestral}h no semestre ${semestreAtual}) é um instrumento pedagógico de acompanhamento do Colegiado e NDE.`,
    margemEsq + 10,
    currentY + 23,
  )
  doc.setFont('helvetica', 'bold')
  doc.text(
    'NÃO GERA DEPENDÊNCIA ACADÊMICA (DP), NEM REPROVAÇÃO, NEM IMPEDIMENTO DE MATRÍCULA NO CURSO.',
    margemEsq + 10,
    currentY + 32,
  )
  doc.setFont('helvetica', 'normal')
  doc.text(
    `O discente pode compensar as horas nos semestres subsequentes até a integralização das ${metaCurso}h exigidas para a colação de grau.`,
    margemEsq + 10,
    currentY + 41,
  )

  currentY += alturaNotaPedagogica + 16

  // -------------------------------------------------------------
  // 7. LINHAS DE ASSINATURA / PROTOCOLO DA COORDENAÇÃO
  // -------------------------------------------------------------
  const larguraAssinatura = (larguraUtil - 40) / 2
  const linhaAssinaturaY = currentY + 28

  // Assinatura do Aluno
  doc.setDrawColor(148, 163, 184) // slate-400
  doc.setLineWidth(0.6)
  doc.line(margemEsq, linhaAssinaturaY, margemEsq + larguraAssinatura, linhaAssinaturaY)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(51, 65, 85)
  doc.text(aluno.nome, margemEsq + larguraAssinatura / 2, linhaAssinaturaY + 10, {
    align: 'center',
  })
  doc.setFontSize(7)
  doc.setTextColor(100, 116, 139)
  doc.text(
    `Discente — Matrícula ${aluno.matricula}`,
    margemEsq + larguraAssinatura / 2,
    linhaAssinaturaY + 18,
    {
      align: 'center',
    },
  )

  // Assinatura da Coordenação
  const assCoordX = margemEsq + larguraAssinatura + 40
  doc.line(assCoordX, linhaAssinaturaY, assCoordX + larguraAssinatura, linhaAssinaturaY)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(15, 43, 72)
  doc.text(`Prof.ª ${nomeCoordenadora}`, assCoordX + larguraAssinatura / 2, linhaAssinaturaY + 10, {
    align: 'center',
  })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(100, 116, 139)
  doc.text(
    `Coordenação de Psicologia — CRP ${crpCoordenadora}`,
    assCoordX + larguraAssinatura / 2,
    linhaAssinaturaY + 18,
    { align: 'center' },
  )

  // -------------------------------------------------------------
  // 8. RODAPÉ INSTITUCIONAL COM NUMERAÇÃO DE PÁGINAS
  // -------------------------------------------------------------
  // Aplica rodapé nas páginas criadas para este aluno (ou em todas se for doc novo)
  const pageEndNumber = doc.getNumberOfPages()

  for (let i = pageStartNumber; i <= pageEndNumber; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(148, 163, 184)
    doc.text(
      `FAUSP Psicologia · Controle de Horas Complementares · Matrícula ${aluno.matricula} · Página ${i} de ${pageEndNumber}`,
      pageWidth / 2,
      pageHeight - 14,
      { align: 'center' },
    )
  }

  const nomeArquivo = obterNomeArquivoRelatorioAluno(aluno, configEfetiva)

  if (salvarArquivo) {
    doc.save(nomeArquivo)
  }

  return { doc, nomeArquivo }
}

/**
 * Gera um único arquivo PDF multi-aluno contendo o relatório de cada estudante filtrado,
 * com cabeçalho institucional, balanço e notas pedagógicas por estudante.
 */
export async function exportarRelatoriosEmLotePdf(params: GerarRelatorioLotePdfOpcoes): Promise<{
  totalExportados: number
  nomeArquivo: string
}> {
  const {
    alunos,
    lancamentos,
    categorias,
    config,
    nomeArquivo: nomeArquivoParam,
    onProgress,
  } = params

  if (alunos.length === 0) {
    throw new Error('Nenhum estudante selecionado para emissão em lote.')
  }

  const semestreAtual = config?.semestre_letivo_atual || '2026.2'
  const nomeArquivoFinal =
    nomeArquivoParam || `relatorios-alunos-turma-${sanitizarNomeArquivo(semestreAtual)}.pdf`

  // Cria doc inicial com o primeiro aluno
  let doc: jsPDF | null = null

  for (let i = 0; i < alunos.length; i++) {
    const aluno = alunos[i]
    if (onProgress) {
      onProgress(i + 1, alunos.length)
    }

    if (i === 0) {
      const res = gerarRelatorioAlunoPdf({
        aluno,
        lancamentos,
        categorias,
        config,
        salvarArquivo: false,
      })
      doc = res.doc
    } else if (doc) {
      gerarRelatorioAlunoPdf({
        aluno,
        lancamentos,
        categorias,
        config,
        salvarArquivo: false,
        docExistente: doc,
        novaPaginaSeExistente: true,
      })
    }

    // Ceder temporariamente para UI não congelar
    if (alunos.length > 5 && i % 5 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
  }

  if (doc) {
    doc.save(nomeArquivoFinal)
  }

  return {
    totalExportados: alunos.length,
    nomeArquivo: nomeArquivoFinal,
  }
}
