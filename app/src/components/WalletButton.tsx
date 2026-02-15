'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useWallet } from '@/contexts/WalletContext';
import { authenticatedPost, signRequest } from '@/lib/signRequest';

function PhantomIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 200 180" fill="none">
      <path fillRule="evenodd" clipRule="evenodd" d="M89.1138 112.613C83.1715 121.719 73.2139 133.243 59.9641 133.243C53.7005 133.243 47.6777 130.665 47.6775 119.464C47.677 90.9369 86.6235 46.777 122.76 46.7764C143.317 46.776 151.509 61.0389 151.509 77.2361C151.509 98.0264 138.018 121.799 124.608 121.799C120.352 121.799 118.264 119.462 118.264 115.756C118.264 114.789 118.424 113.741 118.746 112.613C114.168 120.429 105.335 127.683 97.0638 127.683C91.0411 127.683 87.9898 123.895 87.9897 118.576C87.9897 116.642 88.3912 114.628 89.1138 112.613ZM115.936 68.7103C112.665 68.7161 110.435 71.4952 110.442 75.4598C110.449 79.4244 112.689 82.275 115.96 82.2693C119.152 82.2636 121.381 79.4052 121.374 75.4405C121.367 71.4759 119.128 68.7047 115.936 68.7103ZM133.287 68.6914C130.016 68.6972 127.786 71.4763 127.793 75.4409C127.8 79.4055 130.039 82.2561 133.311 82.2504C136.503 82.2448 138.732 79.3863 138.725 75.4216C138.718 71.457 136.479 68.6858 133.287 68.6914Z" fill="currentColor"/>
    </svg>
  );
}

