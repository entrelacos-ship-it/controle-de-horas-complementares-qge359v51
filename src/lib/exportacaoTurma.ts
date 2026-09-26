import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Aluno, ConfiguracaoGlobal, Lancamento } from '@/types'

export interface TurmaItemExportacao {
  id: string
  nome: string
  matricula: string
  turno: string
  periodo_entrada: string
  semestre_atual: number
  totalGeral: number
  horasSemestre: number
  restanteSemestre: number
  cumpriu: boolean
  porcentagemCurso: number
}

export function prepararDadosTurma(
  alunos: Aluno[],
  lancamentos: Lancamento[],
  config: ConfiguracaoGlobal | null,
): TurmaItemExportacao[] {
  const semestreAtual = config?.semestre_letivo_atual || '2026.2'
  const minimoSemestral = config?.minimo_exigido_semestre || 20
  const metaCurso = config?.meta_curso || 200

  return alunos.map((aluno) => {
    const lancsAluno = lancamentos.filter((l) => l.aluno_id === aluno.id)
    const totalGeral = lancsAluno.reduce((sum, l) => sum + (Number(l.horas_aceitas) || 0), 0)
    const horasSemestre = lancsAluno
      .filter((l) => l.semestre_letivo_atividade === semestreAtual)
      .reduce((sum, l) => sum + (Number(l.horas_aceitas) || 0), 0)

    const restanteSemestre = Math.max(0, minimoSemestral - horasSemestre)
    const cumpriu = horasSemestre >= minimoSemestral
    const porcentagemCurso =
      metaCurso > 0 ? Math.min(100, Math.round((totalGeral / metaCurso) * 100)) : 0

    return {
      id: aluno.id,
      nome: aluno.nome,
      matricula: aluno.matricula,
      turno: aluno.turno,
      periodo_entrada: aluno.periodo_entrada,
      semestre_atual: aluno.semestre_atual,
      totalGeral,
      horasSemestre,
      restanteSemestre,
      cumpriu,
      porcentagemCurso,
    }
  })
}

