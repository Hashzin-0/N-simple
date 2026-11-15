# Pesquisa técnica — fontes de dados agropecuários e meteorológicos

> Escopo da issue #34. Este documento distingue APIs públicas, bases para download, portais de consulta e serviços licenciados. A existência de uma página pública não significa que exista uma API pública ou autorização para scraping.

## 1. Diagnóstico do N-simple

Classificação baseada no código e nos fluxos encontrados:

- **Educação e pesquisa científica — confirmada:** cursos, tutor, quizzes, pesquisa bibliográfica, referências ABNT e calculadoras técnicas.
- **IA, RAG e voz — confirmada:** Gemini Live, tools/function calling, busca semântica e serviços de pesquisa.
- **Geoespacial/localização — confirmada no fluxo meteorológico:** a tool `consultarPrevisaoTempo` resolve cidades, solicita geolocalização do aparelho e consulta Open-Meteo.
- **Painéis de dados configuráveis — não demonstrada:** existem cards e seções, mas não foi identificado um workspace configurável com widgets persistidos. Não introduzir essa arquitetura sem necessidade.

O fluxo meteorológico existente está implementado em `hooks/useGeminiLiveAgent.ts` e faz geocodificação e chamadas HTTP diretamente no hook do agente de voz. A extensão visual deve reutilizar esse comportamento por meio de um serviço compartilhado, sem criar uma segunda implementação independente.

## 2. Matriz das fontes

| Fonte | Dados disponíveis | Granularidade e atualização | Acesso e restrições | Uso recomendado |
|---|---|---|---|---|
| **IBGE / SIDRA / Agregados v3** | Produção agrícola municipal (PAM), pecuária municipal (PPM), área, quantidade produzida, rendimento, efetivos de rebanhos, preço médio anual e valor da produção | Predominantemente anual; permite consultar Brasil, UF e municípios conforme a pesquisa | APIs oficiais públicas; os códigos de tabelas, variáveis, períodos, classificações e níveis geográficos devem ser descobertos pelos metadados | Painel de produção por município, cultura, ano e unidade geográfica |
| **CEPEA / ESALQ-USP** | Indicadores de preços e séries históricas de grãos, pecuária, sucroenergéticos, fibras, citros, café e outros mercados | Depende do indicador: diário, semanal, quinzenal ou mensal; muitos indicadores são regionais, não municipais | Há serviços oficiais de API por módulos e contratação/licença. O regulamento informa limite de 50 requisições/minuto e atualização diária dos dados da API após o fechamento, realizado depois das 19h. As condições do contrato e da licença precisam ser confirmadas para o produto contratado | Preços de referência e séries históricas, somente após obter documentação, credenciais e licença adequadas |
| **CONAB — Preços Agropecuários** | Preços médios semanais e mensais de produtos agrícolas, da sociobiodiversidade e da pesca; diferentes níveis de comercialização e localidades | Consulta pública informa dados desde 2014 e limita o período a quatro semanas por consulta | A página de consulta permite reprodução com citação da fonte e informa que é proibida a comercialização das informações. Não foi confirmada documentação pública de API para consumo automatizado | Comparação de preços regionais, condicionada à análise de uso/licença do N-simple; priorizar exportação ou canal oficial documentado |
| **CONAB — Portal de Informações** | Séries de safra de grãos, área, produção, produtividade, preços, custos de produção, rentabilidade, preço mínimo, oferta e demanda | Varia conforme o painel e o conjunto de dados | O portal lista painéis públicos. A disponibilidade de um painel não comprova a existência de API pública estável; não fazer engenharia reversa de endpoints internos do Pentaho | Referência e links para painéis oficiais; integração estruturada somente quando houver arquivo/API oficial documentado |
| **Banco Central — SGS / BCData** | Séries macroeconômicas e financeiras, como câmbio, Selic, inflação e taxas de juros | Diária, mensal ou outra periodicidade definida pela série | Serviços automatizados oficiais com recursos JSON/CSV. Cada série possui código, unidade, periodicidade e cobertura próprios | Contextualizar custos, câmbio, inflação e juros; não apresentar como cotação de commodity |
| **Comex Stat / MDIC** | Exportações e importações brasileiras por NCM/produto, país, UF, via, período e outros filtros; valor FOB, peso líquido e quantidade estatística | Mensal; dados gerais desde 1997. A base em dados abertos é disponibilizada em CSV | Sistema oficial e dados abertos para download. A consulta pode ser detalhada; consultas muito extensas devem usar as bases abertas | Comércio exterior, fluxo de exportação/importação e participação de produtos e destinos; não é preço recebido pelo produtor |
| **AgroStat Brasil / MAPA** | Comércio exterior do agronegócio por países, blocos, UF, produtos, setores e períodos | Atualização mensal | Portal oficial de estatísticas do agronegócio. O acesso automatizado deve seguir a documentação e o cadastro aplicáveis; não presumir API aberta | Complementar Comex Stat com a classificação setorial própria do agronegócio |
| **Dados Abertos MAPA** | Agrofit, ZARC, sementes e mudas, registros e outros conjuntos disponibilizados em CSV/PDF/XLSX | Depende do dataset | Catálogo público com documentação de API do portal de dados abertos; a disponibilidade de cada conjunto varia | Dados regulatórios e técnicos complementares; não substitui séries de preço |
| **Open-Meteo** | Previsão horária/diária, temperatura, precipitação, probabilidade de chuva, vento, radiação, evapotranspiração e variáveis de solo; APIs históricas | Previsão de até 16 dias; reanálise histórica desde 1940, conforme o produto | API gratuita sem chave apenas para uso não comercial, com limite publicado de 10.000 chamadas/dia, 5.000/hora e 600/minuto. Uso comercial exige plano pago. Os dados são CC BY 4.0 e exigem atribuição | Extensão meteorológica, desde que o modelo de uso do N-simple esteja compatível com a licença ou seja contratado plano comercial |

