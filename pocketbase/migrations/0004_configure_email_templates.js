migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    const siteUrl = $os.getenv('SITE_URL') || ''

    // Ajusta o template de redefinição de senha para apontar para a rota do app
    const resetBaseUrl = siteUrl ? siteUrl.replace(/\/$/, '') : '{APP_URL}'
    users.resetPasswordTemplate = {
      subject: 'Redefinição de senha — Horas Complementares Psicologia FAUSP',
      body:
        '<p>Olá,</p>' +
        '<p>Recebemos uma solicitação para redefinir a sua senha de acesso ao sistema de Controle de Horas Complementares (Psicologia — FAUSP).</p>' +
        '<p><a class="btn" href="' +
        resetBaseUrl +
        '/redefinir-senha?token={TOKEN}" target="_blank" rel="noopener">Redefinir minha senha</a></p>' +
        '<p>Se você não solicitou esta alteração, por favor ignore esta mensagem com segurança.</p>' +
        '<p>Atenciosamente,<br>Coordenação do Curso de Psicologia — FAUSP</p>',
    }

    // Ajusta o template de verificação de e-mail institucional
    users.verificationTemplate = {
      subject: 'Confirmação de e-mail institucional — Horas Complementares Psicologia FAUSP',
      body:
        '<p>Olá,</p>' +
        '<p>Por favor, confirme seu endereço de e-mail institucional para o sistema de Controle de Horas Complementares (Psicologia — FAUSP):</p>' +
        '<p><a class="btn" href="' +
        resetBaseUrl +
        '/verificar-email?token={TOKEN}" target="_blank" rel="noopener">Confirmar meu e-mail</a></p>' +
        '<p>Se você não reconhece este cadastro, ignore este e-mail.</p>' +
        '<p>Atenciosamente,<br>Coordenação do Curso de Psicologia — FAUSP</p>',
    }

    app.save(users)
  },
  (app) => {
    // Revert opcional: não necessita ação destrutiva
  },
)
