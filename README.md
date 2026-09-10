# INVENTUM 2026 — Dashboard de operação

Painel para a equipe da INVENTUM acompanhar e editar a programação (atividades, frentes de atuação, demandas de entidades parceiras e pendências), com dado compartilhado em tempo real entre todos.

## Como funciona

- **Banco de dados**: [Supabase](https://supabase.com) (Postgres hospedado, plano grátis é suficiente).
- **Login**: conta Google individual (Supabase Auth), restrito a e-mails `@patobranco.tec.br`.
- **Hospedagem**: [Vercel](https://vercel.com) (plano grátis).
- O app roda 100% no navegador — não existe servidor próprio em produção. Toda leitura/escrita conversa direto com o Supabase.

---

## 1. Criar o banco (Supabase)

1. Crie uma conta em https://supabase.com e clique em **New project**.
2. Escolha um nome (ex.: `inventum-dashboard`), defina uma senha de banco (guarde-a, mas ela não é usada pelo app) e a região mais próxima.
3. Aguarde o projeto ficar pronto (1-2 minutos).
4. No menu lateral, abra **SQL Editor** → **New query**.
5. Cole todo o conteúdo do arquivo [`supabase/schema.sql`](./supabase/schema.sql) deste repositório e clique em **Run**.
6. Abra uma nova query, cole todo o conteúdo de [`supabase/seed.sql`](./supabase/seed.sql) e clique em **Run**. Isso importa as 58 atividades, 8 entidades e 10 pendências da planilha original.
7. Vá em **Project Settings → API**. Você vai precisar de dois valores:
   - **Project URL** → vira `VITE_SUPABASE_URL`
   - **anon public key** → vira `VITE_SUPABASE_ANON_KEY`
8. Se o projeto Supabase já existia **antes** desta atualização (colunas de prazo/edição e login individual), abra **SQL Editor → New query**, cole o conteúdo de [`supabase/migrations/002_prazo_auth_audit.sql`](./supabase/migrations/002_prazo_auth_audit.sql) e rode uma única vez.

## 2. Configurar login com Google

1. No [Google Cloud Console](https://console.cloud.google.com/apis/credentials), crie um **OAuth Client ID** do tipo **Web application**. Em "Authorized redirect URIs", adicione:
   `https://<PROJECT_REF>.supabase.co/auth/v1/callback` (o `PROJECT_REF` está na Project URL do Supabase, ex.: `xxxxx.supabase.co`).
2. No painel do Supabase, vá em **Authentication → Providers → Google**, habilite e cole o **Client ID** e o **Client Secret** gerados no passo anterior.
3. Ainda em **Authentication → URL Configuration**, adicione em **Redirect URLs** a URL de produção (ex.: `https://inventum-dashboard.vercel.app`) e, para testar localmente, `http://localhost:5173`.
4. O acesso já vem restrito no código a e-mails `@patobranco.tec.br` (tela de login barra e desloga automaticamente qualquer outro domínio, e o banco também recusa gravações de fora desse domínio). Para liberar outro domínio, troque o valor em `client/src/components/AuthGate.tsx` (`ALLOWED_DOMAIN`) e nas policies do `supabase/schema.sql`.

## 3. Rodar localmente

1. Instale as dependências (uma vez):
   ```
   pnpm install
   ```
2. Copie `.env.example` para `.env` e preencha:
   ```
   VITE_SUPABASE_URL=https://xxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```
3. Rode:
   ```
   pnpm dev
   ```
4. Abra o endereço mostrado no terminal, entre com uma conta Google `@patobranco.tec.br` e confira se os dados aparecem.

## 4. Publicar na Vercel (para o resto da equipe acessar)

Duas formas — escolha a que preferir:

### Opção A — via GitHub (recomendado, deploy automático a cada mudança)
1. Suba este projeto para um repositório no GitHub (crie o repo em https://github.com/new e siga as instruções de `git init` / `git push` que o GitHub mostra).
2. Em https://vercel.com, clique **Add New → Project** e importe esse repositório.
3. A Vercel detecta o `vercel.json` automaticamente (build command e pasta de saída já configurados).
4. Em **Environment Variables**, adicione as mesmas 2 chaves do `.env`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Clique **Deploy**. Em ~1 minuto você recebe uma URL pública (ex.: `inventum-dashboard.vercel.app`) — lembre de adicionar essa URL em **Authentication → URL Configuration → Redirect URLs** no Supabase (passo 2 acima) antes de compartilhar com a equipe.
6. Qualquer novo `git push` na branch principal atualiza o site sozinho.

### Opção B — direto do computador, sem GitHub
1. Instale a CLI da Vercel: `pnpm add -g vercel`
2. Rode `vercel login` e siga o login pelo navegador.
3. Na pasta do projeto, rode `vercel` (primeira vez configura o projeto) e depois `vercel --prod` para publicar.
4. Quando perguntado por env vars, informe as mesmas 2 chaves acima (ou configure depois em vercel.com → seu projeto → Settings → Environment Variables e rode `vercel --prod` de novo).

## Uso do dia a dia pela equipe

- Qualquer pessoa com conta Google `@patobranco.tec.br` pode entrar, ver e editar.
- **Frentes** (aba "Frentes"): criar, renomear, recolorir, reordenar ou excluir uma frente de atuação (ex.: "Competições e Caravanas", "INFRA"). Excluir uma frente não apaga as atividades, só remove a associação.
- Ao criar/editar uma atividade, dá pra criar uma frente nova sem sair do formulário (opção "+ nova frente…" no seletor).
- **Prazo**: atividades e pendências têm um campo de prazo editável. O sino no topo mostra os prazos vencidos ou que vencem nos próximos 3 dias, com opção de filtrar "Somente minhas" (compara com o campo Responsável da atividade).
- Cada atividade/pendência mostra a foto de quem fez a última edição (avatar da conta Google).
- Edições de qualquer pessoa aparecem nas telas dos demais automaticamente (alguns segundos), sem precisar recarregar a página.
- **Exportar CSV / Exportar backup (JSON)**: continuam funcionando como cópia de segurança manual.
- **Importar backup**: importa um JSON exportado anteriormente, atualizando os registros existentes (por id) e adicionando os novos.

## Estrutura relevante

```
supabase/schema.sql                     - tabelas + policies (rodar 1x no Supabase)
supabase/seed.sql                       - dados da planilha original (rodar 1x, depois do schema)
supabase/migrations/002_prazo_auth_audit.sql - migração p/ projetos já existentes
client/src/lib/supabaseClient.ts        - conexão com o Supabase
client/src/lib/useInventumData.ts       - leitura/escrita + tempo real
client/src/contexts/AuthContext.tsx     - sessão do usuário (Supabase Auth)
client/src/components/AuthGate.tsx      - tela de login com Google
client/src/pages/Home.tsx               - o dashboard em si
```
