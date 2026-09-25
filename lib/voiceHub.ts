'use client';

/**
 * Hub de agentes de voz (global ↔ tutor).
 *
 * Centraliza qual agente está ativo, permite trocar de agente em sessão
 * (session resumption via switchPersona) e mantém a orb viva durante a
 * troca (flag `handoff`).
 *
 * Mecanismo:
 * - Cada hook de agente (useGeminiLiveAgent / useTutorLiveAgent) se registra
 *   ao montar e remove ao desmontar.
 * - callAgent captura o handle de resumption do agente atual, agenda o
 *   disconnect dele (grace para a ferramenta/fala de despedida sair no
 *   socket antigo) e então chama switchPersona no alvo.
 * - Se o alvo ainda não estiver montado (ex: tab tutor fechada), guarda o
 *   switch como `pendingSwitch` e aplica quando o alvo registrar
 *   (ou quando o grace terminar, o que vier depois).
 */

export type VoiceAgentId = 'global' | 'tutor';

export interface HubAgentState {
  isConnected: boolean;
  isConnecting: boolean;
  isMuted: boolean;
  status: 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking' | 'error';
  errorMessage: string | null;
  userVolume: number;
  agentVolume: number;
}

export interface VoiceAgentRuntime {
  id: VoiceAgentId;
  getState: () => HubAgentState;
  connect: () => void;
  disconnect: () => void;
  switchPersona: (options?: { resumeHandle?: string; transitionText?: string }) => void;
  getResumptionHandle: () => string | null;
  toggleMute: () => void;
}

export interface HubSnapshot {
  activeAgentId: VoiceAgentId;
  /** true enquanto uma troca de agente está em andamento (orb fica viva). */
  handoff: boolean;
}

export interface CallAgentOptions {
  /** Mensagem injetada via clientContent na sessão do agente destino. */
  transitionText?: string;
  /** Força conexão do destino mesmo sem sessão ativa de origem. */
  connect?: boolean;
  /**
   * Adia a navegação de aba até o fim do grace. Use quando a troca de aba
   * desmontaria o agente atual (ex: tutor → global) e cortaria a fala de
   * despedida.
   */
  delayNavigation?: boolean;
}

/** Espera antes de fechar o socket antigo (resposta da ferramenta + despedida). */
const HANDOFF_GRACE_MS = 2500;

/** Aba padrão de cada agente. */
const TAB_FOR_AGENT: Record<VoiceAgentId, string> = {
  global: 'nitrogen',
  tutor: 'tutor',
};

interface PendingSwitch {
  target: VoiceAgentId;
  resumeHandle: string | null;
  transitionText?: string;
}

class VoiceHub {
  private agents = new Map<VoiceAgentId, VoiceAgentRuntime>();
  private listeners = new Set<() => void>();
  private snapshot: HubSnapshot = { activeAgentId: 'global', handoff: false };
  private pendingSwitch: PendingSwitch | null = null;
  private pendingArmed = false;
  private graceTimer: ReturnType<typeof setTimeout> | null = null;
  private graceToken = 0;
  private navigator: ((agentId: VoiceAgentId, tab: string) => void) | null = null;

  // ---- store (useSyncExternalStore) ----

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  getSnapshot = (): HubSnapshot => this.snapshot;

  private emit(): void {
    for (const fn of this.listeners) fn();
  }

  private update(patch: Partial<HubSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    this.emit();
  }

  // ---- registro de agentes ----

  setNavigator(fn: ((agentId: VoiceAgentId, tab: string) => void) | null): void {
    this.navigator = fn;
  }

  register(agent: VoiceAgentRuntime): void {
    this.agents.set(agent.id, agent);
    this.emit();
    if (
      this.pendingSwitch &&
      this.pendingArmed &&
      this.pendingSwitch.target === agent.id
    ) {
      const p = this.pendingSwitch;
      this.pendingSwitch = null;
      this.pendingArmed = false;
      agent.switchPersona({
        resumeHandle: p.resumeHandle ?? undefined,
        transitionText: p.transitionText,
      });
    }
  }

  unregister(id: VoiceAgentId): void {
    this.agents.delete(id);
    this.emit();
  }

  /** Chamado pelos hooks quando o estado de um agente muda.
   *  Bump de identidade do snapshot força re-render dos assinantes (HUD). */
  agentStateChanged(): void {
    this.update({});
  }

  getAgentState(id: VoiceAgentId): HubAgentState | null {
    return this.agents.get(id)?.getState() ?? null;
  }

  getAgentRuntime(id: VoiceAgentId): VoiceAgentRuntime | null {
    return this.agents.get(id) ?? null;
  }

  get activeAgentId(): VoiceAgentId {
    return this.snapshot.activeAgentId;
  }

  /** Troca passiva de agente ativo (sem conexão/handoff). */
  setActive(id: VoiceAgentId): void {
    if (this.snapshot.activeAgentId === id) return;
    this.cancelPending();
    this.update({ activeAgentId: id, handoff: false });
  }

