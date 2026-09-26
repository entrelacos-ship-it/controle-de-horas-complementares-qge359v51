import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { listarAlunos, criarAluno, atualizarAluno } from '@/services/alunos'
import { listarCategorias } from '@/services/categorias'
import { listarTodosLancamentos, criarLancamento } from '@/services/lancamentos'
import { getConfiguracaoGlobal } from '@/services/configuracao'
import type { Aluno, Categoria, Lancamento, ConfiguracaoGlobal } from '@/types'
import {
  processarPlanilhaExcel,
  gerarPlanilhaModelo,
  exportarRelatorioErrosExcel,
  LinhaImportacaoValidada,
  ResumoValidacao,
  ResultadoEfetivacaoImportacao,
} from '@/lib/importacaoPlanilha'
import {
  FileSpreadsheet,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Download,
  RefreshCw,
  ArrowRight,
  Database,
  Users,
  Clock,
  Sparkles,
  Info,
  ShieldCheck,
  Search,
  Filter,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'

export default function Importacao() {
  const { user } = useAuth()
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Dados do banco
  const [alunosExistentes, setAlunosExistentes] = useState<Aluno[]>([])
  const [categoriasNde, setCategoriasNde] = useState<Categoria[]>([])
  const [lancamentosExistentes, setLancamentosExistentes] = useState<Lancamento[]>([])
  const [configGlobal, setConfigGlobal] = useState<ConfiguracaoGlobal | null>(null)
  const [carregandoBase, setCarregandoBase] = useState(true)

  // Estado do Arquivo e Processamento
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null)
  const [tamanhoArquivo, setTamanhoArquivo] = useState<string | null>(null)
  const [arquivoBuffer, setArquivoBuffer] = useState<ArrayBuffer | null>(null)
  const [processandoArquivo, setProcessandoArquivo] = useState(false)
  const [dragAtivo, setDragAtivo] = useState(false)

  // Dados pós-leitura
  const [linhasValidadas, setLinhasValidadas] = useState<LinhaImportacaoValidada[]>([])
  const [resumoValidacao, setResumoValidacao] = useState<ResumoValidacao | null>(null)
  const [nomeAba, setNomeAba] = useState<string>('')
  const [mapeamentoManualCategorias, setMapeamentoManualCategorias] = useState<
    Record<string, string>
  >({})

  // Filtros da tabela de pré-visualização
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')
  const [buscaTabela, setBuscaTabela] = useState<string>('')

  // Etapa atual: 1 = upload & pré-visualização/validação, 2 = confirmação e efetivação
  const [etapa, setEtapa] = useState<1 | 2>(1)
  const [efetivando, setEfetivando] = useState(false)
  const [progressoGravacao, setProgressoGravacao] = useState(0)
  const [resultadoEfetivacao, setResultadoEfetivacao] =
    useState<ResultadoEfetivacaoImportacao | null>(null)

  // Carregar dados de apoio
  const carregarDadosDoBanco = async () => {
    try {
      setCarregandoBase(true)
      const [alunos, cats, lancs, cfg] = await Promise.all([
        listarAlunos(),
        listarCategorias(false), // todas para casamento de histórico
        listarTodosLancamentos(),
        getConfiguracaoGlobal(),
      ])
      setAlunosExistentes(alunos)
      setCategoriasNde(cats)
      setLancamentosExistentes(lancs)
      setConfigGlobal(cfg)
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro ao carregar dados do banco',
        description: 'Não foi possível buscar alunos e categorias para validação cruzada.',
        variant: 'destructive',
      })
    } finally {
      setCarregandoBase(false)
    }
  }

  useEffect(() => {
    carregarDadosDoBanco()
  }, [])

  // Processa o buffer quando o arquivo é selecionado ou quando o mapeamento manual muda
  const reprocessarArquivo = (
    buffer: ArrayBuffer,
    mapCategorias: Record<string, string> = mapeamentoManualCategorias,
  ) => {
    try {
      setProcessandoArquivo(true)
      const resultado = processarPlanilhaExcel({
        arquivoBuffer: buffer,
        alunosExistentes,
        categoriasNde,
        lancamentosExistentes,
        semestreAtualPadrao: configGlobal?.semestre_letivo_atual || '2026.2',
        mapeamentoManualCategorias: mapCategorias,
      })

      setLinhasValidadas(resultado.linhas)
      setResumoValidacao(resultado.resumo)
      setNomeAba(resultado.nomeAbaUsada)
      setEtapa(1)
      setResultadoEfetivacao(null)
    } catch (err: unknown) {
      console.error(err)
      const msg = err instanceof Error ? err.message : 'Falha ao processar arquivo Excel.'
      toast({
        title: 'Erro na leitura da planilha',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setProcessandoArquivo(false)
    }
  }

  const handleArquivoSelecionado = (file: File) => {
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      toast({
        title: 'Formato inválido',
        description: 'Por favor envie uma planilha nos formatos .xlsx ou .xls.',
        variant: 'destructive',
      })
      return
    }

    setNomeArquivo(file.name)
    setTamanhoArquivo((file.size / 1024).toFixed(1) + ' KB')

    const reader = new FileReader()
    reader.onload = (e) => {
      const buffer = e.target?.result as ArrayBuffer
      if (buffer) {
        setArquivoBuffer(buffer)
        reprocessarArquivo(buffer)
      }
    }
    reader.readAsArrayBuffer(file)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragAtivo(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleArquivoSelecionado(e.dataTransfer.files[0])
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragAtivo(true)
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragAtivo(false)
  }

  const handleMapearCategoriaManual = (categoriaTexto: string, novaCategoriaId: string) => {
    const novoMap = { ...mapeamentoManualCategorias, [categoriaTexto]: novaCategoriaId }
    setMapeamentoManualCategorias(novoMap)
    if (arquivoBuffer) {
      reprocessarArquivo(arquivoBuffer, novoMap)
    }
  }

  // Filtragem da tabela de pré-visualização
  const linhasFiltradas = linhasValidadas.filter((linha) => {
    if (filtroStatus !== 'todos') {
      if (filtroStatus === 'duplicados' && !linha.isDuplicado) return false
      if (filtroStatus === 'erros' && linha.status !== 'erro') return false
      if (filtroStatus === 'avisos' && linha.status !== 'aviso') return false
      if (filtroStatus === 'validas' && linha.status !== 'valida') return false
    }

    if (buscaTabela.trim()) {
      const q = buscaTabela.toLowerCase()
      const matchNome = linha.nome.toLowerCase().includes(q)
      const matchMat = linha.matricula.toLowerCase().includes(q)
      const matchCat = linha.categoriaTexto.toLowerCase().includes(q)
      if (!matchNome && !matchMat && !matchCat) return false
    }

    return true
  })

  // Efetivar Importação (Etapa 2)
  const handleEfetivarImportacao = async () => {
    if (!linhasValidadas || linhasValidadas.length === 0) return

    setEfetivando(true)
    setProgressoGravacao(0)

    let alunosCriados = 0
    let alunosAtualizados = 0
    let lancamentosCriados = 0
    let lancamentosIgnoradosDuplicados = 0
    const errosAoGravar: Array<{ linhaNumero: number; item: string; motivo: string }> = []

    // 1. Processar Alunos (mapa em memória para ids reais do PocketBase)
    const mapaMatriculaParaId = new Map<string, string>()
    alunosExistentes.forEach((a) => mapaMatriculaParaId.set(a.matricula.trim().toUpperCase(), a.id))

    // Agrupar dados mais recentes de cada aluno na planilha
    const alunosParaProcessar = new Map<
      string,
      {
        matricula: string
        nome: string
        turno: 'Matutino' | 'Vespertino' | 'Noturno' | 'Especial'
        semestre_atual: number
        periodo_entrada: string
        email: string
      }
    >()

    linhasValidadas.forEach((linha) => {
      if (linha.matricula && !alunosParaProcessar.has(linha.matricula)) {
        alunosParaProcessar.set(linha.matricula, {
          matricula: linha.matricula,
          nome: linha.nome,
          turno: linha.turno,
          semestre_atual: linha.semestreAtual,
          periodo_entrada: linha.periodoEntrada,
          email: linha.email,
        })
      }
    })

    const totalAlunos = alunosParaProcessar.size
    let idxAluno = 0

    for (const [matricula, dadosAluno] of alunosParaProcessar) {
      idxAluno++
      const idExistente = mapaMatriculaParaId.get(matricula)
      try {
        if (idExistente) {
          // Atualiza dados cadastrais mantendo a integridade (RN de matrícula única)
          await atualizarAluno(idExistente, {
            nome: dadosAluno.nome,
            turno: dadosAluno.turno,
            semestre_atual: dadosAluno.semestre_atual,
            periodo_entrada: dadosAluno.periodo_entrada,
            email: dadosAluno.email,
          })
          alunosAtualizados++
        } else {
          // Cria novo aluno
          const novo = await criarAluno(dadosAluno)
          mapaMatriculaParaId.set(matricula, novo.id)
          alunosCriados++
        }
      } catch (err: unknown) {
        console.error('Erro ao salvar aluno:', err)
        errosAoGravar.push({
          linhaNumero: 0,
          item: `Aluno: ${dadosAluno.nome} (${matricula})`,
          motivo: err instanceof Error ? err.message : 'Erro ao persistir cadastro do aluno',
        })
      }
      setProgressoGravacao(Math.round((idxAluno / (totalAlunos + linhasValidadas.length)) * 100))
    }

    // 2. Processar Lançamentos
    const totalLinhas = linhasValidadas.length
    for (let i = 0; i < totalLinhas; i++) {
      const linha = linhasValidadas[i]

      // Ignora linhas com erro estrutural grave ou já duplicadas
      if (linha.status === 'erro' || !linha.categoriaIdCorrespondente) {
        if (linha.status === 'erro') {
          errosAoGravar.push({
            linhaNumero: linha.linhaNumero,
            item: `Lançamento ${linha.nome}`,
            motivo: linha.erros.join(', '),
          })
        }
        continue
      }

      if (linha.isDuplicado) {
        lancamentosIgnoradosDuplicados++
        continue
      }

      const alunoIdReal = mapaMatriculaParaId.get(linha.matricula)
      if (!alunoIdReal) {
        errosAoGravar.push({
          linhaNumero: linha.linhaNumero,
          item: `Lançamento para matrícula ${linha.matricula}`,
          motivo: 'Aluno não pôde ser localizado ou criado no banco',
        })
        continue
      }

      try {
        await criarLancamento({
          aluno_id: alunoIdReal,
          categoria_id: linha.categoriaIdCorrespondente,
          data_lancamento: `${linha.dataLancamento} 12:00:00.000Z`,
          semestre_letivo_atividade: linha.semestreAtividade,
          horas_aceitas: linha.horas,
          comprovante_ok: true, // Checklist OK por padrão na importação legada
          relatorio_ok: true, // Checklist OK por padrão na importação legada
          observacao: linha.observacao,
        })
        lancamentosCriados++
      } catch (err: unknown) {
        console.error('Erro ao criar lançamento:', err)
        errosAoGravar.push({
          linhaNumero: linha.linhaNumero,
          item: `Linha ${linha.linhaNumero} (${linha.nome} - ${linha.horas}h)`,
          motivo: err instanceof Error ? err.message : 'Falha na gravação do lançamento',
        })
      }

      setProgressoGravacao(Math.round(((totalAlunos + i + 1) / (totalAlunos + totalLinhas)) * 100))
    }

    setResultadoEfetivacao({
      alunosCriados,
      alunosAtualizados,
      lancamentosCriados,
      lancamentosIgnoradosDuplicados,
      errosAoGravar,
    })

    setEfetivando(false)
    setEtapa(2)

    // Recarregar os dados do banco para que próximas operações estejam em sincronia
    carregarDadosDoBanco()

    toast({
      title: 'Importação concluída com sucesso!',
      description: `${lancamentosCriados} lançamentos e ${alunosCriados + alunosAtualizados} alunos processados.`,
    })
  }

  const handleBaixarRelatorioAuditoria = () => {
    if (linhasValidadas.length === 0) return
    exportarRelatorioErrosExcel(linhasValidadas)
    toast({
      title: 'Relatório baixado',
      description: 'O arquivo com o log de auditoria foi gerado com sucesso.',
    })
  }

  const handleBaixarModelo = () => {
    gerarPlanilhaModelo()
    toast({
      title: 'Modelo de planilha gerado',
      description: 'Use a planilha baixada como referência de cabeçalhos e preenchimento.',
    })
  }

  const handleResetar = () => {
    setNomeArquivo(null)
    setTamanhoArquivo(null)
    setArquivoBuffer(null)
    setLinhasValidadas([])
    setResumoValidacao(null)
    setEtapa(1)
    setResultadoEfetivacao(null)
    setMapeamentoManualCategorias({})
  }

  return (
    <div className="space-y-8 animate-fade-in pb-16">
      {/* Header Institucional */}
      <div className="border-b border-slate-200 pb-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1d4ed8] text-white shadow-md">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <div>
              <h1 className="font-['Outfit'] text-2xl font-bold tracking-tight text-[#0f2b48] sm:text-3xl">
                Importação da Planilha Legada
              </h1>
              <p className="text-sm text-slate-600">
                Carga do histórico de alunos e horas complementares (Fase 3 · RF-011)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleBaixarModelo}
              className="text-xs font-semibold border-slate-300 text-slate-700 hover:bg-slate-100"
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Baixar Planilha Modelo (.xlsx)
            </Button>
            {nomeArquivo && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetar}
                className="text-xs text-slate-500 hover:text-slate-800"
              >
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                Novo Arquivo
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Alerta de Imutabilidade e Idempotência */}
      <Alert className="border-blue-200 bg-blue-50 text-blue-900">
        <ShieldCheck className="h-4 w-4 text-[#1d4ed8]" />
        <AlertTitle className="text-xs font-bold text-[#0f2b48]">
          Garantia de Integridade e Histórico Imutável
        </AlertTitle>
        <AlertDescription className="text-xs text-blue-800 leading-relaxed">
          Esta rotina <strong>nunca apaga registros existentes</strong>. Alunos já cadastrados têm
          apenas seus dados de turma atualizados. Lançamentos com a mesma chave (aluno + categoria +
          período + horas) são <strong>deduplicados automaticamente</strong>, permitindo reexecuções
          seguras.
        </AlertDescription>
      </Alert>

      {/* ÁREA DE UPLOAD (se nenhum arquivo carregado) */}
      {!nomeArquivo && (
        <Card className="border-2 border-dashed border-slate-300 bg-white shadow-xs hover:border-[#1d4ed8] transition-colors">
          <CardContent className="p-8 sm:p-12">
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`flex flex-col items-center justify-center rounded-xl p-6 text-center cursor-pointer transition-all ${
                dragAtivo ? 'bg-blue-50/80 scale-[1.01]' : 'hover:bg-slate-50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleArquivoSelecionado(e.target.files[0])
                  }
                }}
              />

              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100 text-[#1d4ed8] mb-4 shadow-inner">
                <UploadCloud className="h-8 w-8" />
              </div>

              <h3 className="font-['Outfit'] text-lg font-bold text-[#0f2b48]">
                Arraste o arquivo Excel (.xlsx) ou clique para selecionar
              </h3>
              <p className="mt-1 max-w-md text-xs text-slate-500">
                Compatível com a planilha protótipo{' '}
                <em>Prototipo_Horas_Complementares_Psicologia.xlsx</em> e modelos similares com
                cabeçalhos de matrícula, nome, categoria e horas.
              </p>

              <div className="mt-5 flex items-center gap-2">
                <Button
                  type="button"
                  className="bg-[#1d4ed8] hover:bg-[#1e40af] text-white text-xs font-semibold shadow-sm"
                >
                  <FileSpreadsheet className="mr-1.5 h-4 w-4" />
                  Selecionar Planilha do Computador
                </Button>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-[11px] text-slate-400">
                <span>✓ Leitura tolerante de colunas</span>
                <span>•</span>
                <span>✓ Pré-visualização com validação</span>
                <span>•</span>
                <span>✓ Deduplicação automática</span>
                <span>•</span>
                <span>✓ Checklist OK por padrão</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* SESSÃO COM ARQUIVO CARREGADO */}
      {nomeArquivo && resumoValidacao && (
        <div className="space-y-6">
          {/* Cartão de Identificação do Arquivo */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-[#0f2b48]">{nomeArquivo}</span>
                  <Badge variant="secondary" className="text-[10px] bg-slate-100 text-slate-600">
                    {tamanhoArquivo}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] text-blue-700 border-blue-200">
                    Aba: {nomeAba}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500">
                  Leitura concluída com sucesso. Validação linha a linha pronta para conferência.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleBaixarRelatorioAuditoria}
                className="text-xs text-slate-700 border-slate-300"
              >
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Baixar Relatório de Validação (.xlsx)
              </Button>
            </div>
          </div>

          {/* CARDS COM RESUMO DOS NÚMEROS */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            <Card className="border-slate-200 bg-white">
              <CardContent className="p-3.5">
                <span className="text-[11px] font-semibold text-slate-500">Total de Linhas</span>
                <div className="mt-1 font-['Outfit'] text-2xl font-bold text-[#0f2b48]">
                  {resumoValidacao.totalLinhasLidas}
                </div>
                <span className="text-[10px] text-slate-400">Lidas na planilha</span>
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-white">
              <CardContent className="p-3.5">
                <span className="text-[11px] font-semibold text-emerald-600">Linhas Válidas</span>
                <div className="mt-1 font-['Outfit'] text-2xl font-bold text-emerald-600">
                  {resumoValidacao.linhasValidas}
                </div>
                <span className="text-[10px] text-slate-400">Sem inconsistências</span>
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-white">
              <CardContent className="p-3.5">
                <span className="text-[11px] font-semibold text-amber-600">Avisos / Alertas</span>
                <div className="mt-1 font-['Outfit'] text-2xl font-bold text-amber-600">
                  {resumoValidacao.linhasComAviso}
                </div>
                <span className="text-[10px] text-slate-400">Categorias ou duplicações</span>
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-white">
              <CardContent className="p-3.5">
                <span className="text-[11px] font-semibold text-red-600">Linhas com Erro</span>
                <div className="mt-1 font-['Outfit'] text-2xl font-bold text-red-600">
                  {resumoValidacao.linhasComErro}
                </div>
                <span className="text-[10px] text-slate-400">Dados ausentes ou inválidos</span>
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-white">
              <CardContent className="p-3.5">
                <span className="text-[11px] font-semibold text-[#1d4ed8]">Estudantes</span>
                <div className="mt-1 font-['Outfit'] text-2xl font-bold text-[#1d4ed8]">
                  {resumoValidacao.alunosUnicos}
                </div>
                <span className="text-[10px] text-slate-400">
                  {resumoValidacao.alunosNovos} novos · {resumoValidacao.alunosExistentes}{' '}
                  existentes
                </span>
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-white">
              <CardContent className="p-3.5">
                <span className="text-[11px] font-semibold text-purple-700">Total de Horas</span>
                <div className="mt-1 font-['Outfit'] text-2xl font-bold text-purple-700">
                  {resumoValidacao.totalHorasValidas}h
                </div>
                <span className="text-[10px] text-slate-400">
                  {resumoValidacao.totalLancamentosValidos} lançamentos válidos
                </span>
              </CardContent>
            </Card>
          </div>

          {/* ALERTA DE CATEGORIAS NÃO ENCONTRADAS (MAPEAMENTO MANUAL) */}
          {Object.keys(resumoValidacao.categoriasNaoEncontradas).length > 0 && (
            <Card className="border-amber-300 bg-amber-50/70 shadow-xs">
              <CardHeader className="pb-2">
                <CardTitle className="font-['Outfit'] text-sm font-bold text-amber-900 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  Categorias que precisam de mapeamento para a tabela oficial NDE
                </CardTitle>
                <CardDescription className="text-xs text-amber-800">
                  As seguintes descrições na planilha não tiveram casamento exato. Selecione a qual
                  categoria do regulamento elas pertencem:
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {Object.entries(resumoValidacao.categoriasNaoEncontradas).map(
                    ([catTexto, qtd]) => (
                      <div
                        key={catTexto}
                        className="flex flex-col gap-1.5 rounded-lg border border-amber-200 bg-white p-3 shadow-2xs"
                      >
                        <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
                          <span className="truncate" title={catTexto}>
                            «{catTexto}»
                          </span>
                          <Badge
                            variant="outline"
                            className="text-[10px] text-amber-800 border-amber-300"
                          >
                            {qtd} {qtd === 1 ? 'ocorrência' : 'ocorrências'}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-2 mt-1">
                          <Select
                            value={mapeamentoManualCategorias[catTexto] || ''}
                            onValueChange={(val) => handleMapearCategoriaManual(catTexto, val)}
                          >
                            <SelectTrigger className="h-8 text-xs bg-slate-50">
                              <SelectValue placeholder="Mapear para categoria NDE..." />
                            </SelectTrigger>
                            <SelectContent>
                              {categoriasNde.map((c) => (
                                <SelectItem key={c.id} value={c.id} className="text-xs">
                                  {c.nome} (Teto: {c.teto_maximo_curso}h)
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* SE ETAPA 2: TELA DE RESULTADO PÓS-GRAVAÇÃO */}
          {etapa === 2 && resultadoEfetivacao && (
            <Card className="border-emerald-200 bg-emerald-50/50 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-white">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <div>
                    <CardTitle className="font-['Outfit'] text-lg font-bold text-emerald-950">
                      Importação Efetivada no Banco de Dados
                    </CardTitle>
                    <CardDescription className="text-xs text-emerald-800">
                      Os registros foram gravados e estão disponíveis imediatamente no painel de
                      alunos e lançamentos.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-lg bg-white p-3 border border-emerald-200">
                    <span className="text-[11px] text-slate-500 font-medium">Alunos Criados</span>
                    <div className="text-xl font-bold text-emerald-700">
                      {resultadoEfetivacao.alunosCriados}
                    </div>
                  </div>
                  <div className="rounded-lg bg-white p-3 border border-emerald-200">
                    <span className="text-[11px] text-slate-500 font-medium">
                      Alunos Atualizados
                    </span>
                    <div className="text-xl font-bold text-blue-700">
                      {resultadoEfetivacao.alunosAtualizados}
                    </div>
                  </div>
                  <div className="rounded-lg bg-white p-3 border border-emerald-200">
                    <span className="text-[11px] text-slate-500 font-medium">
                      Lançamentos Gravados
                    </span>
                    <div className="text-xl font-bold text-emerald-700">
                      {resultadoEfetivacao.lancamentosCriados}
                    </div>
                  </div>
                  <div className="rounded-lg bg-white p-3 border border-emerald-200">
                    <span className="text-[11px] text-slate-500 font-medium">
                      Duplicados Ignorados
                    </span>
                    <div className="text-xl font-bold text-slate-600">
                      {resultadoEfetivacao.lancamentosIgnoradosDuplicados}
                    </div>
                  </div>
                </div>

                {resultadoEfetivacao.errosAoGravar.length > 0 && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-red-900 mb-2">
                      <XCircle className="h-4 w-4 text-red-600" />
                      Ocorrências não gravadas ({resultadoEfetivacao.errosAoGravar.length}):
                    </div>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {resultadoEfetivacao.errosAoGravar.map((err, idx) => (
                        <div key={idx} className="text-[11px] text-red-700">
                          • {err.item}: {err.motivo}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setEtapa(1)}
                    className="text-xs text-slate-700 border-slate-300"
                  >
                    Voltar para Pré-visualização
                  </Button>
                  <Button
                    onClick={handleResetar}
                    className="bg-[#1d4ed8] hover:bg-[#1e40af] text-white text-xs font-semibold"
                  >
                    Importar Outra Planilha
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ETAPA 1: TABELA DE PRÉ-VISUALIZAÇÃO / VALIDAÇÃO LINHA A LINHA */}
          {etapa === 1 && (
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3 border-b border-slate-100">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="font-['Outfit'] text-base font-bold text-[#0f2b48]">
                      Etapa 1: Pré-visualização e Conferência dos Lançamentos
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500">
                      Exibindo {linhasFiltradas.length} de {linhasValidadas.length} linhas lidas
                    </CardDescription>
                  </div>

                  {/* Botão de Efetivação Principal */}
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={handleEfetivarImportacao}
                      disabled={efetivando || resumoValidacao.totalLancamentosValidos === 0}
                      className="bg-[#1d4ed8] hover:bg-[#1e40af] text-white text-xs font-semibold shadow-sm"
                    >
                      {efetivando ? (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                          Gravando ({progressoGravacao}%)...
                        </>
                      ) : (
                        <>
                          <Database className="mr-2 h-4 w-4" />
                          Efetivar Importação ({resumoValidacao.totalLancamentosValidos} registros)
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Barra de Progresso caso esteja gravando */}
                {efetivando && (
                  <div className="mt-3 space-y-1">
                    <div className="flex justify-between text-xs text-slate-600 font-medium">
                      <span>Gravando no PocketBase...</span>
                      <span>{progressoGravacao}%</span>
                    </div>
                    <Progress value={progressoGravacao} className="h-2" />
                  </div>
                )}

                {/* Filtros da Tabela */}
                <div className="flex flex-col gap-2 pt-3 sm:flex-row sm:items-center">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <Input
                      placeholder="Filtrar por nome, matrícula ou categoria..."
                      value={buscaTabela}
                      onChange={(e) => setBuscaTabela(e.target.value)}
                      className="h-8 pl-8 text-xs bg-slate-50"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                      <SelectTrigger className="h-8 w-[170px] text-xs bg-slate-50">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos" className="text-xs">
                          Todos os Status
                        </SelectItem>
                        <SelectItem value="validas" className="text-xs">
                          Apenas Válidas
                        </SelectItem>
                        <SelectItem value="avisos" className="text-xs">
                          Apenas com Avisos
                        </SelectItem>
                        <SelectItem value="erros" className="text-xs">
                          Apenas com Erros
                        </SelectItem>
                        <SelectItem value="duplicados" className="text-xs">
                          Apenas Duplicados
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                <div className="max-h-[500px] overflow-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead className="sticky top-0 z-10 bg-slate-100 text-[11px] font-bold text-slate-700 shadow-2xs">
                      <tr>
                        <th className="py-2.5 px-3 w-12 text-center">Linha</th>
                        <th className="py-2.5 px-3 w-24">Status</th>
                        <th className="py-2.5 px-3">Estudante</th>
                        <th className="py-2.5 px-3">Matrícula</th>
                        <th className="py-2.5 px-3">Turma/Semestre</th>
                        <th className="py-2.5 px-3">Categoria Mapeada</th>
                        <th className="py-2.5 px-3 text-right">Horas</th>
                        <th className="py-2.5 px-3">Período</th>
                        <th className="py-2.5 px-3">Validação & Auditoria</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {linhasFiltradas.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-8 text-center text-xs text-slate-500">
                            Nenhum registro encontrado com os filtros aplicados.
                          </td>
                        </tr>
                      ) : (
                        linhasFiltradas.map((linha) => {
                          return (
                            <tr
                              key={linha.linhaNumero}
                              className={`transition-colors hover:bg-slate-50/80 ${
                                linha.status === 'erro'
                                  ? 'bg-red-50/40'
                                  : linha.isDuplicado
                                    ? 'bg-slate-50/70 opacity-75'
                                    : linha.status === 'aviso'
                                      ? 'bg-amber-50/30'
                                      : ''
                              }`}
                            >
                              <td className="py-2 px-3 text-center font-mono text-[11px] text-slate-500">
                                {linha.linhaNumero}
                              </td>

                              <td className="py-2 px-3">
                                {linha.status === 'erro' ? (
                                  <Badge
                                    variant="destructive"
                                    className="text-[10px] py-0 px-1.5 h-5"
                                  >
                                    <XCircle className="mr-1 h-3 w-3" />
                                    Erro
                                  </Badge>
                                ) : linha.isDuplicado ? (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] py-0 px-1.5 h-5 bg-slate-100 text-slate-700 border-slate-300"
                                  >
                                    Duplicado
                                  </Badge>
                                ) : linha.status === 'aviso' ? (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] py-0 px-1.5 h-5 bg-amber-50 text-amber-700 border-amber-300"
                                  >
                                    <AlertTriangle className="mr-1 h-3 w-3" />
                                    Aviso
                                  </Badge>
                                ) : (
                                  <Badge
                                    variant="secondary"
                                    className="text-[10px] py-0 px-1.5 h-5 bg-emerald-100 text-emerald-800"
                                  >
                                    <CheckCircle2 className="mr-1 h-3 w-3" />
                                    Válida
                                  </Badge>
                                )}
                              </td>

                              <td className="py-2 px-3">
                                <div className="font-semibold text-slate-900">
                                  {linha.nome || '—'}
                                </div>
                                <div className="text-[10px] text-slate-500">{linha.email}</div>
                              </td>

                              <td className="py-2 px-3 font-mono text-[11px] text-slate-700">
                                {linha.matricula || '—'}
                                {linha.alunoExistenteId && (
                                  <span className="block text-[9px] text-blue-600 font-sans">
                                    (aluno existente)
                                  </span>
                                )}
                              </td>

                              <td className="py-2 px-3 text-slate-600">
                                {linha.periodoEntrada} · {linha.turno}
                                <span className="block text-[10px] text-slate-400">
                                  {linha.semestreAtual}º Semestre
                                </span>
                              </td>

                              <td className="py-2 px-3">
                                <div
                                  className="text-slate-800 font-medium line-clamp-1"
                                  title={linha.categoriaTexto}
                                >
                                  {linha.categoriaTexto || '—'}
                                </div>
                                {linha.categoriaNomeOficial ? (
                                  <div className="text-[10px] text-emerald-700">
                                    ✓ NDE: {linha.categoriaNomeOficial}
                                  </div>
                                ) : (
                                  <div className="text-[10px] text-amber-700 font-medium">
                                    ⚠ Sem mapeamento NDE
                                  </div>
                                )}
                              </td>

                              <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                                {linha.horas}h
                              </td>

                              <td className="py-2 px-3 text-slate-600 whitespace-nowrap">
                                <div>{linha.semestreAtividade}</div>
                                <div className="text-[10px] text-slate-400">
                                  {linha.dataLancamento}
                                </div>
                              </td>

                              <td className="py-2 px-3 max-w-xs">
                                {linha.erros.length > 0 && (
                                  <div className="text-[11px] text-red-600 font-medium">
                                    {linha.erros.join('; ')}
                                  </div>
                                )}
                                {linha.avisos.length > 0 && (
                                  <div className="text-[10px] text-amber-700">
                                    {linha.avisos.join('; ')}
                                  </div>
                                )}
                                {linha.erros.length === 0 && linha.avisos.length === 0 && (
                                  <div className="text-[11px] text-emerald-600">
                                    Pronto para gravação
                                  </div>
                                )}
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Barra de Rodapé com Ação de Confirmação */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <Info className="h-4 w-4 text-slate-400" />
                    <span>
                      Linhas válidas serão inseridas com <strong>Checklist OK</strong> e observação{' '}
                      <em>[Importação legada]</em>.
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleResetar}
                      className="text-xs text-slate-700"
                    >
                      Cancelar
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleEfetivarImportacao}
                      disabled={efetivando || resumoValidacao.totalLancamentosValidos === 0}
                      className="bg-[#1d4ed8] hover:bg-[#1e40af] text-white text-xs font-semibold shadow-sm"
                    >
                      {efetivando ? (
                        <>
                          <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          Gravando ({progressoGravacao}%)...
                        </>
                      ) : (
                        <>
                          <ArrowRight className="mr-1.5 h-3.5 w-3.5" />
                          Confirmar e Efetivar Importação
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