## 3. Observações técnicas por fonte

### 3.1 IBGE: produção por município

Pontos de entrada oficiais:

- Documentação Agregados v3: https://servicodados.ibge.gov.br/api/docs/agregados?versao=3
- API Agregados: https://servicodados.ibge.gov.br/api/v3/agregados
- SIDRA: https://sidra.ibge.gov.br/
- API SIDRA: https://apisidra.ibge.gov.br/

Fluxo de consulta recomendado:

1. Descobrir o agregado/pesquisa pelo catálogo e metadados.
2. Consultar metadados, variáveis, classificações, períodos e níveis geográficos disponíveis.
3. Descobrir códigos de municípios pela API de Localidades do IBGE, em vez de manter uma lista estática no frontend.
4. Validar se a pesquisa oferece nível municipal e se o período está publicado.
5. Consultar apenas as variáveis e localidades necessárias.
6. Preservar unidade, período de referência, nome da variável, classificação e fonte no resultado.

**Importante:** PAM/PPM são estatísticas anuais de produção e estrutura agropecuária. Algumas variáveis incluem preço médio anual e valor da produção, mas isso não equivale a uma cotação diária ou preço spot. Não misturar produção/preço médio anual do IBGE com cotações diárias ou semanais do CEPEA/CONAB como se tivessem a mesma periodicidade.

Não fixar IDs de tabelas ou variáveis sem confirmar os metadados atuais. O catálogo deve ser a fonte de verdade para os códigos aceitos.

### 3.2 CEPEA: preço de referência e licenciamento

Pontos de entrada oficiais:

- Indicadores: https://www.cepea.org.br/br/indicadores/
- Produtos e serviços de API: https://onetoone.cepea.org.br/docs/api
- Regulamento de contratação da API: https://onetoone.cepea.org.br/termocontratacao-regulamentoapi/

O catálogo oficial apresenta módulos de API para grãos, pecuária, sucroenergéticos, citros/café e pacote completo. O regulamento informa limite de 50 requisições por minuto e que a atualização dos dados da API ocorre uma vez ao dia, após as 19h.

