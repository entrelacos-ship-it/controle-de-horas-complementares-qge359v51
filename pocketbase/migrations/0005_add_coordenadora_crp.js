migrate(
  (app) => {
    const configCol = app.findCollectionByNameOrId('configuracao_global')
    let changed = false

    if (!configCol.fields.getByName('nome_da_coordenadora')) {
      configCol.fields.add(
        new TextField({
          name: 'nome_da_coordenadora',
          required: false,
        }),
      )
      changed = true
    }

    if (!configCol.fields.getByName('crp_coordenadora')) {
      configCol.fields.add(
        new TextField({
          name: 'crp_coordenadora',
          required: false,
        }),
      )
      changed = true
    }

    if (changed) {
      app.save(configCol)
    }

    // Preencher valores padrão nos registros existentes se estiverem vazios
    try {
      const records = app.findRecordsByFilter('configuracao_global', '', '', 10, 0)
      for (let i = 0; i < records.length; i++) {
        const r = records[i]
        let rChanged = false
        if (!r.get('nome_da_coordenadora')) {
          r.set('nome_da_coordenadora', 'Roberta Andrea de Oliveira')
          rChanged = true
        }
        if (!r.get('crp_coordenadora')) {
          r.set('crp_coordenadora', '06/77114')
          rChanged = true
        }
        if (rChanged) {
          app.save(r)
        }
      }
    } catch (_) {}
  },
  (app) => {
    try {
      const configCol = app.findCollectionByNameOrId('configuracao_global')
      const f1 = configCol.fields.getByName('nome_da_coordenadora')
      if (f1) configCol.fields.removeByName('nome_da_coordenadora')
      const f2 = configCol.fields.getByName('crp_coordenadora')
      if (f2) configCol.fields.removeByName('crp_coordenadora')
      app.save(configCol)
    } catch (_) {}
  },
)