export function exportarTurmaExcel(params: {
  itens: TurmaItemExportacao[]
  config: ConfiguracaoGlobal | null
  filtroEntrada?: string
  filtroTurno?: string
}) {
  const { itens, config, filtroEntrada = 'Todas', filtroTurno = 'Todos' } = params
  const semestreAtual = config?.semestre_letivo_atual || '2026.2'
  const metaCurso = config?.meta_curso || 200
  const minimoSemestral = config?.minimo_exigido_semestre || 20
  const dataEmissao = new Date().toLocaleString('pt-BR')

  // Agrupar itens por Entrada e Turno
  const grupos: { [chave: string]: TurmaItemExportacao[] } = {}
  itens.forEach((item) => {
    const chave = `Turma ${item.periodo_entrada} — ${item.turno}`
    if (!grupos[chave]) {
      grupos[chave] = []
    }
    grupos[chave].push(item)
  })

  // Ordenar grupos alfabeticamente/por ano decrescente
  const chavesOrdenadas = Object.keys(grupos).sort((a, b) => b.localeCompare(a))

  // Montar linhas da planilha (formato matriz de células)
  const rows: (string | number)[][] = [
    ['FAUSP — Faculdade de Psicologia'],
    ['Controle de Horas Complementares — Painel por Turma'],
    [`Semestre Letivo: ${semestreAtual}`, `Data de Emissão: ${dataEmissao}`],
    [`Filtros Aplicados: Entrada [${filtroEntrada}] | Turno [${filtroTurno}]`],
    [
      `Parâmetros NDE: Meta do Curso = ${metaCurso}h | Mínimo Semestral Exigido = ${minimoSemestral}h`,
    ],
    [], // linha em branco
  ]

  chavesOrdenadas.forEach((grupoChave) => {
    rows.push([`>>> ${grupoChave.toUpperCase()} (${grupos[grupoChave].length} estudantes)`])
    rows.push([
      'Nome do Estudante',
      'Matrícula',
      'Turno',
      'Entrada',
      'Semestre Atual',
      `Total Geral (${metaCurso}h)`,
      `Horas Semestre (${semestreAtual})`,
      'Restante Semestre',
      'Balanço Semestral',
    ])

    const alunosDoGrupo = [...grupos[grupoChave]].sort((a, b) => a.nome.localeCompare(b.nome))

    alunosDoGrupo.forEach((aluno) => {
      rows.push([
        aluno.nome,
        aluno.matricula,
        aluno.turno,
        aluno.periodo_entrada,
        `${aluno.semestre_atual}º Semestre`,
        `${aluno.totalGeral}h`,
        `${aluno.horasSemestre}h`,
        aluno.restanteSemestre > 0 ? `Faltam ${aluno.restanteSemestre}h` : 'Integralizado',
        aluno.cumpriu ? 'CUMPRIU' : 'NÃO CUMPRIU',
      ])
    })

    rows.push([]) // espaçador entre grupos
  })

  // Nota de rodapé pedagógica
  rows.push([
    'NOTA PEDAGÓGICA INSTITUCIONAL: O balanço "NÃO CUMPRIU" é um alerta pedagógico de acompanhamento semestral e NÃO GERA DP nem reprovação.',
  ])
  rows.push([
    'O estudante pode compensar as horas complementares nos semestres subsequentes até a integralização das 200h totais exigidas.',
  ])

  const ws = XLSX.utils.aoa_to_sheet(rows)

  // Configurar larguras aproximadas das colunas
  ws['!cols'] = [
    { wch: 36 }, // Nome
    { wch: 16 }, // Matrícula
    { wch: 12 }, // Turno
    { wch: 12 }, // Entrada
    { wch: 16 }, // Semestre Atual
    { wch: 18 }, // Total Geral
    { wch: 22 }, // Horas Semestre Atual
    { wch: 20 }, // Restante Semestre
    { wch: 20 }, // Balanço Semestral
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Painel Turma')

  const nomeArquivo = `horas-complementares-turma-${semestreAtual}.xlsx`
  XLSX.writeFile(wb, nomeArquivo)
}

export function exportarTurmaPdf(params: {
  itens: TurmaItemExportacao[]
  config: ConfiguracaoGlobal | null
  filtroEntrada?: string
  filtroTurno?: string
}) {
  const { itens, config, filtroEntrada = 'Todas', filtroTurno = 'Todos' } = params
  const semestreAtual = config?.semestre_letivo_atual || '2026.2'
  const metaCurso = config?.meta_curso || 200
  const minimoSemestral = config?.minimo_exigido_semestre || 20
  const dataEmissao = new Date().toLocaleString('pt-BR')

  // Documento em formato A4 Paisagem (landscape) para acomodar com folga todas as colunas
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'a4',
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  // Cabeçalho institucional com cores FAUSP (#0f2b48 navy e #1d4ed8 azul)
  doc.setFillColor(15, 43, 72) // #0f2b48
  doc.rect(0, 0, pageWidth, 48, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('FAUSP — Faculdade de Psicologia', 40, 22)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text('Controle de Horas Complementares — Painel por Turma', 40, 38)

  // Metadados abaixo do banner
  doc.setTextColor(51, 65, 85) // slate-700
  doc.setFontSize(9)
  doc.text(`Semestre Letivo de Referência: ${semestreAtual}`, 40, 64)
  doc.text(`Data de Emissão: ${dataEmissao}`, 40, 77)

  const filtrosTexto = `Filtros: Entrada [${filtroEntrada}] | Turno [${filtroTurno}] | Total de Estudantes: ${itens.length}`
  doc.text(filtrosTexto, 400, 64)
  doc.text(
    `Critérios NDE: Mínimo Semestral = ${minimoSemestral}h | Meta Total = ${metaCurso}h`,
    400,
    77,
  )

  // Agrupar por Entrada / Turno
  const grupos: { [chave: string]: TurmaItemExportacao[] } = {}
  itens.forEach((item) => {
    const chave = `Turma ${item.periodo_entrada} — ${item.turno}`
    if (!grupos[chave]) {
      grupos[chave] = []
    }
    grupos[chave].push(item)
  })

  const chavesOrdenadas = Object.keys(grupos).sort((a, b) => b.localeCompare(a))

  let currentY = 90

  chavesOrdenadas.forEach((grupoChave) => {
    const grupoAlunos = [...grupos[grupoChave]].sort((a, b) => a.nome.localeCompare(b.nome))

    // Título do Grupo
    // Se estiver muito perto do fim da página, cria nova página
    if (currentY > pageHeight - 120) {
      doc.addPage()
      currentY = 40
    }

    doc.setFillColor(241, 245, 249) // slate-100
    doc.roundedRect(40, currentY, pageWidth - 80, 22, 3, 3, 'F')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(15, 43, 72)
    doc.text(
      `${grupoChave.toUpperCase()} (${grupoAlunos.length} estudante${grupoAlunos.length === 1 ? '' : 's'})`,
      50,
      currentY + 15,
    )

    currentY += 28

    const tableRows = grupoAlunos.map((aluno) => [
      aluno.nome,
      aluno.matricula,
      aluno.turno,
      aluno.periodo_entrada,
      `${aluno.semestre_atual}º Sem`,
      `${aluno.totalGeral}h / ${metaCurso}h (${aluno.porcentagemCurso}%)`,
      `${aluno.horasSemestre}h`,
      aluno.restanteSemestre > 0 ? `Faltam ${aluno.restanteSemestre}h` : 'Integralizado',
      aluno.cumpriu ? 'CUMPRIU' : 'NÃO CUMPRIU',
    ])

    autoTable(doc, {
      startY: currentY,
      margin: { left: 40, right: 40 },
      head: [
        [
          'Estudante',
          'Matrícula',
          'Turno',
          'Entrada',
          'Semestre',
          `Total Geral (${metaCurso}h)`,
          `Semestre Atual (${semestreAtual})`,
          'Restante Semestre',
          'Balanço',
        ],
      ],
      body: tableRows,
      theme: 'grid',
      headStyles: {
        fillColor: [29, 78, 216], // #1d4ed8
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'left',
      },
      styles: {
        fontSize: 8,
        cellPadding: 4,
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240],
        lineWidth: 0.5,
      },
      columnStyles: {
        0: { cellWidth: 'auto', fontStyle: 'bold' }, // Nome
        1: { cellWidth: 70 }, // Matrícula
        2: { cellWidth: 55 }, // Turno
        3: { cellWidth: 50 }, // Entrada
        4: { cellWidth: 55 }, // Semestre
        5: { cellWidth: 85 }, // Total Geral
        6: { cellWidth: 80 }, // Semestre Atual
        7: { cellWidth: 85 }, // Restante
        8: { cellWidth: 80, halign: 'center' }, // Balanço
      },
      didParseCell: (data) => {
        // Colorir a coluna de Balanço
        if (data.section === 'body' && data.column.index === 8) {
          if (data.cell.raw === 'CUMPRIU') {
            data.cell.styles.textColor = [22, 101, 52] // green-800
            data.cell.styles.fillColor = [220, 252, 231] // green-100
            data.cell.styles.fontStyle = 'bold'
          } else if (data.cell.raw === 'NÃO CUMPRIU') {
            data.cell.styles.textColor = [154, 52, 18] // amber-800
            data.cell.styles.fillColor = [254, 243, 199] // amber-100
            data.cell.styles.fontStyle = 'bold'
          }
        }
      },
    })

    // Atualiza a posição atual baseada na última tabela renderizada
    const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY
    currentY = (finalY || currentY + 40) + 16
  })

  // Se a nota pedagógica não couber na página atual, adiciona página
  if (currentY > pageHeight - 90) {
    doc.addPage()
    currentY = 40
  }

  // Caixa da Nota Pedagógica
  doc.setFillColor(254, 243, 199) // amber-100
  doc.setDrawColor(245, 158, 11) // amber-500
  doc.setLineWidth(1)
  doc.roundedRect(40, currentY, pageWidth - 80, 48, 4, 4, 'FD')

  doc.setTextColor(120, 53, 15) // amber-900
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.text('AVISO PEDAGÓGICO INSTITUCIONAL:', 50, currentY + 16)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  const textoNota1 =
    'O status "NÃO CUMPRIU" é um alerta pedagógico de acompanhamento semestral e NÃO GERA DP (dependência) nem reprovação.'
  const textoNota2 =
    'O estudante pode compensar as horas nos semestres subsequentes até a integralização das 200h totais exigidas no curso de Psicologia da FAUSP.'
  doc.text(textoNota1, 50, currentY + 29)
  doc.text(textoNota2, 50, currentY + 40)

  // Rodapé em todas as páginas: numeração
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFontSize(7.5)
    doc.setTextColor(148, 163, 184)
    doc.text(
      `FAUSP Psicologia — Controle de Horas Complementares | Página ${i} de ${totalPages}`,
      pageWidth / 2,
      pageHeight - 15,
      { align: 'center' },
    )
  }

  const nomeArquivo = `horas-complementares-turma-${semestreAtual}.pdf`
  doc.save(nomeArquivo)
}
