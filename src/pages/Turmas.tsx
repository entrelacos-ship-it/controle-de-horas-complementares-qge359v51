import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { listarAlunos, promoverTodosAlunos } from '@/services/alunos'
import { listarTodosLancamentos } from '@/services/lancamentos'
import { getConfiguracaoGlobal } from '@/services/configuracao'
import type { Aluno, Lancamento, ConfiguracaoGlobal } from '@/types'
import {
  Building2,
  Users,
  Filter,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Info,
  Loader2,
  FileSpreadsheet,
  FileText,
  Search,
  RotateCcw,
  Sparkles,
  Award,
  Clock,
  ShieldAlert,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  prepararDadosTurma,
  exportarTurmaExcel,
  exportarTurmaCsv,
  exportarTurmaPdf,
  type TurmaItemExportacao,
} from '@/lib/exportacaoTurma'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'

export default function Turmas() {
  const { toast } = useToast()

  const [alunos, setAlunos] = useState<Aluno[]>([])
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([])
  const [config, setConfig] = useState<ConfiguracaoGlobal | null>(null)
  const [loading, setLoading] = useState(true)

  // Filtros combinados
  const [filtroEntrada, setFiltroEntrada] = useState('Todas')
  const [filtroTurno, setFiltroTurno] = useState('Todos')
  const [filtroStatus, setFiltroStatus] = useState<'Todos' | 'CUMPRIU' | 'NÃO CUMPRIU'>('Todos')
  const [buscaAluno, setBuscaAluno] = useState('')
  const [promovendo, setPromovendo] = useState(false)
  const [exportandoExcel, setExportandoExcel] = useState(false)
  const [exportandoCsv, setExportandoCsv] = useState(false)
  const [exportandoPdf, setExportandoPdf] = useState(false)

  const carregarDados = async () => {
    try {
      setLoading(true)
      const [als, lcs, cfg] = await Promise.all([
        listarAlunos(),
        listarTodosLancamentos(),
        getConfiguracaoGlobal(),
      ])
      setAlunos(als)
      setLancamentos(lcs)
      setConfig(cfg)
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro ao carregar dados da turma',
        description: 'Não foi possível carregar as turmas.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarDados()
  }, [])

  // Lista de períodos de entrada distintos para o dropdown
  const periodosEntradaDistintos = Array.from(new Set(alunos.map((a) => a.periodo_entrada)))
    .filter(Boolean)
    .sort()
    .reverse()

  // Cálculos de referência institucional vindos da configuração global
  const semestreAtual = config?.semestre_letivo_atual || '2026.2'
  const minimoSemestral = Number(config?.minimo_exigido_semestre) || 20
  const metaCurso = Number(config?.meta_curso) || 200

  // Mapeamento pré-calculado de métricas por aluno para filtros eficientes
  const metricasPorAluno = React.useMemo(() => {
    const mapa = new Map<
      string,
      {
        totalGeral: number
        horasSemestre: number
        restanteSemestre: number
        cumpriu: boolean
        porcentagemCurso: number
      }
    >()

    alunos.forEach((aluno) => {
      const lancsAluno = lancamentos.filter((l) => l.aluno_id === aluno.id)
      const totalGeral = lancsAluno.reduce((sum, l) => sum + (Number(l.horas_aceitas) || 0), 0)
      const horasSemestre = lancsAluno
        .filter((l) => l.semestre_letivo_atividade === semestreAtual)
        .reduce((sum, l) => sum + (Number(l.horas_aceitas) || 0), 0)

      const restanteSemestre = Math.max(0, minimoSemestral - horasSemestre)
      const cumpriu = horasSemestre >= minimoSemestral
      const porcentagemCurso =
        metaCurso > 0 ? Math.min(100, Math.round((totalGeral / metaCurso) * 100)) : 0

      mapa.set(aluno.id, {
        totalGeral,
        horasSemestre,
        restanteSemestre,
        cumpriu,
        porcentagemCurso,
      })
    })

    return mapa
  }, [alunos, lancamentos, semestreAtual, minimoSemestral, metaCurso])

  // Alunos filtrados com filtros combinados (Entrada + Turno + Status + Busca)
  const alunosFiltrados = React.useMemo(() => {
    const buscaNorm = buscaAluno.trim().toLowerCase()

    return alunos.filter((a) => {
      const matchEntrada = filtroEntrada === 'Todas' || a.periodo_entrada === filtroEntrada
      const matchTurno = filtroTurno === 'Todos' || a.turno === filtroTurno

      const metricas = metricasPorAluno.get(a.id)
      const cumpriu = metricas?.cumpriu ?? false
      const matchStatus =
        filtroStatus === 'Todos' ||
        (filtroStatus === 'CUMPRIU' && cumpriu) ||
        (filtroStatus === 'NÃO CUMPRIU' && !cumpriu)

      const matchBusca =
        !buscaNorm ||
        a.nome.toLowerCase().includes(buscaNorm) ||
        a.matricula.toLowerCase().includes(buscaNorm)

      return matchEntrada && matchTurno && matchStatus && matchBusca
    })
  }, [alunos, filtroEntrada, filtroTurno, filtroStatus, buscaAluno, metricasPorAluno])

  // Contadores globais e por filtro
  const totalAlunos = alunos.length
  const totalCumpriramGlobal = alunos.filter((a) => metricasPorAluno.get(a.id)?.cumpriu).length
  const totalNaoCumpriramGlobal = totalAlunos - totalCumpriramGlobal

  const totalFiltrados = alunosFiltrados.length
  const totalCumpriramFiltrados = alunosFiltrados.filter(
    (a) => metricasPorAluno.get(a.id)?.cumpriu,
  ).length
  const totalNaoCumpriramFiltrados = totalFiltrados - totalCumpriramFiltrados

  const handleExportarExcel = () => {
    try {
      setExportandoExcel(true)
      const dadosPreparados = prepararDadosTurma(alunosFiltrados, lancamentos, config)
      exportarTurmaExcel({
        itens: dadosPreparados,
        config,
        filtroEntrada,
        filtroTurno,
        filtroStatus,
      })
      toast({
        title: 'Planilha Excel gerada com sucesso!',
        description: `Exportados ${dadosPreparados.length} estudantes filtrados para Excel (.xlsx).`,
      })
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro ao exportar Excel',
        description: 'Ocorreu uma falha ao gerar a planilha.',
        variant: 'destructive',
      })
    } finally {
      setExportandoExcel(false)
    }
  }

  const handleExportarCsv = () => {
    try {
      setExportandoCsv(true)
      const dadosPreparados = prepararDadosTurma(alunosFiltrados, lancamentos, config)
      exportarTurmaCsv({
        itens: dadosPreparados,
        config,
        filtroEntrada,
        filtroTurno,
        filtroStatus,
      })
      toast({
        title: 'Arquivo CSV gerado com sucesso!',
        description: `Exportados ${dadosPreparados.length} estudantes filtrados para CSV (.csv).`,
      })
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro ao exportar CSV',
        description: 'Ocorreu uma falha ao gerar o arquivo CSV.',
        variant: 'destructive',
      })
    } finally {
      setExportandoCsv(false)
    }
  }

  const handleExportarPdf = () => {
    try {
      setExportandoPdf(true)
      const dadosPreparados = prepararDadosTurma(alunosFiltrados, lancamentos, config)
      exportarTurmaPdf({
        itens: dadosPreparados,
        config,
        filtroEntrada,
        filtroTurno,
        filtroStatus,
      })
      toast({
        title: 'Relatório PDF gerado com sucesso!',
        description: `Arquivo horas-complementares-turmas-${semestreAtual}.pdf baixado.`,
      })
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro ao exportar PDF',
        description: 'Ocorreu uma falha ao gerar o documento PDF.',
        variant: 'destructive',
      })
    } finally {
      setExportandoPdf(false)
    }
  }

  const handlePromoverSemestres = async () => {
    try {
      setPromovendo(true)
      const count = await promoverTodosAlunos()
      toast({
        title: 'Promoção semestral realizada!',
        description: `${count} alunos avançaram de semestre. Alunos no 10º permaneceram no 10º.`,
      })
      carregarDados()
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro ao promover alunos',
        description: 'Falha na comunicação com o servidor.',
        variant: 'destructive',
      })
    } finally {
      setPromovendo(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0f2b48] text-white shadow-xs">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-['Outfit'] text-2xl font-bold tracking-tight text-[#0f2b48] sm:text-3xl">
                Painel por Turma & Balanço Semestral
              </h1>
              <p className="text-sm text-slate-600">
                Acompanhamento pedagógico das turmas de Psicologia — Semestre {semestreAtual}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Botão Exportar Excel */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportarExcel}
            disabled={exportandoExcel || loading || alunosFiltrados.length === 0}
            className="text-xs text-slate-700 hover:text-green-700 hover:border-green-300 hover:bg-green-50/50 shadow-xs"
            title="Exportar planilha Excel formatada com agrupamentos e filtros atuais"
          >
            {exportandoExcel ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin text-green-600" />
            ) : (
              <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5 text-green-600" />
            )}
            Excel (.xlsx)
          </Button>

          {/* Botão Exportar CSV */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportarCsv}
            disabled={exportandoCsv || loading || alunosFiltrados.length === 0}
            className="text-xs text-slate-700 hover:text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50/50 shadow-xs"
            title="Exportar dados tabulados em CSV (compatível com Google Sheets e Excel)"
          >
            {exportandoCsv ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin text-emerald-600" />
            ) : (
              <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5 text-emerald-600" />
            )}
            CSV (.csv)
          </Button>

          {/* Botão Exportar PDF */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportarPdf}
            disabled={exportandoPdf || loading || alunosFiltrados.length === 0}
            className="text-xs text-slate-700 hover:text-red-700 hover:border-red-300 hover:bg-red-50/50 shadow-xs"
            title="Exportar relatório institucional oficial em PDF Paisagem"
          >
            {exportandoPdf ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin text-red-600" />
            ) : (
              <FileText className="mr-1.5 h-3.5 w-3.5 text-red-600" />
            )}
            PDF Oficial
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-xs text-slate-700">
                <TrendingUp className="mr-1.5 h-3.5 w-3.5 text-blue-600" />
                Promover Semestres
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-white">
              <AlertDialogHeader>
                <AlertDialogTitle className="font-['Outfit'] text-lg font-bold text-[#0f2b48]">
                  Confirmar Promoção Semestral em Lote?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-xs text-slate-600 leading-relaxed">
                  Isso promoverá todos os alunos para o próximo semestre letivo. Alunos que já estão
                  no 10º semestre permanecerão no 10º semestre.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="text-xs">Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handlePromoverSemestres}
                  className="bg-[#1d4ed8] hover:bg-[#1e40af] text-xs font-semibold"
                >
                  {promovendo ? 'Promovendo...' : 'Sim, Promover Todos'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* NOTA PEDAGÓGICA OFICIAL EM DESTAQUE NO TOPO DA PÁGINA */}
      <div className="relative overflow-hidden rounded-xl border-2 border-amber-300 bg-gradient-to-r from-amber-50 via-amber-50/90 to-amber-100/60 p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-xs">
            <ShieldAlert className="h-6 w-6" />
          </div>

          <div className="flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/20 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-amber-900 border border-amber-400/40">
                Diretriz NDE & Colegiado de Psicologia
              </span>
              <span className="text-xs font-semibold text-amber-900">
                Acompanhamento Semestral Formativo
              </span>
            </div>

            <h2 className="font-['Outfit'] text-base font-bold text-amber-950 sm:text-lg">
              Nota Pedagógica Oficial: Indicador de Balanço Semestral
            </h2>

            <p className="text-xs sm:text-sm text-amber-900/90 leading-relaxed">
              O status{' '}
              <strong className="rounded bg-amber-200/70 px-1.5 py-0.5 font-bold text-amber-950">
                NÃO CUMPRIU
              </strong>{' '}
              (&lt; {minimoSemestral}h aceitas no semestre {semestreAtual}) é exclusivamente um{' '}
              <strong>instrumento pedagógico de acompanhamento e orientação</strong> ao estudante.
            </p>

            <div className="pt-1 flex flex-wrap items-center gap-y-1.5 gap-x-4 text-xs font-medium text-amber-950">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-600" />
                <span>
                  <strong>NÃO gera dependência acadêmica (DP)</strong> nem acréscimo de mensalidade
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-600" />
                <span>
                  <strong>NÃO reprova</strong> nem bloqueia rematrícula no curso
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-blue-600" />
                <span>
                  O discente pode compensar as horas nos semestres seguintes até totalizar as{' '}
                  {metaCurso}h
                </span>
              </div>
            </div>
          </div>

          <div className="hidden lg:flex flex-col items-end justify-center rounded-lg border border-amber-300/80 bg-white/70 px-4 py-3 text-right">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-800">
              Meta do Semestre
            </span>
            <span className="font-['Outfit'] text-2xl font-bold text-[#0f2b48]">
              {minimoSemestral}h <span className="text-xs font-normal text-slate-500">mínimo</span>
            </span>
            <span className="text-[11px] text-slate-500">Meta global: {metaCurso}h</span>
          </div>
        </div>
      </div>

      {/* Resumo Rápido das Turmas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Estudantes no Painel</p>
              <h3 className="font-['Outfit'] text-2xl font-bold text-[#0f2b48] mt-0.5">
                {totalFiltrados}
                {totalFiltrados !== totalAlunos && (
                  <span className="text-xs font-normal text-slate-500 ml-1">de {totalAlunos}</span>
                )}
              </h3>
              <p className="text-[11px] text-slate-500">Turmas ativas na FAUSP</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-blue-50 text-[#1d4ed8] flex items-center justify-center">
              <Users className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card
          className={`border-emerald-200 bg-emerald-50/30 shadow-xs cursor-pointer transition hover:border-emerald-400 ${
            filtroStatus === 'CUMPRIU' ? 'ring-2 ring-[#16a34a]' : ''
          }`}
          onClick={() => setFiltroStatus(filtroStatus === 'CUMPRIU' ? 'Todos' : 'CUMPRIU')}
          title="Clique para filtrar apenas discentes que cumpriram"
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-emerald-800">
                Cumpriu o Semestre (≥ {minimoSemestral}h)
              </p>
              <h3 className="font-['Outfit'] text-2xl font-bold text-[#16a34a] mt-0.5">
                {totalCumpriramFiltrados}
                <span className="text-xs font-normal text-emerald-700 ml-1.5">
                  (
                  {totalFiltrados > 0
                    ? Math.round((totalCumpriramFiltrados / totalFiltrados) * 100)
                    : 0}
                  %)
                </span>
              </h3>
              <p className="text-[11px] text-emerald-700 font-medium">Balanço semestral regular</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-[#16a34a]/15 text-[#16a34a] flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card
          className={`border-amber-200 bg-amber-50/30 shadow-xs cursor-pointer transition hover:border-amber-400 ${
            filtroStatus === 'NÃO CUMPRIU' ? 'ring-2 ring-amber-500' : ''
          }`}
          onClick={() => setFiltroStatus(filtroStatus === 'NÃO CUMPRIU' ? 'Todos' : 'NÃO CUMPRIU')}
          title="Clique para filtrar apenas discentes com alerta de balanço"
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-amber-800">
                Não Cumpriu o Semestre (&lt; {minimoSemestral}h)
              </p>
              <h3 className="font-['Outfit'] text-2xl font-bold text-amber-600 mt-0.5">
                {totalNaoCumpriramFiltrados}
                <span className="text-xs font-normal text-amber-700 ml-1.5">
                  (
                  {totalFiltrados > 0
                    ? Math.round((totalNaoCumpriramFiltrados / totalFiltrados) * 100)
                    : 0}
                  %)
                </span>
              </h3>
              <p className="text-[11px] text-amber-700 font-medium">
                Alerta pedagógico de acompanhamento
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Parâmetro Semestral Vigente</p>
              <h3 className="font-['Outfit'] text-2xl font-bold text-[#0f2b48] mt-0.5">
                {minimoSemestral}h{' '}
                <span className="text-xs font-normal text-slate-500">/ semestre</span>
              </h3>
              <p className="text-[11px] text-slate-500">
                Semestre {semestreAtual} • Meta {metaCurso}h
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Barra de Filtros Combinados (Entrada + Turno + Balanço Semestral + Busca) */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="p-4 pb-3 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-[#1d4ed8]" />
              <CardTitle className="font-['Outfit'] text-sm font-bold text-[#0f2b48]">
                Filtros Combinados de Turma & Balanço
              </CardTitle>
            </div>
            {(filtroEntrada !== 'Todas' ||
              filtroTurno !== 'Todos' ||
              filtroStatus !== 'Todos' ||
              buscaAluno) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFiltroEntrada('Todas')
                  setFiltroTurno('Todos')
                  setFiltroStatus('Todos')
                  setBuscaAluno('')
                }}
                className="h-7 text-xs text-slate-500 hover:text-slate-800"
              >
                <RotateCcw className="mr-1 h-3 w-3" />
                Limpar todos os filtros
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            {/* 1. Filtro Período de Entrada */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                <span>Período de Entrada:</span>
                {filtroEntrada !== 'Todas' && (
                  <span className="text-[11px] font-bold text-[#1d4ed8]">Ativo</span>
                )}
              </label>
              <select
                value={filtroEntrada}
                onChange={(e) => setFiltroEntrada(e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs shadow-xs focus:border-[#1d4ed8] focus:ring-1 focus:ring-[#1d4ed8] focus:outline-none"
              >
                <option value="Todas">Todas as Entradas</option>
                {periodosEntradaDistintos.map((p) => (
                  <option key={p} value={p}>
                    Turma {p}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Filtro Turno */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                <span>Turno:</span>
                {filtroTurno !== 'Todos' && (
                  <span className="text-[11px] font-bold text-[#1d4ed8]">Ativo</span>
                )}
              </label>
              <div className="flex rounded-md border border-slate-200 bg-slate-50 p-0.5">
                {(['Todos', 'Matutino', 'Vespertino', 'Noturno', 'Especial'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setFiltroTurno(t)}
                    className={`flex-1 rounded py-1 text-[11px] font-medium transition text-center ${
                      filtroTurno === t
                        ? 'bg-white text-[#0f2b48] shadow-xs font-bold border border-slate-200/60'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {t === 'Vespertino' ? 'Vesp.' : t}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Filtro Status do Balanço */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                <span>Status do Balanço ({semestreAtual}):</span>
                {filtroStatus !== 'Todos' && (
                  <span className="text-[11px] font-bold text-[#1d4ed8]">Ativo</span>
                )}
              </label>
              <div className="grid grid-cols-3 gap-1 rounded-md border border-slate-200 bg-slate-50 p-0.5">
                <button
                  type="button"
                  onClick={() => setFiltroStatus('Todos')}
                  className={`rounded py-1 text-[11px] font-medium transition text-center ${
                    filtroStatus === 'Todos'
                      ? 'bg-white text-[#0f2b48] shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Todos
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroStatus('CUMPRIU')}
                  className={`rounded py-1 text-[11px] font-medium transition text-center flex items-center justify-center gap-1 ${
                    filtroStatus === 'CUMPRIU'
                      ? 'bg-[#16a34a] text-white shadow-xs font-bold'
                      : 'text-emerald-700 hover:bg-emerald-50'
                  }`}
                >
                  <CheckCircle2 className="h-3 w-3" />
                  Cumpriu
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroStatus('NÃO CUMPRIU')}
                  className={`rounded py-1 text-[11px] font-medium transition text-center flex items-center justify-center gap-1 ${
                    filtroStatus === 'NÃO CUMPRIU'
                      ? 'bg-amber-500 text-white shadow-xs font-bold'
                      : 'text-amber-700 hover:bg-amber-50'
                  }`}
                >
                  <AlertTriangle className="h-3 w-3" />
                  Não Cumpriu
                </button>
              </div>
            </div>

            {/* 4. Busca por Nome ou Matrícula */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Buscar Estudante:</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Nome ou matrícula..."
                  value={buscaAluno}
                  onChange={(e) => setBuscaAluno(e.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white pl-8 pr-3 py-1.5 text-xs shadow-xs focus:border-[#1d4ed8] focus:ring-1 focus:ring-[#1d4ed8] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Badges de filtros ativos */}
          <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-semibold text-slate-500">Filtros ativos:</span>
              <Badge
                variant="secondary"
                className="text-[11px] font-normal bg-slate-100 text-slate-700"
              >
                Entrada: <strong>{filtroEntrada}</strong>
              </Badge>
              <Badge
                variant="secondary"
                className="text-[11px] font-normal bg-slate-100 text-slate-700"
              >
                Turno: <strong>{filtroTurno}</strong>
              </Badge>
              <Badge
                variant="secondary"
                className={`text-[11px] font-semibold ${
                  filtroStatus === 'CUMPRIU'
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : filtroStatus === 'NÃO CUMPRIU'
                      ? 'bg-amber-100 text-amber-800 border-amber-300'
                      : 'bg-slate-100 text-slate-700'
                }`}
              >
                Balanço: {filtroStatus}
              </Badge>
              {buscaAluno && (
                <Badge
                  variant="secondary"
                  className="text-[11px] font-normal bg-blue-50 text-blue-800"
                >
                  Busca: "{buscaAluno}"
                </Badge>
              )}
            </div>

            <div className="text-xs text-slate-600">
              Mostrando <strong>{alunosFiltrados.length}</strong> de{' '}
              <strong>{alunos.length}</strong> discentes ({totalCumpriramFiltrados} cumpriram /{' '}
              {totalNaoCumpriramFiltrados} com alerta)
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Turmas & Balanço Semestral */}
      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600">
              <tr>
                <th className="px-4 py-3">Estudante / Matrícula</th>
                <th className="px-4 py-3">Semestre</th>
                <th className="px-4 py-3">Total Geral ({metaCurso}h)</th>
                <th className="px-4 py-3">Horas Semestre ({semestreAtual})</th>
                <th className="px-4 py-3">Restante Semestre</th>
                <th className="px-4 py-3 text-center">Balanço Semestral</th>
                <th className="px-4 py-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-xs text-slate-500">
                    <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-[#1d4ed8]" />
                    Carregando dados das turmas e balanço semestral...
                  </td>
                </tr>
              ) : alunosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-xs text-slate-500">
                    <div className="max-w-sm mx-auto space-y-2">
                      <p className="font-semibold text-slate-700">Nenhum estudante encontrado</p>
                      <p className="text-slate-500">
                        Nenhum aluno atende à combinação selecionada de filtros (Entrada:{' '}
                        {filtroEntrada}, Turno: {filtroTurno}, Balanço: {filtroStatus}).
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setFiltroEntrada('Todas')
                          setFiltroTurno('Todos')
                          setFiltroStatus('Todos')
                          setBuscaAluno('')
                        }}
                        className="mt-2 text-xs"
                      >
                        Resetar Filtros
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                alunosFiltrados.map((aluno) => {
                  const metricas = metricasPorAluno.get(aluno.id) || {
                    totalGeral: 0,
                    horasSemestre: 0,
                    restanteSemestre: minimoSemestral,
                    cumpriu: false,
                    porcentagemCurso: 0,
                  }
                  const { totalGeral, horasSemestre, restanteSemestre, cumpriu, porcentagemCurso } =
                    metricas

                  return (
                    <tr
                      key={aluno.id}
                      className={`transition-colors ${
                        cumpriu ? 'hover:bg-emerald-50/30' : 'hover:bg-amber-50/40 bg-amber-50/10'
                      }`}
                    >
                      <td className="px-4 py-3">
                        <Link
                          to={`/alunos/${aluno.id}`}
                          className="font-semibold text-slate-900 hover:text-[#1d4ed8] hover:underline"
                        >
                          {aluno.nome}
                        </Link>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                          <span className="font-mono font-medium text-slate-700">
                            {aluno.matricula}
                          </span>
                          <span>•</span>
                          <span className="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700">
                            {aluno.turno}
                          </span>
                          <span>•</span>
                          <span>Entrada {aluno.periodo_entrada}</span>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-xs font-semibold text-slate-700">
                        <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-[#0f2b48]">
                          {aluno.semestre_atual}º Semestre
                        </span>
                      </td>

                      <td className="px-4 py-3 min-w-[155px]">
                        <div className="flex items-center justify-between text-xs font-semibold text-slate-800 mb-1">
                          <span>
                            {totalGeral}h / {metaCurso}h
                          </span>
                          <span className="text-[11px] text-slate-500 font-normal">
                            {porcentagemCurso}%
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-[#16a34a] transition-all"
                            style={{ width: `${porcentagemCurso}%` }}
                          />
                        </div>
                      </td>

                      <td className="px-4 py-3 text-xs font-bold text-slate-900">
                        <span
                          className={`inline-flex items-center gap-1 font-bold ${
                            horasSemestre >= minimoSemestral ? 'text-emerald-700' : 'text-slate-800'
                          }`}
                        >
                          {horasSemestre}h
                        </span>
                      </td>

                      <td className="px-4 py-3 text-xs">
                        {restanteSemestre > 0 ? (
                          <span className="inline-flex items-center gap-1 font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/60">
                            Faltam {restanteSemestre}h (mín {minimoSemestral}h)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-semibold text-[#16a34a] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60">
                            Integralizado
                          </span>
                        )}
                      </td>

                      {/* INDICADOR VISUAL DESTACADO EM BADGES/PILLS: CUMPRIU vs NÃO CUMPRIU */}
                      <td className="px-4 py-3 text-center">
                        {cumpriu ? (
                          <span
                            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold text-white shadow-xs"
                            style={{ backgroundColor: '#16a34a' }}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            CUMPRIU
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-3 py-1 text-xs font-bold text-white shadow-xs"
                            title="Alerta pedagógico de acompanhamento: não gera DP nem reprovação"
                          >
                            <AlertTriangle className="h-3.5 w-3.5" />
                            NÃO CUMPRIU
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <Link to={`/alunos/${aluno.id}`}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-[#1d4ed8] hover:bg-blue-50"
                          >
                            Acessar Ficha
                            <ChevronRight className="ml-1 h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Nota Pedagógica também no rodapé para reforçar a diretriz */}
      <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-4 text-xs text-slate-600 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-[#1d4ed8] shrink-0" />
          <span>
            Critérios do Colegiado de Psicologia FAUSP: Mínimo Semestral ={' '}
            <strong>{minimoSemestral}h</strong> | Meta Total = <strong>{metaCurso}h</strong>.
            Exportações em Excel e CSV respeitam os filtros ativos na tela.
          </span>
        </div>
        <span className="text-[11px] font-medium text-slate-400">Ref: {semestreAtual}</span>
      </div>
    </div>
  )
}
