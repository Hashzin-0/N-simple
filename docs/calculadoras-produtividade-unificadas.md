# Centralização das calculadoras de produtividade

## Interface

A aba principal `productivity` agora monta `components/ProductivityHub.tsx`. O hub mantém as nove culturas em subtabs e monta somente a calculadora da cultura selecionada:

1. Milho
2. Soja
3. Sorgo granífero
4. Trigo
5. Arroz
6. Feijão (grãos secos)
7. Girassol
8. Amendoim em casca
9. Cana-de-açúcar

A aba antiga separada de soja foi removida de `GooeyTabPanel`; a calculadora de soja permanece dentro do hub. As calculadoras existentes e seus motores de cálculo foram preservados.

## Geradores de atividades

O botão de prática monta o motor próprio da cultura:
- Milho: `CornProductivityGenerator` / `lib/cornProductivityGenerator.ts`.
- Soja: `SoybeanProductivityGenerator` / `lib/soybeanProductivityGenerator.ts`.
- Demais sete culturas: `OtherCropProductivityGenerator` / `lib/otherCropProductivityGenerator.ts`, com `fixedCrop` para travar o motor à subtab atual.

Os motores preservam níveis, quantidade, tolerância, hash anti-repetição e resolução que já existiam. A unificação é de navegação e composição, não uma fusão das fórmulas agronômicas.

## Visualização 3D

- Milho mantém `CornEar3DVisualizer`, com a espiga dinâmica baseada em fileiras × grãos por fileira.
- Soja e as sete culturas adicionais usam `ProductivityCrop3D`, uma cena Three.js procedural que reconstrói a estrutura visual a partir dos valores emitidos pela calculadora.
- Os componentes de cálculo emitem os valores de amostragem por `onValuesChange`; o hub encaminha os valores ao visualizador sem transferir a lógica de cálculo para o renderer.
- Os modelos adicionais são representações didáticas procedurais (vagens, panículas/espigas, capítulo e colmos), não digitalizações botânicas de cultivar específica nem modelos de fabricante.

## Arquitetura e preservação

- `app/page.tsx` continua orquestrando a aba e carrega o hub via `dynamic(..., { ssr: false })`.
- Fórmulas, conversões, fontes e resultados permanecem nos módulos de domínio já existentes.
- Nenhuma migration, alteração de schema, dependência ou segredo foi adicionado.
- O Three.js é reutilizado; o visualizador usa `useWebGLManager` e libera geometria/material/renderer ao desmontar.

## Validação pendente

A comparação de branch confirma os arquivos modificados, mas o conector GitHub não executa os comandos locais. Executar `npm run lint` e `npm run build` após checkout da branch, além de testar alternância entre as nove culturas, campos zerados/preenchidos, geradores e perda/restauração de contexto WebGL. Não tratar o deployment Vercel cancelado por Ignored Build Step como validação de build.
