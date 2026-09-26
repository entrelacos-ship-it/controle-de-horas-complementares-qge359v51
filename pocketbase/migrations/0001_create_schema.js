migrate(
  (app) => {
    // 1. Add role field to existing users collection if not present
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    if (!users.fields.getByName('role')) {
      users.fields.add(
        new SelectField({
          name: 'role',
          values: ['Coordenador', 'Administrador'],
          maxSelect: 1,
          required: false,
        }),
      )
      app.save(users)
    }

    // 2. Collection configuracao_global
    try {
      app.findCollectionByNameOrId('configuracao_global')
    } catch (_) {
      const configCol = new Collection({
        name: 'configuracao_global',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != '' && @request.auth.role = 'Administrador'",
        updateRule: "@request.auth.id != '' && @request.auth.role = 'Administrador'",
        deleteRule: null,
        fields: [
          { name: 'semestre_letivo_atual', type: 'text', required: true },
          { name: 'minimo_exigido_semestre', type: 'number', required: true, onlyInt: true },
          { name: 'meta_curso', type: 'number', required: true, onlyInt: true },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
      })
      app.save(configCol)
    }

    // 3. Collection categorias
    try {
      app.findCollectionByNameOrId('categorias')
    } catch (_) {
      const catCol = new Collection({
        name: 'categorias',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != '' && @request.auth.role = 'Administrador'",
        updateRule: "@request.auth.id != '' && @request.auth.role = 'Administrador'",
        deleteRule: "@request.auth.id != '' && @request.auth.role = 'Administrador'",
        fields: [
          { name: 'nome', type: 'text', required: true },
          { name: 'regra_horas_unitaria', type: 'text', required: true },
          { name: 'teto_maximo_curso', type: 'number', required: true, onlyInt: true },
          { name: 'ativo', type: 'bool', required: false },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE INDEX idx_categorias_ativo ON categorias (ativo)'],
      })
      app.save(catCol)
    }

    // 4. Collection alunos
    try {
      app.findCollectionByNameOrId('alunos')
    } catch (_) {
      const alunosCol = new Collection({
        name: 'alunos',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        fields: [
          { name: 'matricula', type: 'text', required: true },
          { name: 'nome', type: 'text', required: true },
          {
            name: 'turno',
            type: 'select',
            required: true,
            values: ['Matutino', 'Noturno'],
            maxSelect: 1,
          },
          {
            name: 'semestre_atual',
            type: 'number',
            required: true,
            onlyInt: true,
            min: 1,
            max: 10,
          },
          { name: 'periodo_entrada', type: 'text', required: true },
          { name: 'email', type: 'text', required: true },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_alunos_matricula ON alunos (matricula)',
          'CREATE INDEX idx_alunos_nome ON alunos (nome)',
          'CREATE INDEX idx_alunos_turno ON alunos (turno)',
          'CREATE INDEX idx_alunos_periodo ON alunos (periodo_entrada)',
          'CREATE INDEX idx_alunos_semestre ON alunos (semestre_atual)',
        ],
      })
      app.save(alunosCol)
    }

    // 5. Collection lancamentos (immutable: no updateRule / deleteRule for users)
    try {
      app.findCollectionByNameOrId('lancamentos')
    } catch (_) {
      const alunos = app.findCollectionByNameOrId('alunos')
      const categorias = app.findCollectionByNameOrId('categorias')

      const lancamentosCol = new Collection({
        name: 'lancamentos',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: null,
        deleteRule: null,
        fields: [
          {
            name: 'aluno_id',
            type: 'relation',
            required: true,
            collectionId: alunos.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'categoria_id',
            type: 'relation',
            required: true,
            collectionId: categorias.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'data_lancamento', type: 'date', required: true },
          { name: 'semestre_letivo_atividade', type: 'text', required: true },
          { name: 'horas_aceitas', type: 'number', required: true, onlyInt: false },
          { name: 'comprovante_ok', type: 'bool', required: false },
          { name: 'relatorio_ok', type: 'bool', required: false },
          { name: 'observacao', type: 'text', required: false },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_lancamentos_aluno_cat ON lancamentos (aluno_id, categoria_id)',
          'CREATE INDEX idx_lancamentos_created ON lancamentos (created)',
          'CREATE INDEX idx_lancamentos_semestre ON lancamentos (semestre_letivo_atividade)',
        ],
      })
      app.save(lancamentosCol)
    }
  },
  (app) => {
    try {
      const lancamentos = app.findCollectionByNameOrId('lancamentos')
      app.delete(lancamentos)
    } catch (_) {}
    try {
      const alunos = app.findCollectionByNameOrId('alunos')
      app.delete(alunos)
    } catch (_) {}
    try {
      const categorias = app.findCollectionByNameOrId('categorias')
      app.delete(categorias)
    } catch (_) {}
    try {
      const config = app.findCollectionByNameOrId('configuracao_global')
      app.delete(config)
    } catch (_) {}
  },
)