function shortenAddress(address: string): string {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export default function WalletButton() {
  const wallet = useWallet();
  const { connected, connecting, initializing, publicKey, balance, connect, disconnect } = wallet;
  const [showDropdown, setShowDropdown] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [editingUsername, setEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [savingUsername, setSavingUsername] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchProfile = useCallback(async () => {
    if (!publicKey) return;
    try {
      const res = await fetch(`/api/profile?wallet=${publicKey}`);
      const data = await res.json();
      if (data.success && data.profile) {
        setUsername(data.profile.username);
        setNewUsername(data.profile.username || '');
        setAvatar(data.profile.avatar);
        setAvatarError(false);
      }
    } catch (err) {
      console.error('Failed to fetch profile:', err);
    }
  }, [publicKey]);

  useEffect(() => {
    if (connected && publicKey) {
      fetchProfile();
    } else {
      setUsername(null);
      setAvatar(null);
    }
  }, [connected, publicKey, fetchProfile]);

  const saveProfile = async (updates: { username?: string | null; avatar?: string | null }) => {
    if (!publicKey) return;
    const profileData = {
      username: updates.username !== undefined ? updates.username : (username || null),
      avatar: updates.avatar !== undefined ? updates.avatar : (avatar || null),
    };
    const res = await authenticatedPost(wallet, '/api/profile', 'profile', profileData);
    const data = await res.json();
    if (data.success) {
      setUsername(data.profile.username);
      setAvatar(data.profile.avatar);
      setAvatarError(false);
    }
    return data;
  };

  const saveUsername = async () => {
    if (!publicKey || savingUsername) return;
    setSavingUsername(true);
    try {
      const data = await saveProfile({ username: newUsername.trim() || null });
      if (data?.success) {
        setEditingUsername(false);
      }
    } catch (err) {
      console.error('Failed to save username:', err);
    } finally {
      setSavingUsername(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !publicKey) return;

    setUploadingAvatar(true);
    try {
      // Upload file as avatar (replaces existing)
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'avatar');
      formData.append('wallet', publicKey);
      const authHeaders = await signRequest(wallet, 'upload', { wallet: publicKey });
      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        headers: authHeaders || {},
        body: formData,
      });
      const uploadData = await uploadRes.json();

      if (!uploadData.success) {
        console.error('Upload failed:', uploadData.error);
        return;
      }

      // Save avatar URL to profile
      await saveProfile({ avatar: uploadData.url });
    } catch (err) {
      console.error('Failed to upload avatar:', err);
    } finally {
      setUploadingAvatar(false);
      // Reset input so same file can be re-selected
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
        setEditingUsername(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (initializing) {
    return (
      <div className="glass-card animate-pulse px-4 py-2 flex items-center gap-2">
        <div className="w-4 h-4 rounded-full bg-white/10" />
        <div className="w-20 h-4 rounded bg-white/10" />
      </div>
    );
  }

  if (!connected) {
    return (
      <button
        onClick={connect}
        disabled={connecting}
        title="Connect your Phantom wallet to trade tokens"
        className="flex items-center gap-1.5 rounded-lg bg-vault-accent px-3 py-2 text-sm font-semibold text-vault-bg transition-all hover:bg-vault-accent-hover disabled:opacity-50 sm:gap-2 sm:px-4"
      >
        {connecting ? (
          <>
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-vault-bg border-t-transparent sm:h-5 sm:w-5" />
            <span className="hidden sm:inline">Connecting...</span>
          </>
        ) : (
          <>
            <PhantomIcon className="w-5 h-5 sm:w-6 sm:h-6" />
            <span className="hidden sm:inline">Connect Wallet</span>
            <span className="sm:hidden">Connect</span>
          </>
        )}
      </button>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="glass-card flex items-center gap-1.5 px-2 py-2 text-sm font-medium transition-colors hover:border-white/10 sm:gap-2 sm:px-3"
      >
        {avatar && !avatarError ? (
          <img src={avatar} alt="" className="h-5 w-5 shrink-0 rounded-full object-cover" onError={() => setAvatarError(true)} />
        ) : (
          <div className="h-2 w-2 shrink-0 rounded-full bg-vault-green" />
        )}
        <span className="max-w-[60px] truncate font-mono text-xs text-vault-text sm:max-w-none sm:text-sm">
          {username || shortenAddress(publicKey!)}
        </span>
        {balance !== null && (
          <span className="whitespace-nowrap font-mono text-xs text-vault-muted">
            {balance.toFixed(2)} <span className="hidden sm:inline">SOL</span>
          </span>
        )}
        <svg className="h-3 w-3 text-vault-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {showDropdown && (
        <div className="absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-xl border border-white/[0.08] bg-[#0d0d14] shadow-2xl shadow-black/50">
          {/* Avatar Section */}
          <div className="border-b border-white/[0.06] p-4">
            <div className="mb-2 text-xs text-vault-muted">Avatar</div>
            <div className="flex items-center gap-3">
              {avatar && !avatarError ? (
                <img src={avatar} alt="" className="h-10 w-10 rounded-full object-cover border border-white/[0.08]" onError={() => setAvatarError(true)} />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] text-vault-muted">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                </div>
              )}
              <button
                onClick={() => avatarInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="rounded-lg bg-white/[0.05] px-3 py-1.5 text-sm text-vault-secondary transition hover:bg-white/[0.08] disabled:opacity-50"
              >
                {uploadingAvatar ? 'Uploading...' : avatar ? 'Change' : 'Upload'}
              </button>
              {avatar && (
                <button
                  onClick={async () => {
                    await saveProfile({ avatar: null });
                  }}
                  className="text-sm text-vault-muted transition hover:text-vault-red"
                >
                  Remove
                </button>
              )}
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                className="hidden"
                onChange={handleAvatarUpload}
              />
            </div>
          </div>

          {/* Username Section */}
          <div className="border-b border-white/[0.06] p-4">
            <div className="mb-2 text-xs text-vault-muted">Display Name</div>
            {editingUsername ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="Enter username"
                  maxLength={20}
                  className="flex-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-sm text-vault-text placeholder-vault-muted focus:border-vault-accent focus:outline-none"
                  autoFocus
                />
                <button
                  onClick={saveUsername}
                  disabled={savingUsername}
                  className="rounded-lg bg-vault-accent px-3 py-1.5 text-sm font-medium text-vault-bg transition hover:bg-vault-accent-hover disabled:opacity-50"
                >
                  {savingUsername ? '...' : 'Save'}
                </button>
                <button
                  onClick={() => {
                    setEditingUsername(false);
                    setNewUsername(username || '');
                  }}
                  className="rounded-lg bg-white/[0.05] px-3 py-1.5 text-sm text-vault-muted transition hover:bg-white/[0.08]"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="font-medium text-vault-text">
                  {username || <span className="italic text-vault-muted">Not set</span>}
                </span>
                <button
                  onClick={() => setEditingUsername(true)}
                  className="text-sm text-vault-accent transition hover:text-vault-accent-hover"
                >
                  Edit
                </button>
              </div>
            )}
          </div>

          {/* Wallet Address */}
          <div className="border-b border-white/[0.06] p-4">
            <div className="mb-1 text-xs text-vault-muted">Wallet Address</div>
            <div className="break-all font-mono text-sm text-vault-text">{publicKey}</div>
          </div>
          
          {/* Balance */}
          <div className="border-b border-white/[0.06] p-4">
            <div className="mb-1 text-xs text-vault-muted">Balance</div>
            <div className="text-lg font-semibold text-vault-text">
              {balance !== null ? `${balance.toFixed(4)} SOL` : 'Loading...'}
            </div>
          </div>

          {/* Actions */}
          <div className="p-2">
            <button
              onClick={() => {
                navigator.clipboard.writeText(publicKey!);
                setShowDropdown(false);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-vault-secondary transition hover:bg-white/[0.05]"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
              </svg>
              Copy Address
            </button>
            <a
              href={`https://solscan.io/account/${publicKey}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-vault-secondary transition hover:bg-white/[0.05]"
              onClick={() => setShowDropdown(false)}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
              View on Solscan
            </a>
            <button
              onClick={() => {
                disconnect();
                setShowDropdown(false);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-vault-red transition hover:bg-white/[0.05]"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
              </svg>
              Disconnect
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
