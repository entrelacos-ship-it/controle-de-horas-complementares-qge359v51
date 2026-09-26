import React, { useState, useEffect, useRef } from 'react'
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
import type { Aluno, Categoria, Lancamento, ConfiguracaoGlobal, AlunoProgresso } from '@/types'
import {
  Search,
  CheckCircle2,
  Copy,
  Check,
  AlertCircle,
  Lock,
  Zap,
  ArrowRight,
  User,
  GraduationCap,
  FileText,
  Loader2,
  HelpCircle,
  FileCheck2,
  Undo2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
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
  const [comprovanteOk, setComprovanteOk] = useState(false)
  const [relatorioOk, setRelatorioOk] = useState(false)
  const [observacao, setObservacao] = useState('')
  const [submitting, setSubmitting] = useState(false)
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

  // Atualiza progresso do estudante quando selecionado
  useEffect(() => {
    if (!selectedAluno || !config) {
      setAlunoProgresso(null)
      setAlunoLancamentos([])
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

  // Filtragem rápida de alunos (<100ms)
  const filteredAlunos = React.useMemo(() => {
    if (!searchQuery.trim()) return []
    const q = searchQuery.toLowerCase().trim()
    return alunos
      .filter((a) => a.nome.toLowerCase().includes(q) || a.matricula.toLowerCase().includes(q))
      .slice(0, 8)
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
    setSearchQuery(`${aluno.matricula} – ${aluno.nome}`)
    setIsSearchOpen(false)
    setValidationError(null)
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

    const catSelecionada = categorias.find((c) => c.id === categoriaId)
    if (!catSelecionada) {
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
    const horasAcumuladas = calcularHorasCategoria(catSelecionada.id, alunoLancamentos)

    const validacao = validarNovoLancamento({
      horasAceitas: numHoras,
      categoria: catSelecionada,
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
        categoria_id: catSelecionada.id,
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
          categoriaAtividade: catSelecionada,
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
        description: `${numHoras > 0 ? `+${numHoras}h` : `${numHoras}h`} em ${catSelecionada.nome}. Despacho oficial gerado abaixo.`,
      })

      // Reseta os campos do formulário para o próximo lançamento
      setCategoriaId('')
      setHorasAceitas(10)
      setIsEstorno(false)
      setComprovanteOk(false)
      setRelatorioOk(false)
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
    if (!despachoGerado) return
    try {
      await navigator.clipboard.writeText(despachoGerado)
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

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Header */}
      <div className="border-b border-slate-200 pb-5">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-[#1d4ed8]">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-['Outfit'] text-2xl font-bold tracking-tight text-[#0f2b48] sm:text-3xl">
              Lançamento Rápido de Horas
            </h1>
            <p className="text-sm text-slate-600">
              Fluxo ágil de deferimento de atividades complementares com geração de despacho
              automatizada
            </p>
          </div>
        </div>
      </div>

      {/* Main Flow: 3 Numbered Steps */}
      <div className="space-y-6">
        {/* PASSO 1: Seleção do Estudante */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1d4ed8] text-xs font-bold text-white shadow-sm">
                1
              </span>
              <div>
                <CardTitle className="font-['Outfit'] text-lg font-bold text-[#0f2b48]">
                  PASSO 1: Seleção do Estudante
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Pesquise por nome ou matrícula para verificar o saldo acumulado
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search Input with instant autocomplete */}
            <div className="relative" ref={searchContainerRef}>
              <Label htmlFor="search-aluno" className="text-xs font-semibold text-slate-700">
                Buscar Aluno (Nome ou Matrícula)
              </Label>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  id="search-aluno"
                  type="text"
                  placeholder="Ex: PSI2024201 ou Mariana..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    setIsSearchOpen(true)
                  }}
                  onFocus={() => setIsSearchOpen(true)}
                  className="pl-9 pr-10 text-sm font-medium"
                />
                {selectedAluno && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAluno(null)
                      setSearchQuery('')
                    }}
                    className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600"
                  >
                    Limpar
                  </button>
                )}
              </div>

              {/* Autocomplete Dropdown */}
              {isSearchOpen && filteredAlunos.length > 0 && (
                <div className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-md border border-slate-200 bg-white shadow-lg">
                  {filteredAlunos.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => handleSelectAluno(a)}
                      className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-blue-50/80 transition-colors border-b border-slate-100 last:border-b-0"
                    >
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-900">
                          {a.matricula} – {a.nome}
                        </span>
                        <span className="text-xs text-slate-500">
                          {a.semestre_atual}º Semestre · Turno {a.turno} · Entrada{' '}
                          {a.periodo_entrada}
                        </span>
                      </div>
                      <Badge variant="outline" className="text-[11px] font-normal">
                        Selecionar
                      </Badge>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Student Info Strip (quando selecionado) */}
            {selectedAluno && (
              <div className="rounded-lg border border-blue-200 bg-gradient-to-r from-blue-50/70 to-indigo-50/40 p-4 transition-all">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-['Outfit'] text-base font-bold text-[#0f2b48]">
                        {selectedAluno.nome}
                      </h3>
                      <Badge className="bg-[#0f2b48] text-white text-[11px]">
                        {selectedAluno.matricula}
                      </Badge>
                      <Link
                        to={`/alunos/${selectedAluno.id}`}
                        className="text-xs text-[#1d4ed8] underline hover:text-[#1e40af]"
                      >
                        Ver prontuário completo →
                      </Link>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                      <span>
                        Turno <strong>{selectedAluno.turno}</strong>
                      </span>
                      <span>•</span>
                      <span>
                        <strong>{selectedAluno.semestre_atual}º Semestre</strong>
                      </span>
                      <span>•</span>
                      <span>
                        Entrada: <strong>{selectedAluno.periodo_entrada}</strong>
                      </span>
                      <span>•</span>
                      <span>{selectedAluno.email}</span>
                    </div>
                  </div>

                  {/* Mini-progress indicator */}
                  <div className="min-w-[200px] rounded-md bg-white p-3 shadow-xs border border-blue-100">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                      <span>Progresso Total:</span>
                      <span className="text-[#16a34a] font-bold">
                        {alunoProgresso?.totalGeralHoras ?? 0}h / {alunoProgresso?.metaCurso ?? 200}
                        h
                      </span>
                    </div>
                    <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-[#16a34a] transition-all duration-300"
                        style={{
                          width: `${alunoProgresso?.porcentagemCurso ?? 0}%`,
                        }}
                      />
                    </div>
                    <div className="mt-1 flex justify-between text-[11px] text-slate-500">
                      <span>{alunoProgresso?.porcentagemCurso ?? 0}% integralizado</span>
                      <span>
                        Faltam{' '}
                        {Math.max(
                          0,
                          (alunoProgresso?.metaCurso ?? 200) -
                            (alunoProgresso?.totalGeralHoras ?? 0),
                        )}
                        h
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* PASSO 2: Registro da Atividade Deferida */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1d4ed8] text-xs font-bold text-white shadow-sm">
                2
              </span>
              <div>
                <CardTitle className="font-['Outfit'] text-lg font-bold text-[#0f2b48]">
                  PASSO 2: Registro da Atividade Deferida
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Preencha os dados da atividade comprovada conforme as regras do NDE
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {validationError && (
              <Alert variant="destructive" className="mb-5 border-red-200 bg-red-50 text-red-900">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertTitle className="text-xs font-bold">Atenção ao registrar:</AlertTitle>
                <AlertDescription className="text-xs font-medium">
                  {validationError}
                </AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSalvarLancamento} className="space-y-5">
              {/* Row 1: Data + Semestre */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="data-atividade" className="text-xs font-semibold text-slate-700">
                    Data da Atividade / Registro *
                  </Label>
                  <Input
                    id="data-atividade"
                    type="date"
                    required
                    value={dataAtividade}
                    onChange={(e) => setDataAtividade(e.target.value)}
                    className="text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="semestre-atividade"
                    className="text-xs font-semibold text-slate-700"
                  >
                    Semestre da Atividade *
                  </Label>
                  <select
                    id="semestre-atividade"
                    required
                    value={semestreAtividade}
                    onChange={(e) => setSemestreAtividade(e.target.value)}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-xs focus:border-[#1d4ed8] focus:outline-none focus:ring-1 focus:ring-[#1d4ed8]"
                  >
                    {semestresDisponiveis.map((sem) => (
                      <option key={sem} value={sem}>
                        {sem} {sem === config?.semestre_letivo_atual ? '(Atual)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 2: Categoria + Horas Aceitas */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="categoria-select"
                    className="text-xs font-semibold text-slate-700"
                  >
                    Categoria da Atividade *
                  </Label>
                  <select
                    id="categoria-select"
                    required
                    value={categoriaId}
                    onChange={(e) => setCategoriaId(e.target.value)}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-xs focus:border-[#1d4ed8] focus:outline-none focus:ring-1 focus:ring-[#1d4ed8]"
                  >
                    <option value="">Selecione a Categoria...</option>
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
                            {cat.nome} (Máx {cat.teto_maximo_curso}h)
                            {bloqueada ? ' ⛔ [BLOQUEADA]' : ` — acumulado ${horasCat}h`}
                          </option>
                        )
                      })}
                  </select>
                  {categoriaId && (
                    <p className="text-[11px] text-slate-500">
                      Regra unitária:{' '}
                      <strong>
                        {categorias.find((c) => c.id === categoriaId)?.regra_horas_unitaria}
                      </strong>
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="horas-aceitas" className="text-xs font-semibold text-slate-700">
                      Horas Aceitas {isEstorno ? '(negativas)' : ''} *
                    </Label>
                    <div className="flex items-center gap-1.5">
                      <Switch
                        id="estorno-toggle"
                        checked={isEstorno}
                        onCheckedChange={handleEstornoToggle}
                      />
                      <Label
                        htmlFor="estorno-toggle"
                        className="cursor-pointer text-[11px] font-medium text-slate-600"
                      >
                        Lançamento de Estorno
                      </Label>
                    </div>
                  </div>
                  <Input
                    id="horas-aceitas"
                    type="number"
                    step="0.5"
                    required
                    value={horasAceitas}
                    onChange={(e) => setHorasAceitas(e.target.value)}
                    className={`text-sm font-semibold ${
                      isEstorno ? 'text-red-600 border-red-300 bg-red-50/50' : 'text-slate-900'
                    }`}
                    placeholder={isEstorno ? '-10' : '10'}
                  />
                  {isEstorno && (
                    <p className="text-[11px] font-medium text-red-600">
                      ⚠️ Modo estorno ativado: o valor deve ser negativo e a observação de
                      justificativa é obrigatória.
                    </p>
                  )}
                </div>
              </div>

              {/* Row 3: Checklists Obrigatórios */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#0f2b48]">
                    Checklist de Conformidade Documental (Obrigatório)
                  </span>
                  <Badge variant="outline" className="text-[10px] text-slate-500">
                    Exige SIM em ambos para deferimento
                  </Badge>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="flex items-start gap-2.5 rounded border border-slate-200 bg-white p-3 cursor-pointer hover:bg-slate-50 transition">
                    <Checkbox
                      checked={comprovanteOk}
                      onCheckedChange={(checked) => setComprovanteOk(!!checked)}
                      className="mt-0.5 accent-[#1d4ed8]"
                    />
                    <div className="text-xs">
                      <span className="font-semibold text-slate-900 block">
                        Comprovante de Participação OK?
                      </span>
                      <span className="text-slate-500 text-[11px]">
                        Certificado, declaração ou ata oficial com carga horária legível.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 rounded border border-slate-200 bg-white p-3 cursor-pointer hover:bg-slate-50 transition">
                    <Checkbox
                      checked={relatorioOk}
                      onCheckedChange={(checked) => setRelatorioOk(!!checked)}
                      className="mt-0.5 accent-[#1d4ed8]"
                    />
                    <div className="text-xs">
                      <span className="font-semibold text-slate-900 block">
                        Relatório Reflexivo OK?
                      </span>
                      <span className="text-slate-500 text-[11px]">
                        Texto reflexivo elaborado pelo estudante relacionando à Psicologia.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Row 4: Observação */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="observacao" className="text-xs font-semibold text-slate-700">
                    Observação {isEstorno ? '(OBRIGATÓRIA PARA ESTORNO)' : '(Opcional)'}
                  </Label>
                  {isEstorno && (
                    <span className="text-[11px] font-semibold text-red-600">
                      Justificativa obrigatória
                    </span>
                  )}
                </div>
                <Textarea
                  id="observacao"
                  rows={2}
                  required={isEstorno}
                  placeholder={
                    isEstorno
                      ? 'Descreva obrigatoriamente o motivo da dedução de horas (ex: cancelamento, certificado duplicado)...'
                      : 'Detalhes adicionais do certificado, instituição emissora, título do trabalho...'
                  }
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  className="text-xs"
                />
              </div>

              {/* Submit Button */}
              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  disabled={submitting || !selectedAluno}
                  className="bg-[#1d4ed8] text-white hover:bg-[#1e40af] px-6 transition-all duration-150 active:scale-[0.98]"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <FileCheck2 className="mr-2 h-4 w-4" />
                      Registrar Lançamento e Gerar Despacho
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* PASSO 3: Despacho Automático Gerado */}
        {despachoGerado && (
          <Card className="border-l-4 border-l-[#1d4ed8] border-slate-200 bg-[#eef2f7] shadow-sm animate-fade-in">
            <CardHeader className="pb-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1d4ed8] text-xs font-bold text-white shadow-sm">
                    3
                  </span>
                  <div>
                    <CardTitle className="font-['Outfit'] text-lg font-bold text-[#0f2b48]">
                      PASSO 3: Despacho Oficial Gerado
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-600">
                      Texto oficial formatado e pronto para envio/comunicação à coordenação e aluno
                    </CardDescription>
                  </div>
                </div>

                <Button
                  type="button"
                  onClick={handleCopiarDespacho}
                  className={`transition-colors duration-200 text-xs font-semibold ${
                    copied
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : 'bg-[#1d4ed8] hover:bg-[#1e40af] text-white'
                  }`}
                >
                  {copied ? (
                    <>
                      <Check className="mr-1.5 h-4 w-4" />
                      Texto copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="mr-1.5 h-4 w-4" />
                      Copiar Texto do Despacho
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>

            <CardContent>
              <div className="rounded-md border border-blue-200 bg-white p-4 shadow-inner">
                <pre className="font-mono text-xs leading-relaxed text-slate-800 whitespace-pre-wrap select-all">
                  {despachoGerado}
                </pre>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