A página pública dos indicadores informa licença CC BY-NC 4.0. A licença e as permissões do produto de API contratado devem ser verificadas separadamente no contrato aplicável. Não assumir que a licença de uma página pública autoriza redistribuir séries completas em outro produto.

**Bloqueio para integração real:** não foi encontrada documentação técnica pública suficiente para determinar o endpoint autenticado, o formato de resposta e os campos de credencial do módulo contratado. Não inventar endpoint, token ou schema. Para implementar, é necessário obter a documentação de integração e a licença/contrato do módulo que será utilizado. A chave deverá ficar exclusivamente no servidor.

Também não presumir que todo indicador CEPEA tem cotação por município. Muitos indicadores representam praças ou regiões específicas. O filtro geográfico deve refletir a praça real publicada pela fonte.

### 3.3 CONAB: preços e produção

Pontos de entrada oficiais:

- Consulta de preços de mercado: https://consultaprecosdemercado.conab.gov.br/
- Portal de Informações: https://portaldeinformacoes.conab.gov.br/
- Preços agropecuários: https://www.gov.br/conab/pt-br/atuacao/informacoes-agropecuarias/precos-agropecuarios

A consulta de preços informa cobertura a partir de 2014, consultas semanais/mensais e limite de quatro semanas por consulta. A própria página autoriza reprodução com citação da CONAB e proíbe comercialização das informações disponibilizadas.

O Portal de Informações lista painéis públicos para preço agropecuário semanal/mensal, série histórica de safra de grãos, custo de produção, comparativo de rentabilidade, preço mínimo e outros. Não foi confirmada uma API pública e estável para todos esses painéis.

**Decisão:** usar os canais oficiais de consulta/download e solicitar documentação de integração quando necessário. Não extrair dados de endpoints internos do Pentaho, não contornar autenticação e não tratar URLs internas como contrato público de API.

### 3.4 Banco Central: indicadores macroeconômicos

Pontos de entrada oficiais:

- Webservices do BCB: https://www.bcb.gov.br/gestao_site/webservices.asp?frame=1
- Portal de Dados Abertos: https://dadosabertos.bcb.gov.br/
- SGS: https://www3.bcb.gov.br/sgspub/

O SGS disponibiliza recursos automatizados em JSON e CSV. A integração deve armazenar o código da série, unidade, periodicidade, data de referência e metadados. Câmbio, inflação e juros podem contextualizar custos e rentabilidade, mas não devem ser rotulados como preços agrícolas.

### 3.5 Comex Stat e AgroStat: comércio exterior

Pontos de entrada oficiais:

- Comex Stat: https://comexstat.mdic.gov.br/pt/home
- FAQ MDIC: https://www.gov.br/mdic/pt-br/assuntos/comercio-exterior/estatisticas/perguntas-frequentes-faq/4-como-realizar-consultas
- AgroStat: https://sistemasweb.agricultura.gov.br/pages/AGROSTAT.html
- Estatísticas de comércio exterior do MAPA: https://www.gov.br/agricultura/pt-br/assuntos/relacoes-internacionais/estatisticas-de-comercio-exterior

Comex Stat publica dados mensais desde 1997 e permite detalhar por NCM, país, UF, via de transporte e outros atributos. O portal informa que a base completa também fica disponível em dados abertos CSV. As métricas incluem valor FOB, peso líquido e quantidade estatística.

AgroStat oferece recorte próprio do agronegócio e atualização mensal. Não confundir valor FOB de exportação com preço pago ao produtor, preço spot ou indicador CEPEA.

### 3.6 Meteorologia: Open-Meteo e o fluxo já existente

Documentação e termos:

- Forecast API: https://open-meteo.com/en/docs
- Historical Weather API: https://open-meteo.com/en/docs/historical-weather-api
- Termos: https://open-meteo.com/en/terms
- Preços/licença comercial: https://open-meteo.com/en/pricing
- Licença dos dados: https://open-meteo.com/en/licence

O hook do agente global já consulta geocodificação e previsão Open-Meteo. A nova interface deve consumir um serviço compartilhado com o agente de voz, não duplicar a lógica no componente.

