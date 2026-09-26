import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { listarAlunos } from '@/services/alunos'
import { listarCategorias } from '@/services/categorias'
import { getConfiguracaoGlobal } from '@/services/configuracao'
import { listarLancamentosPorAluno } from '@/services/lancamentos'
import { useApp } from '@/contexts/AppContext'
import {
  calcularHorasCategoria,
  isCategoriaBloqueada,
  validarNovoLancamento,
  calcularProgressoAluno,
} from '@/lib/calculoHoras'
import { gerarTextoDespacho } from '@/lib/formatadorDespacho'
import { gerarRelatorioAlunoPdf } from '@/lib/exportacaoRelatorioAlunoPdf'
import type { Aluno, Categoria, Lancamento, ConfiguracaoGlobal, AlunoProgresso } from '@/types'
import {
  Search,
  Check,
  Copy,
  AlertCircle,
  Clock,
  ExternalLink,
  ChevronDown,
  FileDown,
  Sparkles,
  AlertTriangle,
  Loader2,
  Calendar,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'

export default function LancamentoRapido() {
  const { toast } = useToast()
  const appContext = useApp()

  // Dados globais
  const [alunos, setAlunos] = useState<Aluno[]>(appContext.alunos)
  const [categorias, setCategorias] = useState<Categoria[]>(appContext.categorias)
  const [config, setConfig] = useState<ConfiguracaoGlobal | null>(appContext.config)
  const [loadingInitial, setLoadingInitial] = useState(appContext.loading)

  useEffect(() => {
    if (appContext.alunos.length > 0) setAlunos(appContext.alunos)
    if (appContext.categorias.length > 0) setCategorias(appContext.categorias)
    if (appContext.config) {
      setConfig(appContext.config)
      if (appContext.config.semestre_letivo_atual) {
        setSemestreAtividade(appContext.config.semestre_letivo_atual)
      }
    }
    setLoadingInitial(appContext.loading)
  }, [appContext.alunos, appContext.categorias, appContext.config, appContext.loading])

  // Passo 1: Seleção do Estudante
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [selectedAluno, setSelectedAluno] = useState<Aluno | null>(null)
  const [alunoProgresso, setAlunoProgresso] = useState<AlunoProgresso | null>(null)
  const [alunoLancamentos, setAlunoLancamentos] = useState<Lancamento[]>([])
  const searchContainerRef = useRef<HTMLDivElement>(null)

  // Passo 2: Registro da Atividade
  const [dataAtividade, setDataAtividade] = useState(() => {
    return new Date().toISOString().split('T')[0]
  })
  const [semestreAtividade, setSemestreAtividade] = useState('2026.2')
  const [categoriaId, setCategoriaId] = useState('')
  const [horasAceitas, setHorasAceitas] = useState<number | string>(10)
  const [isEstorno, setIsEstorno] = useState(false)
  const [comprovanteOk, setComprovanteOk] = useState(true)
  const [relatorioOk, setRelatorioOk] = useState(true)
  const [observacao, setObservacao] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [gerandoPdf, setGerandoPdf] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  // Passo 3: Despacho Automático Gerado
  const [despachoGerado, setDespachoGerado] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Carrega configuração e listas iniciais
  useEffect(() => {
    async function init() {
      try {
        setLoadingInitial(true)
        const [cfg, als, cats] = await Promise.all([
          getConfiguracaoGlobal(),
          listarAlunos(),
          listarCategorias(false), // traz todas
        ])
        setConfig(cfg)
        setAlunos(als)
        setCategorias(cats)
        if (cfg?.semestre_letivo_atual) {
          setSemestreAtividade(cfg.semestre_letivo_atual)
        }
        // Seleciona automaticamente o primeiro aluno caso nenhum esteja selecionado
        if (als.length > 0 && !selectedAluno) {
          const primeiro = als[0]
          setSelectedAluno(primeiro)
          setSearchQuery(
            `${primeiro.matricula} — ${primeiro.nome} (${primeiro.semestre_atual}º Sem • ${primeiro.turno})`,
          )
        }
      } catch (err) {
        console.error('Erro ao carregar dados:', err)
        toast({
          title: 'Erro ao carregar dados',
          description: 'Não foi possível carregar a base de estudantes e categorias.',
          variant: 'destructive',
        })
      } finally {
        setLoadingInitial(false)
      }
    }
    init()
  }, [toast])

  // Fecha dropdown de busca ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setIsSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Atualiza lançamentos e progresso do estudante quando selecionado
  useEffect(() => {
    if (!selectedAluno || !config) {
      setAlunoProgresso(null)
      setAlunoLancamentos([])
      setDespachoGerado(null)
      return
    }

    async function loadAlunoData() {
      if (!selectedAluno || !config) return
      try {
        const lancs = await listarLancamentosPorAluno(selectedAluno.id)
        setAlunoLancamentos(lancs)
        const prog = calcularProgressoAluno(selectedAluno, lancs, categorias, config)
        setAlunoProgresso(prog)
      } catch (err) {
        console.error('Erro ao carregar lançamentos do aluno:', err)
      }
    }
    loadAlunoData()
  }, [selectedAluno, config, categorias])

  // Categoria atualmente selecionada
  const catSelecionada = useMemo(() => {
    return categorias.find((c) => c.id === categoriaId) || null
  }, [categorias, categoriaId])

  // Horas acumuladas na categoria selecionada para o aluno atual
  const horasCategoriaAtual = useMemo(() => {
    if (!catSelecionada || !selectedAluno) return 0
    return calcularHorasCategoria(catSelecionada.id, alunoLancamentos)
  }, [catSelecionada, selectedAluno, alunoLancamentos])

  const categoriaBloqueadaAtual = useMemo(() => {
    if (!catSelecionada) return false
    return isCategoriaBloqueada(horasCategoriaAtual, catSelecionada.teto_maximo_curso)
  }, [catSelecionada, horasCategoriaAtual])

  // Seleciona a primeira categoria ativa disponível por padrão se nenhuma selecionada
  useEffect(() => {
    if (!categoriaId && categorias.length > 0) {
      const ativa = categorias.find((c) => c.ativo !== false)
      if (ativa) {
        setCategoriaId(ativa.id)
      }
    }
  }, [categorias, categoriaId])

  // Gerar despacho prévio/simulado caso o usuário ainda não tenha salvo o lançamento
  // ou atualizar com o despacho do formulário atual
  const despachoPreview = useMemo(() => {
    if (!selectedAluno || !config) return null
    if (despachoGerado) return despachoGerado

    const catParaDespacho = catSelecionada || categorias[0]
    if (!catParaDespacho) return null

    const numHoras = Number(horasAceitas) || 0
    return gerarTextoDespacho({
      aluno: selectedAluno,
      categoriaAtividade: catParaDespacho,
      horasLancamento: numHoras,
      semestreAtividade,
      lancamentosDoAluno: alunoLancamentos,
      categorias,
      config,
      dataDespacho: new Date(dataAtividade || Date.now()),
    })
  }, [
    selectedAluno,
    config,
    despachoGerado,
    catSelecionada,
    categorias,
    horasAceitas,
    semestreAtividade,
    alunoLancamentos,
    dataAtividade,
  ])

  // Filtragem rápida de alunos (<100ms)
  const filteredAlunos = useMemo(() => {
    if (!searchQuery.trim()) return alunos.slice(0, 8)
    const q = searchQuery.toLowerCase().trim()
    return alunos
      .filter((a) => a.nome.toLowerCase().includes(q) || a.matricula.toLowerCase().includes(q))
      .slice(0, 10)
  }, [alunos, searchQuery])

  // Opções de semestres letivos para seleção
  const semestresDisponiveis = [
    '2024.1',
    '2024.2',
    '2025.1',
    '2025.2',
    '2026.1',
    '2026.2',
    '2027.1',
  ]

  // Handlers
  const handleSelectAluno = (aluno: Aluno) => {
    setSelectedAluno(aluno)
    setSearchQuery(
      `${aluno.matricula} — ${aluno.nome} (${aluno.semestre_atual}º Sem • ${aluno.turno})`,
    )
    setIsSearchOpen(false)
    setValidationError(null)
    setDespachoGerado(null)
  }

  const handleSomarHorasAtalho = (qtd: number) => {
    const atual = Number(horasAceitas) || 0
    if (isEstorno) {
      setHorasAceitas(atual - qtd)
    } else {
      setHorasAceitas(Math.max(0, atual + qtd))
    }
  }

  const handleEstornoToggle = (checked: boolean) => {
    setIsEstorno(checked)
    const currentNum = Number(horasAceitas) || 0
    if (checked) {
      if (currentNum > 0) setHorasAceitas(-currentNum)
      else if (currentNum === 0) setHorasAceitas(-5)
    } else {
      if (currentNum < 0) setHorasAceitas(Math.abs(currentNum))
      else if (currentNum === 0) setHorasAceitas(10)
    }
  }

  const handleSalvarLancamento = async (e: React.FormEvent) => {
    e.preventDefault()
    setValidationError(null)

    if (!selectedAluno) {
      setValidationError('Selecione um estudante no Passo 1.')
      return
    }

    if (!categoriaId) {
      setValidationError('Selecione uma categoria de atividade válida.')
      return
    }

    const cat = categorias.find((c) => c.id === categoriaId)
    if (!cat) {
      setValidationError('Categoria não encontrada.')
      return
    }

    const numHoras = Number(horasAceitas)
    if (isNaN(numHoras)) {
      setValidationError('Informe uma quantidade de horas válida.')
      return
    }

    if (isEstorno && numHoras >= 0) {
      setValidationError('Lançamentos de estorno exigem horas negativas (ex: -10).')
      return
    }

    if (!isEstorno && numHoras <= 0) {
      setValidationError(
        'Lançamento normal exige horas positivas. Ative "Estorno" se deseja deduzir horas.',
      )
      return
    }

    // Calcula acumulado da categoria para validar bloqueio
    const horasAcumuladas = calcularHorasCategoria(cat.id, alunoLancamentos)

    const validacao = validarNovoLancamento({
      horasAceitas: numHoras,
      categoria: cat,
      horasAcumuladasAtuais: horasAcumuladas,
      comprovanteOk,
      relatorioOk,
      observacao,
    })

    if (!validacao.valido) {
      setValidationError(validacao.erro || 'Validação falhou.')
      return
    }

    // Salvar no backend
    try {
      setSubmitting(true)

      // Muta no backend E sincroniza backup local imediatamente via AppContext
      const novoLancamento = await appContext.criarLancamento({
        aluno_id: selectedAluno.id,
        categoria_id: cat.id,
        data_lancamento: new Date(dataAtividade).toISOString(),
        semestre_letivo_atividade: semestreAtividade,
        horas_aceitas: numHoras,
        comprovante_ok: comprovanteOk,
        relatorio_ok: relatorioOk,
        observacao: observacao.trim(),
      })

      // Atualiza lista local de lançamentos para gerar despacho imediato
      const novosLancamentos = [novoLancamento, ...alunoLancamentos]
      setAlunoLancamentos(novosLancamentos)

      // Atualiza progresso do aluno com o novo lançamento
      if (config) {
        const novoProg = calcularProgressoAluno(selectedAluno, novosLancamentos, categorias, config)
        setAlunoProgresso(novoProg)

        // Gera o texto do despacho oficial formatado
        const textoDespacho = gerarTextoDespacho({
          aluno: selectedAluno,
          categoriaAtividade: cat,
          horasLancamento: numHoras,
          semestreAtividade,
          lancamentosDoAluno: novosLancamentos,
          categorias,
          config,
          dataDespacho: new Date(),
        })

        setDespachoGerado(textoDespacho)
      }

      toast({
        title: 'Lançamento registrado com sucesso!',
        description: `${numHoras > 0 ? `+${numHoras}h` : `${numHoras}h`} em ${cat.nome}. Despacho oficial gerado.`,
      })

      // Mantém campos preparados para um eventual próximo lançamento
      setObservacao('')
    } catch (err: unknown) {
      console.error('Erro ao salvar lançamento:', err)
      setValidationError(
        'Ocorreu um erro ao registrar o lançamento no banco de dados. Verifique a conexão e tente novamente.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  const handleCopiarDespacho = async () => {
    const textoParaCopiar = despachoGerado || despachoPreview
    if (!textoParaCopiar) return
    try {
      await navigator.clipboard.writeText(textoParaCopiar)
      setCopied(true)
      toast({
        title: 'Texto copiado!',
        description: 'Despacho oficial copiado para a área de transferência.',
      })
      setTimeout(() => {
        setCopied(false)
      }, 2000)
    } catch (err) {
      console.error('Falha ao copiar:', err)
    }
  }

  const handleBaixarPdf = async () => {
    if (!selectedAluno) return
    try {
      setGerandoPdf(true)
      gerarRelatorioAlunoPdf({
        aluno: selectedAluno,
        lancamentos: alunoLancamentos,
        categorias,
        config,
        salvarArquivo: true,
      })
      toast({
        title: 'Extrato oficial gerado',
        description: `Download do PDF individual de ${selectedAluno.nome} iniciado.`,
      })
    } catch (err) {
      console.error('Erro ao gerar PDF:', err)
      toast({
        title: 'Erro ao gerar PDF',
        description: 'Não foi possível compilar o documento PDF do estudante.',
        variant: 'destructive',
      })
    } finally {
      setGerandoPdf(false)
    }
  }

  // Estatísticas calculadas em tempo real para a barra inferior do Passo 3
  const semestreVigente = config?.semestre_letivo_atual || '2026.2'
  const minimoSemestre = config?.minimo_exigido_semestre || 20
  const metaCurso = config?.meta_curso || 200

  // Contagem de categorias bloqueadas do aluno
  const totalCategoriasBloqueadas = alunoProgresso?.categoriasBloqueadasIds.size || 0

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* ========================================================
          1. BANNER INSTITUCIONAL DE ALTA PRODUTIVIDADE
         ======================================================== */}
      <section className="relative overflow-hidden rounded-xl bg-gradient-to-r from-[#0a1e33] via-[#0f2b48] to-[#12365c] p-6 text-white shadow-lg border border-[#1e3e60]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400 px-3 py-1 text-[11px] font-bold tracking-wider uppercase text-amber-950 shadow-xs">
                <Sparkles className="h-3.5 w-3.5" />
                Operação de Alta Produtividade
              </span>
              <span className="text-xs text-blue-200/90 font-medium">
                Tempo estimado de atendimento: &lt; 15 segundos
              </span>
            </div>
            <h1 className="font-['Outfit'] text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Lançamento Rápido &amp; Geração de Despacho
            </h1>
            <p className="text-xs sm:text-sm text-blue-100/80 max-w-2xl leading-relaxed">
              Validação instantânea de tetos regulamentares NDE, cálculo de saldos em tempo real e
              cópia do texto oficial de deferimento para o chamado institucional.
            </p>
          </div>

          {/* Chip do Semestre Vigente */}
          <div className="shrink-0 flex items-center">
            <div className="flex items-center gap-3 rounded-lg bg-[#0b223a]/90 px-4 py-3 border border-blue-400/20 shadow-inner">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-400/20 text-amber-300">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <span className="block text-[11px] uppercase tracking-wider text-blue-200/70 font-semibold">
                  Semestre Vigente:
                </span>
                <span className="font-['Outfit'] text-lg font-bold text-white tracking-tight">
                  {semestreVigente}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          GRID DE DUAS COLUNAS (Esquerda: P1 + P2; Direita: P3 Sticky)
         ======================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* COLUNA ESQUERDA: Passo 1 + Passo 2 (8 colunas no desktop) */}
        <div className="lg:col-span-7 space-y-6">
          {/* ----------------------------------------------------
              PASSO 1: Seleção do Estudante
             ---------------------------------------------------- */}
          <Card className="border-slate-200/90 shadow-sm bg-white overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-[#1d4ed8]">
                  1
                </span>
                <h2 className="font-['Outfit'] text-base font-bold text-[#0f2b48]">
                  PASSO 1: Seleção do Estudante
                </h2>
              </div>
              {selectedAluno && (
                <Link
                  to={`/alunos/${selectedAluno.id}`}
                  className="inline-flex items-center gap-1 text-xs font-medium text-[#1d4ed8] hover:text-[#1e40af] hover:underline"
                >
                  <span>Ver Extrato Completo</span>
                  <ExternalLink className="h-3 w-3" />
                </Link>
              )}
            </div>

            <CardContent className="p-5 space-y-4">
              {/* Select / Search de Aluno */}
              <div className="relative" ref={searchContainerRef}>
                <Label
                  htmlFor="search-aluno"
                  className="text-xs font-semibold text-slate-700 block mb-1.5"
                >
                  Buscar Aluno (Nome ou Matrícula):
                </Label>
                <div className="relative">
                  <Input
                    id="search-aluno"
                    type="text"
                    placeholder="Digite a matrícula ou nome do aluno..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value)
                      setIsSearchOpen(true)
                    }}
                    onFocus={() => setIsSearchOpen(true)}
                    className="h-10 text-sm font-medium pr-8 border-slate-300 focus-visible:ring-[#1d4ed8]"
                  />
                  <ChevronDown className="absolute right-3 top-3 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>

                {/* Dropdown de sugestões */}
                {isSearchOpen && filteredAlunos.length > 0 && (
                  <div className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-xl">
                    {filteredAlunos.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => handleSelectAluno(a)}
                        className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition-colors border-b border-slate-100 last:border-b-0 ${
                          selectedAluno?.id === a.id
                            ? 'bg-blue-50 text-blue-900 font-semibold'
                            : 'hover:bg-slate-50 text-slate-800'
                        }`}
                      >
                        <div className="flex flex-col">
                          <span className="font-semibold">
                            {a.matricula} — {a.nome}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            {a.semestre_atual}º Semestre • Turno {a.turno} • Entrada{' '}
                            {a.periodo_entrada}
                          </span>
                        </div>
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-slate-50 text-slate-600 border-slate-200"
                        >
                          Selecionar
                        </Badge>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* CARTÃO DE RESUMO RICO DO ALUNO (Idêntico ao Mockup) */}
              {selectedAluno ? (
                <div className="rounded-xl border border-slate-200/90 bg-slate-50/70 p-4 space-y-3.5 shadow-2xs">
                  {/* Linha 1: Nome, Badge Matrícula e Badge Balanço */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-['Outfit'] text-base font-bold text-[#0f2b48]">
                        {selectedAluno.nome}
                      </h3>
                      <Badge
                        variant="secondary"
                        className="bg-slate-200 text-slate-700 text-[11px] font-mono px-2 py-0.5"
                      >
                        {selectedAluno.matricula}
                      </Badge>
                    </div>

                    {alunoProgresso && (
                      <Badge
                        className={`text-[11px] font-bold px-2.5 py-0.5 border ${
                          alunoProgresso.cumpriuSemestre
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                            : 'bg-amber-50 text-amber-800 border-amber-300'
                        }`}
                      >
                        {alunoProgresso.cumpriuSemestre
                          ? 'Balanço: CUMPRIU'
                          : 'Balanço: NÃO CUMPRIU'}
                      </Badge>
                    )}
                  </div>

                  {/* Linha 2: Quatro colunas de metadados acadêmicos */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 border-t border-slate-200/60 text-xs">
                    <div>
                      <span className="block text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                        Turno / Entrada
                      </span>
                      <span className="font-semibold text-slate-800">
                        {selectedAluno.turno} • {selectedAluno.periodo_entrada}
                      </span>
                    </div>

                    <div>
                      <span className="block text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                        Semestre Atual
                      </span>
                      <span className="font-bold text-blue-700">
                        {selectedAluno.semestre_atual}º Semestre
                      </span>
                    </div>

                    <div>
                      <span className="block text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                        Semestre Vigente
                      </span>
                      <span className="font-semibold text-slate-800">
                        {alunoProgresso?.horasSemestreAtual ?? 0}h / mín. {minimoSemestre}h
                      </span>
                    </div>

                    <div>
                      <span className="block text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                        Total Acumulado
                      </span>
                      <span className="font-bold text-slate-900">
                        {alunoProgresso?.totalGeralHoras ?? 0}h
                        <span className="text-slate-500 font-normal"> / {metaCurso}h</span>
                      </span>
                    </div>
                  </div>

                  {/* Barra de Progresso Horizontal com Percentual */}
                  <div className="space-y-1 pt-1">
                    <div className="flex items-center justify-between text-[11px] font-medium text-slate-600">
                      <span>Progresso da Meta ({metaCurso}h)</span>
                      <span className="font-bold text-blue-700">
                        {alunoProgresso?.porcentagemCurso ?? 0}%
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-[#1d4ed8] transition-all duration-300"
                        style={{
                          width: `${Math.min(100, alunoProgresso?.porcentagemCurso ?? 0)}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Aviso de categorias bloqueadas caso existam */}
                  {totalCategoriasBloqueadas > 0 && (
                    <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800 border border-red-200">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
                      <span>
                        <strong>Atenção:</strong> Este estudante possui{' '}
                        <strong>{totalCategoriasBloqueadas}</strong> categoria(s) com teto máximo
                        atingido (bloqueadas para novos lançamentos normais).
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500">
                  Nenhum estudante selecionado. Digite acima para buscar.
                </div>
              )}
            </CardContent>
          </Card>

          {/* ----------------------------------------------------
              PASSO 2: Registro da Atividade Deferida
             ---------------------------------------------------- */}
          <Card className="border-slate-200/90 shadow-sm bg-white overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-[#1d4ed8]">
                  2
                </span>
                <h2 className="font-['Outfit'] text-base font-bold text-[#0f2b48]">
                  PASSO 2: Registro da Atividade Deferida
                </h2>
              </div>
              <span className="text-[11px] text-slate-500">Campos com validação de teto NDE</span>
            </div>

            <CardContent className="p-5">
              {validationError && (
                <Alert variant="destructive" className="mb-5 border-red-200 bg-red-50 text-red-900">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertTitle className="text-xs font-bold">Atenção ao registrar:</AlertTitle>
                  <AlertDescription className="text-xs font-medium">
                    {validationError}
                  </AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleSalvarLancamento} className="space-y-4">
                {/* Linha 1: Data da Atividade + Semestre Letivo */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="data-atividade"
                      className="text-xs font-semibold text-slate-700"
                    >
                      Data da Atividade:
                    </Label>
                    <div className="relative">
                      <Input
                        id="data-atividade"
                        type="date"
                        required
                        value={dataAtividade}
                        onChange={(e) => setDataAtividade(e.target.value)}
                        className="h-10 text-sm border-slate-300 focus-visible:ring-[#1d4ed8]"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label
                      htmlFor="semestre-atividade"
                      className="text-xs font-semibold text-slate-700"
                    >
                      Semestre Letivo da Atividade:
                    </Label>
                    <div className="relative">
                      <select
                        id="semestre-atividade"
                        required
                        value={semestreAtividade}
                        onChange={(e) => setSemestreAtividade(e.target.value)}
                        className="h-10 w-full appearance-none rounded-md border border-slate-300 bg-white px-3 py-2 pr-8 text-sm shadow-2xs focus:border-[#1d4ed8] focus:outline-none focus:ring-1 focus:ring-[#1d4ed8]"
                      >
                        {semestresDisponiveis.map((sem) => (
                          <option key={sem} value={sem}>
                            {sem}{' '}
                            {sem === config?.semestre_letivo_atual ? '(Semestre Vigente)' : ''}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-3 h-4 w-4 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                </div>

                {/* Linha 2: Categoria NDE + Badge de Saldo à direita */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Label
                      htmlFor="categoria-select"
                      className="text-xs font-semibold text-slate-700"
                    >
                      Categoria NDE:
                    </Label>
                    {catSelecionada && selectedAluno && (
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          categoriaBloqueadaAtual
                            ? 'bg-red-100 text-red-800 border border-red-300'
                            : 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                        }`}
                      >
                        {categoriaBloqueadaAtual
                          ? `⛔ Teto Atingido: ${horasCategoriaAtual}h / ${catSelecionada.teto_maximo_curso}h`
                          : `Saldo acumulado: ${horasCategoriaAtual}h / Teto: ${catSelecionada.teto_maximo_curso}h`}
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <select
                      id="categoria-select"
                      required
                      value={categoriaId}
                      onChange={(e) => setCategoriaId(e.target.value)}
                      className="h-10 w-full appearance-none rounded-md border border-slate-300 bg-white px-3 py-2 pr-8 text-sm shadow-2xs focus:border-[#1d4ed8] focus:outline-none focus:ring-1 focus:ring-[#1d4ed8]"
                    >
                      <option value="">Selecione a Categoria NDE...</option>
                      {categorias
                        .filter((c) => c.ativo !== false)
                        .map((cat) => {
                          const horasCat = selectedAluno
                            ? calcularHorasCategoria(cat.id, alunoLancamentos)
                            : 0
                          const bloqueada = isCategoriaBloqueada(horasCat, cat.teto_maximo_curso)

                          return (
                            <option
                              key={cat.id}
                              value={cat.id}
                              disabled={bloqueada && !isEstorno}
                              className={bloqueada ? 'text-red-600 bg-red-50' : ''}
                            >
                              {cat.nome} (Máx {cat.teto_maximo_curso}h) —{' '}
                              {cat.regra_horas_unitaria || 'Conforme Edital'}
                              {bloqueada ? ' ⛔ [BLOQUEADA]' : ''}
                            </option>
                          )
                        })}
                    </select>
                    <ChevronDown className="absolute right-3 top-3 h-4 w-4 text-slate-400 pointer-events-none" />
                  </div>
                  {categoriaBloqueadaAtual && !isEstorno && (
                    <p className="text-xs text-red-600 font-medium">
                      ⛔ Categoria bloqueada para este estudante (teto de{' '}
                      {catSelecionada?.teto_maximo_curso}h já atingido). Selecione outra categoria
                      ou ative o modo estorno.
                    </p>
                  )}
                </div>

                {/* Linha 3: Horas Aceitas + Atalhos Rápidos (+5h, +10h, +20h, +30h) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="horas-aceitas" className="text-xs font-semibold text-slate-700">
                      Horas Aceitas:
                    </Label>
                    <span className="text-[11px] text-slate-400">
                      (Para estornos corretivos, informe valor negativo)
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="w-24">
                      <Input
                        id="horas-aceitas"
                        type="number"
                        step="0.5"
                        required
                        value={horasAceitas}
                        onChange={(e) => setHorasAceitas(e.target.value)}
                        className={`h-9 text-center font-bold text-sm ${
                          isEstorno
                            ? 'text-red-600 border-red-300 bg-red-50'
                            : 'text-slate-900 border-slate-300'
                        }`}
                      />
                    </div>
                    <span className="text-xs font-medium text-slate-500">horas</span>

                    {/* Botões rápidos de atalho (+5h, +10h, +20h, +30h) */}
                    <div className="flex items-center gap-1.5 ml-auto">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleSomarHorasAtalho(5)}
                        className="h-8 px-2.5 text-xs font-semibold border-slate-300 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300"
                      >
                        +5h
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleSomarHorasAtalho(10)}
                        className="h-8 px-2.5 text-xs font-semibold bg-[#1d4ed8] text-white border-[#1d4ed8] hover:bg-[#1e40af] hover:text-white"
                      >
                        +10h
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleSomarHorasAtalho(20)}
                        className="h-8 px-2.5 text-xs font-semibold border-slate-300 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300"
                      >
                        +20h
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleSomarHorasAtalho(30)}
                        className="h-8 px-2.5 text-xs font-semibold border-slate-300 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300"
                      >
                        +30h
                      </Button>
                    </div>
                  </div>

                  {/* Toggle para estorno corretivo */}
                  <div className="flex items-center justify-end pt-1">
                    <div className="flex items-center gap-2">
                      <Switch
                        id="estorno-switch"
                        checked={isEstorno}
                        onCheckedChange={handleEstornoToggle}
                      />
                      <Label
                        htmlFor="estorno-switch"
                        className="cursor-pointer text-[11px] font-medium text-slate-600"
                      >
                        Modo Estorno (dedução de horas)
                      </Label>
                    </div>
                  </div>
                </div>

                {/* Linha 4: Checklist de Validação Documental Obrigatória (Idêntico ao Mockup) */}
                <div className="rounded-xl border border-blue-200/90 bg-blue-50/40 p-4 space-y-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#0f2b48]">
                    <span className="text-[#1d4ed8]">☑</span>
                    <span>Checklist de Validação Documental Obrigatória</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="flex items-start gap-2.5 rounded-lg border border-blue-100 bg-white p-3 cursor-pointer hover:bg-slate-50 transition shadow-2xs">
                      <Checkbox
                        checked={comprovanteOk}
                        onCheckedChange={(checked) => setComprovanteOk(!!checked)}
                        className="mt-0.5 border-slate-400 data-[state=checked]:bg-[#1d4ed8] data-[state=checked]:border-[#1d4ed8]"
                      />
                      <div className="space-y-0.5 text-xs">
                        <span className="font-bold text-slate-900 block leading-tight">
                          Comprovante de Participação OK?
                        </span>
                        <span className="text-[11px] text-slate-500 block">
                          Certificado ou declaração válida anexada
                        </span>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 rounded-lg border border-blue-100 bg-white p-3 cursor-pointer hover:bg-slate-50 transition shadow-2xs">
                      <Checkbox
                        checked={relatorioOk}
                        onCheckedChange={(checked) => setRelatorioOk(!!checked)}
                        className="mt-0.5 border-slate-400 data-[state=checked]:bg-[#1d4ed8] data-[state=checked]:border-[#1d4ed8]"
                      />
                      <div className="space-y-0.5 text-xs">
                        <span className="font-bold text-slate-900 block leading-tight">
                          Relatório Reflexivo OK?
                        </span>
                        <span className="text-[11px] text-slate-500 block">
                          Reflexão pedagógica apresentada e deferida
                        </span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Linha 5: Observação / Título da Atividade */}
                <div className="space-y-1.5">
                  <Label htmlFor="observacao" className="text-xs font-semibold text-slate-700">
                    Observação / Título da Atividade:
                  </Label>
                  <Input
                    id="observacao"
                    type="text"
                    required={isEstorno}
                    placeholder={
                      isEstorno
                        ? 'Justificativa obrigatória para estorno corretivo...'
                        : 'Ex.: Curso de Extensão em Neuropsicologia Clínica'
                    }
                    value={observacao}
                    onChange={(e) => setObservacao(e.target.value)}
                    className="h-10 text-sm border-slate-300 focus-visible:ring-[#1d4ed8]"
                  />
                  {isEstorno && (
                    <span className="text-[11px] font-semibold text-red-600 block">
                      A justificativa de estorno é obrigatória conforme regimento NDE.
                    </span>
                  )}
                </div>

                {/* Botão largo de Ação Primária: REGISTRAR LANÇAMENTO E GERAR DESPACHO */}
                <div className="pt-2">
                  <Button
                    type="submit"
                    disabled={
                      submitting || !selectedAluno || (categoriaBloqueadaAtual && !isEstorno)
                    }
                    className="w-full h-11 bg-[#0f2b48] hover:bg-[#091a2c] text-white font-bold text-xs tracking-wider uppercase shadow-md transition-all duration-150 active:scale-[0.99] flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Processando Lançamento...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 text-amber-300" />
                        <span>Registrar Lançamento e Gerar Despacho</span>
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* COLUNA DIREITA: PASSO 3 - Despacho Automático (5 colunas, sticky) */}
        <div className="lg:col-span-5 lg:sticky lg:top-6 space-y-4">
          <Card className="border-slate-200/90 shadow-sm bg-white overflow-hidden">
            {/* Header com badge 'Padrão Coordenação' */}
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-[#1d4ed8]">
                  3
                </span>
                <h2 className="font-['Outfit'] text-base font-bold text-[#0f2b48]">
                  PASSO 3: Despacho Automático
                </h2>
              </div>
              <Badge
                variant="outline"
                className="bg-emerald-50 text-emerald-800 border-emerald-300 text-[10px] font-semibold"
              >
                Padrão Coordenação
              </Badge>
            </div>

            <CardContent className="p-5 space-y-4">
              <p className="text-xs text-slate-500 leading-relaxed">
                Texto pronto e formatado segundo o regimento do NDE e regras de exibição do numeral
                &apos;0&apos;. Copie e cole diretamente no chamado institucional.
              </p>

              {/* BLOCO ESTILO TERMINAL / DOCUMENTO */}
              <div className="relative rounded-lg bg-[#0a1826] border border-[#1b3248] text-slate-100 p-4 shadow-inner">
                {/* Botão pequeno 'Copiar' sobreposto no canto superior direito */}
                <button
                  type="button"
                  onClick={handleCopiarDespacho}
                  className="absolute right-3 top-3 inline-flex items-center gap-1 rounded bg-[#1e3a58]/80 hover:bg-[#1e3a58] px-2.5 py-1 text-[11px] font-medium text-slate-200 transition shadow-xs border border-white/10"
                >
                  {copied ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-400" />
                      <span className="text-emerald-400 font-semibold">Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>Copiar</span>
                    </>
                  )}
                </button>

                {/* Área de texto monoespaçada com scroll */}
                <div className="max-h-80 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                  {despachoPreview ? (
                    <pre className="font-mono text-[11px] leading-relaxed text-slate-200 whitespace-pre-wrap select-all font-normal">
                      {despachoPreview}
                    </pre>
                  ) : (
                    <div className="py-12 text-center text-xs text-slate-500 italic">
                      Selecione um estudante e categoria para visualizar o despacho instantâneo.
                    </div>
                  )}
                </div>
              </div>

              {/* Botão Primário Largo: Copiar Texto do Despacho para o Clipboard */}
              <Button
                type="button"
                onClick={handleCopiarDespacho}
                disabled={!despachoPreview}
                className={`w-full h-11 text-xs font-bold tracking-wider uppercase shadow-md transition-all ${
                  copied
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-[#1d4ed8] hover:bg-[#1e40af] text-white'
                }`}
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 mr-1.5" />
                    <span>Texto Copiado para a Área de Transferência!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-1.5" />
                    <span>Copiar Texto do Despacho para o Clipboard</span>
                  </>
                )}
              </Button>

              {/* Botão Secundário: Baixar Extrato Oficial do Aluno em PDF */}
              <Button
                type="button"
                variant="outline"
                onClick={handleBaixarPdf}
                disabled={!selectedAluno || gerandoPdf}
                className="w-full h-10 text-xs font-semibold border-slate-300 text-slate-700 hover:bg-slate-50 shadow-2xs flex items-center justify-center gap-1.5"
              >
                {gerandoPdf ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Gerando Relatório PDF...</span>
                  </>
                ) : (
                  <>
                    <FileDown className="h-3.5 w-3.5 text-amber-600" />
                    <span>Baixar Extrato Oficial do Aluno em PDF</span>
                  </>
                )}
              </Button>

              {/* LISTA-RESUMO DE SALDOS (Rótulo à esquerda, valor à direita) */}
              <div className="border-t border-slate-200/80 pt-3 space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-600">
                  <span>Horas no Semestre ({semestreVigente}):</span>
                  <span className="font-semibold text-slate-900">
                    {alunoProgresso?.horasSemestreAtual ?? 0}h
                  </span>
                </div>

                <div className="flex items-center justify-between text-slate-600">
                  <span>Restante no Semestre Atual:</span>
                  <span className="font-semibold text-slate-900">
                    {alunoProgresso?.restanteSemestreAtual ?? minimoSemestre}h
                  </span>
                </div>

                <div className="flex items-center justify-between text-slate-600">
                  <span>Restante para Integralizar o Curso:</span>
                  <span className="font-semibold text-slate-900">
                    {Math.max(0, metaCurso - (alunoProgresso?.totalGeralHoras ?? 0))}h
                  </span>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-slate-200 text-sm font-bold text-slate-900">
                  <span>Total Geral Acumulado:</span>
                  <span className="font-['Outfit'] text-base text-[#0f2b48]">
                    {alunoProgresso?.totalGeralHoras ?? 0}h
                    <span className="text-xs font-normal text-slate-500"> / {metaCurso}h</span>
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
