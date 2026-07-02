# PRD — FS Soluções · Manutenção Preditiva (SaaS Multi-Tenant)

## Problema Original
Software de manutenção preditiva (pt-BR) com: Login, Dashboard (KPIs + Índice de Saúde), Plantas (hierarquia), Máquinas com importação Excel (desdobrando subconjuntos), Análise de Vibração e Termografia, Biblioteca de Defeitos pesquisável e Diagnósticos (cards, histórico, banco). Evoluído para **arquitetura multi-tenant** (SaaS) com isolamento estrito de dados por cliente e papel Super-Admin.

## Arquitetura
- Backend: FastAPI monolítico (`/app/backend/server.py`), Motor/MongoDB, PyJWT + bcrypt, openpyxl, xhtml2pdf.
- Frontend: React SPA, Tailwind + Shadcn, Recharts, ReactMarkdown. Auth via cookie HttpOnly + Bearer (localStorage `fs_token`).
- Multi-tenant: `tenant_id` em machines, measurements, thermal, diagnostics, plant_nodes, deletion_logs, users. `defects` é GLOBAL/compartilhado.
- Escopo de tenant: super-admin envia header `X-Tenant-Id` (localStorage `fs_tenant`); usuários comuns são presos ao próprio `tenant_id`.

## Papéis
- superadmin (FS Soluções): cria/gerencia clientes e admins; opera dados de um cliente selecionado.
- admin (tenant): CRUD completo + gerencia usuários do próprio tenant.
- gestor / tecnico: edição. visualizador: somente leitura.

## Implementado (data: 02/07/2026)
- ✅ Multi-Tenant (P0): coleção `tenants`, papel superadmin, `tenant_id` em todas coleções escopadas, todas as queries filtradas por tenant, defects globais.
- ✅ Migração idempotente: dados existentes → tenant "SAUDALI ALIMENTOS" + cópia "FS SOLUÇÕES DEMO" (413 máquinas cada). Admin promovido a superadmin. Tenant-admins criados (admin@saudali.com, admin@fsdemo.com / demo123).
- ✅ Endpoints /api/tenants (GET/POST/DELETE, superadmin). POST /api/auth/register agora cria usuário escopado ao tenant (admin/superadmin, sem trocar sessão).
- ✅ Frontend: página Clientes (CRUD + Acessar), seletor de tenant no header (super-admin), banner de "selecione um cliente", nav condicional por papel. Login simplificado (sem cadastro público).
- ✅ Testado: iteration_13.json — 22/22 backend pytest, frontend E2E OK, isolamento e spoof-header validados.
- (Sessões anteriores) Dashboard, Plantas, Máquinas+import Excel, Vibração/Termografia (Tabela de Dados, tendência, templates), Biblioteca de Defeitos, Diagnósticos, Auditoria, Manual PDF (admin).

## Backlog / Roadmap
- [P1] Relatório Executivo e Completo em PDF (com logo da empresa no cabeçalho).
- [P1] Refatorar `server.py` (~1310 linhas) em routers modulares (auth, tenants, machines, measurements, thermal, defects, diagnostics, reports).
- [P2] Sugestão de defeitos por IA a partir de sintomas.
- [P2] Envio automático de relatórios completos por e-mail (agendado).
- [P2] Audit-log da exclusão de tenant; logo/branding por tenant.

## Credenciais
Ver `/app/memory/test_credentials.md`.
