'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Cloud, LogOut, UserRound } from 'lucide-react';
import { useAuth } from './AuthProvider';

export default function ProfileMenu() {
  const { user, signOut, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  if (loading || !user) return null;

  const meta = (user.user_metadata || {}) as {
    picture?: string;
    full_name?: string;
    name?: string;
    avatar_url?: string;
  };
  const picture = meta.picture || meta.avatar_url || '';
  const name = meta.full_name || meta.name || user.email || 'Conta';
  const email = user.email || '';

  return (
    <div ref={rootRef} className="relative" id="profile_menu_root">
      <button
        type="button"
        id="btn_profile_menu"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 p-1 pr-2 bg-white/10 dark:bg-white/5 hover:bg-white/20 text-white rounded-xl border border-white/20 dark:border-white/10 transition-all active:scale-95"
        title={email}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {picture ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={picture}
            alt=""
            className="size-7 rounded-lg object-cover border border-white/30"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="size-7 rounded-lg bg-white/15 flex items-center justify-center">
            <UserRound className="size-4 text-white" />
          </span>
        )}
        <ChevronDown className="size-3.5 text-white/80" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-64 rounded-2xl border border-[#E5E2D9] dark:border-[#2C3328] bg-white dark:bg-[#1C201A] shadow-xl z-50 overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-[#F0EDE5] dark:border-[#2C3328] flex items-start gap-3">
            {picture ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={picture}
                alt=""
                className="size-10 rounded-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="size-10 rounded-full bg-[#2E6F40]/10 dark:bg-[#9CB386]/15 flex items-center justify-center">
                <UserRound className="size-5 text-[#2E6F40] dark:text-[#9CB386]" />
              </span>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#242A20] dark:text-[#F3F1EC] truncate">
                {name}
              </p>
              <p className="text-xs text-[#8C897E] dark:text-[#9EA399] truncate">{email}</p>
            </div>
          </div>

          <div className="px-4 py-2.5 flex items-center gap-2 text-[11px] text-[#2E6F40] dark:text-[#9CB386] bg-[#2E6F40]/5 dark:bg-[#9CB386]/10">
            <Cloud className="size-3.5 shrink-0" />
            Progresso do Tutor e Libras salvo na nuvem
          </div>

          <button
            type="button"
            id="btn_sign_out"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              void signOut();
            }}
            className="w-full flex items-center gap-2 px-4 py-3 text-sm text-left text-[#3D3D3D] dark:text-[#E8E6DF] hover:bg-[#F9F8F6] dark:hover:bg-[#242720] transition-colors"
          >
            <LogOut className="size-4 text-[#8C897E] dark:text-[#9EA399]" />
            Sair da conta
          </button>
          <button
            type="button"
            id="btn_switch_account"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              void signOut();
            }}
            className="w-full flex items-center gap-2 px-4 py-3 text-sm text-left text-[#3D3D3D] dark:text-[#E8E6DF] hover:bg-[#F9F8F6] dark:hover:bg-[#242720] border-t border-[#F0EDE5] dark:border-[#2C3328] transition-colors"
          >
            <UserRound className="size-4 text-[#8C897E] dark:text-[#9EA399]" />
            Trocar de conta Google
          </button>
        </div>
      )}
    </div>
  );
}
