'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { CreateTokenRequest, CreateTokenResponse } from '@/lib/types';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useWallet } from '@/contexts/WalletContext';

export default function CreatePage() {
  const { connected, publicKey, connect, signTransaction } = useWallet();
  const [anchorAvailable, setAnchorAvailable] = useState<boolean | null>(null);
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [twitter, setTwitter] = useState('');
  const [telegram, setTelegram] = useState('');
  const [website, setWebsite] = useState('');
  const [initialBuy, setInitialBuy] = useState('');
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [result, setResult] = useState<CreateTokenResponse | null>(null);
  const [error, setError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check if Anchor program is available on network
  useEffect(() => {
    const checkNetwork = async () => {
      try {
        const res = await fetch('/api/network');
        const data = await res.json();
        setAnchorAvailable(data.anchorProgram === true);
      } catch {
        setAnchorAvailable(false);
      }
    };
    checkNetwork();
  }, []);

  const handleFileUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    setUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (data.success) {
        setImage(data.url);
      } else {
        setError(data.error || 'Upload failed');
        setImagePreview(null);
      }
    } catch (_err) {
      setError('Upload failed');
      setImagePreview(null);
    } finally {
      setUploading(false);
    }
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  const removeImage = () => {
    setImage('');
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setLoadingStep('');
    setError('');
    setResult(null);

    try {
      if (anchorAvailable && publicKey) {
        console.log('Using on-chain Anchor flow');
        setLoadingStep('Preparing transaction...');

        const prepareRes = await fetch('/api/token/prepare-create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            creator: publicKey,
            name,
            symbol,
            uri: image || '',
            initialBuy: initialBuy ? parseFloat(initialBuy) : undefined,
          }),
        });

        const prepareData = await prepareRes.json();

        if (!prepareData.success) {
          setError(prepareData.error || 'Failed to prepare transaction');
          return;
        }

        setLoadingStep('Waiting for wallet signature...');
        let signedTx: string | null = null;
        try {
          signedTx = await signTransaction(prepareData.transaction);
        } catch (signErr) {
          console.error('Signing error:', signErr);
          setError('Wallet signing failed: ' + (signErr instanceof Error ? signErr.message : 'Unknown error'));
          setLoading(false);
          return;
        }

        if (!signedTx) {
          setError('Transaction signing cancelled or wallet returned empty response');
          setLoading(false);
          return;
        }

        setLoadingStep('Submitting to Solana...');

        let executeData;
        try {
          const executeRes = await fetch('/api/token/execute-create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              signedTransaction: signedTx,
              mint: prepareData.mint,
              creator: publicKey,
              name,
              symbol,
              description: description || undefined,
              image: image || undefined,
              twitter: twitter || undefined,
              telegram: telegram || undefined,
              website: website || undefined,
              initialBuy: prepareData.initialBuy ? {
                solAmount: prepareData.initialBuy.sol,
                estimatedTokens: prepareData.initialBuy.estimatedTokens,
              } : undefined,
            }),
          });

          executeData = await executeRes.json();
        } catch (execErr) {
          console.error('Execute fetch error:', execErr);
          setError('Failed to submit transaction: ' + (execErr instanceof Error ? execErr.message : 'Network error'));
          setLoading(false);
          return;
        }

        if (executeData.success) {
          setResult({
            success: true,
            token: executeData.token,
            mint: executeData.mint,
            signature: executeData.signature,
            onChain: true,
          });
        } else {
          setError(executeData.error || 'Failed to create token on-chain');
        }

        setLoading(false);
        return;
      }

      // Fallback: custodial flow
      const body: CreateTokenRequest = {
        name,
        symbol,
        description: description || undefined,
        image: image || undefined,
        twitter: twitter || undefined,
        telegram: telegram || undefined,
        website: website || undefined,
        initialBuy: initialBuy ? parseFloat(initialBuy) : undefined,
      };

      const res = await fetch('/api/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(publicKey ? { 'X-Wallet': publicKey } : {}),
        },
        body: JSON.stringify({
          ...body,
          creator: publicKey || undefined,
        }),
      });

      const data: CreateTokenResponse = await res.json();

      if (data.success) {
        setResult(data);
      } else {
        setError(data.error || 'Failed to create token');
      }
    } catch (err) {
      console.error('Create error:', err);
      setError('Network error: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setLoading(false);
      setLoadingStep('');
    }
  };

  return (
    <main className="min-h-screen">
      <Header />

      <section className="px-6 py-16">
        <div className="mx-auto max-w-xl">
          {/* Page header */}
          <div className="mb-10">
            <h1 className="text-3xl font-bold tracking-tight text-vault-text">Launch Your Token</h1>
            <p className="mt-2 text-vault-muted">
              Create a new token on the bonding curve. No coding required.
            </p>
          </div>

          {result?.success ? (
            /* ---- Success state ---- */
            <div className="rounded-xl border border-vault-green/30 bg-vault-green/5 p-6">
              <div className="mb-1 flex items-center gap-2">
                <svg className="h-5 w-5 text-vault-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <h2 className="text-xl font-bold text-vault-green">Token Created</h2>
              </div>
              <p className="mb-4 text-vault-secondary">
                Your token <span className="font-semibold text-vault-text">${result.token?.symbol}</span> is now live.
              </p>
              <div className="mb-4 rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 font-mono text-sm">
                <div className="text-[10px] uppercase tracking-wider text-vault-dim">Mint Address</div>
                <a
                  href={`https://solscan.io/account/${result.mint}?cluster=${process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet'}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all text-vault-accent underline hover:text-vault-accent-hover"
                >
                  {result.mint}
                </a>
              </div>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- CreateTokenResponse may include initialBuy */}
              {(result as any).initialBuy && (
                <div className="mb-4 rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 text-sm">
                  <div className="mb-1 font-medium text-vault-green">Initial Buy Complete</div>
                  <div className="text-vault-secondary">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    You bought <span className="font-medium text-vault-text">{(result as any).initialBuy.tokens_received.toLocaleString()}</span> tokens{' '}
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    for <span className="font-medium text-vault-text">{(result as any).initialBuy.sol_spent} SOL</span>
                  </div>
                </div>
              )}
              <div className="flex gap-3">
                <Link
                  href={`/tokens/${result.mint}`}
                  className="rounded-lg bg-vault-accent px-6 py-2.5 text-sm font-semibold text-vault-bg transition-colors hover:bg-vault-accent-hover"
                >
                  View Token
                </Link>
                <button
                  onClick={() => {
                    setResult(null);
                    setName('');
                    setSymbol('');
                    setDescription('');
                    setImage('');
                    setImagePreview(null);
                    setTwitter('');
                    setTelegram('');
                    setWebsite('');
                    setInitialBuy('');
                  }}
                  className="rounded-lg border border-white/[0.06] px-6 py-2.5 text-sm font-semibold text-vault-text transition-colors hover:border-vault-accent/40"
                >
                  Create Another
                </button>
              </div>
            </div>
          ) : (
            /* ---- Form ---- */
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="rounded-lg border border-vault-red/30 bg-vault-red/5 p-4 text-sm text-vault-red">
                  {error}
                </div>
              )}

              {/* Token Name */}
              <div>
                <label className="mb-2 block text-sm font-medium text-vault-text">
                  Token Name <span className="text-vault-accent">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Solana Governance Token"
                  maxLength={32}
                  required
                  className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-vault-text placeholder-vault-dim outline-none transition-colors focus:border-vault-accent/40"
                />
                <div className="mt-1 text-xs text-vault-dim">{name.length}/32 characters</div>
              </div>

              {/* Symbol */}
              <div>
                <label className="mb-2 block text-sm font-medium text-vault-text">
                  Symbol <span className="text-vault-accent">*</span>
                </label>
                <input
                  type="text"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                  placeholder="SGT"
                  maxLength={10}
                  required
                  className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-4 py-3 uppercase text-vault-text placeholder-vault-dim outline-none transition-colors focus:border-vault-accent/40"
                />
                <div className="mt-1 text-xs text-vault-dim">{symbol.length}/10 characters</div>
              </div>

              {/* Description */}
              <div>
                <label className="mb-2 block text-sm font-medium text-vault-text">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the purpose, utility, and vision for your token"
                  rows={3}
                  className="w-full resize-none rounded-lg border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-vault-text placeholder-vault-dim outline-none transition-colors focus:border-vault-accent/40"
                />
              </div>

              {/* Image Upload */}
              <div>
                <label className="mb-2 block text-sm font-medium text-vault-text">Token Image</label>

                {imagePreview || image ? (
                  <div className="relative h-32 w-32 overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.03]">
                    <img
                      src={imagePreview || image}
                      alt="Token preview"
                      className="h-full w-full object-cover"
                    />
                    {uploading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-vault-bg/60">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-vault-accent border-t-transparent" />
                      </div>
                    )}
                    {!uploading && (
                      <button
                        type="button"
                        onClick={removeImage}
                        className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-vault-red text-xs text-white transition-colors hover:brightness-110"
                      >
                        x
                      </button>
                    )}
                  </div>
                ) : (
                  <div
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition ${
                      dragActive
                        ? 'border-vault-accent bg-vault-accent/5'
                        : 'border-white/[0.08] bg-white/[0.02] hover:border-white/[0.12]'
                    }`}
                  >
                    <svg className="mx-auto mb-2 h-8 w-8 text-vault-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.41a2.25 2.25 0 013.182 0l2.909 2.91m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>
                    <div className="text-sm text-vault-muted">
                      {dragActive ? 'Drop image here' : 'Drag & drop or click to upload'}
                    </div>
                    <div className="mt-1 text-xs text-vault-dim">PNG, JPG, GIF, WebP (max 5MB)</div>
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <div className="mt-3">
                  <div className="mb-2 text-xs text-vault-dim">Or paste image URL:</div>
                  <input
                    type="url"
                    value={image}
                    onChange={(e) => {
                      setImage(e.target.value);
                      setImagePreview(e.target.value);
                    }}
                    placeholder="https://..."
                    className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-4 py-2 text-sm text-vault-text placeholder-vault-dim outline-none transition-colors focus:border-vault-accent/40"
                  />
                </div>
              </div>

              {/* Social Links */}
              <div className="space-y-4">
                <label className="block text-sm font-medium text-vault-text">
                  Social Links <span className="font-normal text-vault-dim">(optional)</span>
                </label>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <div className="mb-1 text-xs text-vault-muted">X / Twitter</div>
                    <input
                      type="text"
                      value={twitter}
                      onChange={(e) => setTwitter(e.target.value)}
                      placeholder="@handle or https://x.com/..."
                      className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-vault-text placeholder-vault-dim outline-none transition-colors focus:border-vault-accent/40"
                    />
                  </div>

                  <div>
                    <div className="mb-1 text-xs text-vault-muted">Telegram</div>
                    <input
                      type="text"
                      value={telegram}
                      onChange={(e) => setTelegram(e.target.value)}
                      placeholder="@group or https://t.me/..."
                      className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-vault-text placeholder-vault-dim outline-none transition-colors focus:border-vault-accent/40"
                    />
                  </div>

                  <div>
                    <div className="mb-1 text-xs text-vault-muted">Website</div>
                    <input
                      type="text"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      placeholder="yourproject.io"
                      className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-vault-text placeholder-vault-dim outline-none transition-colors focus:border-vault-accent/40"
                    />
                  </div>
                </div>
              </div>

              {/* Initial Buy */}
              <div>
                <label className="mb-2 block text-sm font-medium text-vault-text">
                  Initial Buy <span className="font-normal text-vault-dim">(optional)</span>
                </label>
                <p className="mb-3 text-xs text-vault-muted">
                  Buy tokens with SOL when your token launches. You&apos;ll be the first holder.
                </p>
                <div className="mb-3 flex flex-wrap gap-2">
                  {['0', '0.1', '0.5', '1', '2', '5'].map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      onClick={() => setInitialBuy(amount === '0' ? '' : amount)}
                      className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                        (amount === '0' && !initialBuy) || initialBuy === amount
                          ? 'bg-vault-accent text-vault-bg'
                          : 'border border-white/[0.06] bg-white/[0.02] text-vault-muted hover:border-white/[0.1] hover:text-vault-text'
                      }`}
                    >
                      {amount === '0' ? 'None' : `${amount} SOL`}
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <input
                    type="number"
                    value={initialBuy}
                    onChange={(e) => setInitialBuy(e.target.value)}
                    placeholder="0.0"
                    step="0.01"
                    min="0"
                    max="100"
                    className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-4 py-3 pr-16 text-vault-text placeholder-vault-dim outline-none transition-colors focus:border-vault-accent/40"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 font-medium text-vault-muted">SOL</span>
                </div>
                {initialBuy && parseFloat(initialBuy) > 0 && (
                  <div className="mt-2 text-sm text-vault-green">
                    You&apos;ll buy ~{(parseFloat(initialBuy) / 0.000000028).toLocaleString(undefined, { maximumFractionDigits: 0 })} tokens at launch
                  </div>
                )}
              </div>

              {/* Token Parameters Info */}
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 text-sm">
                <div className="mb-2 font-medium text-vault-accent">Token Parameters</div>
                <ul className="space-y-1 text-vault-muted">
                  <li className="flex items-center gap-2">
                    <span className="h-1 w-1 rounded-full bg-vault-dim" />
                    Initial supply: 1,000,000,000 tokens
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="h-1 w-1 rounded-full bg-vault-dim" />
                    Starting price: ~0.000000028 SOL
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="h-1 w-1 rounded-full bg-vault-dim" />
                    Bonding curve: 1% fee (0.5% creator + 0.5% protocol)
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="h-1 w-1 rounded-full bg-vault-dim" />
                    Post-graduation: ~0.25% Raydium swap fee
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="h-1 w-1 rounded-full bg-vault-dim" />
                    Graduates to Raydium at ~120 SOL raised
                  </li>
                </ul>
                {/* Network status */}
                <div className="mt-3 flex items-center gap-2 border-t border-white/[0.04] pt-3">
                  {anchorAvailable === null ? (
                    <span className="text-xs text-vault-dim">Checking network...</span>
                  ) : anchorAvailable ? (
                    <>
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-vault-green" />
                      <span className="text-xs text-vault-green">
                        Solana {process.env.NEXT_PUBLIC_SOLANA_NETWORK === 'mainnet-beta' ? 'Mainnet' : 'Devnet'} (On-chain)
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      <span className="text-xs text-amber-400">Anchor program not deployed</span>
                    </>
                  )}
                </div>
              </div>

              {/* Submit */}
              {connected ? (
                <button
                  type="submit"
                  disabled={loading || uploading || !name || !symbol}
                  className="w-full rounded-xl bg-vault-accent py-4 font-semibold text-vault-bg transition-colors hover:bg-vault-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {loading ? (loadingStep || 'Creating...') : uploading ? 'Uploading image...' : 'Launch Token'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={connect}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] py-4 font-semibold text-vault-text transition-colors hover:border-vault-accent/30 hover:bg-white/[0.05]"
                >
                  <svg className="h-5 w-5" viewBox="0 0 200 180" fill="none">
                    <path fillRule="evenodd" clipRule="evenodd" d="M89.1138 112.613C83.1715 121.719 73.2139 133.243 59.9641 133.243C53.7005 133.243 47.6777 130.665 47.6775 119.464C47.677 90.9369 86.6235 46.777 122.76 46.7764C143.317 46.776 151.509 61.0389 151.509 77.2361C151.509 98.0264 138.018 121.799 124.608 121.799C120.352 121.799 118.264 119.462 118.264 115.756C118.264 114.789 118.424 113.741 118.746 112.613C114.168 120.429 105.335 127.683 97.0638 127.683C91.0411 127.683 87.9898 123.895 87.9897 118.576C87.9897 116.642 88.3912 114.628 89.1138 112.613ZM115.936 68.7103C112.665 68.7161 110.435 71.4952 110.442 75.4598C110.449 79.4244 112.689 82.275 115.96 82.2693C119.152 82.2636 121.381 79.4052 121.374 75.4405C121.367 71.4759 119.128 68.7047 115.936 68.7103ZM133.287 68.6914C130.016 68.6972 127.786 71.4763 127.793 75.4409C127.8 79.4055 130.039 82.2561 133.311 82.2504C136.503 82.2448 138.732 79.3863 138.725 75.4216C138.718 71.457 136.479 68.6858 133.287 68.6914Z" fill="currentColor"/>
                  </svg>
                  Connect Wallet to Launch
                </button>
              )}
            </form>
          )}
        </div>
      </section>

      <Footer />
    </main>
  );
}