  /** Cancela um handoff pendente/em grace (ex: usuário mudou de aba no meio). */
  private cancelPending(): void {
    this.pendingSwitch = null;
    this.pendingArmed = false;
    if (this.graceTimer) {
      clearTimeout(this.graceTimer);
      this.graceTimer = null;
      this.graceToken++;
    }
  }

  endHandoff(): void {
    if (this.snapshot.handoff) this.update({ handoff: false });
  }

  // ---- troca de agente ----

  private applyPendingSwitch(target: VoiceAgentId): void {
    const next = this.agents.get(target);
    if (!next) {
      this.pendingArmed = true; // aguarda register()
      return;
    }
    const st = next.getState();
    if (st.isConnected) {
      this.endHandoff();
      return;
    }
    if (st.isConnecting) return; // já subindo
    const p = this.pendingSwitch;
    this.pendingSwitch = null;
    this.pendingArmed = false;
    next.switchPersona({
      resumeHandle: p?.resumeHandle ?? undefined,
      transitionText: p?.transitionText,
    });
  }

  /**
   * Torna `target` o agente ativo e transfere a sessão (session resumption).
   * - Captura o handle do agente atual na hora.
   * - Fecha o socket atual após um grace (para a resposta da ferramenta e a
   *   fala de despedida saírem) e então chama switchPersona no destino.
   * - Navega para a aba do destino via navigator registrado pelo page.
   */
  callAgent(
    target: VoiceAgentId,
    options: CallAgentOptions = {}
  ): { ok: boolean; message: string } {
    const fromId = this.snapshot.activeAgentId;
    if (fromId === target) {
      const cur = this.agents.get(target);
      if (cur && !cur.getState().isConnected && !cur.getState().isConnecting && options.connect) {
        cur.connect();
      }
      return { ok: true, message: 'Agente já é o ativo.' };
    }

    const current = this.agents.get(fromId);
    const currentState = current?.getState();
    const wasConnected = !!currentState?.isConnected;
    const resumeHandle = wasConnected && current ? current.getResumptionHandle() : null;

    // cancela qualquer handoff anterior em grace (nova chamada sobrepõe)
    this.cancelPending();

    // desconecta qualquer outro agente órfão que ainda esteja com sessão viva
    for (const [id, ag] of this.agents) {
      if (id !== fromId && id !== target && ag.getState().isConnected) {
        try {
          ag.disconnect();
        } catch {
          // ignore
        }
      }
    }

    this.pendingSwitch = {
      target,
      resumeHandle,
      transitionText: options.transitionText,
    };
    this.pendingArmed = false;

    this.update({ activeAgentId: target, handoff: true });
    if (!options.delayNavigation) {
      this.navigator?.(target, TAB_FOR_AGENT[target]);
    }

    const finish = () => {
      if (wasConnected && current) {
        try {
          current.disconnect();
        } catch {
          // ignore
        }
      }
      if (options.delayNavigation) {
        this.navigator?.(target, TAB_FOR_AGENT[target]);
      }
      this.applyPendingSwitch(target);
    };

    if (wasConnected) {
      if (this.graceTimer) clearTimeout(this.graceTimer);
      const token = ++this.graceToken;
      this.graceTimer = setTimeout(() => {
        this.graceTimer = null;
        if (this.graceToken !== token) return; // outra troca sobrepôs este grace
        finish();
      }, HANDOFF_GRACE_MS);
    } else if (options.connect) {
      finish();
    } else {
      // sem sessão em jogo: só ativa o agente (conexão fica por conta do usuário)
      this.pendingSwitch = null;
      this.pendingArmed = false;
      this.update({ handoff: false });
    }

    return {
      ok: true,
      message: wasConnected
        ? `Transferindo a sessão para o agente ${target}…`
        : `Agente ${target} ativado.`,
    };
  }

  /**
   * Sincroniza o agente ativo com a aba escolhida pelo usuário.
   * - Cancela um handoff pendente cujo destino não é o agente da nova aba
   *   (usuário navegou durante o grace).
   * - Se houver sessão viva no agente anterior, faz o handoff; caso contrário,
   *   apenas marca o agente ativo.
   */
  syncTab(tab: string): void {
    const target: VoiceAgentId = tab === 'tutor' ? 'tutor' : 'global';
    if (this.pendingSwitch && this.pendingSwitch.target !== target) {
      // navegação manual no meio da troca: cancela, mantém o que estiver vivo
      this.cancelPending();
      this.update({ handoff: false });
    }
    if (this.snapshot.activeAgentId === target) return;
    const from = this.agents.get(this.snapshot.activeAgentId);
    if (from?.getState().isConnected) {
      this.callAgent(target, {
        transitionText:
          target === 'tutor'
            ? 'Cedendo a conversa ao Tutor de Revisão do aplicativo.'
            : 'Retornando ao assistente agronômico principal.',
      });
    } else {
      this.setActive(target);
    }
  }
}

export const voiceHub = new VoiceHub();
