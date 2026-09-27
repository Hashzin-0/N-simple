import 'dotenv/config';
import { CEFSA_MOODLE_URL, verifyCefsaCredentials } from '../lib/cefsa';

/**
 * Testa a verificação de aluno CEFSA direto contra o Moodle
 * (sem HTTP/Supabase) — é a "Fase 0" do gate do painel de admin.
 *
 * Uso:
 *   CEFSA_TEST_RA=<ra_ou_rm> CEFSA_TEST_SENHA=<senha> npx --yes tsx scripts/test-cefsa-verify.ts
 *
 * Saídas:
 *   exit 0 → credenciais aceitas (aluno ativo)
 *   exit 2 → credencial recusada / conta inativa / Moodle indisponível
 */
async function main(): Promise<void> {
  const ra = process.env.CEFSA_TEST_RA?.trim();
  const senha = process.env.CEFSA_TEST_SENHA;

  if (!ra || !senha) {
    console.error(
      'Defina CEFSA_TEST_RA e CEFSA_TEST_SENHA (não são impressas no console).\n' +
        'Ex.: CEFSA_TEST_RA=123456 CEFSA_TEST_SENHA=*** npx --yes tsx scripts/test-cefsa-verify.ts'
    );
    process.exit(1);
  }

  console.log(`Moodle: ${CEFSA_MOODLE_URL}`);
  const start = Date.now();
  const result = await verifyCefsaCredentials(ra, senha);
  const ms = Date.now() - start;

  if (result.ok) {
    const { identity } = result;
    console.log(`\nOK (${ms} ms) — aluno verificado no Moodle:`);
    console.log(`  username : ${identity.username}`);
    console.log(`  nome     : ${identity.fullName || '(não retornado)'}`);
    console.log(`  e-mail   : ${identity.email || '(função WS não liberada — NULL)'}`);
    console.log(`  userid   : ${identity.moodleUserId}`);
    console.log(`  site     : ${identity.siteUrl || CEFSA_MOODLE_URL}`);
    return;
  }

  console.error(`\nFALHOU (${ms} ms) — reason=${result.reason}`);
  if (result.detail) console.error(`  detail: ${result.detail}`);
  if (result.reason === 'moodle_service_disabled') {
    console.error('  → o service WS não está habilitado (CEFSA_MOODLE_SERVICE).');
  }
  if (result.reason === 'invalid_credentials') {
    console.error(
      '  → se a senha estiver correta, a conta é OIDC-only (login Microsoft) e o\n' +
        '    caminho local não serve — usar SSO/ADFS (caminho B do plano).'
    );
  }
  process.exitCode = 2;
}

void main();