Variáveis úteis para o painel agronômico, após validação do endpoint e do modelo escolhido:

- temperatura atual e máximas/mínimas;
- precipitação acumulada e probabilidade de precipitação;
- velocidade do vento;
- umidade relativa;
- evapotranspiração de referência (ET₀);
- umidade e temperatura do solo, quando disponíveis no modelo.

Exibir sempre local, coordenada aproximada/grade utilizada quando relevante, horário de atualização, unidade, fonte e período da previsão. Previsão meteorológica não é garantia de ocorrência.

**Decisão de licença:** antes de ampliar chamadas, confirmar se o uso do N-simple é não comercial. A licença gratuita não permite uso comercial; em produto comercial é necessário contratar plano. A atribuição CC BY 4.0 deve aparecer no painel.

## 4. Arquitetura proposta para a issue #33

### 4.1 Camada de provedores

Criar adapters de servidor por fonte, com contratos TypeScript comuns e validação na fronteira:

- `lib/agro-data/types.ts`: séries normalizadas, unidades, localidade, período, fonte e licença.
- `lib/agro-data/ibge.ts`: descoberta de metadados e consultas SIDRA/Agregados.
- `lib/agro-data/conab.ts`: apenas endpoints/arquivos oficiais documentados e permitidos.
- `lib/agro-data/cepea.ts`: adapter bloqueado até receber documentação e credenciais do módulo contratado.
- `lib/agro-data/bcb.ts`: séries SGS selecionadas e metadados.
- `lib/agro-data/comexstat.ts`: downloads oficiais ou integração documentada para dados abertos.
- `lib/weather/openMeteo.ts`: serviço meteorológico compartilhado com o agente de voz.

Os componentes React não devem montar URLs de provedores nem acessar APIs externas diretamente. As rotas Next.js validam os parâmetros, aplicam limites e chamam os adapters.

### 4.2 Modelo normalizado

Cada observação deve preservar, no mínimo:

- provedor e identificador do indicador;
- produto/cultura ou série;
- localidade, código IBGE e nível geográfico;
- valor, moeda e unidade de medida;
- início/fim do período de referência;
- data de publicação/atualização da fonte e data de coleta;
- URL da fonte, licença e atribuição exigida.

Não agregar séries com unidades, períodos, praças ou níveis geográficos diferentes sem conversão e regra explícita. Valores ausentes não são zero.

### 4.3 Filtros geográficos

- Usar código IBGE como identificador canônico do município.
- Descobrir municípios pela API oficial de Localidades, sem listas manuais.
- Cada indicador informa seus níveis geográficos disponíveis.
- Se a fonte publicar somente praça/região/UF, mostrar esse nível e não simular preço municipal.
- Geocodificação meteorológica e localização de estatísticas municipais são conceitos distintos; não usar coordenadas do tempo como substituto do código municipal.

### 4.4 Cache, resiliência e segurança

- Definir timeout, tamanho máximo de resposta e retry limitado por provedor.
- Repetir apenas falhas transitórias (429/5xx/timeouts), respeitando `Retry-After` e limites contratuais.
- Cachear conforme periodicidade da fonte; armazenar `fetchedAt` e `referencePeriod` para não apresentar dado antigo como atual.
- Aplicar rate limit às rotas do N-simple e evitar chamadas por tecla digitada.
- Validar códigos de município, produtos, datas e séries com allowlists/metadados.
- Manter tokens e chaves exclusivamente no servidor. Não usar prefixo `NEXT_PUBLIC_` para credenciais.
- Não persistir coordenadas exatas ou histórico de localização sem necessidade e consentimento.
- Exibir estado de carregamento, ausência de dados, fonte indisponível, limite de uso e dados desatualizados separadamente.

### 4.5 Estratégia de cache sugerida

Os TTLs finais devem refletir a periodicidade real e o cabeçalho/metadata do provedor:

