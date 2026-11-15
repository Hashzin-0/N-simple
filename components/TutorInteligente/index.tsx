                )}
              </button>
            );
          })}
        </div>
      </div>

      {showTema && (
        <TemaSelector
          onStart={handleStart}
          isStarting={state.status === 'loading' || isResearching}
          disabled={state.status === 'loading'}
        />
      )}

      {state.status === 'conversando' && (
        <div
          id="tutor_conversar"
          className="rounded-3xl border border-[#2E6F40]/25 bg-[#2E6F40]/5 dark:bg-[#9CB386]/10 p-5 space-y-3"
        >
          <p className="text-sm font-semibold text-[#242A20] dark:text-[#F3F1EC] flex items-center gap-2">
            <MessageCircle className="size-4 text-[#2E6F40] dark:text-[#9CB386]" />
            Modo conversar
          </p>
          <p className="text-xs text-[#5A5A40] dark:text-[#9EA399] leading-relaxed">
            Conecte a voz do tutor para dialogar sobre{' '}
            {currentTema ? currentTema.tema : 'agronomia'}. Peça “me pergunte sobre…” para iniciar
            uma sessão de questões pelo áudio.
          </p>
          {state.contextFontes && (
            <p className="text-[11px] text-[#8C897E] dark:text-[#9EA399] line-clamp-3">
              Contexto carregado de fontes já pesquisadas.
            </p>
          )}
        </div>
      )}

      {state.status === 'loading' && (
        <div className="rounded-3xl border border-[#E5E2D9] dark:border-[#2C3328] bg-white dark:bg-[#1C201A] p-6 flex flex-col items-center gap-3 text-center">
          <Loader2 className="size-6 animate-spin text-[#2E6F40] dark:text-[#9CB386]" />
          <p className="text-sm text-[#242A20] dark:text-[#F3F1EC] font-medium">
            Preparando sua sessão de revisão…
          </p>
          <p className="text-xs text-[#8C897E] dark:text-[#9EA399]">
            {activeModo === 'revisar_erros'
              ? 'Carregando fila de erros e questões pendentes…'
              : 'Consultando memória de fontes, artigos e questões no Supabase…'}
          </p>
        </div>
      )}

      {state.status === 'error' && (
        <div className="rounded-3xl border border-red-500/25 bg-red-500/5 p-4 flex gap-2.5">
          <AlertCircle className="size-4 text-red-500 shrink-0 mt-0.5" />
          <div className="space-y-2">
            <p className="text-sm text-red-700 dark:text-red-400">{state.errorMessage}</p>