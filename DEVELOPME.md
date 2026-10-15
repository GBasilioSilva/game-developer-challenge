# Plano de desenvolvimento — Pirate Battle

Este documento organiza a implementação do shooter naval em etapas passo a passo. 
A ordem prioriza primeiro regras confiáveis do jogo, depois sua representação visual, integração com a interface e, por fim, qualidade de entrega.

## Estado do projeto

A estrutura já inclui React, TypeScript estrito, PixiJS, TanStack Query, Axios, MSW, Vitest e Playwright. A simulação está em `src/game/engine.ts`, os testes unitários em `src/game/engine.test.ts` e a renderização em `src/game/GameCanvas.tsx`.

A engine já continha movimento, disparos, inimigos, colisões, pausa e encerramento em uma primeira versão. A Etapa 1 foi concluída para centralizar o balanceamento, corrigir regras de colisão, spawn, pontuação e encerramento, e ampliar a cobertura da simulação.

## Etapa 1 — Fechar e testar as regras da simulação

**Objetivo:** tornar a engine correta, configurável e testável sem depender de React ou PixiJS.
    
1. Implementar as regras ausentes e corrigir lacunas em `src/game/engine.ts`, usando os requisitos de gameplay do `README.md` como checklist.
2. Definir em `src/types/game.ts` os tipos para todos os parâmetros de balanceamento e estados necessários. Em `src/config.ts`, centralizar valores padrão, limites e validação. Manter na tela Options apenas as configurações que o desafio pede para o jogador alterar.
3. Substituir velocidades, vida, dano, alcance, cooldowns e durações embutidos na lógica por valores da configuração da partida. Criar um snapshot da configuração ao iniciar, para que mudanças posteriores afetem apenas novas partidas.
4. Verificar movimento frontal e reverso, rotação, limites da arena e colisão de navios com ilhas.
5. Verificar disparo frontal e salvas laterais, direção, cooldown, duração e remoção de projéteis por impacto, obstáculo ou saída da arena. Garantir que um projétil cause dano no máximo uma vez.
6. Completar os comportamentos de Chaser e Shooter, incluindo rotação, perseguição/aproximação, ataque dentro do alcance, colisões com ilhas e remoção após destruição.
7. Tornar os spawns seguros e coerentes com o intervalo configurado: posições livres de obstáculos, distância inicial segura do jogador e aparição dos dois tipos de inimigo durante uma partida padrão.
8. Confirmar pontuação de um ponto por inimigo destruído pelo jogador. Colisões de Chaser com o jogador não pontuam.
9. Confirmar que derrota ou tempo esgotado encerram a simulação imediatamente e impedem movimento, ataque, dano, spawn ou pontuação adicional. Confirmar também que a pausa congela o relógio da simulação.
10. Ampliar `src/game/engine.test.ts` com testes isolados para esses comportamentos. Introduzir uma fonte de aleatoriedade controlável nos testes se ela for necessária para reproduzir spawns.

**Critério de conclusão:** os casos de gameplay podem ser demonstrados por testes unitários reproduzíveis; duração, intervalo e demais parâmetros respeitam tipos e limites; a engine continua independente da camada visual.

**Verificação:** `npm test`, `npm run typecheck`, `npm run lint` e `npm run build`.

**Status: concluída.** A configuração tipada e seus valores padrão estão em `src/types/game.ts` e `src/config.ts`; a engine usa snapshots por partida e permite controlar a aleatoriedade nos testes. Navios não atravessam ilhas, projéteis verificam impactos em trajetória, spawns evitam obstáculos/navios/jogador, os dois inimigos alternam por sequência configurável e cada abate do jogador vale exatamente um ponto. A cobertura da engine inclui movimento, limites, colisões, armas, invulnerabilidade, IA, spawn seguro, pontuação, pausa e encerramento imediato.

**Validação atual:** `npm test` (24 testes aprovados), `npm run lint`, `npm run typecheck`, `npm run build` e `npm run test:e2e` (18 testes aprovados, incluindo desktop, mobile e regressão visual).

## Etapa 2 — Fazer a arena representar fielmente a simulação

**Objetivo:** permitir observar na tela os estados e eventos definidos pela engine.

1. Em `src/game/GameCanvas.tsx`, revisar a correspondência entre estado da engine e objetos PixiJS: jogador, Chasers, Shooters, projéteis, ilhas, vida, pontuação, tempo e pausa.
2. Substituir o uso de imagens de interface como textura de ilha por tiles ou sprites de jogo adequados em `assets/png/`, `assets/spritesheet/` ou `assets/tilesheet/`.
3. Preparar uma arena legível com água, ilhas e navios em orientação consistente com os ângulos da engine.
4. Usar assets/effects e feedback visual simples para disparos, impactos e destruição; representar visualmente o dano restante.
5. Manter texturas carregadas e reutilizadas; apresentar erro de carregamento e permitir nova tentativa sem iniciar uma arena incompleta.
6. Verificar redimensionamento, proporção da arena, escala de pixels e conversão de coordenadas de input em diferentes dimensões de janela.

