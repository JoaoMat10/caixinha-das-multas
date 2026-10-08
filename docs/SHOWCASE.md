# Espelho público anonimizado

Este repositório é uma versão de demonstração da **Caixinha das Multas**. O histórico técnico, a sequência de decisões, as datas e a estrutura de branches foram preservados, mas os dados identificáveis e os destinos operacionais foram substituídos antes da publicação.

## Garantias do espelho

- nomes de membros e usernames são fictícios;
- o clube e os dados de plantel representam uma organização de demonstração;
- referências Supabase, URLs de alojamento, UUIDs operacionais e emails técnicos são placeholders;
- o email pessoal do autor não integra os metadados publicados; a autoria usa o endereço `noreply` do GitHub;
- fotografias, credenciais locais, ficheiros de ambiente e artefactos de validação manual não fazem parte do histórico;
- os documentos em `docs/operacao/` são modelos de boas práticas e não constituem instruções para um ambiente real já existente.

## Executar num ambiente próprio

1. Criar um projeto Supabase dedicado.
2. Copiar `.env.example` para `.env.local`.
3. Preencher apenas as variáveis públicas indicadas no exemplo.
4. Aplicar as migrações versionadas e usar exclusivamente dados de demonstração.
5. Rever URLs, CSP e referências placeholder antes de qualquer deployment.

Nunca reutilizar identificadores demonstrativos como destino de operações remotas. Scripts de produção permanecem bloqueados por referências fictícias até serem deliberadamente adaptados a um ambiente próprio.

## Âmbito da anonimização

A reescrita abrangeu todas as referências Git locais do espelho. Depois da reescrita foram verificados todos os snapshots alcançáveis por nomes antigos, referências de infraestrutura, emails pessoais, JWTs e chaves administrativas. As datas de autoria e commit foram comparadas com o histórico de origem e permaneceram inalteradas.
