import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { listarAlunos, criarAluno, atualizarAluno } from '@/services/alunos'
import { listarCategorias, criarCategoria, atualizarCategoria } from '@/services/categorias'
import { listarTodosLancamentos, criarLancamento } from '@/services/lancamentos'
import { getConfiguracaoGlobal, salvarConfiguracaoGlobal } from '@/services/configuracao'
import type { Aluno, Categoria, Lancamento, ConfiguracaoGlobal } from '@/types'
import { formatarMesAno } from '@/lib/formatadorDespacho'
import {
  processarPlanilhaExcel,
  gerarPlanilhaModelo,
  exportarRelatorioErrosExcel,
  calcularConciliacaoSaldos,
  LinhaImportacaoValidada,
  ResumoValidacao,
  ResultadoEfetivacaoImportacao,
  ConciliacaoAluno,
  ResumoConciliacao,
  StatusConciliacao,
  ConfiguracaoDetectadaPlanilha,
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
  ArrowLeft,
  Database,
  Users,
  Clock,
  Sparkles,
  Info,
  ShieldCheck,
  Search,
  Filter,
  ChevronDown,
  ChevronRight,
  Trash2,
  Scale,
  Calendar,
  AlertCircle,
  Check,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
  const [saldosDeclaradosPainelTurma, setSaldosDeclaradosPainelTurma] = useState<
    Map<string, number>
  >(new Map())
  const [configDetectada, setConfigDetectada] = useState<ConfiguracaoDetectadaPlanilha | null>(null)
  const [aplicandoConfig, setAplicandoConfig] = useState(false)
  const [dialogAplicarConfigAberto, setDialogAplicarConfigAberto] = useState(false)
  const [configJaAplicada, setConfigJaAplicada] = useState(false)
  const [mapeamentoManualCategorias, setMapeamentoManualCategorias] = useState<
    Record<string, string>
  >({})

  // Exclusões de linhas do lote em processamento (apenas em memória, mantendo imutabilidade)
  const [idsLinhasExcluidas, setIdsLinhasExcluidas] = useState<Set<string>>(new Set())

  // Filtros da tabela de pré-visualização (Etapa 1)
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')
  const [buscaTabela, setBuscaTabela] = useState<string>('')

  // Filtros e expansão da tabela de conciliação (Etapa 2)
  const [filtroConciliacao, setFiltroConciliacao] = useState<string>('todos')
  const [buscaConciliacao, setBuscaConciliacao] = useState<string>('')
  const [alunoExpandidoMatricula, setAlunoExpandidoMatricula] = useState<string | null>(null)

  // Modal de confirmação explícita de efetivação
  const [dialogConfirmacaoAberto, setDialogConfirmacaoAberto] = useState(false)

  // Etapa atual do fluxo: 1 = Pré-visualização, 2 = Conciliação de Saldos, 3 = Efetivação / Resultado
  const [etapa, setEtapa] = useState<1 | 2 | 3>(1)
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
    categoriasParaValidar: Categoria[] = categoriasNde,
  ) => {
    try {
      setProcessandoArquivo(true)
      const resultado = processarPlanilhaExcel({
        arquivoBuffer: buffer,
        alunosExistentes,
        categoriasNde: categoriasParaValidar,
        lancamentosExistentes,
        semestreAtualPadrao: configGlobal?.semestre_letivo_atual || '2026.2',
        mapeamentoManualCategorias: mapCategorias,
      })

      setLinhasValidadas(resultado.linhas)
      setResumoValidacao(resultado.resumo)
      setNomeAba(resultado.nomeAbaUsada)
      setSaldosDeclaradosPainelTurma(resultado.saldosDeclaradosPainelTurma)
      setConfigDetectada(resultado.configDetectada)
      setEtapa(1)
      setIdsLinhasExcluidas(new Set())
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

  // Alterna exclusão de linha específica do lote em processamento
  const handleAlternarExclusaoLinhaLote = (idLinhaLote: string) => {
    setIdsLinhasExcluidas((prev) => {
      const novo = new Set(prev)
      if (novo.has(idLinhaLote)) {
        novo.delete(idLinhaLote)
        toast({
          title: 'Linha restaurada no lote',
          description: 'A atividade voltará a ser computada na importação.',
        })
      } else {
        novo.add(idLinhaLote)
        toast({
          title: 'Linha excluída do lote',
          description:
            'A atividade foi desconsiderada deste lote de importação. Nada foi apagado do banco.',
        })
      }
      return novo
    })
  }

  // Cálculo reativo da conciliação de saldos aluno por aluno
  const dadosConciliacao = React.useMemo(() => {
    return calcularConciliacaoSaldos({
      linhasLote: linhasValidadas,
      idsLinhasExcluidas,
      alunosExistentes,
      lancamentosExistentes,
      categoriasNde,
      saldosDeclaradosPainelTurma,
    })
  }, [
    linhasValidadas,
    idsLinhasExcluidas,
    alunosExistentes,
    lancamentosExistentes,
    categoriasNde,
    saldosDeclaradosPainelTurma,
  ])

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
        reprocessarArquivo(buffer, mapeamentoManualCategorias, categoriasNde)
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

  // Mapa de conciliação por matrícula para consulta rápida na efetivação
  const mapaConciliacaoPorMatricula = React.useMemo(() => {
    const mapa = new Map<string, ConciliacaoAluno>()
    dadosConciliacao.alunosConciliacao.forEach((a) => mapa.set(a.matricula.trim().toUpperCase(), a))
    return mapa
  }, [dadosConciliacao])

  // Filtragem da lista de conciliação (Etapa 2)
  const alunosConciliacaoFiltrados = dadosConciliacao.alunosConciliacao.filter((aluno) => {
    if (filtroConciliacao !== 'todos') {
      if (filtroConciliacao !== aluno.statusConciliacao) return false
    }

    if (buscaConciliacao.trim()) {
      const q = buscaConciliacao.toLowerCase()
      const matchNome = aluno.nome.toLowerCase().includes(q)
      const matchMat = aluno.matricula.toLowerCase().includes(q)
      if (!matchNome && !matchMat) return false
    }

    return true
  })

  // Efetivar Importação Definitiva com confirmação explícita (Etapa 3)
  const handleEfetivarImportacao = async () => {
    setDialogConfirmacaoAberto(false)
    if (!linhasValidadas || linhasValidadas.length === 0) return

    setEfetivando(true)
    setProgressoGravacao(0)

    let alunosCriados = 0
    let alunosAtualizados = 0
    let lancamentosCriados = 0
    let lancamentosIgnoradosDuplicados = 0
    const errosAoGravar: Array<{ linhaNumero: number; item: string; motivo: string }> = []

    // Captura snapshot da auditoria de conciliação no exato momento da efetivação
    const totalAlunosConciliadosNoMomento = dadosConciliacao.resumo.totalConciliados
    const totalAlunosDivergentesNoMomento = dadosConciliacao.resumo.totalDivergentes
    const totalAlunosSemReferenciaNoMomento = dadosConciliacao.resumo.totalSemReferencia

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
      // Ignora se todas as linhas desse aluno foram excluídas pelo usuário
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

      // Ignora linhas excluídas manualmente do lote na etapa de conciliação
      if (idsLinhasExcluidas.has(linha.idLinhaLote)) {
        continue
      }

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

      // Identifica status de conciliação do aluno para registrar na observação
      const dadosAlunoConciliacao = mapaConciliacaoPorMatricula.get(linha.matricula)
      const tagConciliacao =
        dadosAlunoConciliacao?.statusConciliacao === 'CONCILIADO'
          ? '[Conciliado OK]'
          : dadosAlunoConciliacao?.statusConciliacao === 'DIVERGENTE'
            ? `[Conciliação Divergente: proj ${dadosAlunoConciliacao.saldoProjetado}h / decl ${dadosAlunoConciliacao.saldoDeclarado}h]`
            : '[Conciliação Sem Referência]'

      // Monta a observação com formato legado e auditoria
      // Exemplo: "[Importação legada] [Conciliado OK] Histórico importado via planilha..."
      const observacaoComAuditoria = linha.observacao.startsWith('[Importação legada]')
        ? linha.observacao.replace('[Importação legada]', `[Importação legada] ${tagConciliacao}`)
        : `[Importação legada] ${tagConciliacao} ${linha.observacao}`

      try {
        await criarLancamento({
          aluno_id: alunoIdReal,
          categoria_id: linha.categoriaIdCorrespondente,
          data_lancamento: `${linha.dataLancamento} 12:00:00.000Z`,
          semestre_letivo_atividade: linha.semestreAtividade,
          horas_aceitas: linha.horas,
          comprovante_ok: true, // Checklist OK por padrão na importação legada
          relatorio_ok: true, // Checklist OK por padrão na importação legada
          observacao: observacaoComAuditoria,
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
      totalAlunosConciliadosNoMomento,
      totalAlunosDivergentesNoMomento,
      totalAlunosSemReferenciaNoMomento,
    })

    setEfetivando(false)
    setEtapa(3)

    // Recarregar os dados do banco para que próximas operações estejam em sincronia
    carregarDadosDoBanco()

    // Registra na trilha global de auditoria
    try {
      const { registrarLogAuditoria } = await import('@/services/auditoria')
      registrarLogAuditoria({
        tipo_evento: 'IMPORTACAO_LEGADA',
        ator_nome: user?.name || 'Coordenação NDE',
        ator_email: user?.email,
        semestre_letivo: configGlobal?.semestre_letivo_atual || '2026.2',
        descricao: `Efetivação de Carga Legada via planilha "${nomeArquivo}" — ${lancamentosCriados} lançamentos criados, ${alunosCriados + alunosAtualizados} alunos processados (${totalAlunosConciliadosNoMomento} conciliados, ${totalAlunosDivergentesNoMomento} divergentes).`,
      })
    } catch (e) {
      console.warn('Erro ao registrar log de importação na auditoria:', e)
    }

    toast({
      title: 'Importação concluída com sucesso!',
      description: `${lancamentosCriados} lançamentos e ${alunosCriados + alunosAtualizados} alunos processados (${totalAlunosConciliadosNoMomento} conciliados).`,
    })
  }

  // Aplicar configurações detectadas da planilha na tabela NDE (Configuração Global + Categorias)
  const handleAplicarConfigConfirmada = async () => {
    if (!configDetectada) return
    setDialogAplicarConfigAberto(false)
    setAplicandoConfig(true)

    try {
      // 1. Atualizar parâmetros globais se detectados
      if (
        configDetectada.semestreLetivoAtual ||
        configDetectada.minimoExigidoSemestre ||
        configDetectada.metaCurso
      ) {
        const patchCfg: Partial<Omit<ConfiguracaoGlobal, 'id' | 'created' | 'updated'>> = {}
        if (configDetectada.semestreLetivoAtual) {
          patchCfg.semestre_letivo_atual = configDetectada.semestreLetivoAtual
        }
        if (configDetectada.minimoExigidoSemestre) {
          patchCfg.minimo_exigido_semestre = configDetectada.minimoExigidoSemestre
        }
        if (configDetectada.metaCurso) {
          patchCfg.meta_curso = configDetectada.metaCurso
        }

        const cfgAtualizada = await salvarConfiguracaoGlobal(configGlobal?.id || '', patchCfg)
        setConfigGlobal(cfgAtualizada)
      }

      // 2. Sincronizar categorias NDE sem apagar existentes que tenham lançamentos
      let categoriasCriadas = 0
      let categoriasAtualizadas = 0

      for (const catPlanilha of configDetectada.categorias) {
        const existente = categoriasNde.find(
          (c) => c.nome.trim().toLowerCase() === catPlanilha.nome.trim().toLowerCase(),
        )

        if (existente) {
          // Atualiza regra e teto mantendo integridade
          await atualizarCategoria(existente.id, {
            regra_horas_unitaria: catPlanilha.regraHoras,
            teto_maximo_curso: catPlanilha.tetoMaximo,
            ativo: true,
          })
          categoriasAtualizadas++
        } else {
          // Cria nova categoria
          await criarCategoria({
            nome: catPlanilha.nome,
            regra_horas_unitaria: catPlanilha.regraHoras,
            teto_maximo_curso: catPlanilha.tetoMaximo,
            ativo: true,
          })
          categoriasCriadas++
        }
      }

      // Recarrega categorias do banco
      const catsAtualizadas = await listarCategorias(false)
      setCategoriasNde(catsAtualizadas)
      setConfigJaAplicada(true)

      // Reprocessa planilha com novas categorias
      if (arquivoBuffer) {
        reprocessarArquivo(arquivoBuffer, mapeamentoManualCategorias, catsAtualizadas)
      }

      // Registra na trilha global de auditoria
      try {
        const { registrarLogAuditoria } = await import('@/services/auditoria')
        registrarLogAuditoria({
          tipo_evento: 'CONFIGURACAO_ALTERADA',
          ator_nome: user?.name || 'Coordenação NDE',
          ator_email: user?.email,
          descricao: `Sincronização de regulamento NDE a partir de planilha: ${categoriasCriadas} novas categorias criadas e ${categoriasAtualizadas} atualizadas.`,
        })
      } catch (e) {
        console.warn('Erro ao registrar log de configuração:', e)
      }

      toast({
        title: 'Configurações do regulamento NDE aplicadas!',
        description: `${categoriasCriadas} categorias criadas, ${categoriasAtualizadas} atualizadas com sucesso.`,
      })
    } catch (err: unknown) {
      console.error('Erro ao aplicar configurações NDE da planilha:', err)
      toast({
        title: 'Erro ao aplicar configurações',
        description:
          err instanceof Error
            ? err.message
            : 'Falha ao sincronizar parâmetros ou categorias no banco.',
        variant: 'destructive',
      })
    } finally {
      setAplicandoConfig(false)
    }
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
    setSaldosDeclaradosPainelTurma(new Map())
    setConfigDetectada(null)
    setConfigJaAplicada(false)
    setIdsLinhasExcluidas(new Set())
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
                    Aba de Lançamentos: {nomeAba}
                  </Badge>
                  {resumoValidacao.origemSaldoDeclarado === 'aba_painel_turma' && (
                    <Badge className="text-[10px] bg-blue-100 text-blue-800 border-blue-300">
                      Saldo declarado: aba Painel por Turma
                    </Badge>
                  )}
                  {resumoValidacao.origemSaldoDeclarado === 'aba_lancamentos' && (
                    <Badge className="text-[10px] bg-slate-100 text-slate-700 border-slate-300">
                      Saldo declarado: coluna na aba Lançamentos
                    </Badge>
                  )}
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

          {/* INDICADOR DE ETAPAS (WIZARD 3 ETAPAS) */}
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Fluxo de Importação:
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                {/* Etapa 1 */}
                <button
                  type="button"
                  onClick={() => setEtapa(1)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                    etapa === 1
                      ? 'bg-[#1d4ed8] text-white shadow-xs font-semibold'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-[11px] font-bold">
                    1
                  </span>
                  <span>Pré-visualização</span>
                </button>

                <ChevronRight className="h-4 w-4 text-slate-300" />

                {/* Etapa 2 */}
                <button
                  type="button"
                  onClick={() => setEtapa(2)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                    etapa === 2
                      ? 'bg-[#1d4ed8] text-white shadow-xs font-semibold'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-[11px] font-bold">
                    2
                  </span>
                  <span>Conciliação de Saldos</span>
                  {dadosConciliacao.resumo.totalDivergentes > 0 && (
                    <Badge className="bg-amber-500 text-white text-[10px] py-0 px-1 ml-1 h-4">
                      {dadosConciliacao.resumo.totalDivergentes} div
                    </Badge>
                  )}
                </button>

                <ChevronRight className="h-4 w-4 text-slate-300" />

                {/* Etapa 3 */}
                <div
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                    etapa === 3
                      ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                      : 'text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-[11px] font-bold">
                    3
                  </span>
                  <span>Efetivação e Auditoria</span>
                </div>
              </div>
            </div>
          </div>

          {/* BLOCO DE CONFIGURAÇÕES DETECTADAS NA PLANILHA (ABA CONFIG TABELA) */}
          {configDetectada && (
            <Card className="border-blue-200 bg-blue-50/50 shadow-xs">
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="font-['Outfit'] text-sm font-bold text-[#0f2b48] flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-[#1d4ed8]" />
                      Configurações e Regulação NDE detectadas na planilha
                    </CardTitle>
                    <CardDescription className="text-xs text-blue-900/80">
                      A aba de configuração traz parâmetros semestrais e{' '}
                      {configDetectada.categorias.length} categorias regulamentares.
                    </CardDescription>
                  </div>

                  <div className="flex items-center gap-2">
                    {configJaAplicada ? (
                      <Badge className="bg-emerald-600 text-white text-xs px-2.5 py-1">
                        <Check className="mr-1 h-3.5 w-3.5" />
                        Configurações Aplicadas à Tabela NDE
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => setDialogAplicarConfigAberto(true)}
                        disabled={aplicandoConfig}
                        className="bg-[#1d4ed8] hover:bg-[#1e40af] text-white text-xs font-semibold shadow-xs"
                      >
                        {aplicandoConfig ? (
                          <>
                            <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            Aplicando...
                          </>
                        ) : (
                          <>
                            <Database className="mr-1.5 h-3.5 w-3.5" />
                            Aplicar Configurações ao NDE
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                  <div className="bg-white rounded-lg p-2.5 border border-blue-100 shadow-2xs">
                    <span className="text-[10px] uppercase font-bold text-slate-500">
                      Semestre Letivo Atual
                    </span>
                    <div className="text-sm font-bold text-[#0f2b48]">
                      {configDetectada.semestreLetivoAtual || 'Não informado'}
                    </div>
                  </div>
                  <div className="bg-white rounded-lg p-2.5 border border-blue-100 shadow-2xs">
                    <span className="text-[10px] uppercase font-bold text-slate-500">
                      Mínimo Exigido por Semestre
                    </span>
                    <div className="text-sm font-bold text-[#0f2b48]">
                      {configDetectada.minimoExigidoSemestre
                        ? `${configDetectada.minimoExigidoSemestre}h`
                        : 'Não informado'}
                    </div>
                  </div>
                  <div className="bg-white rounded-lg p-2.5 border border-blue-100 shadow-2xs">
                    <span className="text-[10px] uppercase font-bold text-slate-500">
                      Meta do Curso
                    </span>
                    <div className="text-sm font-bold text-[#0f2b48]">
                      {configDetectada.metaCurso
                        ? `${configDetectada.metaCurso}h`
                        : 'Não informada'}
                    </div>
                  </div>
                </div>

                <div className="text-xs text-slate-600">
                  <span className="font-semibold text-slate-700">Categorias regulamentares:</span>{' '}
                  {configDetectada.categorias.map((c, i) => (
                    <span key={i} className="inline-block mr-2 mb-1">
                      <Badge variant="outline" className="text-[10px] bg-white border-blue-200">
                        {c.nome} (teto {c.tetoMaximo}h)
                      </Badge>
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

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
                <span className="text-[10px] text-slate-400">
                  {resumoValidacao.linhasComSemestreFallback > 0
                    ? `${resumoValidacao.linhasComSemestreFallback} com semestre padrão`
                    : 'Categorias ou duplicações'}
                </span>
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

          {/* SE ETAPA 3: TELA DE RESULTADO PÓS-GRAVAÇÃO E AUDITORIA */}
          {etapa === 3 && resultadoEfetivacao && (
            <Card className="border-emerald-200 bg-emerald-50/50 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-white">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <div>
                    <CardTitle className="font-['Outfit'] text-lg font-bold text-emerald-950">
                      Etapa 3: Importação Efetivada no Banco de Dados
                    </CardTitle>
                    <CardDescription className="text-xs text-emerald-800">
                      Os registros foram consolidados com imutabilidade e estão disponíveis
                      imediatamente no painel de alunos e lançamentos.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-lg bg-white p-3 border border-emerald-200 shadow-2xs">
                    <span className="text-[11px] text-slate-500 font-medium">Alunos Criados</span>
                    <div className="text-xl font-bold text-emerald-700">
                      {resultadoEfetivacao.alunosCriados}
                    </div>
                  </div>
                  <div className="rounded-lg bg-white p-3 border border-emerald-200 shadow-2xs">
                    <span className="text-[11px] text-slate-500 font-medium">
                      Alunos Atualizados
                    </span>
                    <div className="text-xl font-bold text-blue-700">
                      {resultadoEfetivacao.alunosAtualizados}
                    </div>
                  </div>
                  <div className="rounded-lg bg-white p-3 border border-emerald-200 shadow-2xs">
                    <span className="text-[11px] text-slate-500 font-medium">
                      Lançamentos Gravados
                    </span>
                    <div className="text-xl font-bold text-emerald-700">
                      {resultadoEfetivacao.lancamentosCriados}
                    </div>
                  </div>
                  <div className="rounded-lg bg-white p-3 border border-emerald-200 shadow-2xs">
                    <span className="text-[11px] text-slate-500 font-medium">
                      Duplicados Ignorados
                    </span>
                    <div className="text-xl font-bold text-slate-600">
                      {resultadoEfetivacao.lancamentosIgnoradosDuplicados}
                    </div>
                  </div>
                </div>

                {/* Resumo de auditoria de conciliação registrado no momento da consolidação */}
                <div className="rounded-xl border border-blue-200 bg-white p-4 shadow-2xs">
                  <h4 className="text-xs font-bold text-[#0f2b48] flex items-center gap-1.5 uppercase tracking-wider mb-2">
                    <Scale className="h-4 w-4 text-[#1d4ed8]" />
                    Auditoria de Conciliação no Momento da Efetivação
                  </h4>
                  <p className="text-xs text-slate-600 mb-3">
                    Estes números foram registrados nos históricos para prestação de contas à
                    Coordenação e ao NDE:
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2.5 text-center">
                      <span className="text-[11px] font-semibold text-emerald-800">
                        Alunos Conciliados
                      </span>
                      <div className="text-lg font-bold text-emerald-700">
                        {resultadoEfetivacao.totalAlunosConciliadosNoMomento}
                      </div>
                    </div>
                    <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-center">
                      <span className="text-[11px] font-semibold text-amber-800">
                        Alunos Divergentes
                      </span>
                      <div className="text-lg font-bold text-amber-700">
                        {resultadoEfetivacao.totalAlunosDivergentesNoMomento}
                      </div>
                    </div>
                    <div className="rounded-lg bg-slate-50 border border-slate-200 p-2.5 text-center">
                      <span className="text-[11px] font-semibold text-slate-700">
                        Sem Referência na Planilha
                      </span>
                      <div className="text-lg font-bold text-slate-700">
                        {resultadoEfetivacao.totalAlunosSemReferenciaNoMomento}
                      </div>
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
                    onClick={() => setEtapa(2)}
                    className="text-xs text-slate-700 border-slate-300"
                  >
                    Ver Conciliação de Saldos
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

          {/* ETAPA 2: CONCILIAÇÃO E CONFERÊNCIA DE SALDOS ALUNO POR ALUNO */}
          {etapa === 2 && (
            <div className="space-y-6">
              {/* Resumo Executivo da Conciliação */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <Card className="border-slate-200 bg-white shadow-2xs">
                  <CardContent className="p-3.5">
                    <span className="text-[11px] font-semibold text-slate-500">
                      Total de Alunos
                    </span>
                    <div className="mt-1 font-['Outfit'] text-2xl font-bold text-[#0f2b48]">
                      {dadosConciliacao.resumo.totalAlunos}
                    </div>
                    <span className="text-[10px] text-slate-400">No lote em conferência</span>
                  </CardContent>
                </Card>

                <Card className="border-emerald-200 bg-emerald-50/40 shadow-2xs">
                  <CardContent className="p-3.5">
                    <span className="text-[11px] font-semibold text-emerald-700">Conciliados</span>
                    <div className="mt-1 font-['Outfit'] text-2xl font-bold text-emerald-600">
                      {dadosConciliacao.resumo.totalConciliados}
                    </div>
                    <span className="text-[10px] text-emerald-600">Projetado = Declarado</span>
                  </CardContent>
                </Card>

                <Card className="border-amber-200 bg-amber-50/40 shadow-2xs">
                  <CardContent className="p-3.5">
                    <span className="text-[11px] font-semibold text-amber-700">Divergentes</span>
                    <div className="mt-1 font-['Outfit'] text-2xl font-bold text-amber-600">
                      {dadosConciliacao.resumo.totalDivergentes}
                    </div>
                    <span className="text-[10px] text-amber-600">Requerem atenção</span>
                  </CardContent>
                </Card>

                <Card className="border-slate-200 bg-slate-50/60 shadow-2xs">
                  <CardContent className="p-3.5">
                    <span className="text-[11px] font-semibold text-slate-600">Sem Referência</span>
                    <div className="mt-1 font-['Outfit'] text-2xl font-bold text-slate-600">
                      {dadosConciliacao.resumo.totalSemReferencia}
                    </div>
                    <span className="text-[10px] text-slate-400">Planilha sem total declarado</span>
                  </CardContent>
                </Card>

                <Card className="border-blue-200 bg-blue-50/40 shadow-2xs">
                  <CardContent className="p-3.5">
                    <span className="text-[11px] font-semibold text-[#1d4ed8]">
                      Horas Ativas do Lote
                    </span>
                    <div className="mt-1 font-['Outfit'] text-2xl font-bold text-[#1d4ed8]">
                      {dadosConciliacao.resumo.totalHorasLote}h
                    </div>
                    <span className="text-[10px] text-blue-600">
                      Projetado total: {dadosConciliacao.resumo.totalHorasProjetadas}h
                    </span>
                  </CardContent>
                </Card>
              </div>

              {/* Informação sobre exclusão cirúrgica de linhas */}
              {idsLinhasExcluidas.size > 0 && (
                <Alert className="border-amber-300 bg-amber-50 text-amber-900">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <AlertTitle className="text-xs font-bold text-amber-950">
                    Ajuste Manual em Memória: {idsLinhasExcluidas.size}{' '}
                    {idsLinhasExcluidas.size === 1 ? 'linha excluída' : 'linhas excluídas'} do lote
                  </AlertTitle>
                  <AlertDescription className="text-xs text-amber-800 leading-relaxed">
                    As linhas marcadas para exclusão não serão gravadas no banco na efetivação. O
                    banco de dados permanece intocado e imutável. Você pode restaurar qualquer linha
                    expandindo o aluno correspondente.
                  </AlertDescription>
                </Alert>
              )}

              {/* Painel de Alunos para Conferência */}
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-3 border-b border-slate-100">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle className="font-['Outfit'] text-base font-bold text-[#0f2b48] flex items-center gap-2">
                        <Scale className="h-5 w-5 text-[#1d4ed8]" />
                        Etapa 2: Conferência e Conciliação de Saldos por Estudante
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-500">
                        Compare o saldo atual no banco, as horas a importar e o total declarado na
                        planilha antes da consolidação.
                      </CardDescription>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEtapa(1)}
                        className="text-xs text-slate-700 border-slate-300"
                      >
                        <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                        Voltar para Pré-visualização
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => setDialogConfirmacaoAberto(true)}
                        disabled={efetivando || dadosConciliacao.resumo.totalHorasLote === 0}
                        className="bg-[#1d4ed8] hover:bg-[#1e40af] text-white text-xs font-semibold shadow-sm"
                      >
                        {efetivando ? (
                          <>
                            <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            Gravando ({progressoGravacao}%)...
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                            Prosseguir para Efetivação Definitiva
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Barra de Progresso caso esteja gravando */}
                  {efetivando && (
                    <div className="mt-3 space-y-1">
                      <div className="flex justify-between text-xs text-slate-600 font-medium">
                        <span>Gravando registros no PocketBase...</span>
                        <span>{progressoGravacao}%</span>
                      </div>
                      <Progress value={progressoGravacao} className="h-2" />
                    </div>
                  )}

                  {/* Filtros da Tabela de Conciliação */}
                  <div className="flex flex-col gap-2 pt-3 sm:flex-row sm:items-center">
                    <div className="relative flex-1">
                      <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                      <Input
                        placeholder="Buscar aluno por nome ou matrícula..."
                        value={buscaConciliacao}
                        onChange={(e) => setBuscaConciliacao(e.target.value)}
                        className="h-8 pl-8 text-xs bg-slate-50"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <Select value={filtroConciliacao} onValueChange={setFiltroConciliacao}>
                        <SelectTrigger className="h-8 w-[190px] text-xs bg-slate-50">
                          <SelectValue placeholder="Status de Conciliação" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todos" className="text-xs">
                            Todos ({dadosConciliacao.alunosConciliacao.length})
                          </SelectItem>
                          <SelectItem value="CONCILIADO" className="text-xs text-emerald-700">
                            Conciliados ({dadosConciliacao.resumo.totalConciliados})
                          </SelectItem>
                          <SelectItem value="DIVERGENTE" className="text-xs text-amber-700">
                            Divergentes ({dadosConciliacao.resumo.totalDivergentes})
                          </SelectItem>
                          <SelectItem value="SEM_REFERENCIA" className="text-xs text-slate-600">
                            Sem Referência ({dadosConciliacao.resumo.totalSemReferencia})
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-0">
                  <div className="max-h-[600px] overflow-auto">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead className="sticky top-0 z-10 bg-slate-100 text-[11px] font-bold text-slate-700 shadow-2xs">
                        <tr>
                          <th className="py-2.5 px-3 w-8"></th>
                          <th className="py-2.5 px-3">Estudante</th>
                          <th className="py-2.5 px-3">Matrícula / Turma</th>
                          <th className="py-2.5 px-3 text-right">Saldo Atual (Banco)</th>
                          <th className="py-2.5 px-3 text-right">+ Horas Lote</th>
                          <th className="py-2.5 px-3 text-right">= Saldo Projetado</th>
                          <th className="py-2.5 px-3 text-right">Saldo Declarado (Planilha)</th>
                          <th className="py-2.5 px-3 text-center">Status Conciliação</th>
                          <th className="py-2.5 px-3 text-center w-24">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {alunosConciliacaoFiltrados.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="py-8 text-center text-xs text-slate-500">
                              Nenhum estudante encontrado com o filtro selecionado.
                            </td>
                          </tr>
                        ) : (
                          alunosConciliacaoFiltrados.map((aluno) => {
                            const expandido = alunoExpandidoMatricula === aluno.matricula
                            const linhasDoAluno = linhasValidadas.filter(
                              (l) => l.matricula.trim().toUpperCase() === aluno.matricula,
                            )

                            return (
                              <React.Fragment key={aluno.matricula}>
                                <tr
                                  className={`transition-colors hover:bg-slate-50/80 cursor-pointer ${
                                    aluno.statusConciliacao === 'DIVERGENTE'
                                      ? 'bg-amber-50/30'
                                      : aluno.statusConciliacao === 'CONCILIADO'
                                        ? 'bg-emerald-50/20'
                                        : ''
                                  } ${expandido ? 'border-l-4 border-l-[#1d4ed8] bg-blue-50/20' : ''}`}
                                  onClick={() =>
                                    setAlunoExpandidoMatricula(expandido ? null : aluno.matricula)
                                  }
                                >
                                  <td className="py-2.5 px-3 text-center">
                                    {expandido ? (
                                      <ChevronDown className="h-4 w-4 text-[#1d4ed8]" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4 text-slate-400" />
                                    )}
                                  </td>

                                  <td className="py-2.5 px-3">
                                    <div className="font-semibold text-slate-900">{aluno.nome}</div>
                                    <div className="text-[10px] text-slate-500">{aluno.email}</div>
                                  </td>

                                  <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700">
                                    <div>{aluno.matricula}</div>
                                    <div className="text-[10px] font-sans text-slate-500">
                                      {aluno.periodoEntrada} · {aluno.semestreAtual}º Sem ·{' '}
                                      {aluno.turno}
                                    </div>
                                  </td>

                                  <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                                    {aluno.saldoBancoAtual}h
                                  </td>

                                  <td className="py-2.5 px-3 text-right font-mono font-semibold text-[#1d4ed8]">
                                    +{aluno.horasLote}h
                                    <span className="block text-[10px] font-sans text-slate-400">
                                      {aluno.totalLinhasAtivas}{' '}
                                      {aluno.totalLinhasAtivas === 1 ? 'atividade' : 'atividades'}
                                    </span>
                                  </td>

                                  <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                                    {aluno.saldoProjetado}h
                                  </td>

                                  <td className="py-2.5 px-3 text-right font-mono">
                                    {aluno.saldoDeclarado !== undefined ? (
                                      <div>
                                        <span className="font-bold text-slate-800">
                                          {aluno.saldoDeclarado}h
                                        </span>
                                        {aluno.origemSaldoDeclarado === 'aba_painel_turma' && (
                                          <span className="block text-[9px] font-sans text-blue-600">
                                            Painel por Turma
                                          </span>
                                        )}
                                        {aluno.origemSaldoDeclarado === 'aba_lancamentos' && (
                                          <span className="block text-[9px] font-sans text-slate-400">
                                            Aba Lançamentos
                                          </span>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-slate-400 text-[11px]">
                                        Sem referência
                                      </span>
                                    )}
                                  </td>

                                  <td className="py-2.5 px-3 text-center">
                                    {aluno.statusConciliacao === 'CONCILIADO' ? (
                                      <Badge
                                        variant="secondary"
                                        className="text-[10px] py-0 px-2 h-5 bg-emerald-100 text-emerald-800 border-emerald-300"
                                      >
                                        <CheckCircle2 className="mr-1 h-3 w-3" />
                                        CONCILIADO
                                      </Badge>
                                    ) : aluno.statusConciliacao === 'DIVERGENTE' ? (
                                      <Badge
                                        variant="outline"
                                        className="text-[10px] py-0 px-2 h-5 bg-amber-50 text-amber-800 border-amber-400"
                                      >
                                        <AlertTriangle className="mr-1 h-3 w-3" />
                                        DIVERGENTE (
                                        {aluno.diferenca !== undefined && aluno.diferenca > 0
                                          ? `+${aluno.diferenca}`
                                          : aluno.diferenca}
                                        h)
                                      </Badge>
                                    ) : (
                                      <Badge
                                        variant="secondary"
                                        className="text-[10px] py-0 px-2 h-5 bg-slate-100 text-slate-600 border-slate-300"
                                      >
                                        SEM REFERÊNCIA
                                      </Badge>
                                    )}
                                  </td>

                                  <td
                                    className="py-2.5 px-3 text-center"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() =>
                                        setAlunoExpandidoMatricula(
                                          expandido ? null : aluno.matricula,
                                        )
                                      }
                                      className="h-7 text-xs text-[#1d4ed8] hover:bg-blue-50"
                                    >
                                      {expandido ? 'Recolher' : 'Detalhar'}
                                    </Button>
                                  </td>
                                </tr>

                                {/* DETALHAMENTO EXPANDIDO DO ALUNO */}
                                {expandido && (
                                  <tr className="bg-slate-50/90 border-y border-slate-200">
                                    <td colSpan={9} className="p-4">
                                      <div className="space-y-4">
                                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200 pb-2">
                                          <div>
                                            <h4 className="text-xs font-bold text-[#0f2b48] flex items-center gap-1.5">
                                              <Users className="h-4 w-4 text-[#1d4ed8]" />
                                              Detalhamento de {aluno.nome} ({aluno.matricula})
                                            </h4>
                                            <p className="text-[11px] text-slate-500">
                                              Conferência por categoria NDE e atividades individuais
                                              no lote
                                            </p>
                                          </div>

                                          <div className="flex items-center gap-2">
                                            {aluno.statusConciliacao === 'DIVERGENTE' && (
                                              <span className="text-xs text-amber-800 bg-amber-100/70 px-2.5 py-1 rounded-md font-medium">
                                                Divergência: projetado {aluno.saldoProjetado}h vs
                                                planilha {aluno.saldoDeclarado}h (dif{' '}
                                                {aluno.diferenca}h)
                                              </span>
                                            )}
                                          </div>
                                        </div>

                                        {/* Tabela de Categorias NDE para este aluno */}
                                        <div>
                                          <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                                            Saldos por Categoria Regulamentar NDE
                                          </span>
                                          {aluno.categorias.length === 0 ? (
                                            <p className="text-xs text-slate-400 italic">
                                              Nenhuma categoria ativa para este aluno ainda.
                                            </p>
                                          ) : (
                                            <table className="w-full text-xs border border-slate-200 rounded-lg overflow-hidden bg-white shadow-2xs">
                                              <thead className="bg-slate-100 text-[10px] font-bold text-slate-600">
                                                <tr>
                                                  <th className="py-1.5 px-3">Categoria</th>
                                                  <th className="py-1.5 px-3 text-right">
                                                    Banco Atual
                                                  </th>
                                                  <th className="py-1.5 px-3 text-right">
                                                    Horas Lote Ativas
                                                  </th>
                                                  <th className="py-1.5 px-3 text-right">
                                                    Projetado Total
                                                  </th>
                                                </tr>
                                              </thead>
                                              <tbody className="divide-y divide-slate-100">
                                                {aluno.categorias.map((c) => (
                                                  <tr
                                                    key={c.categoriaId}
                                                    className="hover:bg-slate-50"
                                                  >
                                                    <td className="py-1.5 px-3 font-medium text-slate-800">
                                                      {c.categoriaNome}
                                                    </td>
                                                    <td className="py-1.5 px-3 text-right font-mono text-slate-600">
                                                      {c.horasBancoAtual}h
                                                    </td>
                                                    <td className="py-1.5 px-3 text-right font-mono font-semibold text-[#1d4ed8]">
                                                      +{c.horasLote}h
                                                    </td>
                                                    <td className="py-1.5 px-3 text-right font-mono font-bold text-slate-900">
                                                      {c.horasProjetadas}h
                                                    </td>
                                                  </tr>
                                                ))}
                                              </tbody>
                                            </table>
                                          )}
                                        </div>

                                        {/* Atividades do Lote para este aluno com opção de exclusão pontual */}
                                        <div>
                                          <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                                              Atividades Lidas da Planilha para Este Aluno (
                                              {linhasDoAluno.length})
                                            </span>
                                            <span className="text-[10px] text-slate-500">
                                              Clique em &quot;Excluir do Lote&quot; para descartar
                                              uma linha divergente sem alterar o banco.
                                            </span>
                                          </div>

                                          <div className="space-y-1.5">
                                            {linhasDoAluno.map((linha) => {
                                              const excluida = idsLinhasExcluidas.has(
                                                linha.idLinhaLote,
                                              )

                                              return (
                                                <div
                                                  key={linha.idLinhaLote}
                                                  className={`flex flex-col sm:flex-row sm:items-center justify-between p-2.5 rounded-lg border text-xs transition-colors ${
                                                    excluida
                                                      ? 'bg-slate-100 border-dashed border-slate-300 opacity-60 line-through'
                                                      : linha.status === 'erro'
                                                        ? 'bg-red-50 border-red-200'
                                                        : linha.isDuplicado
                                                          ? 'bg-slate-50 border-slate-200'
                                                          : 'bg-white border-slate-200 shadow-2xs'
                                                  }`}
                                                >
                                                  <div className="space-y-0.5 flex-1 pr-3">
                                                    <div className="flex items-center gap-2">
                                                      <span className="font-mono text-[10px] text-slate-500">
                                                        Linha {linha.linhaNumero}
                                                      </span>
                                                      <span className="font-semibold text-slate-900">
                                                        {linha.categoriaTexto}
                                                      </span>
                                                      {linha.categoriaNomeOficial && (
                                                        <span className="text-[10px] text-emerald-700">
                                                          (NDE: {linha.categoriaNomeOficial})
                                                        </span>
                                                      )}
                                                      <Badge
                                                        variant="outline"
                                                        className="text-[9px] py-0 px-1 border-blue-200 bg-blue-50 text-blue-700"
                                                      >
                                                        Semestre {linha.semestreAtividade}
                                                        {linha.semestreFallbackUtilizado &&
                                                          ' (fallback)'}
                                                      </Badge>
                                                    </div>
                                                    <div className="text-[11px] text-slate-500">
                                                      {linha.observacao} · Competência:{' '}
                                                      <span className="font-mono font-medium text-slate-700">
                                                        {formatarMesAno(linha.dataLancamento)}
                                                      </span>
                                                    </div>
                                                  </div>

                                                  <div className="flex items-center gap-3 pt-2 sm:pt-0">
                                                    <div className="font-mono font-bold text-slate-900 text-sm">
                                                      {linha.horas}h
                                                    </div>

                                                    <Button
                                                      type="button"
                                                      variant={excluida ? 'outline' : 'ghost'}
                                                      size="sm"
                                                      onClick={() =>
                                                        handleAlternarExclusaoLinhaLote(
                                                          linha.idLinhaLote,
                                                        )
                                                      }
                                                      className={`h-7 text-xs ${
                                                        excluida
                                                          ? 'text-emerald-700 hover:bg-emerald-50 border-emerald-300'
                                                          : 'text-red-600 hover:bg-red-50 hover:text-red-700'
                                                      }`}
                                                    >
                                                      {excluida ? (
                                                        <>
                                                          <Check className="mr-1 h-3 w-3" />
                                                          Restaurar no Lote
                                                        </>
                                                      ) : (
                                                        <>
                                                          <Trash2 className="mr-1 h-3 w-3" />
                                                          Excluir do Lote
                                                        </>
                                                      )}
                                                    </Button>
                                                  </div>
                                                </div>
                                              )
                                            })}
                                          </div>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            )
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Rodapé da Etapa 2 */}
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-slate-200 bg-slate-50/70 p-4">
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <ShieldCheck className="h-4 w-4 text-[#16a34a]" />
                      <span>
                        Histórico Imutável garantido: exclusões no lote descartam itens apenas antes
                        da gravação.
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEtapa(1)}
                        className="text-xs text-slate-700"
                      >
                        <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                        Voltar à Pré-visualização
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => setDialogConfirmacaoAberto(true)}
                        disabled={
                          efetivando || (dadosConciliacao?.resumo?.totalHorasLote ?? 0) === 0
                        }
                        className="bg-[#1d4ed8] hover:bg-[#1e40af] text-white text-xs font-semibold shadow-sm"
                      >
                        Prosseguir para Efetivação
                        <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
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

                  {/* Botão para Avançar para a Etapa 2 de Conciliação */}
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => setEtapa(2)}
                      disabled={
                        !resumoValidacao || (resumoValidacao?.totalLancamentosValidos ?? 0) === 0
                      }
                      className="bg-[#1d4ed8] hover:bg-[#1e40af] text-white text-xs font-semibold shadow-sm"
                    >
                      Avançar para Conciliação de Saldos
                      <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
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
                        <th className="py-2.5 px-3">Semestre da Atividade</th>
                        <th className="py-2.5 px-3">Saldo Declarado</th>
                        <th className="py-2.5 px-3">Validação & Auditoria</th>
                      </tr>
                    </thead>{' '}
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
                                <div className="flex items-center gap-1.5">
                                  <span className="font-semibold text-slate-800">
                                    {linha.semestreAtividade}
                                  </span>
                                  {linha.semestreFallbackUtilizado && (
                                    <Badge
                                      variant="outline"
                                      className="text-[9px] py-0 px-1 text-amber-700 border-amber-300 bg-amber-50"
                                      title="Semestre padrão utilizado como fallback porque a linha não especificou o semestre"
                                    >
                                      fallback
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-500 font-mono">
                                  {formatarMesAno(linha.dataLancamento)}
                                </div>
                              </td>

                              <td className="py-2 px-3 text-slate-700">
                                {linha.saldoDeclaradoLinha !== undefined ? (
                                  <span className="font-semibold text-slate-900 font-mono">
                                    {linha.saldoDeclaradoLinha}h
                                  </span>
                                ) : (
                                  <span className="text-slate-400 text-[11px]">—</span>
                                )}
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
                      onClick={() => setEtapa(2)}
                      disabled={
                        !resumoValidacao || (resumoValidacao?.totalLancamentosValidos ?? 0) === 0
                      }
                      className="bg-[#1d4ed8] hover:bg-[#1e40af] text-white text-xs font-semibold shadow-sm"
                    >
                      Ir para Conciliação de Saldos (Etapa 2){' '}
                      <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO PARA APLICAR CONFIGURAÇÕES NDE DETECTADAS */}
      <Dialog open={dialogAplicarConfigAberto} onOpenChange={setDialogAplicarConfigAberto}>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-['Outfit'] text-lg font-bold text-[#0f2b48] flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[#1d4ed8]" />
              Confirmar Aplicação das Configurações NDE
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600">
              Revise os parâmetros e categorias que serão sincronizados no banco de dados. Nenhuma
              categoria existente com lançamentos será excluída.
            </DialogDescription>
          </DialogHeader>

          {configDetectada && (
            <div className="space-y-4 py-3 text-xs">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
                <h4 className="font-bold text-[#0f2b48] uppercase tracking-wider text-[11px]">
                  Parâmetros Gerais do Curso
                </h4>
                <div className="flex justify-between">
                  <span className="text-slate-600">Semestre Letivo:</span>
                  <span className="font-bold text-slate-900">
                    {configDetectada.semestreLetivoAtual || 'Manter atual'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Mínimo Exigido Semestral:</span>
                  <span className="font-bold text-slate-900">
                    {configDetectada.minimoExigidoSemestre
                      ? `${configDetectada.minimoExigidoSemestre}h`
                      : 'Manter atual'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Meta do Curso:</span>
                  <span className="font-bold text-slate-900">
                    {configDetectada.metaCurso ? `${configDetectada.metaCurso}h` : 'Manter atual'}
                  </span>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-[#0f2b48] uppercase tracking-wider text-[11px] mb-2">
                  Categorias Regulamentares ({configDetectada.categorias.length})
                </h4>
                <div className="max-h-60 overflow-y-auto space-y-1.5 border border-slate-200 rounded-lg p-2 bg-white">
                  {configDetectada.categorias.map((cat, idx) => {
                    const jaExiste = categoriasNde.some(
                      (c) => c.nome.trim().toLowerCase() === cat.nome.trim().toLowerCase(),
                    )
                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 rounded-md bg-slate-50 border border-slate-100"
                      >
                        <div className="flex-1 pr-2">
                          <span className="font-medium text-slate-800">{cat.nome}</span>
                          <span className="block text-[10px] text-slate-500">{cat.regraHoras}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="font-mono text-[10px]">
                            Teto: {cat.tetoMaximo}h
                          </Badge>
                          {jaExiste ? (
                            <Badge
                              variant="outline"
                              className="text-[9px] text-blue-700 border-blue-300"
                            >
                              Atualizar
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-[9px] text-emerald-700 border-emerald-300"
                            >
                              Nova
                            </Badge>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDialogAplicarConfigAberto(false)}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleAplicarConfigConfirmada}
              disabled={aplicandoConfig}
              className="bg-[#1d4ed8] hover:bg-[#1e40af] text-white text-xs font-semibold"
            >
              {aplicandoConfig ? (
                <>
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Aplicando...
                </>
              ) : (
                <>
                  <Check className="mr-1.5 h-3.5 w-3.5" />
                  Confirmar e Sincronizar NDE
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL DE CONFIRMAÇÃO EXPLÍCITA ANTES DA EFETIVAÇÃO DEFINITIVA */}
      <Dialog open={dialogConfirmacaoAberto} onOpenChange={setDialogConfirmacaoAberto}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle className="font-['Outfit'] text-lg font-bold text-[#0f2b48] flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-[#1d4ed8]" />
              Confirmar Efetivação da Carga de Histórico
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600">
              Revise o resumo da conciliação de saldos antes de persistir os dados definitivamente
              no sistema.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            {/* Resumo da Operação */}
            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-600">Alunos no lote:</span>
                <span className="font-bold text-slate-900">
                  {dadosConciliacao?.resumo?.totalAlunos ?? 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Horas ativas a gravar:</span>
                <span className="font-bold text-[#1d4ed8]">
                  {dadosConciliacao?.resumo?.totalHorasLote ?? 0}h
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Saldo total projetado pós-carga:</span>
                <span className="font-bold text-slate-900">
                  {dadosConciliacao?.resumo?.totalHorasProjetadas ?? 0}h
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Linhas ativas no lote:</span>
                <span className="font-bold text-slate-900">
                  {linhasValidadas.length -
                    idsLinhasExcluidas.size -
                    (resumoValidacao?.lancamentosDuplicadosIgnorados ?? 0) -
                    (resumoValidacao?.linhasComErro ?? 0)}
                </span>
              </div>
              {idsLinhasExcluidas.size > 0 && (
                <div className="flex justify-between text-amber-700">
                  <span>Linhas excluídas manualmente do lote:</span>
                  <span className="font-bold">{idsLinhasExcluidas.size}</span>
                </div>
              )}
            </div>

            {/* Status de Conciliação no Momento */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2">
                <span className="text-[10px] font-semibold text-emerald-800 uppercase block">
                  Conciliados
                </span>
                <span className="font-['Outfit'] text-xl font-bold text-emerald-700">
                  {dadosConciliacao?.resumo?.totalConciliados ?? 0}
                </span>
              </div>
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-2">
                <span className="text-[10px] font-semibold text-amber-800 uppercase block">
                  Divergentes
                </span>
                <span className="font-['Outfit'] text-xl font-bold text-amber-700">
                  {dadosConciliacao?.resumo?.totalDivergentes ?? 0}
                </span>
              </div>
              <div className="rounded-lg bg-slate-100 border border-slate-200 p-2">
                <span className="text-[10px] font-semibold text-slate-600 uppercase block">
                  Sem Referência
                </span>
                <span className="font-['Outfit'] text-xl font-bold text-slate-700">
                  {dadosConciliacao?.resumo?.totalSemReferencia ?? 0}
                </span>
              </div>
            </div>

            {(dadosConciliacao?.resumo?.totalDivergentes ?? 0) > 0 && (
              <Alert className="border-amber-300 bg-amber-50 text-amber-900 py-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-[11px] text-amber-800 leading-snug">
                  Existem{' '}
                  <strong>
                    {dadosConciliacao?.resumo?.totalDivergentes ?? 0} alunos com divergência
                  </strong>{' '}
                  entre o saldo projetado e o declarado na planilha. Ao efetivar, a divergência será
                  registrada no campo de observação para fins de auditoria acadêmica.
                </AlertDescription>
              </Alert>
            )}

            <p className="text-[11px] text-slate-500 leading-relaxed">
              Ao confirmar, os novos lançamentos serão gravados com marcação{' '}
              <strong>[Importação legada]</strong> e status de conciliação. Em conformidade com o
              princípio do histórico imutável, esses registros não poderão ser excluídos
              fisicamente.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDialogConfirmacaoAberto(false)}
              className="text-xs"
            >
              Voltar e Revisar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleEfetivarImportacao}
              disabled={efetivando}
              className="bg-[#1d4ed8] hover:bg-[#1e40af] text-white text-xs font-semibold"
            >
              {efetivando ? (
                <>
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Efetivando...
                </>
              ) : (
                <>
                  <Check className="mr-1.5 h-3.5 w-3.5" />
                  Confirmar e Efetivar Definitivamente
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
