import React, { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { getConfiguracaoGlobal, salvarConfiguracaoGlobal } from '@/services/configuracao'
import {
  listarCategorias,
  criarCategoria,
  atualizarCategoria,
  excluirCategoria,
} from '@/services/categorias'
import { contarLancamentosPorCategoria } from '@/services/lancamentos'
import type { ConfiguracaoGlobal, Categoria } from '@/types'
import {
  Settings,
  ShieldAlert,
  Plus,
  Pencil,
  Trash2,
  Check,
  AlertCircle,
  HelpCircle,
  Loader2,
  Lock,
  Layers,
  Save,
} from 'lucide-react'
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useToast } from '@/hooks/use-toast'

export default function ConfiguracoesNDE() {
  const { user, isAdmin } = useAuth()
  const { toast } = useToast()

  const [config, setConfig] = useState<ConfiguracaoGlobal | null>(null)
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)

  // Form Global Config
  const [semestreLetivo, setSemestreLetivo] = useState('2026.2')
  const [minimoSemestral, setMinimoSemestral] = useState(20)
  const [metaCurso, setMetaCurso] = useState(200)
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
      const updated = await salvarConfiguracaoGlobal(id, {
        semestre_letivo_atual: semestreLetivo.trim(),
        minimo_exigido_semestre: Number(minimoSemestral),
        meta_curso: Number(metaCurso),
      })
      setConfig(updated)
      toast({
        title: 'Configurações atualizadas com sucesso!',
        description: `Semestre ${updated.semestre_letivo_atual}, Mínimo ${updated.minimo_exigido_semestre}h, Meta ${updated.meta_curso}h.`,
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
        await atualizarCategoria(editingCatId, {
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
        await criarCategoria({
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
      await atualizarCategoria(c.id, { ativo: !c.ativo })
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

  const handleConfirmarExclusao = async (c: Categoria) => {
    setDeletingCat(c)
    // Verifica se possui lançamentos
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
      await excluirCategoria(deletingCat.id)
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
        description:
          'Esta categoria possui lançamentos ou ocorreu erro no servidor. Marque-a como inativa.',
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
                Configurações NDE & Regulamento
              </h1>
              <p className="text-sm text-slate-600">
                Parametrização global do curso e tabela de tetos de atividades complementares
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

      {/* Card 1: Configuração Global */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="font-['Outfit'] text-lg font-bold text-[#0f2b48]">
            Configuração Global do Curso
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Parâmetros utilizados em cálculos de balanço semestral e regras de despacho
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
                  className="text-xs font-semibold"
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

      {/* Card 2: Categorias e Regulamento de Tetos */}
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
    </div>
  )
}
