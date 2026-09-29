import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useApp } from '@/contexts/AppContext'
import { getConfiguracaoGlobal } from '@/services/configuracao'
import { listarCategorias } from '@/services/categorias'
import { contarLancamentosPorCategoria } from '@/services/lancamentos'
import {
  exportarBackupCompleto,
  baixarArquivoJson,
  validarArquivoBackup,
  restaurarBackupJson,
  restaurarDadosDemonstracao,
  BackupData,
} from '@/services/backup'
import type { ConfiguracaoGlobal, Categoria } from '@/types'
import {
  Settings,
  ShieldAlert,
  Plus,
  Pencil,
  Trash2,
  Check,
  AlertCircle,
  Loader2,
  Lock,
  Save,
  CalendarFold,
  ArrowRight,
  CheckSquare,
  Square,
  Sparkles,
  Info,
  Calendar,
  Download,
  Upload,
  RotateCcw,
  Database,
  FileJson,
  FileCheck,
} from 'lucide-react'
import { listarAlunos, ResultadoViradaSemestre } from '@/services/alunos'
import type { Aluno } from '@/types'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
} from '@/components/ui/alert-dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useToast } from '@/hooks/use-toast'

export default function ConfiguracoesNDE() {
  const { toast } = useToast()
  const { isAdmin } = useAuth()
  const appContext = useApp()

  const [config, setConfig] = useState<ConfiguracaoGlobal | null>(appContext.config)
  const [categorias, setCategorias] = useState<Categoria[]>(appContext.categorias)
  const [loading, setLoading] = useState(appContext.loading)

  useEffect(() => {
    if (appContext.config) setConfig(appContext.config)
    if (appContext.categorias.length > 0) setCategorias(appContext.categorias)
    setLoading(appContext.loading)
  }, [appContext.config, appContext.categorias, appContext.loading])
  // Form Global Config (Semestre, Mínimo, Meta, Coordenadora, CRP)
  const [semestreLetivo, setSemestreLetivo] = useState('2026.2')
  const [minimoSemestral, setMinimoSemestral] = useState(20)
  const [metaCurso, setMetaCurso] = useState(200)
  const [nomeCoordenadora, setNomeCoordenadora] = useState('Roberta Andrea de Oliveira')
  const [crpCoordenadora, setCrpCoordenadora] = useState('06/77114')
  const [salvandoConfig, setSalvandoConfig] = useState(false)

  // Modal Categoria (Novo / Editar)
  const [isCatModalOpen, setIsCatModalOpen] = useState(false)
  const [editingCatId, setEditingCatId] = useState<string | null>(null)
  const [catNome, setCatNome] = useState('')
  const [catRegra, setCatRegra] = useState('')
  const [catTeto, setCatTeto] = useState<number>(40)
  const [catAtivo, setCatAtivo] = useState(true)
  const [salvandoCat, setSalvandoCat] = useState(false)
  const [erroCatModal, setErroCatModal] = useState<string | null>(null)

  // Delete modal state
  const [deletingCat, setDeletingCat] = useState<Categoria | null>(null)
  const [deleteWarning, setDeleteWarning] = useState<string | null>(null)

  // ESTADOS DA VIRADA DE SEMESTRE ASSISTIDA
  const [isViradaModalOpen, setIsViradaModalOpen] = useState(false)
  const [viradaEtapa, setViradaEtapa] = useState<'config' | 'preview' | 'executando' | 'resumo'>(
    'config',
  )
  const [novoSemestreInput, setNovoSemestreInput] = useState('')
  const [erroFormatoSemestre, setErroFormatoSemestre] = useState<string | null>(null)
  const [alunosVirada, setAlunosVirada] = useState<Aluno[]>([])
  const [alunosViradaCarregando, setAlunosViradaCarregando] = useState(false)
  const [idsAlunosSelecionados, setIdsAlunosSelecionados] = useState<Set<string>>(new Set())
  const [progressoVirada, setProgressoVirada] = useState<number>(0)
  const [progressoViradaTexto, setProgressoViradaTexto] = useState<string>('')
  const [resultadoVirada, setResultadoVirada] = useState<ResultadoViradaSemestre | null>(null)
  const [erroExecucaoVirada, setErroExecucaoVirada] = useState<string | null>(null)

  // ESTADOS DE BACKUP E RESTAURAÇÃO JSON
  const [exportandoBackup, setExportandoBackup] = useState(false)
  const [arquivoBackupSelecionado, setArquivoBackupSelecionado] = useState<BackupData | null>(null)
  const [nomeArquivoJson, setNomeArquivoJson] = useState<string>('')
  const [isModalRestaurarBackupOpen, setIsModalRestaurarBackupOpen] = useState(false)
  const [restaurandoBackup, setRestaurandoBackup] = useState(false)
  const [progressoRestauracaoTexto, setProgressoRestauracaoTexto] = useState<string>('')
  const [progressoRestauracao, setProgressoRestauracao] = useState<number>(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ESTADOS DE RESTAURAÇÃO DOS DADOS DEMO
  const [isModalDemoOpen1, setIsModalDemoOpen1] = useState(false)
  const [isModalDemoOpen2, setIsModalDemoOpen2] = useState(false)
  const [restaurandoDemo, setRestaurandoDemo] = useState(false)
  const [progressoDemoTexto, setProgressoDemoTexto] = useState<string>('')

  const carregarDados = async () => {
    try {
      setLoading(true)
      const [cfg, cats] = await Promise.all([
        getConfiguracaoGlobal(),
        listarCategorias(false), // todas inclusive inativas
      ])
      setConfig(cfg)
      setCategorias(cats)

      if (cfg) {
        setSemestreLetivo(cfg.semestre_letivo_atual || '2026.2')
        setMinimoSemestral(cfg.minimo_exigido_semestre || 20)
        setMetaCurso(cfg.meta_curso || 200)
        setNomeCoordenadora(cfg.nome_da_coordenadora?.trim() || 'Roberta Andrea de Oliveira')
        setCrpCoordenadora(cfg.crp_coordenadora?.trim() || '06/77114')
      }
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro ao carregar configurações',
        description: 'Não foi possível carregar os parâmetros do sistema.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarDados()
  }, [])

  const handleSalvarConfigGlobal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isAdmin) {
      toast({
        title: 'Ação restrita',
        description: 'Apenas Administradores podem alterar configurações.',
        variant: 'destructive',
      })
      return
    }

    try {
      setSalvandoConfig(true)
      const id = config?.id || ''
      const updated = await appContext.salvarConfiguracao(id, {
        semestre_letivo_atual: semestreLetivo.trim(),
        minimo_exigido_semestre: Number(minimoSemestral),
        meta_curso: Number(metaCurso),
        nome_da_coordenadora: nomeCoordenadora.trim(),
        crp_coordenadora: crpCoordenadora.trim(),
      })
      setConfig(updated)
      toast({
        title: 'Configurações atualizadas com sucesso!',
        description: `Semestre ${updated.semestre_letivo_atual}, Mínimo ${updated.minimo_exigido_semestre}h, Meta ${updated.meta_curso}h. Coordenação: ${updated.nome_da_coordenadora} (CRP ${updated.crp_coordenadora}).`,
      })
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro ao salvar',
        description: 'Falha ao atualizar parâmetros globais.',
        variant: 'destructive',
      })
    } finally {
      setSalvandoConfig(false)
    }
  }

  // OPERAÇÕES DE BACKUP JSON
  const handleExportarBackup = async () => {
    try {
      setExportandoBackup(true)
      const backup = await exportarBackupCompleto()
      baixarArquivoJson(backup)
      toast({
        title: 'Cópia de segurança gerada com sucesso!',
        description: `Download do JSON com ${backup.alunos.length} alunos, ${backup.categorias.length} categorias e ${backup.lancamentos.length} lançamentos.`,
      })
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro ao gerar cópia de segurança',
        description: 'Não foi possível compilar os dados do sistema.',
        variant: 'destructive',
      })
    } finally {
      setExportandoBackup(false)
    }
  }

  const handleSelecionarArquivoBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setNomeArquivoJson(file.name)
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const conteudo = event.target?.result as string
        const parsed = JSON.parse(conteudo)
        const validacao = validarArquivoBackup(parsed)

        if (!validacao.valido || !validacao.dados) {
          toast({
            title: 'Arquivo de backup inválido',
            description: validacao.erro || 'O arquivo selecionado não contém o formato esperado.',
            variant: 'destructive',
          })
          setArquivoBackupSelecionado(null)
          return
        }

        setArquivoBackupSelecionado(validacao.dados)
        setIsModalRestaurarBackupOpen(true)
      } catch (err) {
        console.error(err)
        toast({
          title: 'Erro ao ler arquivo JSON',
          description: 'Certifique-se de selecionar um arquivo JSON válido.',
          variant: 'destructive',
        })
        setArquivoBackupSelecionado(null)
      }
    }
    reader.readAsText(file)
    // Limpar o input para permitir selecionar o mesmo arquivo novamente
    e.target.value = ''
  }

  const handleExecutarRestauracaoBackup = async () => {
    if (!arquivoBackupSelecionado || !isAdmin) return

    try {
      setRestaurandoBackup(true)
      setProgressoRestauracao(5)
      setProgressoRestauracaoTexto('Iniciando restauração da cópia de segurança...')

      const resultado = await restaurarBackupJson(arquivoBackupSelecionado, (msg, pct) => {
        setProgressoRestauracaoTexto(msg)
        setProgressoRestauracao(pct)
      })

      setIsModalRestaurarBackupOpen(false)
      setArquivoBackupSelecionado(null)
      await carregarDados()

      toast({
        title: 'Restauração concluída!',
        description: resultado.mensagem,
      })
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro ao restaurar cópia de segurança',
        description: 'Ocorreu um erro durante a gravação dos dados no servidor.',
        variant: 'destructive',
      })
    } finally {
      setRestaurandoBackup(false)
    }
  }

  // OPERAÇÕES DE DADOS DEMO COM DUPLA CONFIRMAÇÃO
  const handleConfirmarRestauracaoDemoFinal = async () => {
    if (!isAdmin) return
    setIsModalDemoOpen2(false)

    try {
      setRestaurandoDemo(true)
      setProgressoDemoTexto('Restaurando estudantes, categorias e lançamentos da demonstração...')

      const resultado = await restaurarDadosDemonstracao((msg) => {
        setProgressoDemoTexto(msg)
      })

      await carregarDados()

      toast({
        title: 'Dados de demonstração restaurados!',
        description: resultado.mensagem,
      })
    } catch (err) {
      console.error(err)
      toast({
        title: 'Falha na restauração dos dados demo',
        description: 'Não foi possível restaurar os dados originais no banco.',
        variant: 'destructive',
      })
    } finally {
      setRestaurandoDemo(false)
    }
  }

  // CRUD Categorias
  const handleAbrirNovaCategoria = () => {
    setEditingCatId(null)
    setCatNome('')
    setCatRegra('')
    setCatTeto(40)
    setCatAtivo(true)
    setErroCatModal(null)
    setIsCatModalOpen(true)
  }

  const handleAbrirEditarCategoria = (c: Categoria) => {
    setEditingCatId(c.id)
    setCatNome(c.nome)
    setCatRegra(c.regra_horas_unitaria)
    setCatTeto(c.teto_maximo_curso)
    setCatAtivo(c.ativo !== false)
    setErroCatModal(null)
    setIsCatModalOpen(true)
  }

  const handleSalvarCategoria = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isAdmin) {
      setErroCatModal('Apenas Administradores podem salvar alterações de categorias.')
      return
    }

    if (!catNome.trim() || !catRegra.trim() || !catTeto) {
      setErroCatModal('Preencha todos os campos obrigatórios.')
      return
    }

    try {
      setSalvandoCat(true)
      if (editingCatId) {
        await appContext.atualizarCategoria(editingCatId, {
          nome: catNome.trim(),
          regra_horas_unitaria: catRegra.trim(),
          teto_maximo_curso: Number(catTeto),
          ativo: catAtivo,
        })
        toast({
          title: 'Categoria atualizada!',
          description: `Alterações em "${catNome}" salvas com sucesso.`,
        })
      } else {
        await appContext.criarCategoria({
          nome: catNome.trim(),
          regra_horas_unitaria: catRegra.trim(),
          teto_maximo_curso: Number(catTeto),
          ativo: catAtivo,
        })
        toast({
          title: 'Categoria criada!',
          description: `"${catNome}" incluída no regulamento.`,
        })
      }

      setIsCatModalOpen(false)
      carregarDados()
    } catch (err) {
      console.error(err)
      setErroCatModal('Erro ao salvar categoria no banco.')
    } finally {
      setSalvandoCat(false)
    }
  }

  const handleToggleAtivo = async (c: Categoria) => {
    if (!isAdmin) {
      toast({
        title: 'Ação restrita',
        description: 'Apenas Administradores podem alterar o status.',
        variant: 'destructive',
      })
      return
    }

    try {
      await appContext.atualizarCategoria(c.id, { ativo: !c.ativo })
      toast({
        title: !c.ativo ? 'Categoria reativada' : 'Categoria inativada',
        description: !c.ativo
          ? `"${c.nome}" voltará a aparecer nos lançamentos.`
          : `"${c.nome}" foi ocultada dos dropdowns de lançamento (histórico preservado).`,
      })
      carregarDados()
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro ao alternar status',
        variant: 'destructive',
      })
    }
  }

  // Helpers para Virada de Semestre
  const sugerirProximoSemestre = (semestreAtual: string): string => {
    const match = semestreAtual.match(/^(\d{4})\.([12])$/)
    if (!match) return '2027.1'
    const ano = parseInt(match[1], 10)
    const sem = parseInt(match[2], 10)
    return sem === 1 ? `${ano}.2` : `${ano + 1}.1`
  }

  const validarFormatoSemestre = (s: string): boolean => {
    return /^\d{4}\.[12]$/.test(s.trim())
  }

  const handleAbrirViradaSemestre = async () => {
    if (!isAdmin) {
      toast({
        title: 'Ação restrita',
        description: 'Apenas Administradores podem executar a virada de semestre.',
        variant: 'destructive',
      })
      return
    }

    const semAtual = config?.semestre_letivo_atual || '2026.2'
    setNovoSemestreInput(sugerirProximoSemestre(semAtual))
    setErroFormatoSemestre(null)
    setErroExecucaoVirada(null)
    setViradaEtapa('config')
    setIsViradaModalOpen(true)
  }

  const handleAvancarParaPreview = async () => {
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
    setAlunosViradaCarregando(true)
    setViradaEtapa('preview')

    try {
      const todos = await listarAlunos()
      setAlunosVirada(todos)
      const selecionados = new Set<string>()
      todos.forEach((a) => {
        if (Number(a.semestre_atual) < 10) {
          selecionados.add(a.id)
        }
      })
      setIdsAlunosSelecionados(selecionados)
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro ao listar alunos',
        description: 'Não foi possível carregar a lista de alunos para pré-visualização.',
        variant: 'destructive',
      })
    } finally {
      setAlunosViradaCarregando(false)
    }
  }

  const handleToggleAlunoVirada = (id: string) => {
    const novo = new Set(idsAlunosSelecionados)
    if (novo.has(id)) {
      novo.delete(id)
    } else {
      novo.add(id)
    }
    setIdsAlunosSelecionados(novo)
  }

  const handleSelecionarTodosVirada = () => {
    const todosNaoConcluintes = new Set<string>()
    alunosVirada.forEach((a) => {
      if (Number(a.semestre_atual) < 10) {
        todosNaoConcluintes.add(a.id)
      }
    })
    setIdsAlunosSelecionados(todosNaoConcluintes)
  }

  const handleLimparSelecaoVirada = () => {
    setIdsAlunosSelecionados(new Set())
  }

  const handleExecutarViradaConfirmada = async () => {
    if (!isAdmin) return
    const novoSemestre = novoSemestreInput.trim()

    setViradaEtapa('executando')
    setProgressoVirada(5)
    setProgressoViradaTexto('Iniciando processamento da virada letiva...')
    setErroExecucaoVirada(null)

    try {
      const resultado = await appContext.executarViradaSemestreAssistida({
        novoSemestreLetivo: novoSemestre,
        idsAlunosParaPromover: Array.from(idsAlunosSelecionados),
        onProgress: (pct, atual, total) => {
          setProgressoVirada(pct)
          setProgressoViradaTexto(`Atualizando estudante ${atual} de ${total}...`)
        },
      })

      setResultadoVirada(resultado)
      setViradaEtapa('resumo')
      await carregarDados()

      toast({
        title: 'Virada de semestre concluída com sucesso!',
        description: `Semestre ${resultado.novoSemestre} ativado. ${resultado.alunosPromovidos} alunos promovidos.`,
      })
    } catch (err: unknown) {
      console.error(err)
      const msg = err instanceof Error ? err.message : 'Falha ao processar virada de semestre.'
      setErroExecucaoVirada(msg)
      setViradaEtapa('preview')
      toast({
        title: 'Erro na virada de semestre',
        description: msg,
        variant: 'destructive',
      })
    }
  }

  const handleConfirmarExclusao = async (c: Categoria) => {
    setDeletingCat(c)
    try {
      const total = await contarLancamentosPorCategoria(c.id)
      if (total > 0) {
        setDeleteWarning(
          `Esta categoria possui ${total} ${
            total === 1 ? 'lançamento vinculado' : 'lançamentos vinculados'
          } e NÃO PODE ser excluída. Recomendamos inativá-la para manter o histórico de auditoria.`,
        )
      } else {
        setDeleteWarning(null)
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleExcluirCategoria = async () => {
    if (!deletingCat || !isAdmin) return
    try {
      await appContext.excluirCategoria(deletingCat.id)
      toast({
        title: 'Categoria excluída!',
        description: `"${deletingCat.nome}" foi removida do regulamento.`,
      })
      setDeletingCat(null)
      carregarDados()
    } catch (err: unknown) {
      console.error(err)
      toast({
        title: 'Não foi possível excluir',
        description: 'Esta categoria possui lançamentos ou ocorreu erro no servidor.',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="space-y-8 animate-fade-in pb-16">
      {/* Header */}
      <div className="border-b border-slate-200 pb-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-[#1d4ed8]">
              <Settings className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-['Outfit'] text-2xl font-bold tracking-tight text-[#0f2b48] sm:text-3xl">
                Tabela NDE Parametrizável & Backup
              </h1>
              <p className="text-sm text-slate-600">
                Parâmetros do curso, assinatura de despachos, regulamento NDE e cópias de segurança
                JSON
              </p>
            </div>
          </div>

          {!isAdmin && (
            <Badge
              variant="outline"
              className="border-amber-300 bg-amber-50 text-amber-800 text-xs"
            >
              <Lock className="mr-1 h-3 w-3 text-amber-600" />
              Modo Leitura (Apenas Administrador pode salvar)
            </Badge>
          )}
        </div>
      </div>

      {/* SEÇÃO COM DESTAQUE: AUTOMAÇÃO ASSISTIDA DA VIRADA DE SEMESTRE */}
      <Card className="border-2 border-blue-200 bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-slate-50 shadow-md">
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#1d4ed8] text-white shadow-md">
                <CalendarFold className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-['Outfit'] text-lg font-bold text-[#0f2b48]">
                    Virada de Semestre Letivo Assistida
                  </h2>
                  <Badge className="bg-blue-600 text-white text-[10px] font-semibold">
                    Automação Integrada
                  </Badge>
                  {config?.ultima_virada_semestre && (
                    <Badge
                      variant="outline"
                      className="text-[11px] border-emerald-300 bg-emerald-50 text-emerald-800"
                    >
                      Última virada: {config.ultima_virada_semestre}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
                  Transição assistida com pré-visualização completa: avança o semestre letivo
                  oficial (ex.: {config?.semestre_letivo_atual || '2026.2'} →{' '}
                  {sugerirProximoSemestre(config?.semestre_letivo_atual || '2026.2')}) e promove o
                  semestre dos alunos com trava no 10º, permitindo exclusões seletivas (ex.:
                  trancamentos). Operação segura e idempotente.
                </p>
                {config?.ultima_virada_data && (
                  <div className="flex items-center gap-1.5 pt-1 text-[11px] text-slate-500">
                    <Info className="h-3.5 w-3.5 text-slate-400" />
                    <span>
                      Última virada registrada em{' '}
                      <strong>
                        {new Date(config.ultima_virada_data).toLocaleDateString('pt-BR')} às{' '}
                        {new Date(config.ultima_virada_data).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </strong>
                      {typeof config.ultima_virada_alunos_promovidos === 'number' && (
                        <>
                          {' '}
                          · <strong>{config.ultima_virada_alunos_promovidos}</strong> estudantes
                          promovidos
                        </>
                      )}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="shrink-0 flex items-center gap-2 pt-2 lg:pt-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      type="button"
                      disabled={!isAdmin}
                      onClick={handleAbrirViradaSemestre}
                      className="bg-[#0f2b48] hover:bg-[#1e40af] text-white text-xs font-semibold px-4 py-2 shadow-sm transition-all active:scale-[0.98]"
                    >
                      <Sparkles className="mr-1.5 h-4 w-4 text-amber-300" />
                      Iniciar Virada de Semestre
                      <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                    </Button>
                  </span>
                </TooltipTrigger>
                {!isAdmin && (
                  <TooltipContent>
                    <p className="text-xs">
                      Apenas Administradores podem executar a virada de semestre.
                    </p>
                  </TooltipContent>
                )}
              </Tooltip>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card 1: Configuração Global Parametrizável (com Coordenadora e CRP) */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="font-['Outfit'] text-lg font-bold text-[#0f2b48]">
            Parametrização Autônoma do Curso & Despachos
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Semestre letivo, metas de integralização e assinatura oficial da coordenação utilizada
            nos despachos oficiais
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSalvarConfigGlobal} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="sem-atual" className="text-xs font-semibold text-slate-700">
                  Semestre Letivo Atual *
                </Label>
                <Input
                  id="sem-atual"
                  type="text"
                  required
                  disabled={!isAdmin}
                  value={semestreLetivo}
                  onChange={(e) => setSemestreLetivo(e.target.value)}
                  placeholder="Ex: 2026.2"
                  className="text-xs font-semibold font-mono"
                />
                <p className="text-[11px] text-slate-500">
                  Usado como referência para apuração do balanço semestral.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="min-sem" className="text-xs font-semibold text-slate-700">
                  Mínimo Exigido por Semestre (Horas) *
                </Label>
                <Input
                  id="min-sem"
                  type="number"
                  required
                  min={1}
                  disabled={!isAdmin}
                  value={minimoSemestral}
                  onChange={(e) => setMinimoSemestral(Number(e.target.value))}
                  className="text-xs font-semibold"
                />
                <p className="text-[11px] text-slate-500">Padrão NDE: 20 horas por semestre.</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="meta-curso" className="text-xs font-semibold text-slate-700">
                  Meta Total do Curso de Psicologia *
                </Label>
                <Input
                  id="meta-curso"
                  type="number"
                  required
                  min={1}
                  disabled={!isAdmin}
                  value={metaCurso}
                  onChange={(e) => setMetaCurso(Number(e.target.value))}
                  className="text-xs font-semibold"
                />
                <p className="text-[11px] text-slate-500">
                  Padrão do Projeto Pedagógico: 200 horas.
                </p>
              </div>
            </div>

            {/* Campos novos: Coordenadora e CRP */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-2 border-t border-slate-100">
              <div className="space-y-1.5">
                <Label htmlFor="coord-nome" className="text-xs font-semibold text-slate-700">
                  Nome da Coordenadora do Curso *
                </Label>
                <Input
                  id="coord-nome"
                  type="text"
                  required
                  disabled={!isAdmin}
                  value={nomeCoordenadora}
                  onChange={(e) => setNomeCoordenadora(e.target.value)}
                  placeholder="Ex: Roberta Andrea de Oliveira"
                  className="text-xs font-medium"
                />
                <p className="text-[11px] text-slate-500">
                  Nome oficial exibido no cabeçalho dos despachos de deferimento.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="coord-crp" className="text-xs font-semibold text-slate-700">
                  Registro Profissional (CRP) *
                </Label>
                <Input
                  id="coord-crp"
                  type="text"
                  required
                  disabled={!isAdmin}
                  value={crpCoordenadora}
                  onChange={(e) => setCrpCoordenadora(e.target.value)}
                  placeholder="Ex: 06/77114"
                  className="text-xs font-mono font-medium"
                />
                <p className="text-[11px] text-slate-500">
                  Número de inscrição no Conselho Regional de Psicologia da signatária.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      type="submit"
                      disabled={!isAdmin || salvandoConfig}
                      className="bg-[#1d4ed8] hover:bg-[#1e40af] text-white text-xs font-semibold"
                    >
                      {salvandoConfig ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Salvando...
                        </>
                      ) : (
                        <>
                          <Save className="mr-1.5 h-4 w-4" />
                          Salvar Configurações Globais
                        </>
                      )}
                    </Button>
                  </span>
                </TooltipTrigger>
                {!isAdmin && (
                  <TooltipContent>
                    <p className="text-xs">Apenas Administradores podem alterar configurações.</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Card 2: Categorias e Regulamento de Tetos (CRUD COMPLETO) */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pb-3">
          <div>
            <CardTitle className="font-['Outfit'] text-lg font-bold text-[#0f2b48]">
              Tabela de Categorias e Tetos Máximos (NDE)
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Grupos de atividades autorizadas pela Resolução do Curso de Psicologia
            </CardDescription>
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button
                  onClick={handleAbrirNovaCategoria}
                  disabled={!isAdmin}
                  size="sm"
                  className="bg-[#1d4ed8] hover:bg-[#1e40af] text-white text-xs"
                >
                  <Plus className="mr-1.5 h-4 w-4" />
                  Nova Categoria
                </Button>
              </span>
            </TooltipTrigger>
            {!isAdmin && (
              <TooltipContent>
                <p className="text-xs">Apenas Administradores podem criar categorias.</p>
              </TooltipContent>
            )}
          </Tooltip>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                <tr>
                  <th className="px-6 py-3">Nome da Categoria</th>
                  <th className="px-6 py-3">Regra de Horas Unitária</th>
                  <th className="px-6 py-3">Teto Máximo do Curso</th>
                  <th className="px-6 py-3 text-center">Status</th>
                  <th className="px-6 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-xs text-slate-500">
                      <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-[#1d4ed8]" />
                      Carregando tabela de categorias...
                    </td>
                  </tr>
                ) : categorias.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-xs text-slate-500">
                      Nenhuma categoria cadastrada.
                    </td>
                  </tr>
                ) : (
                  categorias.map((c) => (
                    <tr
                      key={c.id}
                      className={`hover:bg-slate-50/50 transition-colors ${
                        c.ativo === false ? 'opacity-60 bg-slate-50/40' : ''
                      }`}
                    >
                      <td className="px-6 py-3.5">
                        <div className="font-semibold text-slate-900">{c.nome}</div>
                        {c.ativo === false && (
                          <span className="text-[10px] text-amber-700 font-medium">
                            (Inativa nos lançamentos rápidos)
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3.5 text-xs text-slate-600">
                        {c.regra_horas_unitaria}
                      </td>
                      <td className="px-6 py-3.5 text-xs font-bold text-slate-900">
                        {c.teto_maximo_curso} horas
                      </td>
                      <td className="px-6 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Switch
                            checked={c.ativo !== false}
                            disabled={!isAdmin}
                            onCheckedChange={() => handleToggleAtivo(c)}
                          />
                          <span className="text-[11px] font-medium text-slate-600">
                            {c.ativo !== false ? 'Ativo' : 'Inativo'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={!isAdmin}
                            onClick={() => handleAbrirEditarCategoria(c)}
                            className="h-8 w-8 p-0 text-slate-600 hover:text-[#1d4ed8]"
                            title="Editar Categoria"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={!isAdmin}
                            onClick={() => handleConfirmarExclusao(c)}
                            className="h-8 w-8 p-0 text-slate-600 hover:text-red-600"
                            title="Excluir Categoria"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Card 3: CÓPIAS DE SEGURANÇA (BACKUP & RESTAURAÇÃO JSON) E DADOS DE DEMONSTRAÇÃO */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Bloco Backup JSON */}
        <Card className="border-slate-200 shadow-sm flex flex-col justify-between">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-[#1d4ed8]">
                <Database className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="font-['Outfit'] text-base font-bold text-[#0f2b48]">
                  Cópia de Segurança em JSON
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Exportação integral e restauração de emergência de todos os dados do sistema
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-slate-600 leading-relaxed">
              Exporte uma cópia completa de segurança contendo estudantes, tabela de categorias,
              lançamentos imutáveis e parâmetros de configuração global em formato JSON padronizado.
            </p>

            <div className="rounded-md border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600 space-y-1">
              <div className="flex items-center justify-between">
                <span>Registros exportados:</span>
                <span className="font-semibold text-slate-800">
                  Alunos, Categorias, Lançamentos e Config
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Formato de saída:</span>
                <span className="font-mono text-slate-800 font-semibold">.JSON (UTF-8)</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2">
              {/* Botão Baixar Backup */}
              <Button
                type="button"
                onClick={handleExportarBackup}
                disabled={exportandoBackup}
                className="bg-[#0f2b48] hover:bg-[#1e40af] text-white text-xs font-semibold"
              >
                {exportandoBackup ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Gerando Backup...
                  </>
                ) : (
                  <>
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                    Baixar Backup Completo (JSON)
                  </>
                )}
              </Button>

              {/* Botão Restaurar Backup (Abre seletor de arquivo) */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={handleSelecionarArquivoBackup}
              />

              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!isAdmin}
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs text-slate-700 border-slate-300 hover:bg-slate-50"
                    >
                      <Upload className="mr-1.5 h-3.5 w-3.5 text-blue-600" />
                      Restaurar a Partir de JSON...
                    </Button>
                  </span>
                </TooltipTrigger>
                {!isAdmin && (
                  <TooltipContent>
                    <p className="text-xs">Apenas Administradores podem restaurar dados.</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </div>
          </CardContent>
        </Card>

        {/* Bloco Restaurar Dados de Demonstração (Seed FAUSP) */}
        <Card className="border-slate-200 shadow-sm flex flex-col justify-between">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-800">
                <RotateCcw className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="font-['Outfit'] text-base font-bold text-[#0f2b48]">
                  Restaurar Dados de Demonstração
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Repõe os estudantes, categorias e lançamentos oficiais de demonstração
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-slate-600 leading-relaxed">
              Restaura a base de demonstração padrão do curso de Psicologia FAUSP (Mariana, Lucas,
              Beatriz, Felipe e Camila), as 13 categorias oficiais NDE e os lançamentos com estornos
              didáticos para testes e homologação.
            </p>

            <div className="rounded-md border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block">Atenção — Operação Sensível:</span>
                Esta operação requer dupla confirmação de segurança antes da execução e redefinirá
                os registros de demonstração.
              </div>
            </div>

            <div className="pt-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!isAdmin || restaurandoDemo}
                      onClick={() => setIsModalDemoOpen1(true)}
                      className="border-amber-300 text-amber-900 hover:bg-amber-50 text-xs font-semibold"
                    >
                      {restaurandoDemo ? (
                        <>
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          Restaurando Demo...
                        </>
                      ) : (
                        <>
                          <RotateCcw className="mr-1.5 h-3.5 w-3.5 text-amber-700" />
                          Restaurar Dados de Demonstração...
                        </>
                      )}
                    </Button>
                  </span>
                </TooltipTrigger>
                {!isAdmin && (
                  <TooltipContent>
                    <p className="text-xs">Apenas Administradores podem executar esta ação.</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* MODAL DE CONFIRMAÇÃO: RESTAURAR BACKUP JSON */}
      {arquivoBackupSelecionado && (
        <Dialog open={isModalRestaurarBackupOpen} onOpenChange={setIsModalRestaurarBackupOpen}>
          <DialogContent className="bg-white max-w-lg">
            <DialogHeader>
              <div className="flex items-center gap-2 text-red-600 mb-1">
                <ShieldAlert className="h-5 w-5" />
                <DialogTitle className="font-['Outfit'] text-lg font-bold text-[#0f2b48]">
                  Confirmar Restauração de Backup JSON?
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs text-slate-500">
                Arquivo selecionado:{' '}
                <strong className="font-mono text-slate-700">{nomeArquivoJson}</strong>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900 leading-relaxed font-medium">
                ⚠️ <strong>AVISO IMPORTANTE:</strong> A restauração é uma operação de recuperação
                que substitui ou sincroniza os dados cadastrais (alunos, categorias NDE e
                configurações). Lançamentos compatíveis serão importados.
              </div>

              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 space-y-1.5">
                <span className="font-bold text-slate-800 block text-xs">Conteúdo do Arquivo:</span>
                <div className="flex justify-between text-slate-600">
                  <span>Semestre no arquivo:</span>
                  <strong className="font-mono text-slate-900">
                    {arquivoBackupSelecionado.configuracao?.semestre_letivo_atual || '—'}
                  </strong>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Estudantes:</span>
                  <strong className="text-slate-900">
                    {arquivoBackupSelecionado.alunos?.length || 0}
                  </strong>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Categorias NDE:</span>
                  <strong className="text-slate-900">
                    {arquivoBackupSelecionado.categorias?.length || 0}
                  </strong>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Lançamentos no backup:</span>
                  <strong className="text-slate-900">
                    {arquivoBackupSelecionado.lancamentos?.length || 0}
                  </strong>
                </div>
              </div>

              {restaurandoBackup && (
                <div className="space-y-2 pt-2">
                  <Progress value={progressoRestauracao} className="h-2" />
                  <p className="text-[11px] text-slate-500 text-center font-mono">
                    {progressoRestauracaoTexto}
                  </p>
                </div>
              )}
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={restaurandoBackup}
                onClick={() => {
                  setIsModalRestaurarBackupOpen(false)
                  setArquivoBackupSelecionado(null)
                }}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={restaurandoBackup}
                onClick={handleExecutarRestauracaoBackup}
                className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold"
              >
                {restaurandoBackup ? 'Restaurando...' : 'Sim, Substituir e Restaurar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* MODAL DUPLA CONFIRMAÇÃO 1: RESTAURAR DEMO */}
      <AlertDialog open={isModalDemoOpen1} onOpenChange={setIsModalDemoOpen1}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-['Outfit'] text-lg font-bold text-[#0f2b48]">
              Passo 1/2: Restaurar Dados de Demonstração?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-600 leading-relaxed">
              Você está prestes a restaurar a base didática de exemplo da FAUSP (5 estudantes,
              categorias padrão e lançamentos com estorno).
              <br />
              <br />
              Deseja avançar para a confirmação definitiva?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setIsModalDemoOpen1(false)
                setIsModalDemoOpen2(true)
              }}
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold"
            >
              Continuar para Confirmação Final
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* MODAL DUPLA CONFIRMAÇÃO 2: RESTAURAR DEMO */}
      <AlertDialog open={isModalDemoOpen2} onOpenChange={setIsModalDemoOpen2}>
        <AlertDialogContent className="bg-white border-2 border-red-200">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-['Outfit'] text-lg font-bold text-red-700 flex items-center gap-2">
              <ShieldAlert className="h-5 w-5" />
              Passo 2/2: Confirmar Sobrescrita de Dados Demo
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-600 leading-relaxed space-y-2">
              <p>
                <strong>CONFIRMAÇÃO FINAL:</strong> Esta ação reporá os registros dos estudantes da
                demonstração e parâmetros NDE originais.
              </p>
              <p className="text-[11px] text-slate-500">
                Tem certeza de que deseja prosseguir agora?
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs">Voltar / Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmarRestauracaoDemoFinal}
              className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold"
            >
              Confirmar Restauração Demo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal Criar / Editar Categoria */}
      <Dialog open={isCatModalOpen} onOpenChange={setIsCatModalOpen}>
        <DialogContent className="bg-white max-w-md">
          <DialogHeader>
            <DialogTitle className="font-['Outfit'] text-lg font-bold text-[#0f2b48]">
              {editingCatId ? 'Editar Categoria do Regulamento' : 'Nova Categoria de Atividade'}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Defina o nome da atividade, regra de aproveitamento unitário e teto máximo no curso.
            </DialogDescription>
          </DialogHeader>

          {erroCatModal && (
            <div className="rounded-md bg-red-50 p-2.5 text-xs text-red-700 border border-red-200">
              {erroCatModal}
            </div>
          )}

          <form onSubmit={handleSalvarCategoria} className="space-y-3.5 py-2">
            <div className="space-y-1">
              <Label htmlFor="cat-nome" className="text-xs font-semibold text-slate-700">
                Nome da Categoria *
              </Label>
              <Input
                id="cat-nome"
                required
                value={catNome}
                onChange={(e) => setCatNome(e.target.value)}
                placeholder="Ex: Eventos científicos com apresentação..."
                className="text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="cat-regra" className="text-xs font-semibold text-slate-700">
                Regra de Horas Unitária *
              </Label>
              <Input
                id="cat-regra"
                required
                value={catRegra}
                onChange={(e) => setCatRegra(e.target.value)}
                placeholder="Ex: 20h por evento, 10h por atividade, 30h por semestre"
                className="text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 items-center">
              <div className="space-y-1">
                <Label htmlFor="cat-teto" className="text-xs font-semibold text-slate-700">
                  Teto Máximo (Horas) *
                </Label>
                <Input
                  id="cat-teto"
                  type="number"
                  required
                  min={1}
                  value={catTeto}
                  onChange={(e) => setCatTeto(Number(e.target.value))}
                  placeholder="Ex: 40"
                  className="text-xs font-bold"
                />
              </div>

              <div className="flex items-center gap-2 pt-5">
                <Switch id="cat-ativo" checked={catAtivo} onCheckedChange={setCatAtivo} />
                <Label htmlFor="cat-ativo" className="text-xs cursor-pointer text-slate-700">
                  Categoria Ativa
                </Label>
              </div>
            </div>

            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCatModalOpen(false)}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={salvandoCat}
                className="bg-[#1d4ed8] hover:bg-[#1e40af] text-white text-xs"
              >
                {salvandoCat
                  ? 'Salvando...'
                  : editingCatId
                    ? 'Salvar Alterações'
                    : 'Criar Categoria'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Excluir Categoria */}
      {deletingCat && (
        <AlertDialog open={!!deletingCat} onOpenChange={() => setDeletingCat(null)}>
          <AlertDialogContent className="bg-white">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-['Outfit'] text-lg font-bold text-red-700">
                Excluir Categoria: {deletingCat.nome}?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs text-slate-600 leading-relaxed">
                {deleteWarning ? (
                  <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900 font-medium">
                    ⚠️ {deleteWarning}
                  </div>
                ) : (
                  <>
                    Tem certeza de que deseja excluir permanentemente esta categoria? Lançamentos
                    históricos, se houverem, serão preservados para fins de auditoria.
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="text-xs">Fechar</AlertDialogCancel>
              {!deleteWarning && (
                <AlertDialogAction
                  onClick={handleExcluirCategoria}
                  className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold"
                >
                  Excluir Categoria
                </AlertDialogAction>
              )}
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* MODAL: AUTOMAÇÃO ASSISTIDA DA VIRADA DE SEMESTRE */}
      <Dialog
        open={isViradaModalOpen}
        onOpenChange={(open) => {
          if (!open && viradaEtapa === 'executando') return
          setIsViradaModalOpen(open)
        }}
      >
        <DialogContent className="bg-white max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-[#1d4ed8]">
                <CalendarFold className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="font-['Outfit'] text-xl font-bold text-[#0f2b48]">
                  Automação Assistida da Virada de Semestre Letivo
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Transição acadêmica controlada em etapas com revisão e confirmação assistida
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Stepper Visual */}
          <div className="flex items-center justify-between border-b border-slate-100 py-3 px-2">
            <div
              className={`flex items-center gap-2 text-xs font-semibold ${
                viradaEtapa === 'config' ? 'text-[#1d4ed8]' : 'text-slate-400'
              }`}
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] ${
                  viradaEtapa === 'config'
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
                viradaEtapa === 'preview' ? 'text-[#1d4ed8]' : 'text-slate-400'
              }`}
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] ${
                  viradaEtapa === 'preview'
                    ? 'bg-[#1d4ed8] text-white'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                2
              </span>
              <span>Pré-visualização e Exclusões</span>
            </div>

            <ArrowRight className="h-4 w-4 text-slate-300" />

            <div
              className={`flex items-center gap-2 text-xs font-semibold ${
                viradaEtapa === 'executando' || viradaEtapa === 'resumo'
                  ? 'text-[#1d4ed8]'
                  : 'text-slate-400'
              }`}
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] ${
                  viradaEtapa === 'executando' || viradaEtapa === 'resumo'
                    ? 'bg-[#1d4ed8] text-white'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                3
              </span>
              <span>Execução e Resumo</span>
            </div>
          </div>

          {/* ETAPA 1: DEFINIÇÃO DO SEMESTRE */}
          {viradaEtapa === 'config' && (
            <div className="space-y-4 py-3">
              <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-4 text-xs text-blue-900 space-y-1.5">
                <div className="flex items-center gap-2 font-semibold text-blue-950">
                  <Info className="h-4 w-4 text-[#1d4ed8]" />
                  Como funciona a transição assistida?
                </div>
                <p className="leading-relaxed text-blue-800">
                  A virada letiva avança o semestre do curso e promove os alunos ativos para a
                  próxima etapa (+1 semestre, com trava no 10º). Na próxima etapa você poderá
                  visualizar todos os alunos afetados e desmarcar aqueles que não devem ser
                  promovidos (ex.: alunos com matrícula trancada).
                </p>
                <p className="text-[11px] font-medium text-blue-700">
                  Nota: A promoção não altera o histórico de lançamentos nem cria registros
                  adicionais de horas.
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
                    Semestre atualmente ativo nas apurações e despachos.
                  </p>
                </div>

                <div className="rounded-lg border border-blue-200 p-3.5 bg-white space-y-2 shadow-xs">
                  <Label
                    htmlFor="novo-semestre"
                    className="text-xs font-semibold text-slate-800 flex items-center justify-between"
                  >
                    <span>Novo Semestre Letivo a Definir *</span>
                    <span className="text-[11px] text-slate-400 font-normal">Padrão NNNN.N</span>
                  </Label>
                  <Input
                    id="novo-semestre"
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
                    Última virada registrada no sistema:{' '}
                    <strong>{config.ultima_virada_semestre}</strong>
                  </span>
                </div>
              )}

              <DialogFooter className="pt-4 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsViradaModalOpen(false)}
                  className="text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={handleAvancarParaPreview}
                  className="bg-[#1d4ed8] hover:bg-[#1e40af] text-white text-xs font-semibold"
                >
                  Avançar para Pré-visualização
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Button>
              </DialogFooter>
            </div>
          )}

          {/* ETAPA 2: PRÉ-VISUALIZAÇÃO */}
          {viradaEtapa === 'preview' && (
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
                    Desmarque alunos que não devem ser promovidos nesta virada (ex.: trancamentos).
                  </p>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleSelecionarTodosVirada}
                    className="h-7 text-xs text-slate-700"
                  >
                    <CheckSquare className="mr-1 h-3.5 w-3.5 text-blue-600" />
                    Selecionar Todos
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleLimparSelecaoVirada}
                    className="h-7 text-xs text-slate-700"
                  >
                    <Square className="mr-1 h-3.5 w-3.5 text-slate-400" />
                    Limpar Seleção
                  </Button>
                </div>
              </div>

              {/* Contadores */}
              <div className="grid grid-cols-3 gap-2.5">
                <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5 text-center">
                  <span className="text-[11px] text-slate-500 block">Total de Alunos</span>
                  <span className="font-['Outfit'] text-lg font-bold text-slate-900">
                    {alunosVirada.length}
                  </span>
                </div>
                <div className="rounded-md border border-blue-200 bg-blue-50/60 p-2.5 text-center">
                  <span className="text-[11px] text-blue-700 font-semibold block">
                    A Serem Promovidos
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
                    {alunosVirada.length - idsAlunosSelecionados.size}
                  </span>
                </div>
              </div>

              {erroExecucaoVirada && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                  <span>{erroExecucaoVirada}</span>
                </div>
              )}

              {/* Tabela de Estudantes */}
              <div className="max-h-[340px] overflow-y-auto rounded-md border border-slate-200">
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
                    {alunosViradaCarregando ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-500">
                          <Loader2 className="mx-auto mb-1.5 h-5 w-5 animate-spin text-[#1d4ed8]" />
                          Carregando lista de alunos...
                        </td>
                      </tr>
                    ) : alunosVirada.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-slate-500">
                          Nenhum estudante cadastrado no sistema.
                        </td>
                      </tr>
                    ) : (
                      alunosVirada.map((a) => {
                        const semAtual = Number(a.semestre_atual) || 1
                        const is10Semestre = semAtual >= 10
                        const selecionado = idsAlunosSelecionados.has(a.id)
                        const semPromovido = is10Semestre
                          ? 10
                          : selecionado
                            ? semAtual + 1
                            : semAtual

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
                                onCheckedChange={() => handleToggleAlunoVirada(a.id)}
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
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <DialogFooter className="pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setViradaEtapa('config')}
                  className="text-xs"
                >
                  Voltar
                </Button>
                <Button
                  type="button"
                  onClick={handleExecutarViradaConfirmada}
                  disabled={alunosViradaCarregando || alunosVirada.length === 0}
                  className="bg-[#1d4ed8] hover:bg-[#1e40af] text-white text-xs font-semibold"
                >
                  <Sparkles className="mr-1.5 h-3.5 w-3.5 text-amber-300" />
                  Confirmar e Aplicar Virada ({idsAlunosSelecionados.size} promovidos)
                </Button>
              </DialogFooter>
            </div>
          )}

          {/* ETAPA 3: PROCESSANDO */}
          {viradaEtapa === 'executando' && (
            <div className="py-8 px-4 text-center space-y-5">
              <div className="flex h-14 w-14 mx-auto items-center justify-center rounded-2xl bg-blue-100 text-[#1d4ed8] shadow-inner">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
              <div className="space-y-1">
                <h3 className="font-['Outfit'] text-lg font-bold text-[#0f2b48]">
                  Processando Virada de Semestre...
                </h3>
                <p className="text-xs text-slate-500">
                  {progressoViradaTexto ||
                    'Atualizando semestres e parâmetros globais com segurança...'}
                </p>
              </div>

              <div className="max-w-md mx-auto space-y-1.5">
                <Progress value={progressoVirada} className="h-2.5" />
                <div className="flex justify-between text-[11px] text-slate-500 font-mono">
                  <span>Gravando no banco...</span>
                  <span>{progressoVirada}%</span>
                </div>
              </div>

              <p className="text-[11px] text-slate-400">
                Por favor, não feche esta janela durante o processamento.
              </p>
            </div>
          )}

          {/* ETAPA 4: RESUMO FINAL */}
          {viradaEtapa === 'resumo' && resultadoVirada && (
            <div className="space-y-5 py-4">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-4 text-center space-y-2">
                <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm">
                  <Check className="h-6 w-6" />
                </div>
                <h3 className="font-['Outfit'] text-lg font-bold text-emerald-950">
                  Virada Letiva Concluída com Sucesso!
                </h3>
                <p className="text-xs text-emerald-800 max-w-md mx-auto">
                  O semestre letivo ativo foi alterado para{' '}
                  <strong>{resultadoVirada.novoSemestre}</strong> e a promoção assistida foi
                  registrada com sucesso.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-lg border border-slate-200 p-3 bg-white text-center">
                  <span className="text-[11px] text-slate-500 block">Novo Semestre Ativo</span>
                  <span className="font-['Outfit'] text-xl font-bold text-[#0f2b48] font-mono">
                    {resultadoVirada.novoSemestre}
                  </span>
                </div>

                <div className="rounded-lg border border-emerald-200 p-3 bg-emerald-50/40 text-center">
                  <span className="text-[11px] text-emerald-700 font-semibold block">
                    Alunos Promovidos
                  </span>
                  <span className="font-['Outfit'] text-xl font-bold text-emerald-700">
                    {resultadoVirada.alunosPromovidos}
                  </span>
                </div>

                <div className="rounded-lg border border-slate-200 p-3 bg-slate-50 text-center">
                  <span className="text-[11px] text-slate-500 block">
                    Alunos Mantidos / Limite 10º
                  </span>
                  <span className="font-['Outfit'] text-xl font-bold text-slate-700">
                    {resultadoVirada.alunosMantidos}
                  </span>
                </div>
              </div>

              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 space-y-1">
                <div className="flex items-center justify-between">
                  <span>Data/Hora da Gravação:</span>
                  <strong className="font-mono text-slate-800">
                    {new Date(resultadoVirada.dataVirada).toLocaleString('pt-BR')}
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
                  onClick={() => setIsViradaModalOpen(false)}
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
