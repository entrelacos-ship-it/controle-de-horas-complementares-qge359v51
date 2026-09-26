migrate(
  (app) => {
    try {
      const atasCol = app.findCollectionByNameOrId('atas_nde')
      const logsCol = app.findCollectionByNameOrId('auditoria_logs')

      const count = app.countRecords('atas_nde')
      if (count === 0) {
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
      console.log('Erro seed atas:', e)
    }
  },
  (app) => {
    // Revert opcional
  },
)
