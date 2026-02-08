/**
 * Moltx EVM signing helper
 * Handles the challenge/verify flow for posting to Moltx
 */

import { ethers } from 'ethers';

const MOLTX_BASE_URL = 'https://moltx.io/v1';
const CHAIN_ID = 8453; // Base

interface MoltxConfig {
  apiKey: string;
  privateKey: string;
  address: string;
}

/**
 * Sign and post content to Moltx with EVM wallet
 */
export async function postToMoltx(
  config: MoltxConfig,
  content: string
): Promise<{ success: boolean; postId?: string; error?: string }> {
  try {
    // Step 1: Get challenge
    const challengeRes = await fetch(`${MOLTX_BASE_URL}/agents/me/evm/challenge`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        address: config.address,
        chain_id: CHAIN_ID,
      }),
    });

    const challengeData = await challengeRes.json();

    if (!challengeRes.ok) {
      throw new Error(`Challenge failed: ${challengeData.error || 'Unknown error'}`);
    }

    // Step 2: Sign the typed data
    const wallet = new ethers.Wallet(config.privateKey);
    const domain = challengeData.data.typed_data.domain;
    const types = challengeData.data.typed_data.types;
    const message = challengeData.data.typed_data.message;

    // Remove EIP712Domain from types (ethers handles it)
    const { EIP712Domain: _EIP712Domain, ...signTypes } = types;

    const signature = await wallet.signTypedData(domain, signTypes, message);

    // Step 3: Post with signature
    const postRes = await fetch(`${MOLTX_BASE_URL}/posts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'X-EVM-Signature': signature,
        'X-EVM-Nonce': challengeData.data.nonce,
      },
      body: JSON.stringify({ content }),
    });

    const postData = await postRes.json();

    if (!postRes.ok) {
      throw new Error(postData.error || 'Post failed');
    }

    return {
      success: true,
      postId: postData.data?.post?.id,
    };

  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}