**Critério de conclusão:** cada entidade da engine aparece no PixiJS na posição e estado esperados; colisões e dano são legíveis; a arena funciona em tamanhos de tela diferentes.

**Correção de estabilidade visual:** o canvas PixiJS mantém a mesma instância durante as atualizações do HUD; as camadas persistem entre frames; a arena não reutiliza textura de interface como ilha; e a proporção 16:9 é preservada no redimensionamento. O teste E2E também verifica que o canvas permanece único e montado após mais de um segundo de partida.

**Status:** em andamento. As correções de estabilidade e enquadramento estão implementadas; a integração de tiles/sprites apropriados, os efeitos de combate e a conferência visual em viewport móvel ainda precisam ser concluídos.

**Verificação:** build e Playwright em desktop e viewport móvel, incluindo conferência visual manual da arena.

## Etapa 3 — Completar controles, pausa e ciclo de vida

**Objetivo:** garantir que o jogador controle a partida sem estados presos ou recursos duplicados.

1. Comparar os controles de teclado e toque em `GameCanvas.tsx` e oferecer movimento, rotação e ataques simultâneos.
2. Liberar todos os controles ao soltar o ponteiro, sair do botão, ocultar a aba ou desmontar a tela; testar o uso em touch.
3. Fazer a pausa manual e automática por perda de visibilidade suspender simulação, cooldowns e cronômetro.
4. Exigir uma ação explícita para retomar a pausa automática e limpar entradas antigas para não gerar movimento ou tiros acumulados.
5. Garantir desmontagem segura do ticker, listeners, canvas, sprites e recursos ao sair, reiniciar ou executar sob React Strict Mode.
6. Confirmar que sair ou recarregar durante uma partida abandona a sessão sem gerar um registro de resultado.

**Critério de conclusão:** iniciar, pausar, retomar, abandonar e reiniciar não deixam controles ativos, simulação em segundo plano ou recursos duplicados.

**Verificação:** testes unitários onde aplicável e cenários Playwright de controles, pausa, navegação repetida e desmontagem.

## Etapa 4 — Consolidar telas React e persistência local

**Objetivo:** conectar o combate a opções, HUD e resultado sem transferir o estado contínuo do jogo para React.

1. Em `src/App.tsx`, manter o fluxo explícito entre menu, opções, partida e resultado.
2. Validar e persistir duração e intervalo de spawn em `src/config.ts`; documentar limites e mostrar erros úteis no formulário.
3. Passar à engine um snapshot imutável das opções no início da partida.
4. Sincronizar para React apenas os dados necessários do HUD e o evento único de fim da partida, evitando atualização do componente a cada frame.
5. Exibir pontuação, duração efetiva, motivo de encerramento e estado do registro no resultado.
6. Implementar Play Again com estado novo e Main Menu sem reaproveitar entidades ou estado da partida anterior.
7. Persistir opções e último resultado concluído. Não persistir como resultado uma partida abandonada.

**Critério de conclusão:** opções sobrevivem ao refresh, o HUD e o resultado correspondem à simulação, e reiniciar não herda pontuação, vida, tempo ou entidades.

**Verificação:** Vitest e Playwright para opções, persistência, resultado e reinício.

## Etapa 5 — Completar contratos e comportamento de ranking/histórico

**Objetivo:** registrar cada partida concluída uma única vez e exibir resultados remotos consistentes.

1. Em `src/types/game.ts`, definir contratos tipados completos para configuração, payload de gravação, histórico e classificação, incluindo jogador, partida, data, duração e motivo.
2. Em `src/api/client.ts`, implementar consultas paginadas e gravação com Axios, tratando status HTTP e erros sem respostas artificiais de sucesso.
3. Em `src/App.tsx`, usar TanStack Query para carregamento, erro, vazio, atualização em segundo plano, cache, invalidação e repetição adequada.
4. Implementar ordenação determinística do ranking, comparando apenas partidas com a mesma configuração e aplicando critério de desempate documentado.
5. Garantir envio idempotente de partida concluída. Cliques repetidos ou nova tentativa não podem duplicar histórico nem classificação.
6. Guardar envios pendentes, recuperá-los após refresh e permitir uma nova tentativa sem impedir o jogador de iniciar outra partida.
7. Atualizar ranking e histórico após gravação confirmada e ao retornar às abas; proteger os dados mais novos de respostas antigas.

**Critério de conclusão:** cada partida concluída resulta em um único registro; ranking e histórico refletem o mesmo resultado; falhas de rede não bloqueiam menu ou jogo.