| Fonte | Ponto de partida | Regra |
|---|---:|---|
| Geocodificação de município | 30 dias | Cache por consulta normalizada/código IBGE |
| Previsão meteorológica | 20–30 min | Cache por coordenadas arredondadas e conjunto de variáveis |
| IBGE PAM/PPM | 7 dias ou mais | Invalidar quando houver nova publicação/período |
| CEPEA | Até a próxima atualização publicada | Respeitar fechamento diário, contrato e limite de chamadas |
| CONAB | 12–24 h | Ajustar à frequência semanal/mensal e restrições da fonte |
| BCB SGS | 6–24 h | Ajustar à periodicidade da série |
| Comex Stat/AgroStat | 24 h ou mais | Dados mensais; verificar data da última carga |

Cache não substitui a data de referência da fonte.

## 5. Sequência de implementação

1. **Meteorologia:** extrair o serviço Open-Meteo existente do hook de voz para módulo compartilhado; criar rota validada e painel visual que reutilize o mesmo serviço.
2. **IBGE:** construir descoberta de municípios/metadados e painel de produção PAM/PPM com período e nível geográfico explícitos.
3. **CONAB:** integrar somente conjuntos/arquivos oficiais cujo uso esteja permitido; identificar a restrição de não comercialização antes de exibir dados.
4. **CEPEA:** ativar o adapter após receber documentação técnica, contrato/licença e credenciais do módulo.
5. **Indicadores complementares:** adicionar BCB (macro) e Comex Stat/AgroStat (comércio exterior), mantendo seus conceitos separados de preço de mercado.

## 6. Bloqueios e decisões necessárias

- **CEPEA:** fornecer documentação técnica da API do módulo contratado e confirmar o escopo da licença. Sem isso, manter apenas link para a fonte oficial; não inventar endpoint nem fazer scraping.
- **Open-Meteo:** confirmar que o uso do N-simple se enquadra em não comercial; caso contrário, contratar plano comercial antes de ampliar o uso.
- **CONAB:** validar que o uso pretendido respeita a proibição de comercialização das informações e solicitar canal/API oficial se a integração automatizada for necessária.
- **Comex Stat/AgroStat:** preferir dados abertos e documentação oficial; não depender de endpoints internos da interface web.

## 7. Critérios de aceite para as integrações

- [ ] Cada valor exibido identifica fonte, unidade, localidade e período de referência.
- [ ] Estatísticas anuais do IBGE não são misturadas com cotações diárias.
- [ ] Indicadores regionais CEPEA não são apresentados como preço municipal.
- [ ] CONAB/CEPEA só são exibidos dentro das licenças aplicáveis.
- [ ] Chaves privadas permanecem no servidor.
- [ ] Timeout, 429, 5xx, resposta inválida, vazio e cache desatualizado têm estados distintos.
- [ ] O painel meteorológico e a tool de voz compartilham o mesmo serviço.
- [ ] Não há dados simulados apresentados como dados reais.

## 8. Fontes oficiais consultadas

- IBGE — https://servicodados.ibge.gov.br/api/docs/agregados?versao=3
- CEPEA — https://onetoone.cepea.org.br/docs/api
- CEPEA — https://onetoone.cepea.org.br/termocontratacao-regulamentoapi/
- CONAB — https://consultaprecosdemercado.conab.gov.br/
- CONAB — https://portaldeinformacoes.conab.gov.br/
- Banco Central — https://www.bcb.gov.br/gestao_site/webservices.asp?frame=1
- Comex Stat — https://comexstat.mdic.gov.br/pt/home
- MDIC — https://www.gov.br/mdic/pt-br/assuntos/comercio-exterior/estatisticas/perguntas-frequentes-faq/4-como-realizar-consultas
- MAPA/AgroStat — https://sistemasweb.agricultura.gov.br/pages/AGROSTAT.html
- MAPA — https://dados.agricultura.gov.br/dataset
- Open-Meteo — https://open-meteo.com/en/docs
- Open-Meteo Terms — https://open-meteo.com/en/terms
- Open-Meteo Pricing — https://open-meteo.com/en/pricing
