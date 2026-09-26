import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  listarAlunos,
  criarAluno,
  atualizarAluno,
  executarViradaSemestreAssistida,
  ResultadoViradaSemestre,
} from '@/services/alunos'
import { listarTodosLancamentos } from '@/services/lancamentos'
import { listarCategorias } from '@/services/categorias'
import { getConfiguracaoGlobal } from '@/services/configuracao'
import { gerarRelatorioAlunoPdf } from '@/lib/exportacaoRelatorioAlunoPdf'
import type { Aluno, Lancamento, Categoria, ConfiguracaoGlobal, TurnoAluno } from '@/types'
import {
  Users,
  Search,
  Plus,
  TrendingUp,
  AlertTriangle,
  Loader2,
  ChevronRight,
  Pencil,
  Sparkles,
  CalendarFold,
  ArrowRight,
  CheckSquare,
  Square,
  Check,
  Info,
  Calendar,
  AlertCircle,
  FileText,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'

// Helper de validação de e-mail institucional / RFC
function validarFormatoEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return re.test(email.trim())
}

// Sugestão de próximo semestre letivo
function sugerirProximoSemestre(semestreAtual: string): string {
  const match = semestreAtual.match(/^(\d{4})\.([12])$/)
  if (!match) return '2027.1'
  const ano = parseInt(match[1], 10)
  const sem = parseInt(match[2], 10)
  return sem === 1 ? `${ano}.2` : `${ano + 1}.1`
}

function validarFormatoSemestre(s: string): boolean {
  return /^\d{4}\.[12]$/.test(s.trim())
}

