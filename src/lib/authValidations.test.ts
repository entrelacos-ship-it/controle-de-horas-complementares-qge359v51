import { validarFormularioRedefinicao } from '../pages/ResetPassword'
import { validarTokenVerificacao } from '../pages/VerifyEmail'

export function executarTestesAuth(): { todosPassaram: boolean; resultados: string[] } {
  const resultados: string[] = []

  // CT-AUTH-01: Validação de token ausente na redefinição de senha
  const r1 = validarFormularioRedefinicao('', 'senhaSegura123', 'senhaSegura123')
  if (!r1.valido && r1.erro?.includes('Token')) {
    resultados.push('CT-AUTH-01: Rejeição de token ausente na redefinição passou.')
  } else {
    throw new Error('CT-AUTH-01 falhou: deveria rejeitar token ausente')
  }

  // CT-AUTH-02: Validação de tamanho mínimo de senha (mínimo 8 caracteres)
  const r2Curta = validarFormularioRedefinicao('token_valido_123', '1234567', '1234567')
  const r2Exata = validarFormularioRedefinicao('token_valido_123', '12345678', '12345678')
  if (!r2Curta.valido && r2Curta.erro?.includes('8 caracteres') && r2Exata.valido) {
    resultados.push('CT-AUTH-02: Validação de mínimo 8 caracteres de senha passou.')
  } else {
    throw new Error('CT-AUTH-02 falhou: validação de comprimento de senha incorreta')
  }

  // CT-AUTH-03: Validação de senhas divergentes
  const r3 = validarFormularioRedefinicao('token_valido_123', 'senhaNova123', 'senhaDiferente456')
  if (!r3.valido && r3.erro?.includes('não são iguais')) {
    resultados.push('CT-AUTH-03: Rejeição de confirmação de senha diferente passou.')
  } else {
    throw new Error('CT-AUTH-03 falhou: deveria rejeitar senhas divergentes')
  }

  // CT-AUTH-04: Sucesso com dados válidos na redefinição de senha
  const r4 = validarFormularioRedefinicao('token_valido_123', 'senhaForte@2026', 'senhaForte@2026')
  if (r4.valido && !r4.erro) {
    resultados.push('CT-AUTH-04: Validação positiva de formulário de redefinição passou.')
  } else {
    throw new Error('CT-AUTH-04 falhou: formulário com dados válidos deveria ser aceito')
  }

  // CT-AUTH-05: Validação de token de verificação de e-mail (ausente/vazio vs presente)
  const v1 = validarTokenVerificacao('')
  const v2 = validarTokenVerificacao(null)
  const v3 = validarTokenVerificacao(undefined)
  const v4 = validarTokenVerificacao('token_confirmacao_pb_456')
  if (!v1.valido && !v2.valido && !v3.valido && v4.valido) {
    resultados.push('CT-AUTH-05: Validação de token na confirmação de e-mail passou.')
  } else {
    throw new Error('CT-AUTH-05 falhou: validação de token de verificação incorreta')
  }

  return { todosPassaram: true, resultados }
}
