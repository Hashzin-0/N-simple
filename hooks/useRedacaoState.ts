'use client';

import { useReducer, useCallback, useRef, useEffect } from 'react';
import { usePersistedState } from '@/hooks/usePersistedState';
import type {
  RedacaoState,
  RedacaoAction,
  RedacaoSecoes,
} from '@/components/PesquisadorRedacao/types';

const STORAGE_KEY = 'n_calc_redacao_state';

const INITIAL_SECOES: RedacaoSecoes = {
  introducao: '',
  desenvolvimento1: '',
  desenvolvimento2: '',
  desenvolvimento3: '',
  conclusao: '',
};

const INITIAL_STATE: RedacaoState = {
  tema: '',
  modo: 'automatico',
  passo: 'tema',
  context: null,
  estrutura: null,
  redacao: '',
  redacaoSecoes: INITIAL_SECOES,
  validacao: null,
  metadata: null,
  isLoading: false,
  error: null,
};

function redacaoReducer(state: RedacaoState, action: RedacaoAction): RedacaoState {
  switch (action.type) {
    case 'SET_TEMA':
      return { ...state, tema: action.payload, error: null };
    case 'SET_MODO':
      return { ...state, modo: action.payload };
    case 'SET_PASSO':
      return { ...state, passo: action.payload };
    case 'SET_CONTEXT':
      return {
        ...state,
        context: action.payload,
        passo: action.payload ? 'repertorio' : state.passo,
        isLoading: false,
        error: null,
      };
    case 'SET_ESTRUTURA':
      return { ...state, estrutura: action.payload, passo: action.payload ? 'redacao' : state.passo };
    case 'UPDATE_SECAO':
      return {
        ...state,
        redacaoSecoes: {
          ...state.redacaoSecoes,
          [action.payload.chave]: action.payload.valor,
        },
      };
    case 'SET_REDACAO':
      return { ...state, redacao: action.payload };
    case 'SET_VALIDACAO':
      return { ...state, validacao: action.payload, passo: 'validacao' };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false };
    case 'RESET':
      return INITIAL_STATE;
    default:
      return state;
  }
}

/**
 * Estado central da tab "Pesquisador de Redação".
 *
 * Usa usePersistedState para persistir no localStorage com debounce.
 * Cada seção da redação é salva separadamente (para contenteditable).
 */
export function useRedacaoState() {
  const [persisted, setPersisted] = usePersistedState<{
    tema: string;
    modo: RedacaoState['modo'];
    redacaoSecoes: RedacaoSecoes;
  }>(STORAGE_KEY, {
    tema: INITIAL_STATE.tema,
    modo: INITIAL_STATE.modo,
    redacaoSecoes: INITIAL_STATE.redacaoSecoes,
  });

  const [state, dispatch] = useReducer(redacaoReducer, {
    ...INITIAL_STATE,
    tema: persisted.tema,
    modo: persisted.modo,
    redacaoSecoes: persisted.redacaoSecoes,
  });

  // Sincroniza mudanças de seções para localStorage com debounce
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!mountedRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      setPersisted({
        tema: state.tema,
        modo: state.modo,
        redacaoSecoes: state.redacaoSecoes,
      });
    }, 300);
  }, [state.tema, state.modo, state.redacaoSecoes, setPersisted]);

  const setTema = useCallback((tema: string) => {
    dispatch({ type: 'SET_TEMA', payload: tema });
  }, []);

  const setModo = useCallback((modo: RedacaoState['modo']) => {
    dispatch({ type: 'SET_MODO', payload: modo });
  }, []);

  const setPasso = useCallback((passo: RedacaoState['passo']) => {
    dispatch({ type: 'SET_PASSO', payload: passo });
  }, []);

  const setContext = useCallback((ctx: RedacaoState['context']) => {
    dispatch({ type: 'SET_CONTEXT', payload: ctx });
  }, []);

  const setEstrutura = useCallback((estrutura: RedacaoState['estrutura']) => {
    dispatch({ type: 'SET_ESTRUTURA', payload: estrutura });
  }, []);

  const updateSecao = useCallback((chave: keyof RedacaoSecoes, valor: string) => {
    dispatch({ type: 'UPDATE_SECAO', payload: { chave, valor } });
  }, []);

  const setRedacao = useCallback((redacao: string) => {
    dispatch({ type: 'SET_REDACAO', payload: redacao });
  }, []);

  const setValidacao = useCallback((validacao: RedacaoState['validacao']) => {
    dispatch({ type: 'SET_VALIDACAO', payload: validacao });
  }, []);

  const setLoading = useCallback((loading: boolean) => {
    dispatch({ type: 'SET_LOADING', payload: loading });
  }, []);

  const setError = useCallback((error: string | null) => {
    dispatch({ type: 'SET_ERROR', payload: error });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  return {
    state,
    setTema,
    setModo,
    setPasso,
    setContext,
    setEstrutura,
    updateSecao,
    setRedacao,
    setValidacao,
    setLoading,
    setError,
    reset,
  };
}