export default function AlunosList() {
  const { toast } = useToast()
  const navigate = useNavigate()

  const [alunos, setAlunos] = useState<Aluno[]>([])
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [config, setConfig] = useState<ConfiguracaoGlobal | null>(null)
  const [loading, setLoading] = useState(true)
  const [alunoBaixandoPdfId, setAlunoBaixandoPdfId] = useState<string | null>(null)

  // Filtros
  const [busca, setBusca] = useState('')
  const [filtroTurno, setFiltroTurno] = useState('Todos')

  // Modal Cadastro / Edição de Aluno
  const [isAlunoModalOpen, setIsAlunoModalOpen] = useState(false)
  const [editingAlunoId, setEditingAlunoId] = useState<string | null>(null)
  const [alunoNome, setAlunoNome] = useState('')
  const [alunoMatricula, setAlunoMatricula] = useState('')
  const [alunoTurno, setAlunoTurno] = useState<TurnoAluno>('Matutino')
  const [alunoSemestre, setAlunoSemestre] = useState<number>(1)
  const [alunoPeriodo, setAlunoPeriodo] = useState('2026.2')
  const [alunoEmail, setAlunoEmail] = useState('')
  const [salvandoAluno, setSalvandoAluno] = useState(false)
  const [erroModal, setErroModal] = useState<string | null>(null)

  // Modal "Promover Semestres" (Ferramenta de transição letiva com resumo de impacto)
  const [isPromoverModalOpen, setIsPromoverModalOpen] = useState(false)
  const [promoverEtapa, setPromoverEtapa] = useState<
    'config' | 'preview' | 'executando' | 'resumo'
  >('config')
  const [novoSemestreInput, setNovoSemestreInput] = useState('')
  const [erroFormatoSemestre, setErroFormatoSemestre] = useState<string | null>(null)
  const [idsAlunosSelecionados, setIdsAlunosSelecionados] = useState<Set<string>>(new Set())
  const [progressoPromocao, setProgressoPromocao] = useState<number>(0)
  const [progressoPromocaoTexto, setProgressoPromocaoTexto] = useState<string>('')
  const [resultadoPromocao, setResultadoPromocao] = useState<ResultadoViradaSemestre | null>(null)
  const [erroExecucaoPromocao, setErroExecucaoPromocao] = useState<string | null>(null)

  const carregarDados = async () => {
    try {
      setLoading(true)
      const [als, lcs, cats, cfg] = await Promise.all([
        listarAlunos(),
        listarTodosLancamentos(),
        listarCategorias(),
        getConfiguracaoGlobal(),
      ])
      setAlunos(als)
      setLancamentos(lcs)
      setCategorias(cats)
      setConfig(cfg)
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro ao carregar alunos',
        description: 'Não foi possível carregar a listagem de estudantes.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarDados()
  }, [])

  // Filtragem
  const alunosFiltrados = alunos.filter((a) => {
    const matchTurno = filtroTurno === 'Todos' || a.turno === filtroTurno
    const q = busca.toLowerCase().trim()
    const matchBusca =
      !q ||
      a.nome.toLowerCase().includes(q) ||
      a.matricula.toLowerCase().includes(q) ||
      a.email.toLowerCase().includes(q)
    return matchTurno && matchBusca
  })

  // Cálculos por aluno
  const metaCurso = config?.meta_curso || 200

  const getAlunoMetricas = (alunoId: string) => {
    const lancs = lancamentos.filter((l) => l.aluno_id === alunoId)
    const totalHoras = lancs.reduce((sum, l) => sum + (Number(l.horas_aceitas) || 0), 0)
    const estornosCount = lancs.filter((l) => Number(l.horas_aceitas) < 0).length
    const porcentagem =
      metaCurso > 0 ? Math.min(100, Math.round((totalHoras / metaCurso) * 100)) : 0
    return { totalHoras, estornosCount, porcentagem }
  }

  // Abertura do modal de criação
  const handleAbrirNovoAluno = () => {
    setEditingAlunoId(null)
    setAlunoNome('')
    setAlunoMatricula('')
    setAlunoTurno('Matutino')
    setAlunoSemestre(1)
    setAlunoPeriodo(config?.semestre_letivo_atual || '2026.2')
    setAlunoEmail('')
    setErroModal(null)
    setIsAlunoModalOpen(true)
  }

  // Abertura do modal de edição
  const handleBaixarRelatorioPdfAluno = (e: React.MouseEvent, a: Aluno) => {
    e.stopPropagation()
    try {
      setAlunoBaixandoPdfId(a.id)
      const { nomeArquivo } = gerarRelatorioAlunoPdf({
        aluno: a,
        lancamentos,
        categorias,
        config,
        salvarArquivo: true,
      })
      toast({
        title: 'Relatório PDF emitido!',
        description: `Arquivo ${nomeArquivo} gerado com sucesso.`,
      })
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro ao gerar PDF',
        description: 'Não foi possível gerar o relatório do aluno.',
        variant: 'destructive',
      })
    } finally {
      setAlunoBaixandoPdfId(null)
    }
  }

  const handleAbrirEditarAluno = (e: React.MouseEvent, a: Aluno) => {
    e.stopPropagation() // Não navegar para o prontuário
    setEditingAlunoId(a.id)
    setAlunoNome(a.nome)
    setAlunoMatricula(a.matricula)
    setAlunoTurno(a.turno)
    setAlunoSemestre(a.semestre_atual)
    setAlunoPeriodo(a.periodo_entrada)
    setAlunoEmail(a.email)
    setErroModal(null)
    setIsAlunoModalOpen(true)
  }

  // Salvar Aluno (Criar ou Editar com validações estritas)
  const handleSalvarAluno = async (e: React.FormEvent) => {
    e.preventDefault()
    setErroModal(null)

    const nomeClean = alunoNome.trim()
    const matriculaClean = alunoMatricula.trim().toUpperCase()
    const emailClean = alunoEmail.trim().toLowerCase()
    const periodoClean = alunoPeriodo.trim()

    // 1. Campos obrigatórios
    if (!nomeClean || !matriculaClean || !emailClean || !periodoClean) {
      setErroModal('Todos os campos marcados com asterisco (*) são obrigatórios.')
      return
    }

    // 2. Validação de e-mail
    if (!validarFormatoEmail(emailClean)) {
      setErroModal(
        'E-mail institucional inválido. Verifique o formato digitado (ex: usuario@aluno.fausp.br).',
      )
      return
    }

    // 3. Validação de matrícula única (não conflitar com outro aluno)
    const matriculaDuplicada = alunos.some(
      (a) => a.matricula.trim().toUpperCase() === matriculaClean && a.id !== editingAlunoId,
    )
    if (matriculaDuplicada) {
      setErroModal(`A matrícula "${matriculaClean}" já está em uso por outro estudante cadastrado.`)
      return
    }

    // 4. Validação de semestre
    if (alunoSemestre < 1 || alunoSemestre > 10) {
      setErroModal('O semestre letivo deve estar compreendido entre o 1º e o 10º semestre.')
      return
    }

    // 5. Validação de turno
    const turnosValidos: TurnoAluno[] = ['Matutino', 'Vespertino', 'Noturno', 'Especial']
    if (!turnosValidos.includes(alunoTurno)) {
      setErroModal('Turno acadêmico inválido selecionado.')
      return
    }

    try {
      setSalvandoAluno(true)
      if (editingAlunoId) {
        await atualizarAluno(editingAlunoId, {
          nome: nomeClean,
          matricula: matriculaClean,
          turno: alunoTurno,
          semestre_atual: alunoSemestre,
          periodo_entrada: periodoClean,
          email: emailClean,
        })
        toast({
          title: 'Dados do estudante atualizados!',
          description: `Matrícula ${matriculaClean} (${nomeClean}) salva com sucesso.`,
        })
      } else {
        await criarAluno({
          nome: nomeClean,
          matricula: matriculaClean,
          turno: alunoTurno,
          semestre_atual: alunoSemestre,
          periodo_entrada: periodoClean,
          email: emailClean,
        })
        toast({
          title: 'Estudante cadastrado com sucesso!',
          description: `Matrícula ${matriculaClean} adicionada ao curso de Psicologia.`,
        })
      }

      setIsAlunoModalOpen(false)
      carregarDados()
    } catch (err: unknown) {
      console.error(err)
      setErroModal(
        'Erro ao salvar no servidor. Verifique se a matrícula ou e-mail já estão cadastrados.',
      )
    } finally {
      setSalvandoAluno(false)
    }
  }

  // FLUXO DA FERRAMENTA "PROMOVER SEMESTRES" COM RESUMO DE IMPACTO
  const handleAbrirPromoverSemestres = () => {
    const semAtual = config?.semestre_letivo_atual || '2026.2'
    setNovoSemestreInput(sugerirProximoSemestre(semAtual))
    setErroFormatoSemestre(null)
    setErroExecucaoPromocao(null)

    // Inicializar seleção padrão: todos abaixo do 10º vêm marcados para promoção
    const selecionados = new Set<string>()
    alunos.forEach((a) => {
      if (Number(a.semestre_atual) < 10) {
        selecionados.add(a.id)
      }
    })
    setIdsAlunosSelecionados(selecionados)
    setPromoverEtapa('config')
    setIsPromoverModalOpen(true)
  }

  const handleAvancarParaPreview = () => {
    const limpo = novoSemestreInput.trim()
    if (!validarFormatoSemestre(limpo)) {
      setErroFormatoSemestre('Formato inválido. Utilize o padrão NNNN.N (ex: 2027.1 ou 2027.2).')
      return
    }

    if (limpo === config?.semestre_letivo_atual) {
      setErroFormatoSemestre('O novo semestre letivo deve ser diferente do semestre atual.')
      return
    }

    setErroFormatoSemestre(null)
    setPromoverEtapa('preview')
  }

  const handleToggleAlunoPromover = (id: string) => {
    const novo = new Set(idsAlunosSelecionados)
    if (novo.has(id)) {
      novo.delete(id)
    } else {
      novo.add(id)
    }
    setIdsAlunosSelecionados(novo)
  }

  const handleSelecionarTodosPromover = () => {
    const todosAbaixo10 = new Set<string>()
    alunos.forEach((a) => {
      if (Number(a.semestre_atual) < 10) {
        todosAbaixo10.add(a.id)
      }
    })
    setIdsAlunosSelecionados(todosAbaixo10)
  }

  const handleLimparSelecaoPromover = () => {
    setIdsAlunosSelecionados(new Set())
  }

  const handleExecutarPromocaoConfirmada = async () => {
    const novoSemestre = novoSemestreInput.trim()
    setPromoverEtapa('executando')
    setProgressoPromocao(5)
    setProgressoPromocaoTexto('Iniciando avanço semestral dos estudantes de Psicologia...')
    setErroExecucaoPromocao(null)

    try {
      const resultado = await executarViradaSemestreAssistida({
        novoSemestreLetivo: novoSemestre,
        idsAlunosParaPromover: Array.from(idsAlunosSelecionados),
        onProgress: (pct, atual, total) => {
          setProgressoPromocao(pct)
          setProgressoPromocaoTexto(`Atualizando estudante ${atual} de ${total}...`)
        },
      })

      setResultadoPromocao(resultado)
      setPromoverEtapa('resumo')
      await carregarDados()

      toast({
        title: 'Promoção semestral concluída com sucesso!',
        description: `Transição letiva para ${resultado.novoSemestre} ativada. ${resultado.alunosPromovidos} alunos avançaram de semestre.`,
      })
    } catch (err: unknown) {
      console.error(err)
      const msg = err instanceof Error ? err.message : 'Falha ao processar promoção semestral.'
      setErroExecucaoPromocao(msg)
      setPromoverEtapa('preview')
      toast({
        title: 'Erro na promoção semestral',
        description: msg,
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-[#1d4ed8]">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-['Outfit'] text-2xl font-bold tracking-tight text-[#0f2b48] sm:text-3xl">
              Gestão de Alunos & Virada de Semestre
            </h1>
            <p className="text-sm text-slate-600">
              Prontuários acadêmicos, cadastro validado e transição letiva de Psicologia
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Botão Ferramenta "Promover Semestres" */}
          <Button
            onClick={handleAbrirPromoverSemestres}
            variant="outline"
            size="sm"
            className="text-xs text-slate-700 border-blue-200 hover:bg-blue-50 font-semibold"
          >
            <TrendingUp className="mr-1.5 h-4 w-4 text-[#1d4ed8]" />
            Promover Semestres
          </Button>

          {/* Botão Novo Aluno */}
          <Button
            onClick={handleAbrirNovoAluno}
            size="sm"
            className="bg-[#1d4ed8] hover:bg-[#1e40af] text-white text-xs font-semibold shadow-xs"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Novo Aluno
          </Button>
        </div>
      </div>

      {/* Banner Resumo de Transição Semestral / Última virada */}
      {config && (
        <div className="rounded-lg border border-blue-100 bg-gradient-to-r from-blue-50/70 via-indigo-50/30 to-white p-3.5 text-xs text-slate-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2.5">
            <CalendarFold className="h-4 w-4 text-[#1d4ed8] shrink-0" />
            <span>
              Semestre Letivo Atual:{' '}
              <strong className="font-mono text-sm text-[#0f2b48]">
                {config.semestre_letivo_atual || '2026.2'}
              </strong>{' '}
              · Meta do Curso: <strong>{metaCurso}h</strong> · Mínimo Semestral:{' '}
              <strong>{config.minimo_exigido_semestre || 20}h</strong>
            </span>
          </div>
          {config.ultima_virada_semestre && (
            <div className="flex items-center gap-1.5 text-slate-500 shrink-0">
              <Info className="h-3.5 w-3.5 text-slate-400" />
              <span>
                Última transição: <strong>{config.ultima_virada_semestre}</strong>
                {typeof config.ultima_virada_alunos_promovidos === 'number' && (
                  <> ({config.ultima_virada_alunos_promovidos} alunos promovidos)</>
                )}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Search and Filters Bar */}
      <Card className="border-slate-200 shadow-xs">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Filtrar por nome, matrícula ou e-mail..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-9 text-xs"
              />
            </div>

            {/* Filter by Turno */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-medium text-slate-600">Turno:</span>
              <div className="flex rounded-md border border-slate-200 bg-slate-50 p-0.5">
                {['Todos', 'Matutino', 'Vespertino', 'Noturno', 'Especial'].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setFiltroTurno(t)}
                    className={`rounded px-2.5 py-1 text-xs font-medium transition ${
                      filtroTurno === t
                        ? 'bg-white text-[#0f2b48] shadow-xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Students Table */}
      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600">
              <tr>
                <th className="px-4 py-3">Matrícula</th>
                <th className="px-4 py-3">Nome do Estudante</th>
                <th className="px-4 py-3">Turno</th>
                <th className="px-4 py-3">Semestre</th>
                <th className="px-4 py-3">Entrada</th>
                <th className="px-4 py-3">Total de Horas</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs text-slate-500">
                    <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-[#1d4ed8]" />
                    Carregando listagem de estudantes...
                  </td>
                </tr>
              ) : alunosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs text-slate-500">
                    Nenhum aluno encontrado para os filtros aplicados.
                  </td>
                </tr>
              ) : (
                alunosFiltrados.map((aluno) => {
                  const { totalHoras, estornosCount, porcentagem } = getAlunoMetricas(aluno.id)

                  return (
                    <tr
                      key={aluno.id}
                      onClick={() => navigate(`/alunos/${aluno.id}`)}
                      className="cursor-pointer hover:bg-blue-50/50 transition-colors"
                    >
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-[#0f2b48]">
                        {aluno.matricula}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{aluno.nome}</div>
                        <div className="text-xs text-slate-500">{aluno.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="secondary"
                          className={
                            aluno.turno === 'Matutino'
                              ? 'bg-amber-50 text-amber-800 border-amber-200 text-[11px]'
                              : aluno.turno === 'Vespertino'
                                ? 'bg-orange-50 text-orange-800 border-orange-200 text-[11px]'
                                : aluno.turno === 'Noturno'
                                  ? 'bg-indigo-50 text-indigo-800 border-indigo-200 text-[11px]'
                                  : 'bg-purple-50 text-purple-800 border-purple-200 text-[11px]'
                          }
                        >
                          {aluno.turno}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs font-medium text-slate-700">
                        {aluno.semestre_atual}º Semestre
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">{aluno.periodo_entrada}</td>
                      <td className="px-4 py-3 min-w-[170px]">
                        <div className="flex items-center justify-between text-xs font-semibold text-slate-800 mb-1">
                          <span>
                            {totalHoras}h / {metaCurso}h
                          </span>
                          <span className="text-[11px] text-slate-500 font-normal">
                            {porcentagem}%
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-[#16a34a] transition-all"
                            style={{ width: `${porcentagem}%` }}
                          />
                        </div>
                        {estornosCount > 0 && (
                          <span className="mt-1 block text-[10px] text-slate-400">
                            {estornosCount}{' '}
                            {estornosCount === 1 ? 'estorno registrado' : 'estornos registrados'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => handleBaixarRelatorioPdfAluno(e, aluno)}
                            disabled={alunoBaixandoPdfId === aluno.id}
                            className="h-7 px-2 text-xs text-slate-600 hover:text-red-700 hover:bg-red-50"
                            title="Baixar Relatório PDF de Balanço Pedagógico"
                          >
                            {alunoBaixandoPdfId === aluno.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-red-600" />
                            ) : (
                              <FileText className="h-3.5 w-3.5 mr-1 text-red-600" />
                            )}
                            PDF
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => handleAbrirEditarAluno(e, aluno)}
                            className="h-7 px-2 text-xs text-slate-600 hover:text-[#1d4ed8] hover:bg-blue-100"
                            title="Editar Dados Cadastrais"
                          >
                            <Pencil className="h-3.5 w-3.5 mr-1" />
                            Editar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-[#1d4ed8] hover:bg-blue-100"
                          >
                            Ficha
                            <ChevronRight className="ml-1 h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal Cadastro e Edição de Aluno (Validações completas) */}
      <Dialog open={isAlunoModalOpen} onOpenChange={setIsAlunoModalOpen}>
        <DialogContent className="bg-white max-w-md">
          <DialogHeader>
            <DialogTitle className="font-['Outfit'] text-lg font-bold text-[#0f2b48]">
              {editingAlunoId ? 'Editar Estudante de Psicologia' : 'Cadastrar Novo Aluno'}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              {editingAlunoId
                ? 'Atualize os dados acadêmicos cadastrais do estudante com validação de matrícula única.'
                : 'Preencha os dados cadastrais acadêmicos com validação de matrícula única, turno, semestre e e-mail.'}
            </DialogDescription>
          </DialogHeader>

          {erroModal && (
            <div className="rounded-md bg-red-50 p-2.5 text-xs text-red-700 border border-red-200 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
              <span>{erroModal}</span>
            </div>
          )}

          <form onSubmit={handleSalvarAluno} className="space-y-3.5 py-1">
            <div className="space-y-1">
              <Label htmlFor="nome" className="text-xs font-semibold text-slate-700">
                Nome Completo *
              </Label>
              <Input
                id="nome"
                required
                value={alunoNome}
                onChange={(e) => setAlunoNome(e.target.value)}
                placeholder="Ex: Mariana Costa Silveira"
                className="text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="mat" className="text-xs font-semibold text-slate-700">
                  Matrícula (única) *
                </Label>
                <Input
                  id="mat"
                  required
                  value={alunoMatricula}
                  onChange={(e) => setAlunoMatricula(e.target.value)}
                  placeholder="Ex: PSI2026101"
                  className="text-xs font-mono uppercase"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="turno" className="text-xs font-semibold text-slate-700">
                  Turno *
                </Label>
                <select
                  id="turno"
                  value={alunoTurno}
                  onChange={(e) => setAlunoTurno(e.target.value as TurnoAluno)}
                  className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs shadow-xs focus:border-[#1d4ed8] focus:outline-none"
                >
                  <option value="Matutino">Matutino</option>
                  <option value="Vespertino">Vespertino</option>
                  <option value="Noturno">Noturno</option>
                  <option value="Especial">Especial</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="sem" className="text-xs font-semibold text-slate-700">
                  Semestre Atual *
                </Label>
                <select
                  id="sem"
                  value={alunoSemestre}
                  onChange={(e) => setAlunoSemestre(Number(e.target.value))}
                  className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs shadow-xs focus:border-[#1d4ed8] focus:outline-none"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((s) => (
                    <option key={s} value={s}>
                      {s}º Semestre
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="entrada" className="text-xs font-semibold text-slate-700">
                  Período de Entrada *
                </Label>
                <Input
                  id="entrada"
                  required
                  value={alunoPeriodo}
                  onChange={(e) => setAlunoPeriodo(e.target.value)}
                  placeholder="Ex: 2026.2"
                  className="text-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="email" className="text-xs font-semibold text-slate-700">
                E-mail Institucional *
              </Label>
              <Input
                id="email"
                type="email"
                required
                value={alunoEmail}
                onChange={(e) => setAlunoEmail(e.target.value)}
                placeholder="aluno@aluno.fausp.br"
                className="text-xs"
              />
              <p className="text-[10px] text-slate-400">
                Formato padrão obrigatório para correspondência acadêmica.
              </p>
            </div>

            <DialogFooter className="pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAlunoModalOpen(false)}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={salvandoAluno}
                className="bg-[#1d4ed8] hover:bg-[#1e40af] text-white text-xs font-semibold"
              >
                {salvandoAluno
                  ? 'Salvando...'
                  : editingAlunoId
                    ? 'Salvar Alterações'
                    : 'Cadastrar Aluno'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL FERRAMENTA "PROMOVER SEMESTRES": TRANSIÇÃO LETIVA ASSISTIDA COM RESUMO DE IMPACTO */}
      <Dialog
        open={isPromoverModalOpen}
        onOpenChange={(open) => {
          if (!open && promoverEtapa === 'executando') return
          setIsPromoverModalOpen(open)
        }}
      >
        <DialogContent className="bg-white max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-[#1d4ed8]">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="font-['Outfit'] text-xl font-bold text-[#0f2b48]">
                  Ferramenta Promover Semestres — Transição Letiva
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Automação controlada para avanço de semestre na transição com resumo e prévia de
                  impacto
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Stepper Visual */}
          <div className="flex items-center justify-between border-b border-slate-100 py-3 px-2">
            <div
              className={`flex items-center gap-2 text-xs font-semibold ${
                promoverEtapa === 'config' ? 'text-[#1d4ed8]' : 'text-slate-400'
              }`}
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] ${
                  promoverEtapa === 'config'
                    ? 'bg-[#1d4ed8] text-white'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                1
              </span>
              <span>Definição do Semestre</span>
            </div>

            <ArrowRight className="h-4 w-4 text-slate-300" />

            <div
              className={`flex items-center gap-2 text-xs font-semibold ${
                promoverEtapa === 'preview' ? 'text-[#1d4ed8]' : 'text-slate-400'
              }`}
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] ${
                  promoverEtapa === 'preview'
                    ? 'bg-[#1d4ed8] text-white'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                2
              </span>
              <span>Resumo e Desmarcações</span>
            </div>

            <ArrowRight className="h-4 w-4 text-slate-300" />

            <div
              className={`flex items-center gap-2 text-xs font-semibold ${
                promoverEtapa === 'executando' || promoverEtapa === 'resumo'
                  ? 'text-[#1d4ed8]'
                  : 'text-slate-400'
              }`}
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] ${
                  promoverEtapa === 'executando' || promoverEtapa === 'resumo'
                    ? 'bg-[#1d4ed8] text-white'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                3
              </span>
              <span>Execução & Resumo</span>
            </div>
          </div>

          {/* ETAPA 1: CONFIGURAÇÃO */}
          {promoverEtapa === 'config' && (
            <div className="space-y-4 py-3">
              <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-4 text-xs text-blue-900 space-y-1.5">
                <div className="flex items-center gap-2 font-semibold text-blue-950">
                  <Info className="h-4 w-4 text-[#1d4ed8]" />
                  Como funciona o avanço de semestre na transição letiva?
                </div>
                <p className="leading-relaxed text-blue-800">
                  Esta ferramenta promove os alunos do curso de Psicologia em{' '}
                  <strong>+1 semestre</strong> (com trava obrigatória no 10º semestre) e atualiza o
                  semestre letivo global do curso. Na etapa seguinte, é apresentado o{' '}
                  <strong>resumo de impacto</strong> detalhado onde você pode desmarcar estudantes
                  individualmente (ex: trancamentos, reprovações de período).
                </p>
                <p className="text-[11px] font-medium text-blue-700">
                  • Histórico de lançamentos e horas deferidas permanece 100% intacto e auditável.
                  <br />• Operação idempotente com registro em auditoria.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start pt-2">
                <div className="rounded-lg border border-slate-200 p-3.5 bg-slate-50 space-y-1">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Semestre Letivo Atual
                  </span>
                  <div className="text-xl font-bold font-mono text-[#0f2b48]">
                    {config?.semestre_letivo_atual || '2026.2'}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Semestre em vigor para apurações e despachos
                  </p>
                </div>

                <div className="rounded-lg border border-blue-200 p-3.5 bg-white space-y-2 shadow-xs">
                  <Label
                    htmlFor="novo-semestre-aluno"
                    className="text-xs font-semibold text-slate-800 flex items-center justify-between"
                  >
                    <span>Novo Semestre Letivo a Ativar *</span>
                    <span className="text-[11px] text-slate-400 font-normal">Padrão NNNN.N</span>
                  </Label>
                  <Input
                    id="novo-semestre-aluno"
                    value={novoSemestreInput}
                    onChange={(e) => {
                      setNovoSemestreInput(e.target.value)
                      setErroFormatoSemestre(null)
                    }}
                    placeholder="Ex: 2027.1"
                    className="font-mono text-sm font-bold tracking-wider"
                  />
                  <p className="text-[11px] text-slate-500">
                    Exemplos válidos: <code>2027.1</code>, <code>2027.2</code>.
                  </p>
                </div>
              </div>

              {erroFormatoSemestre && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                  <span>{erroFormatoSemestre}</span>
                </div>
              )}

              {config?.ultima_virada_semestre && (
                <div className="text-xs text-slate-500 flex items-center gap-2 pt-1">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  <span>
                    Última promoção letiva registrada:{' '}
                    <strong>{config.ultima_virada_semestre}</strong>
                  </span>
                </div>
              )}

              <DialogFooter className="pt-4 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsPromoverModalOpen(false)}
                  className="text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={handleAvancarParaPreview}
                  className="bg-[#1d4ed8] hover:bg-[#1e40af] text-white text-xs font-semibold"
                >
                  Avançar para Resumo de Impacto
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Button>
              </DialogFooter>
            </div>
          )}

          {/* ETAPA 2: RESUMO DE IMPACTO COM DESMARCAÇÃO INDIVIDUAL */}
          {promoverEtapa === 'preview' && (
            <div className="space-y-4 py-2">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">Transição proposta:</span>
                    <Badge variant="outline" className="font-mono text-xs font-bold text-slate-700">
                      {config?.semestre_letivo_atual || '2026.2'}
                    </Badge>
                    <ArrowRight className="h-3.5 w-3.5 text-blue-600" />
                    <Badge className="bg-[#1d4ed8] font-mono text-xs font-bold text-white">
                      {novoSemestreInput.trim()}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Desmarque individualmente os alunos que devem permanecer no semestre atual (ex:
                    trancados).
                  </p>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleSelecionarTodosPromover}
                    className="h-7 text-xs text-slate-700"
                  >
                    <CheckSquare className="mr-1 h-3.5 w-3.5 text-blue-600" />
                    Selecionar Todos
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleLimparSelecaoPromover}
                    className="h-7 text-xs text-slate-700"
                  >
                    <Square className="mr-1 h-3.5 w-3.5 text-slate-400" />
                    Limpar Seleção
                  </Button>
                </div>
              </div>

              {/* Cards do Resumo de Impacto */}
              <div className="grid grid-cols-3 gap-2.5">
                <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5 text-center">
                  <span className="text-[11px] text-slate-500 block">Total de Alunos</span>
                  <span className="font-['Outfit'] text-lg font-bold text-slate-900">
                    {alunos.length}
                  </span>
                </div>
                <div className="rounded-md border border-blue-200 bg-blue-50/60 p-2.5 text-center">
                  <span className="text-[11px] text-blue-700 font-semibold block">
                    A Serem Promovidos (+1)
                  </span>
                  <span className="font-['Outfit'] text-lg font-bold text-blue-700">
                    {idsAlunosSelecionados.size}
                  </span>
                </div>
                <div className="rounded-md border border-amber-200 bg-amber-50/60 p-2.5 text-center">
                  <span className="text-[11px] text-amber-800 font-semibold block">
                    Mantidos no Semestre
                  </span>
                  <span className="font-['Outfit'] text-lg font-bold text-amber-800">
                    {alunos.length - idsAlunosSelecionados.size}
                  </span>
                </div>
              </div>

              {erroExecucaoPromocao && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                  <span>{erroExecucaoPromocao}</span>
                </div>
              )}

              {/* Tabela de Estudantes com Impacto Individual */}
              <div className="max-h-[320px] overflow-y-auto rounded-md border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2 w-10 text-center">Promover?</th>
                      <th className="px-3 py-2">Matrícula</th>
                      <th className="px-3 py-2">Estudante</th>
                      <th className="px-3 py-2">Turno</th>
                      <th className="px-3 py-2 text-center">Semestre Atual</th>
                      <th className="px-3 py-2 text-center">Semestre Promovido</th>
                      <th className="px-3 py-2">Impacto Previsto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {alunos.map((a) => {
                      const semAtual = Number(a.semestre_atual) || 1
                      const is10Semestre = semAtual >= 10
                      const selecionado = idsAlunosSelecionados.has(a.id)
                      const semPromovido = is10Semestre ? 10 : selecionado ? semAtual + 1 : semAtual

                      return (
                        <tr
                          key={a.id}
                          className={`hover:bg-blue-50/40 transition-colors ${
                            is10Semestre
                              ? 'bg-slate-50/70'
                              : selecionado
                                ? 'bg-blue-50/20'
                                : 'bg-amber-50/20'
                          }`}
                        >
                          <td className="px-3 py-2 text-center">
                            <Checkbox
                              checked={selecionado}
                              disabled={is10Semestre}
                              onCheckedChange={() => handleToggleAlunoPromover(a.id)}
                              className="accent-[#1d4ed8]"
                            />
                          </td>
                          <td className="px-3 py-2 font-mono font-semibold text-[#0f2b48]">
                            {a.matricula}
                          </td>
                          <td className="px-3 py-2 font-medium text-slate-900">{a.nome}</td>
                          <td className="px-3 py-2 text-slate-600">{a.turno}</td>
                          <td className="px-3 py-2 text-center font-semibold text-slate-700">
                            {semAtual}º
                          </td>
                          <td className="px-3 py-2 text-center font-bold text-[#1d4ed8]">
                            {semPromovido}º
                          </td>
                          <td className="px-3 py-2">
                            {is10Semestre ? (
                              <Badge
                                variant="outline"
                                className="text-[10px] bg-slate-100 text-slate-600 border-slate-300"
                              >
                                Concluinte (limite 10º mantido)
                              </Badge>
                            ) : selecionado ? (
                              <Badge className="text-[10px] bg-emerald-100 text-emerald-800 hover:bg-emerald-100 font-semibold">
                                +1 ({semAtual}º → {semAtual + 1}º)
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="text-[10px] border-amber-300 bg-amber-50 text-amber-800"
                              >
                                Mantido ({semAtual}º)
                              </Badge>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <DialogFooter className="pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPromoverEtapa('config')}
                  className="text-xs"
                >
                  Voltar
                </Button>
                <Button
                  type="button"
                  onClick={handleExecutarPromocaoConfirmada}
                  disabled={alunos.length === 0}
                  className="bg-[#1d4ed8] hover:bg-[#1e40af] text-white text-xs font-semibold"
                >
                  <Sparkles className="mr-1.5 h-3.5 w-3.5 text-amber-300" />
                  Confirmar e Efetivar Avanço ({idsAlunosSelecionados.size} promovidos)
                </Button>
              </DialogFooter>
            </div>
          )}

          {/* ETAPA 3: PROCESSANDO (BARRA DE PROGRESSO) */}
          {promoverEtapa === 'executando' && (
            <div className="py-8 px-4 text-center space-y-5">
              <div className="flex h-14 w-14 mx-auto items-center justify-center rounded-2xl bg-blue-100 text-[#1d4ed8] shadow-inner">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
              <div className="space-y-1">
                <h3 className="font-['Outfit'] text-lg font-bold text-[#0f2b48]">
                  Efetivando Transição de Semestre...
                </h3>
                <p className="text-xs text-slate-500">
                  {progressoPromocaoTexto ||
                    'Atualizando semestres e parâmetros globais do curso...'}
                </p>
              </div>

              <div className="max-w-md mx-auto space-y-1.5">
                <Progress value={progressoPromocao} className="h-2.5" />
                <div className="flex justify-between text-[11px] text-slate-500 font-mono">
                  <span>Gravando no banco...</span>
                  <span>{progressoPromocao}%</span>
                </div>
              </div>

              <p className="text-[11px] text-slate-400">
                Por favor, aguarde a conclusão do processo.
              </p>
            </div>
          )}

          {/* ETAPA 4: RESUMO FINAL */}
          {promoverEtapa === 'resumo' && resultadoPromocao && (
            <div className="space-y-5 py-4">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-4 text-center space-y-2">
                <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm">
                  <Check className="h-6 w-6" />
                </div>
                <h3 className="font-['Outfit'] text-lg font-bold text-emerald-950">
                  Transição Letiva Concluída com Sucesso!
                </h3>
                <p className="text-xs text-emerald-800 max-w-md mx-auto">
                  O semestre letivo ativo foi alterado para{' '}
                  <strong>{resultadoPromocao.novoSemestre}</strong> e o avanço semestral dos alunos
                  foi concluído com sucesso.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-lg border border-slate-200 p-3 bg-white text-center">
                  <span className="text-[11px] text-slate-500 block">Novo Semestre Ativo</span>
                  <span className="font-['Outfit'] text-xl font-bold text-[#0f2b48] font-mono">
                    {resultadoPromocao.novoSemestre}
                  </span>
                </div>

                <div className="rounded-lg border border-emerald-200 p-3 bg-emerald-50/40 text-center">
                  <span className="text-[11px] text-emerald-700 font-semibold block">
                    Alunos Promovidos
                  </span>
                  <span className="font-['Outfit'] text-xl font-bold text-emerald-700">
                    {resultadoPromocao.alunosPromovidos}
                  </span>
                </div>

                <div className="rounded-lg border border-slate-200 p-3 bg-slate-50 text-center">
                  <span className="text-[11px] text-slate-500 block">
                    Alunos Mantidos / Limite 10º
                  </span>
                  <span className="font-['Outfit'] text-xl font-bold text-slate-700">
                    {resultadoPromocao.alunosMantidos}
                  </span>
                </div>
              </div>

              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 space-y-1">
                <div className="flex items-center justify-between">
                  <span>Data/Hora da Gravação:</span>
                  <strong className="font-mono text-slate-800">
                    {new Date(resultadoPromocao.dataVirada).toLocaleString('pt-BR')}
                  </strong>
                </div>
                <div className="flex items-center justify-between">
                  <span>Registro de Idempotência:</span>
                  <Badge
                    variant="outline"
                    className="text-[10px] text-emerald-700 border-emerald-300"
                  >
                    Gravado em configuracao_global
                  </Badge>
                </div>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  onClick={() => setIsPromoverModalOpen(false)}
                  className="bg-[#1d4ed8] hover:bg-[#1e40af] text-white text-xs font-semibold px-6"
                >
                  Concluir e Fechar
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
