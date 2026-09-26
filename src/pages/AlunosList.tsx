import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listarAlunos, criarAluno, promoverTodosAlunos } from '@/services/alunos'
import { listarTodosLancamentos } from '@/services/lancamentos'
import { getConfiguracaoGlobal } from '@/services/configuracao'
import type { Aluno, Lancamento, ConfiguracaoGlobal } from '@/types'
import {
  Users,
  Search,
  Plus,
  ArrowUpRight,
  TrendingUp,
  AlertTriangle,
  Loader2,
  Filter,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
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

export default function AlunosList() {
  const { toast } = useToast()
  const navigate = useNavigate()

  const [alunos, setAlunos] = useState<Aluno[]>([])
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([])
  const [config, setConfig] = useState<ConfiguracaoGlobal | null>(null)
  const [loading, setLoading] = useState(true)

  // Filtros
  const [busca, setBusca] = useState('')
  const [filtroTurno, setFiltroTurno] = useState('Todos')

  // Modal Novo Aluno
  const [isNovoAlunoOpen, setIsNovoAlunoOpen] = useState(false)
  const [novoNome, setNovoNome] = useState('')
  const [novaMatricula, setNovaMatricula] = useState('')
  const [novoTurno, setNovoTurno] = useState<'Matutino' | 'Noturno'>('Matutino')
  const [novoSemestre, setNovoSemestre] = useState<number>(1)
  const [novoPeriodo, setNovoPeriodo] = useState('2026.2')
  const [novoEmail, setNovoEmail] = useState('')
  const [salvandoAluno, setSalvandoAluno] = useState(false)
  const [erroModal, setErroModal] = useState<string | null>(null)

  // Promover Semestres
  const [promovendo, setPromovendo] = useState(false)

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
        title: 'Erro ao carregar alunos',
        description: 'Não foi possível carregar a listagem.',
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

  const handleCriarAluno = async (e: React.FormEvent) => {
    e.preventDefault()
    setErroModal(null)

    if (!novoNome || !novaMatricula || !novoEmail || !novoPeriodo) {
      setErroModal('Todos os campos são de preenchimento obrigatório.')
      return
    }

    try {
      setSalvandoAluno(true)
      await criarAluno({
        nome: novoNome.trim(),
        matricula: novaMatricula.trim().toUpperCase(),
        turno: novoTurno,
        semestre_atual: novoSemestre,
        periodo_entrada: novoPeriodo.trim(),
        email: novoEmail.trim().toLowerCase(),
      })

      toast({
        title: 'Aluno cadastrado com sucesso!',
        description: `Matrícula ${novaMatricula.toUpperCase()} adicionada.`,
      })

      // Reset
      setNovoNome('')
      setNovaMatricula('')
      setNovoEmail('')
      setIsNovoAlunoOpen(false)
      carregarDados()
    } catch (err: unknown) {
      console.error(err)
      setErroModal('Erro ao salvar. Verifique se a matrícula já está cadastrada.')
    } finally {
      setSalvandoAluno(false)
    }
  }

  const handlePromoverSemestres = async () => {
    try {
      setPromovendo(true)
      const total = await promoverTodosAlunos()
      toast({
        title: 'Semestres promovidos!',
        description: `${total} alunos avançaram de semestre letivo. Alunos do 10º permaneceram no 10º.`,
      })
      carregarDados()
    } catch (err) {
      console.error(err)
      toast({
        title: 'Falha ao promover',
        description: 'Ocorreu um erro ao atualizar os registros.',
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
          <h1 className="font-['Outfit'] text-2xl font-bold tracking-tight text-[#0f2b48] sm:text-3xl">
            Gestão de Alunos
          </h1>
          <p className="text-sm text-slate-600">
            Acompanhamento individualizado e prontuários acadêmicos de Psicologia
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Promover Semestres Action */}
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
                  Esta ação avançará em <strong>+1 o semestre atual</strong> de todos os alunos
                  cadastrados no curso de Psicologia.
                  <br />
                  <br />• Alunos que já estão no <strong>10º semestre permanecerão no 10º</strong>.
                  <br />• Os lançamentos históricos permanecerão intactos para auditoria.
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

          {/* Modal Novo Aluno */}
          <Dialog open={isNovoAlunoOpen} onOpenChange={setIsNovoAlunoOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-[#1d4ed8] hover:bg-[#1e40af] text-white text-xs">
                <Plus className="mr-1.5 h-4 w-4" />
                Novo Aluno
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-white max-w-md">
              <DialogHeader>
                <DialogTitle className="font-['Outfit'] text-lg font-bold text-[#0f2b48]">
                  Cadastrar Novo Aluno
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Preencha os dados cadastrais acadêmicos do estudante.
                </DialogDescription>
              </DialogHeader>

              {erroModal && (
                <div className="rounded-md bg-red-50 p-2.5 text-xs text-red-700 border border-red-200">
                  {erroModal}
                </div>
              )}

              <form onSubmit={handleCriarAluno} className="space-y-3.5 py-2">
                <div className="space-y-1">
                  <Label htmlFor="nome" className="text-xs font-semibold text-slate-700">
                    Nome Completo *
                  </Label>
                  <Input
                    id="nome"
                    required
                    value={novoNome}
                    onChange={(e) => setNovoNome(e.target.value)}
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
                      value={novaMatricula}
                      onChange={(e) => setNovaMatricula(e.target.value)}
                      placeholder="Ex: PSI2026101"
                      className="text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="turno" className="text-xs font-semibold text-slate-700">
                      Turno *
                    </Label>
                    <select
                      id="turno"
                      value={novoTurno}
                      onChange={(e) => setNovoTurno(e.target.value as 'Matutino' | 'Noturno')}
                      className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs shadow-xs focus:border-[#1d4ed8] focus:outline-none"
                    >
                      <option value="Matutino">Matutino</option>
                      <option value="Noturno">Noturno</option>
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
                      value={novoSemestre}
                      onChange={(e) => setNovoSemestre(Number(e.target.value))}
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
                      value={novoPeriodo}
                      onChange={(e) => setNovoPeriodo(e.target.value)}
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
                    value={novoEmail}
                    onChange={(e) => setNovoEmail(e.target.value)}
                    placeholder="aluno@aluno.fausp.br"
                    className="text-xs"
                  />
                </div>

                <DialogFooter className="pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsNovoAlunoOpen(false)}
                    className="text-xs"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={salvandoAluno}
                    className="bg-[#1d4ed8] hover:bg-[#1e40af] text-white text-xs"
                  >
                    {salvandoAluno ? 'Salvando...' : 'Cadastrar Aluno'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <Card className="border-slate-200 shadow-sm">
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
                {['Todos', 'Matutino', 'Noturno'].map((t) => (
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
                              : 'bg-indigo-50 text-indigo-800 border-indigo-200 text-[11px]'
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
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-[#1d4ed8] hover:bg-blue-100"
                        >
                          Painel Individual
                          <ChevronRight className="ml-1 h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