**Verificação:** testes de API e de componentes para paginação, desempate, idempotência, cache, timeout, nova tentativa e respostas fora de ordem.

## Etapa 6 — Tornar os cenários MSW completos e reproduzíveis

**Objetivo:** exercitar os estados de rede sem depender de backend.

1. Ampliar `src/mocks/handlers.ts` com fixtures de páginas, listas vazias, atrasos e erros representativos.
2. Compartilhar contratos e fixtures entre handlers e testes, evitando formatos de resposta diferentes.
3. Permitir selecionar e resetar cenários de forma controlada no ambiente de desenvolvimento.
4. Cobrir erros de leitura e gravação, timeout, latência e respostas atrasadas sem deixar estado de mock contaminado entre testes.
5. Confirmar que o service worker em `public/mockServiceWorker.js` é registrado no desenvolvimento e que chamadas não simuladas continuam visíveis como erro.

**Critério de conclusão:** todos os cenários de sucesso e falha podem ser repetidos, isolados e verificados automaticamente.

**Verificação:** testes MSW/Vitest e cenários Playwright para estados de carregamento, erro, recuperação e envio pendente.

## Etapa 7 — Expandir testes E2E e regressão visual

**Objetivo:** validar os principais fluxos no navegador e reduzir regressões na interface.

1. Expandir `tests/naval-shooter.spec.ts` com fluxos de opções, início, controles, pausa, combate, encerramento, resultado, reinício e abandono.
2. Cobrir ranking/histórico paginados e estados de carregamento, vazio, falha e recuperação.
3. Tornar estados de jogo reproduzíveis nos testes por meio de seed/relógio controlável, sem substituir as regras reais da engine.
4. Capturar baselines Playwright para menu, arena em estado estável e resultado; revisar diferenças visuais, não apenas atualizar snapshots automaticamente.
5. Executar os fluxos relevantes em Chromium desktop e viewport móvel.

**Critério de conclusão:** os fluxos essenciais são verificados de ponta a ponta e a regressão visual é comparada com capturas versionadas.

**Verificação:** `npm run test:e2e`, revisão do relatório HTML, screenshots e traces de falhas.

**Status: concluída.** A suíte contém 18 testes Playwright: 17 no Chromium desktop e um em viewport mobile. Ela cobre opções, carregamento e retry de assets, controles e regras reais de gameplay, armas e cooldowns, dano e pontuação, IA e spawn, encerramento, pausa e perda de foco, persistência do resultado, abandono e navegação repetida, controles de toque, ranking/histórico (paginação, vazio e erros), registro, recuperação após refresh, idempotência de retry e respostas fora de ordem. As telas de menu, arena estável e resultado têm baselines PNG salvas em `tests/visual.spec.ts-snapshots/`. A fixture de início posiciona o clique no centro da arena de acordo com o viewport, inclusive em mobile; a captura do resultado desativa spawns e espera a confirmação do registro para não depender de uma derrota incidental ou de uma resposta pendente.

**Validação executada:** `npm run test:e2e` (18 testes aprovados: 17 desktop e 1 mobile; relatório HTML gerado), `npm test` (24 testes aprovados), `npm run lint`, `npm run typecheck` e `npm run build`.

## Etapa 8 — Preparar build, performance e entrega

**Objetivo:** deixar a aplicação reproduzível e pronta para publicação.

1. Executar `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` e `npm run test:e2e` a partir de uma instalação limpa.
2. Avaliar o build de produção e corrigir erros de console, recursos ausentes e problemas de carregamento.
3. Medir a arena em uma partida longa: FPS, percentil 95 do intervalo entre frames e quantidade de entidades.
4. Verificar possível crescimento de memória após ciclos repetidos de iniciar, jogar e sair.
5. Atualizar `ARCHITECTURE.md` com as decisões realmente adotadas, limitações e resultados de performance.
6. Publicar o build e confirmar que o MSW, assets e rotas funcionam na URL de produção.

**Critério de conclusão:** instalação limpa, verificações automatizadas aprovadas, build funcional e evidências de performance/documentação disponíveis.

## Ordem resumida

1. **Engine e testes unitários** — fechar as regras antes de adicionar complexidade visual.
2. **Arena PixiJS** — apresentar na tela o estado real da simulação.
3. **Controles e ciclo de vida** — tornar partida, pausa e saída confiáveis.
4. **Telas e persistência local** — integrar opções, HUD e resultado.
5. **Ranking e histórico** — finalizar contratos e fluxo remoto.
6. **MSW** — validar sucesso e falhas de rede.
7. **Playwright e regressão visual** — proteger os fluxos completos.
8. **Performance e entrega** — validar build, publicação e documentação final.
