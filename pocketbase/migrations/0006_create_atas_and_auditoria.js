migrate(
  (app) => {
    // 1. Collection atas_nde (Atas Oficiais de Homologação NDE)
    try {
      app.findCollectionByNameOrId('atas_nde')
    } catch (_) {
      const atasCol = new Collection({
        name: 'atas_nde',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != '' && @request.auth.role = 'Administrador'",
        deleteRule: null, // Atas são imutáveis
        fields: [
          { name: 'numero_ata', type: 'text', required: true },
          { name: 'semestre_letivo', type: 'text', required: true },
          { name: 'data_homologacao', type: 'date', required: true },
          { name: 'status', type: 'text', required: true }, // 'HOMOLOGADA'
          { name: 'total_alunos_avaliados', type: 'number', required: true, onlyInt: true },
          { name: 'total_concluintes_aptos', type: 'number', required: true, onlyInt: true },
          { name: 'total_cumpriram_meta', type: 'number', required: true, onlyInt: true },
          { name: 'total_alerta_pedagogico', type: 'number', required: true, onlyInt: true },
          { name: 'total_horas_deferidas', type: 'number', required: true },
          { name: 'presidente_coordenadora', type: 'text', required: true },
          { name: 'crp_coordenadora', type: 'text', required: false },
          { name: 'resumo_deliberacao', type: 'text', required: false },
          { name: 'dados_balanco_json', type: 'json', required: false },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_atas_nde_semestre ON atas_nde (semestre_letivo)',
          'CREATE INDEX idx_atas_nde_created ON atas_nde (created)',
        ],
      })
      app.save(atasCol)
    }

    // 2. Collection auditoria_logs (Trilha de Auditoria Imutável do NDE)
    try {
      app.findCollectionByNameOrId('auditoria_logs')
    } catch (_) {
      const logsCol = new Collection({
        name: 'auditoria_logs',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: null, // Logs são estritamente somente-inserção
        deleteRule: null,
        fields: [
          { name: 'tipo_evento', type: 'text', required: true },
          // Tipos: 'LANCAMENTO_CRIADO', 'ESTORNO_REGISTRADO', 'HOMOLOGACAO_SEMESTRE', 'VIRADA_SEMESTRE', 'IMPORTACAO_LEGADA', 'CONFIGURACAO_ALTERADA'
          { name: 'ator_nome', type: 'text', required: true },
          { name: 'ator_email', type: 'text', required: false },
          { name: 'aluno_nome', type: 'text', required: false },
          { name: 'aluno_matricula', type: 'text', required: false },
          { name: 'semestre_letivo', type: 'text', required: false },
          { name: 'descricao', type: 'text', required: true },
          { name: 'detalhes_json', type: 'json', required: false },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_auditoria_logs_tipo ON auditoria_logs (tipo_evento)',
          'CREATE INDEX idx_auditoria_logs_matricula ON auditoria_logs (aluno_matricula)',
          'CREATE INDEX idx_auditoria_logs_created ON auditoria_logs (created)',
        ],
      })
      app.save(logsCol)
    }

    // 3. Seed inicial da ata 01/2026 referenciada no print de design
    try {
      const atasCol = app.findCollectionByNameOrId('atas_nde')
      const logsCol = app.findCollectionByNameOrId('auditoria_logs')

      const recordExiste = app.findRecordsByFilter('atas_nde', "numero_ata = '01/2026'", '', 1, 0)
      if (recordExiste.length === 0) {
        const ata01 = new Record(atasCol)
        ata01.set('numero_ata', '01/2026')
        ata01.set('semestre_letivo', '2026.1')
        ata01.set('data_homologacao', '2026-07-08 10:00:00.000Z')
        ata01.set('status', 'HOMOLOGADA')
        ata01.set('total_alunos_avaliados', 6)
        ata01.set('total_concluintes_aptos', 0)
        ata01.set('total_cumpriram_meta', 5)
        ata01.set('total_alerta_pedagogico', 1)
        ata01.set('total_horas_deferidas', 175)
        ata01.set('presidente_coordenadora', 'Roberta Andrea de Oliveira')
        ata01.set('crp_coordenadora', '06/77114')
        ata01.set(
          'resumo_deliberacao',
          'Ata ordinária de fechamento do semestre letivo 2026.1. Homologadas 175 horas complementares deferidas pelo NDE com certificação para a Secretaria Acadêmica.',
        )
        app.save(ata01)

        // Registrar também log de auditoria da homologação
        const log01 = new Record(logsCol)
        log01.set('tipo_evento', 'HOMOLOGACAO_SEMESTRE')
        log01.set('ator_nome', 'Roberta Andrea de Oliveira')
        log01.set('ator_email', 'roberta.oliveira@fausp.br')
        log01.set('semestre_letivo', '2026.1')
        log01.set(
          'descricao',
          'Homologação oficial do semestre letivo 2026.1 — Emissão da Ata NDE N° 01/2026 com 175h deferidas e 6 alunos avaliados.',
        )
        app.save(log01)
      }
    } catch (e) {
      console.log('Aviso ao semear ata 01/2026:', e)
    }
  },
  (app) => {
    try {
      const logs = app.findCollectionByNameOrId('auditoria_logs')
      app.delete(logs)
    } catch (_) {}
    try {
      const atas = app.findCollectionByNameOrId('atas_nde')
      app.delete(atas)
    } catch (_) {}
  },
)
