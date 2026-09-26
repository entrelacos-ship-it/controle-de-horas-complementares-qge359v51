import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { AtaNDE } from '@/types/auditoria'
import type { Aluno, Lancamento, Categoria, ConfiguracaoGlobal } from '@/types'
import { calcularBalancoAoVivoSemestre } from '@/services/auditoria'

export interface GerarAtaNdePdfOpcoes {
  ata: AtaNDE
  alunos: Aluno[]
  lancamentos: Lancamento[]
  categorias: Categoria[]
  config: ConfiguracaoGlobal | null
  salvarArquivo?: boolean
}

/**
 * Gera o documento PDF oficial da Ata de Homologação NDE para a Secretaria Acadêmica Geral.
 */
export function gerarAtaNdePdf(opcoes: GerarAtaNdePdfOpcoes): {
  doc: jsPDF
  nomeArquivo: string
} {
  const { ata, alunos, lancamentos, categorias, config, salvarArquivo = true } = opcoes

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  })

  const pageWidth = doc.internal.pageSize.getWidth() // ~595.28 pt
  const margemEsq = 36
  const margemDir = 36
  const larguraUtil = pageWidth - margemEsq - margemDir

  const balanco = calcularBalancoAoVivoSemestre({
    semestreAtivo: ata.semestre_letivo,
    alunos,
    lancamentos,
    categorias,
    config,
  })

  const dataFormatada = new Date(ata.data_homologacao).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

  // 1. Cabeçalho Institucional FAUSP Navy #0f2b48
  doc.setFillColor(15, 43, 72)
  doc.rect(0, 0, pageWidth, 58, 'F')

  doc.setFillColor(29, 78, 216)
  doc.rect(0, 58, pageWidth, 3, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('FAUSP — FACULDADE DE PSICOLOGIA', margemEsq, 22)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(
    'Núcleo Docente Estruturante (NDE) · Ata Oficial de Homologação Semestral',
    margemEsq,
    36,
  )
  doc.setFontSize(8)
  doc.setTextColor(226, 232, 240)
  doc.text(
    `Coordenação do Curso: Prof.ª ${ata.presidente_coordenadora} (CRP ${ata.crp_coordenadora || '06/77114'})`,
    margemEsq,
    49,
  )

  // Metadados no cabeçalho
  doc.setFontSize(9)
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.text(`Ata NDE N° ${ata.numero_ata}`, pageWidth - margemDir, 22, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text(`Semestre Letivo: ${ata.semestre_letivo}`, pageWidth - margemDir, 36, { align: 'right' })
  doc.text(`Status: HOMOLOGADA`, pageWidth - margemDir, 49, { align: 'right' })

  let currentY = 78

  // 2. Título do Documento
  doc.setTextColor(15, 43, 72)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text(
    `ATA ORDINÁRIA DE FECHAMENTO E HOMOLOGAÇÃO NDE — SEMESTRE ${ata.semestre_letivo}`,
    margemEsq,
    currentY,
  )

  currentY += 16
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(51, 65, 85)
  const textoAbertura = `Aos ${dataFormatada}, reuniu-se ordinariamente o Núcleo Docente Estruturante (NDE) do Curso de Psicologia da FAUSP, sob a presidência da Coordenadora Prof.ª ${ata.presidente_coordenadora} (CRP ${ata.crp_coordenadora || '06/77114'}), para deliberar sobre a homologação final e consolidação de horas complementares deferidas no Semestre Letivo ${ata.semestre_letivo}, em estrita conformidade com as Diretrizes Curriculares Nacionais (CNE/CES) e o Regulamento Institucional de Atividades Complementares.`

  const linhasAbertura = doc.splitTextToSize(textoAbertura, larguraUtil)
  doc.text(linhasAbertura, margemEsq, currentY)
  currentY += linhasAbertura.length * 11 + 10

  // 3. Quadro Síntese dos Indicadores de Homologação
  const colW = larguraUtil / 4
  const boxH = 46

  // Card 1: Avaliados
  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(226, 232, 240)
  doc.roundedRect(margemEsq, currentY, colW - 5, boxH, 3, 3, 'FD')
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(71, 85, 105)
  doc.text('ALUNOS AVALIADOS', margemEsq + 8, currentY + 14)
  doc.setFontSize(16)
  doc.setTextColor(15, 43, 72)
  doc.text(String(ata.total_alunos_avaliados), margemEsq + 8, currentY + 34)

  // Card 2: Aptos Colação
  const x2 = margemEsq + colW
  doc.setFillColor(240, 253, 244)
  doc.setDrawColor(187, 247, 208)
  doc.roundedRect(x2, currentY, colW - 5, boxH, 3, 3, 'FD')
  doc.setFontSize(8)
  doc.setTextColor(22, 101, 52)
  doc.text('APTOS COLAÇÃO (≥200h)', x2 + 8, currentY + 14)
  doc.setFontSize(16)
  doc.setTextColor(22, 163, 74)
  doc.text(String(ata.total_concluintes_aptos), x2 + 8, currentY + 34)

  // Card 3: Cumpriram Meta
  const x3 = margemEsq + colW * 2
  doc.setFillColor(239, 246, 255)
  doc.setDrawColor(191, 219, 254)
  doc.roundedRect(x3, currentY, colW - 5, boxH, 3, 3, 'FD')
  doc.setFontSize(8)
  doc.setTextColor(30, 64, 175)
  doc.text('CUMPRIU META (≥20h)', x3 + 8, currentY + 14)
  doc.setFontSize(16)
  doc.setTextColor(29, 78, 216)
  doc.text(String(ata.total_cumpriram_meta), x3 + 8, currentY + 34)

  // Card 4: Alerta Pedagógico
  const x4 = margemEsq + colW * 3
  doc.setFillColor(254, 252, 232)
  doc.setDrawColor(254, 240, 138)
  doc.roundedRect(x4, currentY, colW - 5, boxH, 3, 3, 'FD')
  doc.setFontSize(8)
  doc.setTextColor(161, 98, 7)
  doc.text('ALERTA PEDAGÓGICO', x4 + 8, currentY + 14)
  doc.setFontSize(16)
  doc.setTextColor(217, 119, 6)
  doc.text(String(ata.total_alerta_pedagogico), x4 + 8, currentY + 34)

  currentY += boxH + 14

  // 4. Tabela de Balanço Nominal dos Alunos no Semestre
  doc.setTextColor(15, 43, 72)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('RELAÇÃO NOMINAL DOS ESTUDANTES AVALIADOS NO SEMESTRE', margemEsq, currentY)
  currentY += 6

  const linhasTabela = balanco.balancoAlunos.map((b) => [
    b.nome,
    b.matricula,
    `${b.turno} (${b.semestreAtual}º Sem)`,
    `${b.horasSemestre}h`,
    `${b.totalGeralHoras}h / 200h`,
    b.cumpriuSemestre ? 'CUMPRIU' : 'NÃO CUMPRIU',
    b.aptoColacao ? 'APTO COLAÇÃO' : 'EM CURSO',
  ])

  autoTable(doc, {
    startY: currentY,
    margin: { left: margemEsq, right: margemDir },
    head: [
      [
        'Estudante',
        'Matrícula',
        'Turma/Semestre',
        `Horas ${ata.semestre_letivo}`,
        'Progresso Total',
        'Meta Semestral',
        'Situação',
      ],
    ],
    body:
      linhasTabela.length > 0
        ? linhasTabela
        : [['Nenhum aluno com lançamentos no semestre', '', '', '', '', '', '']],
    theme: 'grid',
    headStyles: {
      fillColor: [15, 43, 72],
      textColor: 255,
      fontSize: 8,
      fontStyle: 'bold',
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 3.5,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
    },
    columnStyles: {
      0: { fontStyle: 'bold' },
      3: { halign: 'right', fontStyle: 'bold' },
      4: { halign: 'right' },
      5: { halign: 'center' },
      6: { halign: 'center', fontStyle: 'bold' },
    },
    didDrawCell: (data) => {
      if (data.section === 'body' && data.column.index === 5) {
        if (data.cell.raw === 'CUMPRIU') {
          doc.setTextColor(22, 101, 52)
        } else if (data.cell.raw === 'NÃO CUMPRIU') {
          doc.setTextColor(180, 83, 9)
        }
      }
      if (data.section === 'body' && data.column.index === 6) {
        if (data.cell.raw === 'APTO COLAÇÃO') {
          doc.setTextColor(22, 163, 74)
        } else {
          doc.setTextColor(71, 85, 105)
        }
      }
    },
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const finalTableY = (doc as any).lastAutoTable?.finalY || currentY + 150
  let yAposTabela = finalTableY + 16

  // Se estiver muito perto do fim da página, cria nova página
  if (yAposTabela > 700) {
    doc.addPage()
    yAposTabela = 40
  }

  // 5. Nota Pedagógica de Fechamento
  doc.setFillColor(254, 252, 232)
  doc.setDrawColor(254, 240, 138)
  doc.roundedRect(margemEsq, yAposTabela, larguraUtil, 40, 3, 3, 'FD')

  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(146, 64, 14) // amber-800
  doc.text(
    'NOTA PEDAGÓGICA DE HOMOLOGAÇÃO & DIRETRIZES DA COORDENAÇÃO:',
    margemEsq + 8,
    yAposTabela + 13,
  )

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(120, 53, 15)
  const textoNota = `A homologação deste semestre letivo certifica as horas aceitas para fins de registro no histórico escolar oficial pela Secretaria Acadêmica Geral. Alunos que não atingiram a meta semestral mínima de 20h permanecem sob orientação formativa, podendo compensar a carga nos semestres subsequentes sem aplicação de dependência (DP).`
  const linhasNota = doc.splitTextToSize(textoNota, larguraUtil - 16)
  doc.text(linhasNota, margemEsq + 8, yAposTabela + 24)

  yAposTabela += 55

  // 6. Termo de Encerramento e Assinaturas
  if (yAposTabela > 720) {
    doc.addPage()
    yAposTabela = 50
  }

  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(71, 85, 105)
  doc.text(
    'Nada mais havendo a tratar, lavrou-se a presente ata que, após lida e achada conforme, é subscrita pelos membros presentes.',
    margemEsq,
    yAposTabela,
  )

  yAposTabela += 35

  // Duas colunas de assinatura
  const assinaturaColW = larguraUtil / 2 - 20

  // Coluna 1: Coordenadora
  doc.setDrawColor(148, 163, 184)
  doc.line(margemEsq, yAposTabela, margemEsq + assinaturaColW, yAposTabela)
  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(15, 43, 72)
  doc.text(`Prof.ª ${ata.presidente_coordenadora}`, margemEsq, yAposTabela + 12)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(100, 116, 139)
  doc.text(
    `Coordenadora de Curso · CRP ${ata.crp_coordenadora || '06/77114'}`,
    margemEsq,
    yAposTabela + 22,
  )
  doc.text('Presidente da Sessão NDE — FAUSP', margemEsq, yAposTabela + 32)

  // Coluna 2: Representante NDE / Secretaria
  const xSec = margemEsq + assinaturaColW + 40
  doc.line(xSec, yAposTabela, xSec + assinaturaColW, yAposTabela)
  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(15, 43, 72)
  doc.text('Secretaria Acadêmica Geral', xSec, yAposTabela + 12)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(100, 116, 139)
  doc.text('Registro e Homologação de Histórico Escolar', xSec, yAposTabela + 22)
  doc.text('FAUSP Faculdade de Psicologia', xSec, yAposTabela + 32)

  // Rodapé em todas as páginas
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(148, 163, 184)
    doc.text(
      `Ata NDE N° ${ata.numero_ata} · Semestre Letivo ${ata.semestre_letivo} · Documento Oficial FAUSP · Página ${i} de ${totalPages}`,
      margemEsq,
      doc.internal.pageSize.getHeight() - 15,
    )
    doc.text(
      `Homologado em ${dataFormatada}`,
      pageWidth - margemDir,
      doc.internal.pageSize.getHeight() - 15,
      { align: 'right' },
    )
  }

  const nomeArquivo = `ata-nde-${ata.numero_ata.replace(/[^a-zA-Z0-9]/g, '-')}-${ata.semestre_letivo}.pdf`

  if (salvarArquivo) {
    doc.save(nomeArquivo)
  }

  return { doc, nomeArquivo }
}
