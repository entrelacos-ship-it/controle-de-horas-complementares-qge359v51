migrate(
  (app) => {
    // 1. Atualizar opções do campo 'turno' na coleção 'alunos' para incluir Vespertino e Especial
    const alunosCol = app.findCollectionByNameOrId('alunos')
    const turnoField = alunosCol.fields.getByName('turno')
    if (turnoField) {
      turnoField.values = ['Matutino', 'Vespertino', 'Noturno', 'Especial']
      turnoField.maxSelect = 1
      app.save(alunosCol)
    }

    // 2. Adicionar campos de auditoria e idempotência da virada de semestre em 'configuracao_global'
    const configCol = app.findCollectionByNameOrId('configuracao_global')
    let configChanged = false

    if (!configCol.fields.getByName('ultima_virada_semestre')) {
      configCol.fields.add(
        new TextField({
          name: 'ultima_virada_semestre',
          required: false,
        }),
      )
      configChanged = true
    }

    if (!configCol.fields.getByName('ultima_virada_data')) {
      configCol.fields.add(
        new TextField({
          name: 'ultima_virada_data',
          required: false,
        }),
      )
      configChanged = true
    }

    if (!configCol.fields.getByName('ultima_virada_alunos_promovidos')) {
      configCol.fields.add(
        new NumberField({
          name: 'ultima_virada_alunos_promovidos',
          required: false,
          onlyInt: true,
        }),
      )
      configChanged = true
    }

    if (configChanged) {
      app.save(configCol)
    }
  },
  (app) => {
    // Reverter opções do campo turno se necessário
    try {
      const alunosCol = app.findCollectionByNameOrId('alunos')
      const turnoField = alunosCol.fields.getByName('turno')
      if (turnoField) {
        turnoField.values = ['Matutino', 'Noturno']
        app.save(alunosCol)
      }
    } catch (_) {}

    // Remover campos de virada
    try {
      const configCol = app.findCollectionByNameOrId('configuracao_global')
      const f1 = configCol.fields.getByName('ultima_virada_semestre')
      if (f1) configCol.fields.removeByName('ultima_virada_semestre')
      const f2 = configCol.fields.getByName('ultima_virada_data')
      if (f2) configCol.fields.removeByName('ultima_virada_data')
      const f3 = configCol.fields.getByName('ultima_virada_alunos_promovidos')
      if (f3) configCol.fields.removeByName('ultima_virada_alunos_promovidos')
      app.save(configCol)
    } catch (_) {}
  },
)
