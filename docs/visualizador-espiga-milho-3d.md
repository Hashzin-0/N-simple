# Visualizador 3D da espiga de milho

O componente `components/CornEar3DVisualizer.tsx` usa uma malha procedural própria em Three.js. Não depende de um GLB externo, de uma imagem de referência incorporada ou de um modelo de fabricante.

## Aparência e geometria

- Sabugo central com perfil cônico irregular e extremidades afiladas.
- Grãos instanciados individualmente a partir de uma geometria de perfil arredondado, com base estreita e cor dourada variável.
- Fileiras distribuídas ao redor do sabugo e grãos alternados entre fileiras para evitar alinhamento rígido.
- Palhas verdes sobrepostas na base, com nervura central.
- Estigmas/sed as finas na ponta e pequeno pedúnculo.
- Iluminação hemisférica, luz principal, preenchimento e luz de recorte; materiais foscos para evitar aparência plástica.

## Correspondência com a calculadora

A malha é reconstruída quando `rows` ou `kernelsPerRow` mudam. O número de instâncias é exatamente `rows × kernelsPerRow`, após conversão para inteiros não negativos. Não há mínimo artificial de fileiras ou grãos. Quando um dos valores é zero, a espiga permanece sem grãos correspondentes.

O contador de grãos exibido usa `totalKernels`, recebido da calculadora. A renderização é apenas uma representação visual dos valores informados e não altera as fórmulas agronômicas.

## Interação e recursos

- Arraste com mouse ou toque para girar a espiga.
- Rotação automática lenta; acelera quando o alarme visual está ativo.
- Usa o `useWebGLManager` já existente e o componente `WebGLFallback` em dispositivos sem WebGL ou com contexto perdido.
- Usa `InstancedMesh` para manter o custo de desenho baixo mesmo com centenas de grãos.
- Desconecta o `ResizeObserver`, cancela o `requestAnimationFrame`, libera geometrias/materiais e devolve o renderer ao gerenciador no unmount.

## Limitação didática

É uma espiga procedural ilustrativa, não uma digitalização de cultivar específica. A forma, cor e disposição representam visualmente os parâmetros fileiras × grãos por fileira; não substituem avaliação de campo, classificação de grãos ou validação de cultivar.
