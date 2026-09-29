migrate(
  (app) => {
    const lancamentos = app.findCollectionByNameOrId('lancamentos')
    const fieldAluno = lancamentos.fields.getByName('aluno_id')
    if (fieldAluno) {
      fieldAluno.cascadeDelete = true
    }
    lancamentos.deleteRule = "@request.auth.id != ''"
    app.save(lancamentos)
  },
  (app) => {
    const lancamentos = app.findCollectionByNameOrId('lancamentos')
    const fieldAluno = lancamentos.fields.getByName('aluno_id')
    if (fieldAluno) {
      fieldAluno.cascadeDelete = false
    }
    lancamentos.deleteRule = null
    app.save(lancamentos)
  },
)
