# Arquitetura tecnica

## 1. Stack aprovada

| Camada                    | Tecnologia                                      |
| ------------------------- | ----------------------------------------------- |
| Frontend                  | React + TypeScript + Vite                       |
| Estilos                   | Tailwind CSS e componentes acessiveis           |
| Routing                   | React Router                                    |
| Estado remoto/cache       | TanStack Query                                  |
| Formularios               | React Hook Form + Zod                           |
| PWA                       | Manifest e service worker                       |
| Backend gerido            | Supabase Free                                   |
| Base de dados             | PostgreSQL                                      |
| Autenticacao              | Supabase Auth com adaptador de username         |
| Autorizacao               | Row Level Security e funcoes PostgreSQL         |
| Ficheiros                 | Supabase Storage, bucket privado de fotografias |
| Operacoes administrativas | Supabase Edge Functions                         |
| Testes                    | Vitest, Testing Library e Playwright            |
| Alojamento web            | Cloudflare Pages Free                           |
| Mobile futuro             | Capacitor                                       |

## 2. Razao da escolha web-first

O produto e dominado por formularios, listas, dashboards e operacoes de dados. React/Vite permite desenvolvimento rapido no browser em Windows e acesso direto aos mecanismos da web e de PWA.

O Capacitor sera acrescentado quando a versao web estiver estavel. A arquitetura deve evitar dependencias desnecessarias do browser que impossibilitem esse empacotamento, mas nao deve antecipar trabalho nativo.

## 3. Estrutura modular esperada

O frontend deve ser organizado por dominio e nao apenas por tipo tecnico:

- `auth`: login, sessao e mudanca de password;
- `admin`: equipas, epocas, utilizadores, planteis e fotografias;
- `fines`: catalogo, aplicacao e eliminacao de multas;
- `treasury`: liquidacao e reabertura;
- `dashboard`: saldos e historico pessoal;
- `leaderboard`: rankings;
- `shared`: design system, formatadores, erros e utilitarios.

As paginas nao devem conter diretamente regras financeiras ou de autorizacao. Essas regras pertencem a servicos de dominio e, nas operacoes privilegiadas, a funcoes protegidas na base de dados/Edge Functions.

## 4. Autenticacao por username

O Supabase Auth autentica password atraves de email ou telefone. A experiencia publica sera adaptada para username:

1. O Super Admin introduz username e password temporaria.
2. Uma Edge Function protegida gera um identificador de email tecnico, nao apresentado ao utilizador.
3. A Edge Function usa a Admin API do Supabase para criar a conta e associa-la ao perfil publico.
4. O login transforma deterministicamente o username normalizado no identificador tecnico e autentica com a password.
5. `must_change_password` bloqueia o resto da app ate a primeira mudanca de password.

Regras:

- usernames sao unicos globalmente e comparados sem distinguir maiusculas/minusculas;
- o username original pode ser apresentado no Admin, mas nao e mostrado no plantel;
- nao existe auto-registo;
- passwords temporarias devem ser distintas por utilizador;
- passwords nunca sao armazenadas nas tabelas publicas;
- uma password esquecida e reposta pelo Super Admin;
- qualquer chamada da Admin API usa uma chave secreta apenas no servidor.

## 5. Autorizacao

Esconder uma tab ou botao no frontend nao concede seguranca. Todas as operacoes devem ser novamente autorizadas no servidor/base de dados.

### Super Admin

- Validado atraves de `app_admins`.
- Pode gerir recursos globais e fotografias.
- A tabela nao e consultavel por membros normais.

### Membro de epoca

- So pode ler dados das epocas em que participa, salvo dados estritamente necessarios ao ranking da equipa.
- Ve o seu proprio historico detalhado.
- Nao altera o seu nome, tipo, numero, funcao, badges ou fotografia.

### Tesoureiro

- A permissao e sempre verificada na epoca da multa.
- Pode aplicar multas nessa epoca.
- Pode marcar/reabrir multas dessa epoca.
- Pode eliminar apenas multas nunca pagas dessa epoca.

As politicas RLS devem ser testadas para cada operacao `select`, `insert`, `update` e `delete`.

## 6. Operacoes atomicas

Devem ser funcoes transacionais e idempotentes, entre outras:

- criacao/copia de epoca;
- aplicacao de multa;
- liquidacao em lote de multas selecionadas;
- reabertura de multa;
- eliminacao autorizada de multa por pagar.

Um duplo toque ou repeticao de pedido nao pode duplicar multas ou registos de liquidacao.

## 7. Estrategia online e PWA

- A app e online-first.
- O shell e recursos estaticos podem ser colocados em cache.
- Dados de leitura podem usar cache de curta duracao.
- Aplicar, liquidar, reabrir ou eliminar multas exige ligacao ao servidor.
- Nao se enfileiram escritas financeiras offline no MVP.
- O service worker deve ter uma estrategia de atualizacao clara para evitar clientes presos em versoes antigas.

## 8. Fotografias

- Bucket privado no Supabase Storage.
- Apenas Super Admin tem permissao de escrita e remocao.
- A leitura e limitada aos utilizadores autenticados autorizados.
- Imagens sao redimensionadas/comprimidas antes do upload.
- Nao dependemos de transformacoes de imagem pagas.

## 9. Custos e limites

A arquitetura deve funcionar no nivel gratuito:

- Supabase Free para base de dados, Auth, Storage e Edge Functions;
- Cloudflare Pages Free para o frontend;
- URL gratuita inicialmente;
- sem SMTP, SMS ou servicos de pagamento;
- backups manuais, porque o nivel gratuito nao inclui backups automaticos;
- monitorizacao de armazenamento e atividade do projeto.

O nivel gratuito pode impor pausa por inatividade e nao oferece SLA. Se o uso real ultrapassar os limites ou exigir disponibilidade garantida, a mudanca de plano sera uma decisao futura explicita.

## 10. Seguranca minima

- HTTPS em todos os ambientes remotos.
- Chaves publicaveis no frontend apenas com RLS ativa.
- Chaves secretas apenas em Edge Functions/ambiente seguro.
- Password minima robusta e validacao da password atual na alteracao, quando suportado.
- Rate limiting e mensagens de login que nao facilitem enumeracao de utilizadores.
- Validacao Zod no cliente e validacao independente no servidor.
- Timestamps em UTC; apresentacao em `Europe/Lisbon`.
- Logs funcionais proprios para acoes relevantes, sem guardar passwords ou tokens.
