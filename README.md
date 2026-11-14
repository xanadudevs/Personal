# Miúdos 2026

App web-mobile (instalável) com o calendário de com quem ficam os miúdos:
semana, próximos períodos, estatísticas, lista para a troca, ano completo, e
alteração de dias e notas **sem iniciar sessão**.

## Acesso
Chave partilhada em `MIUDOS_TOKEN`. Abre uma vez `https://<dominio>/?token=<chave>`
no telemóvel: a chave fica guardada no dispositivo e sai do endereço. Depois,
"Adicionar ao ecrã principal". Quem tiver a chave vê e altera os dias.

## Deploy (grátis)
1. Cria um projeto no [Supabase](https://supabase.com) e copia `DATABASE_URL` e `DIRECT_URL` (ver `.env.example`).
2. Importa este repositório na [Vercel](https://vercel.com) e define `DATABASE_URL`, `DIRECT_URL` e `MIUDOS_TOKEN`.
3. O build cria a tabela `MiudosDay` sozinho.

## Dados
Calendário base em `src/lib/miudosData.ts` (folha "Miudos – Rita e Bruno 2026 v4").
As alterações ficam em `MiudosDay` e sobrepõem o base; "Repor original" apaga a
alteração do dia. Notas novas ficam marcadas "(atualização manual)".

API: `GET /api/miudos`, `PUT|DELETE /api/miudos/AAAA-MM-DD`, com o cabeçalho `x-miudos-token`.

## Estado
Primeiro deploy na Vercel.
